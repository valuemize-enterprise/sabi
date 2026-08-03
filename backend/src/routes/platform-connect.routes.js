/**
 * Platform Connect Routes
 * Sabi Intelligence Suite · Meta OAuth
 *
 * Mount in server.js:
 *   const platformRouter = require('./routes/platform-connect.routes');
 *   app.use('/api/platforms', platformRouter);
 *
 * Endpoints:
 *   GET  /api/platforms/:brandId/connections    → list connections for a brand
 *   GET  /api/platforms/:brandId/connect/meta   → get Meta OAuth URL
 *   GET  /api/platforms/callback/meta           → OAuth callback (called by Meta)
 *   POST /api/platforms/:brandId/sync           → manual sync trigger
 *   DELETE /api/platforms/:brandId/connections/:connectionId → disconnect
 *   GET  /api/platforms/:brandId/analytics      → latest analytics snapshot
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate }   = require('../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../utils/response.utils');
const meta = require('../services/meta-oauth.service');

const BRAND_ADMIN_ROLES = new Set(['super_admin', 'admin', 'md', 'brand_admin']);

// ── Permission helper ─────────────────────────────────────────────────────────
function canManageBrand(req) {
  return BRAND_ADMIN_ROLES.has(req.user?.role);
}

// ── GET /api/platforms/:brandId/connections ──────────────────────────────────
// Returns all platform connections for the brand (no tokens — UI metadata only)
router.get('/:brandId/connections', authenticate, async (req, res, next) => {
  try {
    if (!canManageBrand(req)) return sendError(res, 403, 'Brand Admin or above required');
    const connections = await meta.getConnections(req.params.brandId);
    sendSuccess(res, { connections });
  } catch (err) { next(err); }
});

// ── GET /api/platforms/:brandId/connect/meta ─────────────────────────────────
// Returns the Meta OAuth URL for the Brand Admin to redirect to
router.get('/:brandId/connect/meta', authenticate, async (req, res, next) => {
  try {
    if (!canManageBrand(req)) return sendError(res, 403, 'Brand Admin or above required');
    const { url, state } = meta.getOAuthUrl(req.params.brandId);
    sendSuccess(res, { url, state });
  } catch (err) { next(err); }
});

// ── GET /api/platforms/callback/meta ─────────────────────────────────────────
// Meta redirects here after the user grants permissions.
// This is a browser redirect so it must redirect back to the frontend on completion.
router.get('/callback/meta', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (oauthError) {
    console.error('[platform-connect] Meta OAuth denied:', oauthError);
    return res.redirect(`${FRONTEND}/brands?connect_error=${encodeURIComponent(oauthError)}`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND}/brands?connect_error=missing_code`);
  }

  try {
    // 1. Verify CSRF state → extract brandId
    const { brandId } = meta.verifyState(state);

    // 2. Exchange code → short-lived token → long-lived token
    const shortToken             = await meta.exchangeCode(code);
    const { token, expiry }      = await meta.getLongLivedToken(shortToken);

    // 3. Discover connected pages and IG accounts
    const accounts = await meta.getConnectedAccounts(token);

    if (!accounts.length) {
      return res.redirect(`${FRONTEND}/brands/${brandId}/connect?connect_error=no_pages_found`);
    }

    // 4. Store connections — we don't have req.user in a redirect callback,
    //    so we pass null for userId. The state already proves intent.
    const stored = await meta.storeConnections(brandId, accounts, token, expiry, null);

    // 5. Trigger an immediate sync so data shows right away
    meta.syncBrand(brandId, 'post_connect').catch(err =>
      console.error('[platform-connect] Post-connect sync failed:', err.message)
    );

    const count = stored.length;
    return res.redirect(
      `${FRONTEND}/brands/${brandId}/connect?connect_success=1&count=${count}`
    );
  } catch (err) {
    console.error('[platform-connect] Callback failed:', err.message);
    return res.redirect(
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/brands?connect_error=${encodeURIComponent(err.message)}`
    );
  }
});

// ── POST /api/platforms/:brandId/sync ────────────────────────────────────────
// Manual sync trigger — Brand Admin or above
router.post('/:brandId/sync', authenticate, async (req, res, next) => {
  try {
    if (!canManageBrand(req)) return sendError(res, 403, 'Brand Admin or above required');
    const results = await meta.syncBrand(req.params.brandId, 'manual');
    sendSuccess(res, results, `Synced ${results.synced} platform${results.synced !== 1 ? 's' : ''}`);
  } catch (err) { next(err); }
});

// ── DELETE /api/platforms/:brandId/connections/:connectionId ─────────────────
// Disconnect a platform
router.delete('/:brandId/connections/:connectionId', authenticate, async (req, res, next) => {
  try {
    if (!canManageBrand(req)) return sendError(res, 403, 'Brand Admin or above required');
    await meta.disconnect(req.params.connectionId, req.params.brandId);
    sendSuccess(res, {}, 'Platform disconnected');
  } catch (err) { next(err); }
});

// ── GET /api/platforms/:brandId/analytics ────────────────────────────────────
// Returns latest analytics snapshot for ClarityScore and the Connect page
router.get('/:brandId/analytics', authenticate, async (req, res, next) => {
  try {
    if (!canManageBrand(req)) return sendError(res, 403, 'Brand Admin or above required');
    const analytics = await meta.getLatestAnalytics(req.params.brandId);
    sendSuccess(res, { analytics });
  } catch (err) { next(err); }
});

module.exports = router;
