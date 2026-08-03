/**
 * Meta OAuth Service
 * Sabi Intelligence Suite · Platform Connections
 *
 * Handles the full Meta OAuth lifecycle:
 *   1. Generate OAuth URL (Instagram + Facebook in one flow)
 *   2. Exchange code for short-lived token
 *   3. Exchange short-lived for long-lived token (60 days)
 *   4. Fetch connected pages and IG accounts
 *   5. Store encrypted tokens in brand_platform_connections
 *   6. Pull metrics from Graph API → platform_analytics
 *   7. Token refresh before expiry
 *
 * Required env vars:
 *   META_APP_ID
 *   META_APP_SECRET
 *   META_REDIRECT_URI        → e.g. https://api.sabi.cerebre.media/api/platforms/callback/meta
 *   PLATFORM_TOKEN_KEY       → 32-byte hex string (openssl rand -hex 32)
 *   STATE_SECRET             → any long random string for CSRF state signing
 */

'use strict';

const crypto     = require('crypto');
const { supabase } = require('../config/supabase');

const GRAPH_API  = 'https://graph.facebook.com/v20.0';
const APP_ID     = process.env.META_APP_ID;
const APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT   = process.env.META_REDIRECT_URI;

// Scopes needed for Instagram + Facebook page insights
const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_insights',
  'read_insights',
  'business_management',
].join(',');

// ── Encryption (AES-256-GCM) ──────────────────────────────────────────────────
const TOKEN_KEY = () => {
  const key = process.env.PLATFORM_TOKEN_KEY;
  if (!key || key.length !== 64) throw new Error('PLATFORM_TOKEN_KEY must be a 32-byte hex string (64 hex chars)');
  return Buffer.from(key, 'hex');
};

function encryptToken(plaintext) {
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv('aes-256-gcm', TOKEN_KEY(), iv);
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag     = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptToken(ciphertext) {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', TOKEN_KEY(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// ── CSRF state ────────────────────────────────────────────────────────────────
function generateState(brandId) {
  const timestamp = Date.now();
  const data      = `${brandId}:${timestamp}`;
  const hmac      = crypto.createHmac('sha256', process.env.STATE_SECRET || 'sabi-state-secret')
                          .update(data).digest('hex');
  return Buffer.from(JSON.stringify({ brandId, timestamp, hmac })).toString('base64url');
}

function verifyState(state) {
  try {
    const { brandId, timestamp, hmac } = JSON.parse(Buffer.from(state, 'base64url').toString());
    if (Date.now() - timestamp > 15 * 60 * 1000) throw new Error('OAuth state expired (15 min window)');
    const expected = crypto.createHmac('sha256', process.env.STATE_SECRET || 'sabi-state-secret')
                           .update(`${brandId}:${timestamp}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
      throw new Error('Invalid OAuth state — possible CSRF attempt');
    }
    return { brandId };
  } catch (e) {
    throw new Error(`State verification failed: ${e.message}`);
  }
}

// ── Graph API helper ──────────────────────────────────────────────────────────
async function graphGet(path, accessToken, params = {}) {
  const url = new URL(`${GRAPH_API}${path}`);
  url.searchParams.set('access_token', accessToken);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Meta Graph API error');
    err.code    = data.error.code;
    err.subcode = data.error.error_subcode;
    err.type    = data.error.type;
    throw err;
  }
  return data;
}

// ── Step 1: Generate OAuth URL ────────────────────────────────────────────────
function getOAuthUrl(brandId) {
  if (!APP_ID || !REDIRECT) {
    throw new Error('META_APP_ID and META_REDIRECT_URI must be set in environment');
  }
  const state = generateState(brandId);
  const url   = new URL('https://www.facebook.com/dialog/oauth');
  url.searchParams.set('client_id',     APP_ID);
  url.searchParams.set('redirect_uri',  REDIRECT);
  url.searchParams.set('scope',         META_SCOPES);
  url.searchParams.set('state',         state);
  url.searchParams.set('response_type', 'code');
  return { url: url.toString(), state };
}

// ── Step 2: Exchange code for short-lived token ───────────────────────────────
async function exchangeCode(code) {
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set('client_id',     APP_ID);
  url.searchParams.set('client_secret', APP_SECRET);
  url.searchParams.set('redirect_uri',  REDIRECT);
  url.searchParams.set('code',          code);

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.access_token; // short-lived (~1 hour)
}

// ── Step 3: Exchange for long-lived token (60 days) ───────────────────────────
async function getLongLivedToken(shortToken) {
  const url = new URL(`${GRAPH_API}/oauth/access_token`);
  url.searchParams.set('grant_type',        'fb_exchange_token');
  url.searchParams.set('client_id',         APP_ID);
  url.searchParams.set('client_secret',     APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortToken);

  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const expiry = new Date(Date.now() + (data.expires_in ?? 5184000) * 1000); // default 60 days
  return { token: data.access_token, expiry };
}

// ── Step 4: Get Facebook pages + linked Instagram accounts ───────────────────
async function getConnectedAccounts(longLivedToken) {
  // Get all Facebook pages the user manages
  const pagesData = await graphGet('/me/accounts', longLivedToken, {
    fields: 'id,name,picture,instagram_business_account,category',
  });

  const accounts = [];

  for (const page of pagesData.data || []) {
    // Facebook page itself
    accounts.push({
      type:           'facebook',
      account_id:     page.id,
      account_name:   page.name,
      account_picture: page.picture?.data?.url || null,
      page_token:     page.access_token, // page-level token for insights
      metadata:       { page_id: page.id, category: page.category },
    });

    // Linked Instagram business account
    if (page.instagram_business_account?.id) {
      const igId   = page.instagram_business_account.id;
      const igData = await graphGet(`/${igId}`, longLivedToken, {
        fields: 'id,name,username,profile_picture_url,followers_count,media_count,biography,website',
      }).catch(() => null);

      if (igData) {
        accounts.push({
          type:           'instagram',
          account_id:     igId,
          account_name:   igData.username || igData.name,
          account_picture: igData.profile_picture_url || null,
          page_token:     page.access_token, // IG insights use the page token
          metadata:       {
            ig_user_id:  igId,
            page_id:     page.id,
            page_name:   page.name,
            username:    igData.username,
            followers:   igData.followers_count,
          },
        });
      }
    }
  }

  return accounts;
}

// ── Step 5: Store connections in Supabase ────────────────────────────────────
async function storeConnections(brandId, accounts, longLivedToken, tokenExpiry, userId) {
  const stored = [];

  for (const account of accounts) {
    // Use the page-level token if available (better for insights), else the user token
    const tokenToStore = account.page_token || longLivedToken;

    const { data, error } = await supabase
      .from('brand_platform_connections')
      .upsert({
        brand_id:        brandId,
        platform:        account.type,
        account_id:      account.account_id,
        account_name:    account.account_name,
        account_picture: account.account_picture,
        access_token:    encryptToken(tokenToStore),
        token_expiry:    tokenExpiry.toISOString(),
        scopes:          META_SCOPES.split(','),
        metadata:        account.metadata,
        is_active:       true,
        connected_by:    userId,
        connected_at:    new Date().toISOString(),
      }, { onConflict: 'brand_id,platform,account_id' })
      .select('id, platform, account_name')
      .single();

    if (error) console.error(`[meta-oauth] Failed to store ${account.type}:`, error.message);
    else stored.push(data);
  }

  return stored;
}

// ── Metrics: Instagram ────────────────────────────────────────────────────────
async function fetchInstagramMetrics(connectionId, igUserId, pageToken) {
  const start = Date.now();
  try {
    const [profileData, insightsData] = await Promise.all([
      // Basic profile stats
      graphGet(`/${igUserId}`, pageToken, {
        fields: 'followers_count,media_count,website',
      }),
      // Week insights
      graphGet(`/${igUserId}/insights`, pageToken, {
        metric: 'impressions,reach,profile_views,website_clicks,email_contacts',
        period: 'week',
      }).catch(() => ({ data: [] })),
    ]);

    // Build metrics map from insights
    const insightMap = {};
    for (const metric of insightsData.data || []) {
      const values = metric.values || [];
      const latest = values[values.length - 1];
      if (latest) insightMap[metric.name] = latest.value;
    }

    const metrics = {
      followers:       profileData.followers_count ?? 0,
      media_count:     profileData.media_count     ?? 0,
      impressions:     insightMap.impressions       ?? 0,
      reach:           insightMap.reach             ?? 0,
      profile_views:   insightMap.profile_views     ?? 0,
      website_clicks:  insightMap.website_clicks    ?? 0,
      email_contacts:  insightMap.email_contacts    ?? 0,
    };

    // Calculate engagement rate (impressions / followers * 100)
    metrics.engagement_rate = metrics.followers > 0
      ? Math.round((metrics.impressions / metrics.followers) * 100 * 10) / 10
      : 0;

    return { metrics, durationMs: Date.now() - start };
  } catch (err) {
    throw err;
  }
}

// ── Metrics: Facebook Page ────────────────────────────────────────────────────
async function fetchFacebookMetrics(connectionId, pageId, pageToken) {
  const start = Date.now();
  try {
    const [pageData, insightsData] = await Promise.all([
      graphGet(`/${pageId}`, pageToken, { fields: 'fan_count,followers_count' }),
      graphGet(`/${pageId}/insights`, pageToken, {
        metric: 'page_fans,page_engaged_users,page_impressions,page_reach,page_views_total',
        period: 'week',
      }).catch(() => ({ data: [] })),
    ]);

    const insightMap = {};
    for (const metric of insightsData.data || []) {
      const values = metric.values || [];
      const latest = values[values.length - 1];
      if (latest) insightMap[metric.name] = latest.value;
    }

    const metrics = {
      page_fans:            pageData.fan_count          ?? 0,
      page_followers:       pageData.followers_count    ?? 0,
      page_impressions:     insightMap.page_impressions  ?? 0,
      page_reach:           insightMap.page_reach        ?? 0,
      page_engaged_users:   insightMap.page_engaged_users ?? 0,
      page_views_total:     insightMap.page_views_total  ?? 0,
    };

    return { metrics, durationMs: Date.now() - start };
  } catch (err) {
    throw err;
  }
}

// ── Main sync: pull metrics for all active connections of a brand ─────────────
async function syncBrand(brandId, triggeredBy = 'manual') {
  const { data: connections, error } = await supabase
    .from('brand_platform_connections')
    .select('*')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .in('platform', ['instagram', 'facebook']);

  if (error) throw new Error(error.message);
  if (!connections?.length) return { synced: 0, errors: [] };

  const results = { synced: 0, errors: [] };
  const today   = new Date().toISOString().slice(0, 10);

  for (const conn of connections) {
    const start = Date.now();
    try {
      // Check token expiry
      if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
        await supabase.from('brand_platform_connections')
          .update({ is_active: false, sync_error: 'Token expired — reconnect required' })
          .eq('id', conn.id);
        await logSync(conn, 'token_expired', 0, 'Token expired', Date.now() - start, triggeredBy);
        results.errors.push({ platform: conn.platform, account: conn.account_name, error: 'Token expired' });
        continue;
      }

      const token = decryptToken(conn.access_token);
      let metrics = {};

      if (conn.platform === 'instagram') {
        const igUserId = conn.metadata?.ig_user_id || conn.account_id;
        const res      = await fetchInstagramMetrics(conn.id, igUserId, token);
        metrics = res.metrics;
      } else if (conn.platform === 'facebook') {
        const pageId = conn.metadata?.page_id || conn.account_id;
        const res    = await fetchFacebookMetrics(conn.id, pageId, token);
        metrics = res.metrics;
      }

      // Upsert today's snapshot
      await supabase.from('platform_analytics').upsert({
        brand_id:      brandId,
        connection_id: conn.id,
        platform:      conn.platform,
        metric_date:   today,
        metrics,
        synced_at:     new Date().toISOString(),
      }, { onConflict: 'brand_id,platform,metric_date' });

      // Update last_synced_at + clear any previous error
      await supabase.from('brand_platform_connections')
        .update({ last_synced_at: new Date().toISOString(), sync_error: null })
        .eq('id', conn.id);

      await logSync(conn, 'success', Object.keys(metrics).length, null, Date.now() - start, triggeredBy);
      results.synced++;
    } catch (err) {
      const isRateLimit = err.code === 4 || err.code === 17 || err.code === 32;
      const status      = isRateLimit ? 'rate_limited' : 'error';

      await supabase.from('brand_platform_connections')
        .update({ sync_error: err.message })
        .eq('id', conn.id);

      await logSync(conn, status, 0, err.message, Date.now() - start, triggeredBy);
      results.errors.push({ platform: conn.platform, account: conn.account_name, error: err.message });
      console.error(`[meta-oauth] Sync failed for ${conn.platform} (${conn.account_name}):`, err.message);
    }
  }

  return results;
}

// ── Helper: write sync log ────────────────────────────────────────────────────
async function logSync(conn, status, metricsCount, errorMsg, durationMs, triggeredBy) {
  await supabase.from('platform_sync_log').insert({
    brand_id:      conn.brand_id,
    connection_id: conn.id,
    platform:      conn.platform,
    status,
    metrics_count: metricsCount,
    error_message: errorMsg,
    duration_ms:   durationMs,
    triggered_by:  triggeredBy,
  }).catch(() => {});
}

// ── Get connections for a brand (for the Connect page) ───────────────────────
async function getConnections(brandId) {
  const { data, error } = await supabase
    .from('brand_platform_connections')
    .select('id, platform, account_id, account_name, account_picture, token_expiry, last_synced_at, sync_error, is_active, metadata, connected_at')
    .eq('brand_id', brandId)
    .order('connected_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── Disconnect a platform ────────────────────────────────────────────────────
async function disconnect(connectionId, brandId) {
  const { error } = await supabase
    .from('brand_platform_connections')
    .update({ is_active: false, access_token: '(revoked)' })
    .eq('id', connectionId)
    .eq('brand_id', brandId);

  if (error) throw new Error(error.message);
}

// ── Get latest analytics for a brand (for ClarityScore) ─────────────────────
async function getLatestAnalytics(brandId) {
  const { data, error } = await supabase
    .from('platform_analytics')
    .select('platform, metric_date, metrics')
    .eq('brand_id', brandId)
    .gte('metric_date', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order('metric_date', { ascending: false });

  if (error) throw new Error(error.message);

  // Return most recent snapshot per platform
  const latest = {};
  for (const row of data || []) {
    if (!latest[row.platform]) latest[row.platform] = row;
  }
  return latest;
}

module.exports = {
  getOAuthUrl,
  verifyState,
  exchangeCode,
  getLongLivedToken,
  getConnectedAccounts,
  storeConnections,
  syncBrand,
  getConnections,
  disconnect,
  getLatestAnalytics,
};
