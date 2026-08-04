// ═══════════════════════════════════════════════════════════════════
// book-of-deals.service.js
// Sabi Intelligence Suite — Phase F
//
// Powers all three layers of Book of Deals:
//   Layer 1 — My Deals (all staff, own data)
//   Layer 2 — Full Book (Super Admin + deal_book_full_access)
//   Layer 3 — Pursuit Board (all staff, no amounts)
//
// logDeal() auto-creates a Pipeline opportunity on submission,
// stamping business_bringer_id = the submitting user.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query }   = require('../db/db');
const supabase    = require('../config/supabase');

// ── Helpers ───────────────────────────────────────────────────────

const quarterStart = () => {
  const now = new Date();
  const q   = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
};

const yearStart = () => `${new Date().getFullYear()}-01-01`;

// ── Layer 1 — My Deals ────────────────────────────────────────────
// Returns all opportunities where the calling user is business_bringer.

const getMyDeals = async (userId) => {
  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      id, company_name, deal_title, stage, stage_changed_at,
      deal_type, service_scope, industry, deck_url,
      retainer_monthly_amount, retainer_duration_months,
      campaign_total_amount, estimated_value,
      contact_name, contact_position,
      created_at, updated_at,
      account_manager:users!account_manager_id ( id, full_name, role )
    `)
    .eq('business_bringer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};

// ── My Stats ──────────────────────────────────────────────────────

const getMyStats = async (userId) => {
  const result = await query(
    `SELECT
       COUNT(*)                                                        AS total_pitched,
       COUNT(*) FILTER (WHERE stage IN ('agreement','onboarded'))     AS total_won,
       COUNT(*) FILTER (WHERE stage NOT IN ('onboarded','lost_paused','agreement')) AS active_pipeline,
       ROUND(
         AVG(EXTRACT(EPOCH FROM (stage_changed_at - created_at)) / 86400)
         FILTER (WHERE stage IN ('agreement','onboarded'))::numeric
       , 1)                                                            AS avg_close_days,
       COALESCE(SUM(
         CASE deal_type
           WHEN 'retainer' THEN COALESCE(retainer_monthly_amount * COALESCE(retainer_duration_months,12), 0)
           WHEN 'campaign'  THEN COALESCE(campaign_total_amount, 0)
           ELSE COALESCE(estimated_value, 0)
         END
       ) FILTER (WHERE stage IN ('agreement','onboarded')), 0)        AS attributed_revenue
     FROM opportunities
     WHERE business_bringer_id = $1`,
    [userId]
  ).catch(() => ({ rows: [{}] }));

  const r = result.rows[0] || {};
  const pitched = Number(r.total_pitched  || 0);
  const won     = Number(r.total_won      || 0);

  return {
    total_pitched:    pitched,
    total_won:        won,
    active_pipeline:  Number(r.active_pipeline    || 0),
    conversion_rate:  pitched > 0 ? Math.round((won / pitched) * 100) : 0,
    avg_close_days:   r.avg_close_days ? Number(r.avg_close_days) : null,
    attributed_revenue: Number(r.attributed_revenue || 0),
  };
};

// ── Log a Deal ────────────────────────────────────────────────────
// Creates a Pipeline opportunity at the given stage.
// business_bringer_id = the submitting user — always stamped here.

const logDeal = async (userId, payload) => {
  const {
    company_name, contact_name, contact_position, contact_email, contact_phone,
    deal_type, service_scope, industry, stage = 'introduction',
    estimated_value, retainer_monthly_amount, retainer_start_date, retainer_duration_months,
    campaign_name, campaign_goals, campaign_start_date, campaign_end_date, campaign_total_amount,
    deck_url, notes, account_manager_id,
  } = payload;

  if (!company_name?.trim()) {
    throw Object.assign(new Error('company_name is required'), { status: 400 });
  }

  const VALID_STAGES = [
    'introduction', 'proposal', 'pitch', 'second_pitch', 'decision',
  ];
  const finalStage = VALID_STAGES.includes(stage) ? stage : 'introduction';

  const { data: opp, error } = await supabase
    .from('opportunities')
    .insert({
      company_name:              company_name.trim(),
      stage:                     finalStage,
      stage_changed_at:          new Date().toISOString(),
      business_bringer_id:       userId,
      account_manager_id:        account_manager_id || null,
      contact_name:              contact_name    || null,
      contact_position:          contact_position || null,
      contact_email:             contact_email   || null,
      contact_phone:             contact_phone   || null,
      deal_type:                 deal_type       || null,
      service_scope:             service_scope?.length ? service_scope : null,
      industry:                  industry        || null,
      deck_url:                  deck_url        || null,
      notes:                     notes           || null,
      estimated_value:           estimated_value || null,
      retainer_monthly_amount:   retainer_monthly_amount  || null,
      retainer_start_date:       retainer_start_date      || null,
      retainer_duration_months:  retainer_duration_months || null,
      campaign_name:             campaign_name   || null,
      campaign_goals:            campaign_goals  || null,
      campaign_start_date:       campaign_start_date || null,
      campaign_end_date:         campaign_end_date   || null,
      campaign_total_amount:     campaign_total_amount || null,
      created_at:                new Date().toISOString(),
      updated_at:                new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to log deal: ${error.message}`);
  return opp;
};

// ── Layer 2 — Full Book (Super Admin + assigned users) ────────────

const getFullBook = async ({ stage, deal_type, bringer_id, search } = {}) => {
  let q = supabase
    .from('opportunities')
    .select(`
      id, company_name, deal_title, stage, stage_changed_at,
      deal_type, service_scope, industry, deck_url,
      retainer_monthly_amount, retainer_duration_months,
      campaign_total_amount, estimated_value,
      contact_name, contact_position, contact_email, contact_phone,
      notes, created_at, updated_at,
      business_bringer:users!business_bringer_id ( id, full_name, role ),
      account_manager:users!account_manager_id   ( id, full_name, role )
    `);

  if (stage)      q = q.eq('stage', stage);
  if (deal_type)  q = q.eq('deal_type', deal_type);
  if (bringer_id) q = q.eq('business_bringer_id', bringer_id);
  if (search)     q = q.ilike('company_name', `%${search}%`);

  // Only include deals with a business_bringer (logged via Book of Deals or with attribution)
  q = q.not('business_bringer_id', 'is', null);
  q = q.order('created_at', { ascending: false });

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
};

// ── Layer 3 — Pursuit Board ───────────────────────────────────────
// Three separate rankings, each paginated to 10 entries.
// NO financial amounts are returned — Pursuit Board is public.

const getPursuitBoard = async (period = 'quarter') => {
  const since = period === 'quarter' ? quarterStart() : yearStart();

  const [convertedRes, activeRes, fastestRes] = await Promise.all([

    // Ranking 1: Most Deals Converted
    query(
      `SELECT
         u.id, u.full_name, u.role,
         COUNT(*)                                                      AS converted_count,
         ARRAY_AGG(DISTINCT o.company_name ORDER BY o.company_name)
           FILTER (WHERE o.stage IN ('agreement','onboarded'))        AS companies,
         ARRAY_AGG(DISTINCT o.service_scope[1])
           FILTER (WHERE o.service_scope IS NOT NULL)                 AS scopes
       FROM opportunities o
       JOIN users u ON u.id = o.business_bringer_id
       WHERE o.stage IN ('agreement', 'onboarded')
         AND o.stage_changed_at >= $1
         AND o.business_bringer_id IS NOT NULL
       GROUP BY u.id, u.full_name, u.role
       ORDER BY converted_count DESC
       LIMIT 10`,
      [since]
    ).catch(() => ({ rows: [] })),

    // Ranking 2: Most Active Pipeline
    query(
      `SELECT
         u.id, u.full_name, u.role,
         COUNT(*)                                                      AS active_count,
         ARRAY_AGG(DISTINCT o.company_name ORDER BY o.company_name)  AS companies,
         ARRAY_AGG(DISTINCT o.stage)                                  AS stages
       FROM opportunities o
       JOIN users u ON u.id = o.business_bringer_id
       WHERE o.stage NOT IN ('onboarded', 'agreement', 'lost_paused')
         AND o.business_bringer_id IS NOT NULL
       GROUP BY u.id, u.full_name, u.role
       ORDER BY active_count DESC
       LIMIT 10`,
      []
    ).catch(() => ({ rows: [] })),

    // Ranking 3: Fastest Close (min 2 converted deals to qualify)
    query(
      `SELECT
         u.id, u.full_name, u.role,
         COUNT(*)                                                       AS closed_count,
         ROUND(
           AVG(
             EXTRACT(EPOCH FROM (o.stage_changed_at - o.created_at)) / 86400
           )::numeric
         , 0)                                                           AS avg_close_days,
         ARRAY_AGG(DISTINCT o.company_name ORDER BY o.company_name)
           FILTER (WHERE o.stage IN ('agreement','onboarded'))         AS companies
       FROM opportunities o
       JOIN users u ON u.id = o.business_bringer_id
       WHERE o.stage IN ('agreement', 'onboarded')
         AND o.business_bringer_id IS NOT NULL
         AND o.stage_changed_at IS NOT NULL
       GROUP BY u.id, u.full_name, u.role
       HAVING COUNT(*) >= 2
       ORDER BY avg_close_days ASC
       LIMIT 10`,
      []
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    period,
    since,
    converted: convertedRes.rows.map((r, i) => ({
      rank:           i + 1,
      id:             r.id,
      full_name:      r.full_name,
      role:           r.role,
      converted_count: Number(r.converted_count || 0),
      companies:      r.companies || [],
    })),
    active: activeRes.rows.map((r, i) => ({
      rank:        i + 1,
      id:          r.id,
      full_name:   r.full_name,
      role:        r.role,
      active_count: Number(r.active_count || 0),
      companies:   r.companies || [],
      stages:      r.stages    || [],
    })),
    fastest: fastestRes.rows.map((r, i) => ({
      rank:           i + 1,
      id:             r.id,
      full_name:      r.full_name,
      role:           r.role,
      avg_close_days: Number(r.avg_close_days || 0),
      closed_count:   Number(r.closed_count   || 0),
      companies:      r.companies || [],
    })),
  };
};

// ── Agency new business progress ──────────────────────────────────
// Feeds the progress bar at the top of Book of Deals.

const getAgencyProgress = async () => {
  const [dealResult, targetResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE stage IN ('agreement','onboarded')
           AND stage_changed_at >= $1)                               AS onboarded_this_year,
         COUNT(*) FILTER (WHERE stage NOT IN ('onboarded','lost_paused','agreement')) AS active_pipeline,
         COALESCE(SUM(
           CASE deal_type
             WHEN 'retainer' THEN COALESCE(retainer_monthly_amount * COALESCE(retainer_duration_months,12), 0)
             WHEN 'campaign'  THEN COALESCE(campaign_total_amount, 0)
             ELSE COALESCE(estimated_value, 0)
           END
         ) FILTER (WHERE stage IN ('agreement','onboarded')
           AND stage_changed_at >= $1), 0)                          AS revenue_this_year
       FROM opportunities
       WHERE business_bringer_id IS NOT NULL`,
      [yearStart()]
    ).catch(() => ({ rows: [{}] })),

    // Fetch configured targets
    (async () => {
      try {
        const { data } = await supabase
          .from('agency_targets')
          .select('title, target_value, unit')
          .eq('category', 'new_business')
          .eq('status', 'active');
        return { data };
      } catch { return { data: [] }; }
    })(),
  ]);

  const d = dealResult.rows[0] || {};
  const targets = targetResult.data || [];

  const clientTarget  = Number(targets.find(t => /client/i.test(t.title))?.target_value || 0);
  const revenueTarget = Number(targets.find(t => /revenue/i.test(t.title))?.target_value || 0);
  const onboarded     = Number(d.onboarded_this_year || 0);
  const revenue       = Number(d.revenue_this_year   || 0);
  const pipeline      = Number(d.active_pipeline     || 0);

  return {
    onboarded_this_year:  onboarded,
    client_target:        clientTarget,
    client_pct:           clientTarget > 0 ? Math.min(100, Math.round((onboarded / clientTarget) * 100)) : null,
    revenue_this_year:    revenue,
    revenue_target:       revenueTarget,
    revenue_pct:          revenueTarget > 0 ? Math.min(100, Math.round((revenue / revenueTarget) * 100)) : null,
    active_pipeline:      pipeline,
    year:                 new Date().getFullYear(),
  };
};

// ── Pursuit Board dashboard widget (compact) ──────────────────────
// Lightweight version for the staff homepage — top 3 active + totals.

const getPursuitBoardWidget = async () => {
  const [topResult, totalResult] = await Promise.all([
    query(
      `SELECT u.full_name, COUNT(*) AS deal_count
       FROM opportunities o
       JOIN users u ON u.id = o.business_bringer_id
       WHERE o.stage NOT IN ('onboarded','lost_paused','agreement')
         AND o.business_bringer_id IS NOT NULL
       GROUP BY u.id, u.full_name
       ORDER BY deal_count DESC
       LIMIT 3`,
      []
    ).catch(() => ({ rows: [] })),

    query(
      `SELECT COUNT(*) AS total FROM opportunities
       WHERE stage NOT IN ('onboarded','lost_paused','agreement')
         AND business_bringer_id IS NOT NULL`
    ).catch(() => ({ rows: [{ total: 0 }] })),
  ]);

  return {
    top_chasers: topResult.rows.map(r => ({
      full_name:  r.full_name,
      deal_count: Number(r.deal_count || 0),
    })),
    total_active: Number(totalResult.rows[0]?.total || 0),
  };
};

// ── Toggle deal_book_full_access ──────────────────────────────────

const toggleFullAccess = async (targetUserId, grantAccess) => {
  const { data, error } = await supabase
    .from('users')
    .update({ deal_book_full_access: grantAccess, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
    .select('id, full_name, role, deal_book_full_access')
    .single();
  if (error) throw new Error(error.message);
  return data;
};

module.exports = {
  getMyDeals,
  getMyStats,
  logDeal,
  getFullBook,
  getPursuitBoard,
  getPursuitBoardWidget,
  getAgencyProgress,
  toggleFullAccess,
};
