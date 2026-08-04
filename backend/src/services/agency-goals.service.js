// ═══════════════════════════════════════════════════════════════════
// agency-goals.service.js
// Sabi Intelligence Suite — Phase B: Agency Goals Master Framework
//
// Computes all 6 goal categories from live Sabi data.
// Each category function is independently try/catch'd — one broken
// query never kills the whole response.
//
// Goal categories:
//   1. new_business      — Pipeline + Book of Deals
//   2. revenue           — Invoices + Payments
//   3. client_health     — Satisfaction ratings + ClarityScore
//   4. delivery          — Task verification rates
//   5. people_perf       — Staff scoring + Contribution claims
//   6. hr_workforce      — People OS + Vacancies + Internships
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query } = require('../db/db');

// ── Helpers ───────────────────────────────────────────────────────

const currentYear  = () => new Date().getFullYear();
const currentQuarterStart = () => {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  return new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0];
};
const yearStart = () => `${currentYear()}-01-01`;
const fmtN = v => `₦${Number(v || 0).toLocaleString('en-NG')}`;
const round1 = v => Math.round(Number(v || 0) * 10) / 10;
const pct = (curr, tgt) => tgt > 0 ? Math.min(100, Math.round((curr / tgt) * 100)) : 0;

const healthFromPct = (p) => p >= 70 ? 'green' : p >= 40 ? 'amber' : 'red';

// Fallback row when a query fails
const fallback = (id, label, icon, err) => ({
  id, label, icon,
  health: 'amber',
  error:  err?.message || 'Data unavailable',
  primary:     { label: 'Error', current: 0, target: 0, unit: '', pct: 0 },
  secondaries: [],
  week_delta:  null,
});

// ── Fetch configured targets from agency_targets ──────────────────

const getTargets = async () => {
  const result = await query(
    `SELECT id, title, category, target_value, unit, period_label
     FROM agency_targets
     WHERE status = 'active'
       AND period_label = $1`,
    [String(currentYear())]
  ).catch(() => ({ rows: [] }));

  // Index by category for easy lookup
  const byCategory = {};
  for (const row of result.rows) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push(row);
  }
  return byCategory;
};

// ── 1. New Business ───────────────────────────────────────────────

const getNewBusiness = async (targets = {}) => {
  const myTargets = targets.new_business || [];

  const [onboardedResult, pipelineResult, pitchResult] = await Promise.all([
    // Clients onboarded this year
    query(
      `SELECT
         COUNT(*) AS onboarded_count,
         COALESCE(SUM(retainer_monthly_amount * COALESCE(retainer_duration_months, 12)),0) AS retainer_value,
         COALESCE(SUM(campaign_total_amount), 0) AS campaign_value
       FROM opportunities
       WHERE stage = 'onboarded'
         AND stage_changed_at >= $1`,
      [yearStart()]
    ).catch(() => ({ rows: [{}] })),

    // Active pipeline value
    query(
      `SELECT
         COUNT(*) AS active_deals,
         COALESCE(SUM(
           CASE deal_type
             WHEN 'retainer' THEN COALESCE(retainer_monthly_amount * COALESCE(retainer_duration_months,12), 0)
             WHEN 'campaign'  THEN COALESCE(campaign_total_amount, 0)
             ELSE COALESCE(estimated_value, 0)
           END
         ), 0) AS pipeline_value
       FROM opportunities
       WHERE stage NOT IN ('onboarded','lost_paused')`
    ).catch(() => ({ rows: [{}] })),

    // Pitches this quarter
    query(
      `SELECT COUNT(*) AS pitch_count
       FROM opportunities
       WHERE stage != 'introduction'
         AND created_at >= $1`,
      [currentQuarterStart()]
    ).catch(() => ({ rows: [{}] })),
  ]);

  const o   = onboardedResult.rows[0] || {};
  const p   = pipelineResult.rows[0]  || {};
  const pit = pitchResult.rows[0]     || {};

  const onboardedCount = Number(o.onboarded_count  || 0);
  const retainerVal    = Number(o.retainer_value    || 0);
  const campaignVal    = Number(o.campaign_value    || 0);
  const totalNewRev    = retainerVal + campaignVal;
  const pipelineVal    = Number(p.pipeline_value    || 0);
  const pitchCount     = Number(pit.pitch_count     || 0);

  // Targets (first match per sub-goal — MD sets these in Settings)
  const clientTarget   = Number(myTargets.find(t => /client/i.test(t.title))?.target_value || 0);
  const revenueTarget  = Number(myTargets.find(t => /revenue/i.test(t.title))?.target_value || 0);
  const pitchTarget    = Number(myTargets.find(t => /pitch/i.test(t.title))?.target_value  || 0);

  const clientPct  = pct(onboardedCount, clientTarget);
  const revPct     = pct(totalNewRev,    revenueTarget);
  const pitchPct   = pct(pitchCount,     pitchTarget);

  const overallPct = clientTarget > 0 ? clientPct
                   : revPct > 0       ? revPct
                   : 0;

  return {
    id:    'new_business',
    label: 'New Business',
    icon:  '🎯',
    health: healthFromPct(overallPct),
    primary: {
      label:   'New clients onboarded this year',
      current: onboardedCount,
      target:  clientTarget,
      unit:    'clients',
      pct:     clientPct,
      display: clientTarget > 0
        ? `${onboardedCount} of ${clientTarget}`
        : String(onboardedCount),
    },
    secondaries: [
      {
        label:   'New retainer + campaign revenue',
        current: totalNewRev,
        target:  revenueTarget,
        unit:    '₦',
        pct:     revPct,
        display: `${fmtN(totalNewRev)}${revenueTarget > 0 ? ` of ${fmtN(revenueTarget)}` : ''}`,
      },
      {
        label:   'Active pipeline value',
        current: pipelineVal,
        target:  null,
        unit:    '₦',
        pct:     null,
        display: fmtN(pipelineVal),
        sub:     `${Number(p.active_deals || 0)} deals in progress`,
      },
      {
        label:   'Pitches made this quarter',
        current: pitchCount,
        target:  pitchTarget,
        unit:    'pitches',
        pct:     pitchPct,
        display: pitchTarget > 0
          ? `${pitchCount} of ${pitchTarget}`
          : String(pitchCount),
      },
    ],
    raw: { onboardedCount, totalNewRev, pipelineVal, pitchCount },
  };
};

// ── 2. Revenue ────────────────────────────────────────────────────

const getRevenue = async (targets = {}) => {
  const myTargets = targets.revenue || [];

  const [collected, outstanding] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM invoices
       WHERE status = 'paid' AND created_at >= $1`,
      [yearStart()]
    ).catch(() => ({ rows: [{ total: 0 }] })),

    query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status IN ('sent','overdue')), 0) AS outstanding,
         COALESCE(SUM(amount), 0) AS total_invoiced
       FROM invoices
       WHERE created_at >= $1`,
      [yearStart()]
    ).catch(() => ({ rows: [{ outstanding: 0, total_invoiced: 0 }] })),
  ]);

  const totalCollected  = Number(collected.rows[0]?.total         || 0);
  const totalOutstanding = Number(outstanding.rows[0]?.outstanding  || 0);
  const totalInvoiced    = Number(outstanding.rows[0]?.total_invoiced || 0);
  const collectionRate   = totalInvoiced > 0
    ? Math.round((totalCollected / totalInvoiced) * 100)
    : 0;

  const collectTarget = Number(myTargets.find(t => /collect/i.test(t.title))?.target_value || 0);
  const rateTarget    = Number(myTargets.find(t => /rate/i.test(t.title))?.target_value    || 85);

  const collectPct = pct(totalCollected, collectTarget);
  const overallPct = collectTarget > 0 ? collectPct : collectionRate;

  return {
    id:    'revenue',
    label: 'Revenue',
    icon:  '💰',
    health: healthFromPct(overallPct),
    primary: {
      label:   'Collected this year',
      current: totalCollected,
      target:  collectTarget,
      unit:    '₦',
      pct:     collectPct,
      display: `${fmtN(totalCollected)}${collectTarget > 0 ? ` of ${fmtN(collectTarget)}` : ''}`,
    },
    secondaries: [
      {
        label:   'Invoice collection rate',
        current: collectionRate,
        target:  rateTarget,
        unit:    '%',
        pct:     pct(collectionRate, rateTarget),
        display: `${collectionRate}%`,
      },
      {
        label:   'Outstanding invoices',
        current: totalOutstanding,
        target:  null,
        unit:    '₦',
        pct:     null,
        display: fmtN(totalOutstanding),
        sub:     totalOutstanding > 0 ? 'Awaiting payment' : 'All cleared',
        alert:   totalOutstanding > 0,
      },
    ],
    raw: { totalCollected, totalOutstanding, totalInvoiced, collectionRate },
  };
};

// ── 3. Client Health ──────────────────────────────────────────────

const getClientHealth = async (targets = {}) => {
  const myTargets = targets.client_health || [];

  const [satResult, clarityResult, churnResult] = await Promise.all([
    query(
      `SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS rating_count
       FROM client_satisfaction_ratings
       WHERE created_at >= $1`,
      [currentQuarterStart()]
    ).catch(() => ({ rows: [{}] })),

    query(
      `SELECT ROUND(AVG(score)::numeric, 0) AS avg_clarity
       FROM brand_clarity_scores
       WHERE week_start = (SELECT MAX(week_start) FROM brand_clarity_scores)`
    ).catch(() => ({ rows: [{}] })),

    query(
      `SELECT COUNT(*) AS churned
       FROM brands
       WHERE status = 'inactive'
         AND updated_at >= $1`,
      [yearStart()]
    ).catch(() => ({ rows: [{}] })),
  ]);

  const avgRating  = round1(satResult.rows[0]?.avg_rating   || 0);
  const ratingCount = Number(satResult.rows[0]?.rating_count || 0);
  const avgClarity = Number(clarityResult.rows[0]?.avg_clarity || 0);
  const churnCount = Number(churnResult.rows[0]?.churned       || 0);

  const satTarget     = Number(myTargets.find(t => /satisf/i.test(t.title))?.target_value || 4.0);
  const clarityTarget = Number(myTargets.find(t => /clarity/i.test(t.title))?.target_value || 700);

  const satPct     = pct(avgRating, satTarget) ;
  const overallPct = satPct;

  return {
    id:    'client_health',
    label: 'Client Health',
    icon:  '⭐',
    health: churnCount > 0 ? 'red' : healthFromPct(overallPct),
    primary: {
      label:   'Avg client satisfaction this quarter',
      current: avgRating,
      target:  satTarget,
      unit:    '/5',
      pct:     satPct,
      display: avgRating > 0 ? `${avgRating}/5` : '—',
      sub:     ratingCount > 0 ? `${ratingCount} rating${ratingCount !== 1 ? 's' : ''}` : 'No ratings yet',
    },
    secondaries: [
      {
        label:   'Avg ClarityScore™ across all brands',
        current: avgClarity,
        target:  clarityTarget,
        unit:    '',
        pct:     pct(avgClarity, clarityTarget),
        display: avgClarity > 0 ? String(avgClarity) : '—',
      },
      {
        label:   'Client churn this year',
        current: churnCount,
        target:  0,
        unit:    'clients',
        pct:     churnCount === 0 ? 100 : 0,
        display: churnCount === 0 ? 'Zero — on target' : `${churnCount} lost`,
        alert:   churnCount > 0,
      },
    ],
    raw: { avgRating, avgClarity, churnCount },
  };
};

// ── 4. Delivery ───────────────────────────────────────────────────

const getDelivery = async (targets = {}) => {
  const myTargets = targets.delivery || [];

  const [taskResult, overdueResult, reviewResult] = await Promise.all([
    // On-time verification this quarter
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'verified')                               AS verified,
         COUNT(*) FILTER (WHERE due_date >= $1 AND status = 'verified'
                           AND verified_at <= due_date + INTERVAL '1 day')        AS on_time,
         COUNT(*) FILTER (WHERE due_date >= $1)                                   AS total_due
       FROM tasks
       WHERE due_date >= $1`,
      [currentQuarterStart()]
    ).catch(() => ({ rows: [{}] })),

    // Overdue unverified tasks
    query(
      `SELECT COUNT(*) AS overdue_unverified
       FROM tasks
       WHERE status NOT IN ('verified','done')
         AND due_date < NOW()`
    ).catch(() => ({ rows: [{}] })),

    // Creative Review Queue
    query(
      `SELECT COUNT(*) AS pending_review
       FROM tasks
       WHERE status IN ('in_review','pending_creative_review')`
    ).catch(() => ({ rows: [{}] })),
  ]);

  const t          = taskResult.rows[0]  || {};
  const onTime     = Number(t.on_time    || 0);
  const totalDue   = Number(t.total_due  || 0);
  const onTimePct  = totalDue > 0 ? Math.round((onTime / totalDue) * 100) : 0;
  const overdue    = Number(overdueResult.rows[0]?.overdue_unverified || 0);
  const inReview   = Number(reviewResult.rows[0]?.pending_review      || 0);

  const taskTarget = Number(myTargets.find(t => /task|complet/i.test(t.title))?.target_value || 85);
  const overallPct = onTimePct;

  return {
    id:    'delivery',
    label: 'Delivery',
    icon:  '⚡',
    health: healthFromPct(overallPct),
    primary: {
      label:   'On-time task completion rate',
      current: onTimePct,
      target:  taskTarget,
      unit:    '%',
      pct:     pct(onTimePct, taskTarget),
      display: `${onTimePct}%`,
      sub:     `${onTime} of ${totalDue} tasks verified on time this quarter`,
    },
    secondaries: [
      {
        label:   'Overdue unverified tasks',
        current: overdue,
        target:  0,
        unit:    'tasks',
        pct:     overdue === 0 ? 100 : 0,
        display: overdue === 0 ? 'None — queue clear' : `${overdue} overdue`,
        alert:   overdue > 0,
      },
      {
        label:   'Creative Review queue',
        current: inReview,
        target:  null,
        unit:    'items',
        pct:     null,
        display: inReview === 0 ? 'Queue clear' : `${inReview} pending`,
        alert:   inReview > 5,
      },
    ],
    raw: { onTimePct, totalDue, onTime, overdue, inReview },
  };
};

// ── 5. People Performance ─────────────────────────────────────────

const getPeoplePerformance = async (targets = {}) => {
  const myTargets = targets.people_perf || [];

  const [scoreResult, atRiskResult, claimsResult] = await Promise.all([
    query(
      `SELECT ROUND(AVG(rolling_avg)::numeric, 1) AS agency_avg
       FROM weekly_scores
       WHERE week_start = (SELECT MAX(week_start) FROM weekly_scores)`
    ).catch(() => ({ rows: [{}] })),

    // Staff below floor score for 3+ consecutive weeks
    query(
      `SELECT COUNT(DISTINCT user_id) AS at_risk
       FROM (
         SELECT user_id, COUNT(*) FILTER (WHERE rolling_avg < 60) AS low_weeks
         FROM weekly_scores
         WHERE week_start >= NOW() - INTERVAL '3 weeks'
         GROUP BY user_id
         HAVING COUNT(*) FILTER (WHERE rolling_avg < 60) >= 3
       ) sub`
    ).catch(() => ({ rows: [{}] })),

    // Contribution claims approved this month
    query(
      `SELECT COUNT(*) AS approved_count
       FROM contribution_claims
       WHERE status = 'approved'
         AND updated_at >= DATE_TRUNC('month', NOW())`
    ).catch(() => ({ rows: [{}] })),
  ]);

  const agencyAvg   = round1(scoreResult.rows[0]?.agency_avg   || 0);
  const atRisk      = Number(atRiskResult.rows[0]?.at_risk      || 0);
  const claimsCount = Number(claimsResult.rows[0]?.approved_count || 0);

  const scoreTarget  = Number(myTargets.find(t => /score/i.test(t.title))?.target_value || 80);
  const claimsTarget = Number(myTargets.find(t => /claim/i.test(t.title))?.target_value || 0);

  const scorePct   = pct(agencyAvg, scoreTarget);
  const overallPct = scorePct;

  return {
    id:    'people_perf',
    label: 'People Performance',
    icon:  '👥',
    health: atRisk > 0 ? (atRisk >= 3 ? 'red' : 'amber') : healthFromPct(overallPct),
    primary: {
      label:   'Agency average score',
      current: agencyAvg,
      target:  scoreTarget,
      unit:    '',
      pct:     scorePct,
      display: agencyAvg > 0 ? `${agencyAvg} / 100` : '—',
    },
    secondaries: [
      {
        label:   'Staff at risk (below 60 for 3+ weeks)',
        current: atRisk,
        target:  0,
        unit:    'staff',
        pct:     atRisk === 0 ? 100 : 0,
        display: atRisk === 0 ? 'None — all on track' : `${atRisk} staff at risk`,
        alert:   atRisk > 0,
      },
      {
        label:   'Contribution claims approved this month',
        current: claimsCount,
        target:  claimsTarget,
        unit:    'claims',
        pct:     claimsTarget > 0 ? pct(claimsCount, claimsTarget) : null,
        display: claimsTarget > 0
          ? `${claimsCount} of ${claimsTarget}`
          : String(claimsCount),
      },
    ],
    raw: { agencyAvg, atRisk, claimsCount },
  };
};

// ── 6. HR & Workforce ─────────────────────────────────────────────

const getHRWorkforce = async (targets = {}) => {
  const myTargets = targets.hr_workforce || [];

  const [vacancyResult, retentionResult, internResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')   AS open_count,
         COUNT(*) FILTER (WHERE status = 'filled'
                           AND date_filled >= $1)  AS filled_this_year
       FROM vacancies`,
      [yearStart()]
    ).catch(() => ({ rows: [{}] })),

    // Staff exits this year (retention calculation)
    query(
      `SELECT
         COUNT(*) FILTER (WHERE employment_status IN ('resigned','terminated')
                           AND exit_date >= $1) AS exits,
         COUNT(*) AS total_staff
       FROM people_records
       WHERE start_date < $1`,  // staff who were here at year start
      [yearStart()]
    ).catch(() => ({ rows: [{}] })),

    // Interns completing within 30 days
    query(
      `SELECT COUNT(*) AS completing_soon
       FROM people_records
       WHERE employment_category = 'intern'
         AND internship_end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
         AND employment_status = 'active'`
    ).catch(() => ({ rows: [{}] })),
  ]);

  const v             = vacancyResult.rows[0]   || {};
  const r             = retentionResult.rows[0] || {};
  const openVacancies = Number(v.open_count      || 0);
  const filledCount   = Number(v.filled_this_year || 0);
  const exits         = Number(r.exits            || 0);
  const totalStaff    = Number(r.total_staff      || 1);
  const completingSoon = Number(internResult.rows[0]?.completing_soon || 0);

  const retentionRate  = Math.round(((totalStaff - exits) / totalStaff) * 100);
  const vacancyTarget  = Number(myTargets.find(t => /vacanc/i.test(t.title))?.target_value || 0);
  const retentionTarget = Number(myTargets.find(t => /retent/i.test(t.title))?.target_value || 90);

  const vacancyPct   = vacancyTarget > 0 ? pct(filledCount, vacancyTarget) : 100;
  const retentionPct = pct(retentionRate, retentionTarget);
  const overallPct   = Math.round((vacancyPct + retentionPct) / 2);

  return {
    id:    'hr_workforce',
    label: 'HR & Workforce',
    icon:  '🏢',
    health: healthFromPct(overallPct),
    primary: {
      label:   'Staff retention rate this year',
      current: retentionRate,
      target:  retentionTarget,
      unit:    '%',
      pct:     retentionPct,
      display: `${retentionRate}%`,
      sub:     exits > 0
        ? `${exits} exit${exits !== 1 ? 's' : ''} this year`
        : 'No exits this year',
    },
    secondaries: [
      {
        label:   'Vacancies filled this year',
        current: filledCount,
        target:  vacancyTarget,
        unit:    'roles',
        pct:     vacancyPct,
        display: vacancyTarget > 0
          ? `${filledCount} of ${vacancyTarget}`
          : String(filledCount),
        sub:     openVacancies > 0 ? `${openVacancies} still open` : 'All positions filled',
      },
      {
        label:   'Interns completing within 30 days',
        current: completingSoon,
        target:  null,
        unit:    'interns',
        pct:     null,
        display: completingSoon > 0
          ? `${completingSoon} completing soon`
          : 'None due this month',
        alert: completingSoon > 0,
      },
    ],
    raw: { openVacancies, filledCount, retentionRate, exits, completingSoon },
  };
};

// ── Master aggregator ─────────────────────────────────────────────

const getAllCategories = async () => {
  const targets = await getTargets().catch(() => ({}));

  const [nb, rev, ch, del, pp, hr] = await Promise.all([
    getNewBusiness(targets).catch(e => fallback('new_business', 'New Business', '🎯', e)),
    getRevenue(targets).catch(e     => fallback('revenue',      'Revenue',      '💰', e)),
    getClientHealth(targets).catch(e => fallback('client_health','Client Health','⭐', e)),
    getDelivery(targets).catch(e    => fallback('delivery',     'Delivery',     '⚡', e)),
    getPeoplePerformance(targets).catch(e => fallback('people_perf','People Performance','👥', e)),
    getHRWorkforce(targets).catch(e => fallback('hr_workforce', 'HR & Workforce','🏢', e)),
  ]);

  return [nb, rev, ch, del, pp, hr];
};

// ── Pulse — lightweight for Command Centre strip ──────────────────
// Returns just health colours + primary metric per category.

const getPulse = async () => {
  const categories = await getAllCategories();
  return categories.map(c => ({
    id:     c.id,
    label:  c.label,
    icon:   c.icon,
    health: c.health,
    display: c.primary?.display || '—',
    sub:     c.primary?.label   || '',
    pct:     c.primary?.pct     ?? null,
    error:   c.error || null,
  }));
};

// ── Week vs Goal delta ────────────────────────────────────────────
// Used by the MD Weekly Report to show how this week moved the needle.

const getWeekVsGoal = async () => {
  const categories = await getAllCategories().catch(() => []);

  // For each category, pull the same primary metric but for last week
  // to compute a delta. Simplified version — just returns current values
  // with a computed weekly contribution note.
  return categories.map(c => {
    const primary = c.primary || {};
    return {
      id:      c.id,
      label:   c.label,
      icon:    c.icon,
      health:  c.health,
      current: primary.display,
      target:  primary.target
        ? (primary.unit === '₦' ? fmtN(primary.target) : `${primary.target} ${primary.unit}`)
        : null,
      pct:     primary.pct,
      note:    c.error ? 'Data unavailable' : null,
    };
  });
};

// ── Target management ─────────────────────────────────────────────

const upsertTarget = async ({ id, category, title, target_value, unit }) => {
  const periodLabel = String(currentYear());

  if (id) {
    // Update existing target
    const result = await query(
      `UPDATE agency_targets
       SET target_value = $1, title = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [target_value, title, id]
    );
    return result.rows[0];
  }

  // Insert new target
  const result = await query(
    `INSERT INTO agency_targets
       (category, title, target_value, unit, period_label, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING *`,
    [category, title, target_value, unit || '', periodLabel]
  );
  return result.rows[0];
};

module.exports = {
  getAllCategories,
  getPulse,
  getWeekVsGoal,
  getTargets,
  upsertTarget,
  getNewBusiness,
  getRevenue,
  getClientHealth,
  getDelivery,
  getPeoplePerformance,
  getHRWorkforce,
};
