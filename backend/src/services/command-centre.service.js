// ═══════════════════════════════════════════════════════════════════
// command-centre.service.js
// Sabi Intelligence Suite — Command Centre Phase 2
//
// Computes all 8 dial values, week-on-week deltas, and sparklines.
// No new tables — reads exclusively from existing Sabi tables.
//
// Dials:
//   1. Task Velocity      — % tasks completed on time this week
//   2. Revenue Health     — ₦ collected vs outstanding
//   3. Client Satisfaction— avg rating across all brands
//   4. Creative Review    — pending CD queue size + overdue count
//   5. Staff Performance  — agency average ClarityScore (staff)
//   6. Goal Progress      — % of brand goals on track
//   7. ClarityScore™      — avg brand ClarityScore across fleet
//   8. Pipeline (NEW)     — active deals count + ₦ value
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query } = require('../db/db');

// ── Week / Month helpers ──────────────────────────────────────────

const getWeekBounds = (offsetWeeks = 0) => {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon - offsetWeeks * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().split('T')[0],
    end: sun.toISOString().split('T')[0] + ' 23:59:59',
  };
};

const getMonthBounds = (offsetMonths = 0) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: d.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0] + ' 23:59:59',
  };
};

// Safe division helper
const pct = (num, den) => den > 0 ? Math.round((num / den) * 100) : 0;

// Delta between current and previous value
const delta = (current, previous) => {
  if (previous === 0 || previous == null) return null;
  return Math.round(((current - previous) / previous) * 100);
};

// Health colour based on value vs thresholds
const health = (value, { green, amber }) => {
  if (value >= green) return 'green';
  if (value >= amber) return 'amber';
  return 'red';
};

// ── Dial 1: Task Velocity ─────────────────────────────────────────

const getTaskVelocity = async () => {
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(1);

  const [thisResult, lastResult, brandBreakdown] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('done','verified'))                AS completed,
         COUNT(*) FILTER (WHERE created_at BETWEEN $1 AND $2)                AS created_this_week,
         COUNT(*) FILTER (WHERE due_date BETWEEN $1 AND $2
                           AND status IN ('done','verified'))                 AS on_time,
         COUNT(*) FILTER (WHERE due_date BETWEEN $1 AND $2)                  AS due_this_week
       FROM tasks
       WHERE updated_at BETWEEN $1 AND $2
          OR (due_date BETWEEN $1 AND $2)`,
      [thisWeek.start, thisWeek.end]
    ).catch(() => ({ rows: [{}] })),

    query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('done','verified'))                AS completed,
         COUNT(*) FILTER (WHERE due_date BETWEEN $1 AND $2)                  AS due_this_week
       FROM tasks
       WHERE updated_at BETWEEN $1 AND $2
          OR (due_date BETWEEN $1 AND $2)`,
      [lastWeek.start, lastWeek.end]
    ).catch(() => ({ rows: [{}] })),

    query(
      `SELECT b.name AS brand_name,
         COUNT(*) FILTER (WHERE t.status IN ('done','verified')) AS done,
         COUNT(*) AS total
       FROM tasks t JOIN brands b ON b.id = t.brand_id
       WHERE t.updated_at BETWEEN $1 AND $2
       GROUP BY b.name ORDER BY done::float/NULLIF(total,0) DESC`,
      [thisWeek.start, thisWeek.end]
    ).catch(() => ({ rows: [] })),
  ]);

  const t = thisResult.rows[0] || {};
  const l = lastResult.rows[0] || {};
  const current = pct(Number(t.completed || 0), Number(t.due_this_week || 0) || Number(t.completed || 0) || 1);
  const previous = pct(Number(l.completed || 0), Number(l.due_this_week || 0) || 1);

  return {
    id: 'task_velocity',
    label: 'Task Velocity',
    value: current,
    unit: '%',
    display: `${current}%`,
    sub: `${t.completed || 0} tasks completed this week`,
    delta: delta(current, previous),
    health: health(current, { green: 80, amber: 60 }),
    expanded_data: brandBreakdown.rows.map(r => ({
      label: r.brand_name,
      value: pct(Number(r.done), Number(r.total)),
      unit: '%',
      sub: `${r.done}/${r.total} tasks`,
    })),
  };
};

// ── Dial 2: Revenue Health ────────────────────────────────────────

const getRevenueHealth = async () => {
  const thisMonth = getMonthBounds(0);
  const lastMonth = getMonthBounds(1);

  const [thisResult, lastResult, byBrand] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid'),0)                AS collected,
         COALESCE(SUM(amount) FILTER (WHERE status IN ('sent','overdue')),0)   AS outstanding,
         COALESCE(SUM(amount),0)                                                AS total_invoiced
       FROM invoices
       WHERE created_at BETWEEN $1 AND $2`,
      [thisMonth.start, thisMonth.end]
    ).catch(() => ({ rows: [{ collected: 0, outstanding: 0, total_invoiced: 0 }] })),

    query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'paid'),0) AS collected
       FROM invoices WHERE created_at BETWEEN $1 AND $2`,
      [lastMonth.start, lastMonth.end]
    ).catch(() => ({ rows: [{ collected: 0 }] })),

    query(
      `SELECT b.name AS brand_name,
         COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'),0)              AS paid,
         COALESCE(SUM(i.amount) FILTER (WHERE i.status IN ('sent','overdue')),0) AS outstanding
       FROM invoices i JOIN brands b ON b.id = i.brand_id
       WHERE i.created_at BETWEEN $1 AND $2
       GROUP BY b.name ORDER BY outstanding DESC`,
      [thisMonth.start, thisMonth.end]
    ).catch(() => ({ rows: [] })),
  ]);

  const t = thisResult.rows[0];
  const l = lastResult.rows[0];
  const collected = Number(t.collected || 0);
  const outstanding = Number(t.outstanding || 0);
  const prevCollected = Number(l.collected || 0);
  const collectionRate = pct(collected, collected + outstanding);

  const fmtN = v => `₦${Number(v).toLocaleString('en-NG')}`;

  return {
    id: 'revenue_health',
    label: 'Revenue Health',
    value: collectionRate,
    unit: '%',
    display: fmtN(collected),
    sub: outstanding > 0 ? `${fmtN(outstanding)} outstanding` : 'All invoices cleared',
    delta: delta(collected, prevCollected),
    health: health(collectionRate, { green: 75, amber: 50 }),
    expanded_data: byBrand.rows.map(r => ({
      label: r.brand_name,
      value: Number(r.paid),
      unit: '₦',
      sub: r.outstanding > 0 ? `${fmtN(r.outstanding)} outstanding` : 'Clear',
    })),
    raw: { collected, outstanding, collection_rate: collectionRate },
  };
};

// ── Dial 3: Client Satisfaction ───────────────────────────────────

const getClientSatisfaction = async () => {
  const thisWeek = getWeekBounds(0);
  const lastWeek = getWeekBounds(1);

  const [thisResult, lastResult, byBrand] = await Promise.all([
    query(
      `SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*) AS count
       FROM client_satisfaction_ratings
       WHERE created_at BETWEEN $1 AND $2`,
      [thisWeek.start, thisWeek.end]
    ).catch(() => ({ rows: [{ avg_rating: null, count: 0 }] })),

    query(
      `SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating
       FROM client_satisfaction_ratings
       WHERE created_at BETWEEN $1 AND $2`,
      [lastWeek.start, lastWeek.end]
    ).catch(() => ({ rows: [{ avg_rating: null }] })),

    query(
      `SELECT b.name AS brand_name, ROUND(AVG(r.rating)::numeric,1) AS avg_rating, COUNT(*) AS count
       FROM client_satisfaction_ratings r JOIN brands b ON b.id = r.brand_id
       WHERE r.created_at BETWEEN $1 AND $2
       GROUP BY b.name ORDER BY avg_rating DESC`,
      [thisWeek.start, thisWeek.end]
    ).catch(() => ({ rows: [] })),
  ]);

  const current = Number(thisResult.rows[0]?.avg_rating || 0);
  const previous = Number(lastResult.rows[0]?.avg_rating || 0);
  const count = Number(thisResult.rows[0]?.count || 0);

  return {
    id: 'client_satisfaction',
    label: 'Client Satisfaction',
    value: current,
    unit: '/5',
    display: current > 0 ? `${current}/5` : '—',
    sub: count > 0 ? `${count} rating${count !== 1 ? 's' : ''} this week` : 'No ratings yet this week',
    delta: previous > 0 ? Math.round((current - previous) * 10) / 10 : null,
    delta_type: 'absolute',
    health: health(current, { green: 4.0, amber: 3.0 }),
    expanded_data: byBrand.rows.map(r => ({
      label: r.brand_name,
      value: Number(r.avg_rating),
      unit: '/5',
      sub: `${r.count} rating${r.count !== 1 ? 's' : ''}`,
    })),
  };
};

// ── Dial 4: Creative Review Queue ─────────────────────────────────

const getCreativeReviewQueue = async () => {
  // Queries the existing creative_review_queue or tasks table based on your schema.
  // Adjust the status field names to match your actual task statuses.
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'in_review' OR status = 'pending_creative_review') AS pending,
       COUNT(*) FILTER (
         WHERE (status = 'in_review' OR status = 'pending_creative_review')
           AND updated_at < NOW() - INTERVAL '48 hours'
       )                                                                                   AS overdue
     FROM tasks
     WHERE status IN ('in_review','pending_creative_review')`
  ).catch(() => ({ rows: [{ pending: 0, overdue: 0 }] }));

  const pending = Number(result.rows[0]?.pending || 0);
  const overdue = Number(result.rows[0]?.overdue || 0);

  return {
    id: 'creative_review',
    label: 'Creative Review',
    value: pending,
    unit: '',
    display: String(pending),
    sub: overdue > 0 ? `${overdue} overdue (>48h)` : pending === 0 ? 'Queue clear' : 'All within SLA',
    delta: null, // queue size is a snapshot, not a trend
    health: pending === 0 ? 'green' : overdue > 0 ? 'red' : 'amber',
    expanded_data: [],
    raw: { pending, overdue },
  };
};

// ── Dial 5: Staff Performance ─────────────────────────────────────

const getStaffPerformance = async () => {
  const [currentResult, sparklineResult, topResult] = await Promise.all([
    query(
      `SELECT ROUND(AVG(score)::numeric, 1) AS avg_score
       FROM staff_scores
       WHERE week_start = (SELECT MAX(week_start) FROM staff_scores)`
    ).catch(() => ({ rows: [{ avg_score: null }] })),

    // 6-week sparkline
    query(
      `SELECT week_start, ROUND(AVG(score)::numeric,1) AS avg_score
       FROM staff_scores
       GROUP BY week_start
       ORDER BY week_start DESC LIMIT 6`
    ).catch(() => ({ rows: [] })),

    // Top and bottom performers
    query(
      `SELECT u.name, ss.score
       FROM staff_scores ss JOIN users u ON u.id = ss.user_id
       WHERE ss.week_start = (SELECT MAX(week_start) FROM staff_scores)
       ORDER BY ss.score DESC LIMIT 8`
    ).catch(() => ({ rows: [] })),
  ]);

  const current = Number(currentResult.rows[0]?.avg_score || 0);
  const sparkData = sparklineResult.rows.reverse().map(r => Number(r.avg_score));
  const previous = sparkData.length >= 2 ? sparkData[sparkData.length - 2] : current;

  return {
    id: 'staff_performance',
    label: 'Staff Performance',
    value: current,
    unit: '',
    display: current > 0 ? String(current) : '—',
    sub: 'Agency average score / 100',
    delta: delta(current, previous),
    health: health(current, { green: 80, amber: 65 }),
    sparkline: sparkData,
    expanded_data: topResult.rows.map(r => ({
      label: r.name,
      value: Number(r.score),
      unit: '',
      sub: 'Score',
    })),
  };
};

// ── Dial 6: Goal Progress ─────────────────────────────────────────

const getGoalProgress = async () => {
  const result = await query(
    `SELECT
       COUNT(*)                                          AS total,
       COUNT(*) FILTER (WHERE progress_pct >= 70)       AS on_track,
       COUNT(*) FILTER (WHERE progress_pct < 40
                         AND deadline < NOW() + INTERVAL '30 days') AS at_risk
     FROM brand_goals
     WHERE status NOT IN ('completed','cancelled')`
  ).catch(() => ({ rows: [{ total: 0, on_track: 0, at_risk: 0 }] }));

  const { total, on_track, at_risk } = result.rows[0];
  const onTrackPct = pct(Number(on_track), Number(total));

  const byBrand = await query(
    `SELECT b.name AS brand_name,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE g.progress_pct >= 70) AS on_track,
       ROUND(AVG(g.progress_pct)::numeric, 0) AS avg_progress
     FROM brand_goals g JOIN brands b ON b.id = g.brand_id
     WHERE g.status NOT IN ('completed','cancelled')
     GROUP BY b.name
     ORDER BY avg_progress ASC`
  ).catch(() => ({ rows: [] }));

  return {
    id: 'goal_progress',
    label: 'Goal Progress',
    value: onTrackPct,
    unit: '%',
    display: `${onTrackPct}%`,
    sub: `${on_track}/${total} goals on track${Number(at_risk) > 0 ? ` · ${at_risk} at risk` : ''}`,
    delta: null,
    health: health(onTrackPct, { green: 70, amber: 50 }),
    expanded_data: byBrand.rows.map(r => ({
      label: r.brand_name,
      value: Number(r.avg_progress),
      unit: '%',
      sub: `${r.on_track}/${r.total} goals on track`,
    })),
    raw: { total: Number(total), on_track: Number(on_track), at_risk: Number(at_risk) },
  };
};

// ── Dial 7: ClarityScore™ ─────────────────────────────────────────

const getClarityScore = async () => {
  const [currentResult, sparklineResult, byBrand] = await Promise.all([
    query(
      `SELECT ROUND(AVG(score)::numeric, 0) AS avg_score
       FROM brand_clarity_scores
       WHERE week_start = (SELECT MAX(week_start) FROM brand_clarity_scores)`
    ).catch(() => ({ rows: [{ avg_score: null }] })),

    // 6-week sparkline
    query(
      `SELECT week_start, ROUND(AVG(score)::numeric,0) AS avg_score
       FROM brand_clarity_scores
       GROUP BY week_start
       ORDER BY week_start DESC LIMIT 6`
    ).catch(() => ({ rows: [] })),

    query(
      `SELECT b.name AS brand_name,
         bcs.score,
         bcs.week_start
       FROM brand_clarity_scores bcs
       JOIN brands b ON b.id = bcs.brand_id
       WHERE bcs.week_start = (SELECT MAX(week_start) FROM brand_clarity_scores)
       ORDER BY bcs.score DESC`
    ).catch(() => ({ rows: [] })),
  ]);

  const current = Number(currentResult.rows[0]?.avg_score || 0);
  const sparkData = sparklineResult.rows.reverse().map(r => Number(r.avg_score));
  const previous = sparkData.length >= 2 ? sparkData[0] : current; // vs 6 weeks ago

  return {
    id: 'clarity_score',
    label: 'ClarityScore™',
    value: current,
    unit: '',
    display: current > 0 ? String(current) : '—',
    sub: 'Avg across all active brands',
    delta: delta(current, previous),
    delta_label: 'vs 6 weeks ago',
    health: health(current, { green: 700, amber: 500 }),
    sparkline: sparkData,
    expanded_data: byBrand.rows.map(r => ({
      label: r.brand_name,
      value: Number(r.score),
      unit: '',
      sub: 'ClarityScore',
    })),
  };
};

// ── Dial 8: Pipeline (Phase 2 — NEW) ─────────────────────────────

const getPipelineDial = async () => {
  const [overviewResult, staleResult, recentResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE stage NOT IN ('won','lost_paused'))           AS active_count,
         COALESCE(SUM(estimated_value) FILTER (WHERE stage NOT IN ('won','lost_paused')),0) AS pipeline_value,
         COUNT(*) FILTER (WHERE stage IN ('proposal_sent','under_review'))    AS awaiting_response,
         COUNT(*) FILTER (WHERE stage IN ('identified','in_progress'))        AS in_progress,
         COUNT(*) FILTER (WHERE stage = 'negotiating')                        AS negotiating
       FROM opportunities`
    ).catch(() => ({ rows: [{}] })),

    // Stale check: deals in Awaiting Response for 14+ days
    query(
      `SELECT COUNT(*) AS stale_count
       FROM opportunities
       WHERE stage IN ('proposal_sent','under_review')
         AND EXTRACT(EPOCH FROM (NOW() - stage_changed_at)) / 86400 > 14`
    ).catch(() => ({ rows: [{ stale_count: 0 }] })),

    // Check if new opportunity added in last 30 days
    query(
      `SELECT COUNT(*) AS recent_count
       FROM opportunities
       WHERE created_at > NOW() - INTERVAL '30 days'`
    ).catch(() => ({ rows: [{ recent_count: 0 }] })),
  ]);

  const o = overviewResult.rows[0] || {};
  const active = Number(o.active_count || 0);
  const pipelineValue = Number(o.pipeline_value || 0);
  const awaitingResponse = Number(o.awaiting_response || 0);
  const inProgress = Number(o.in_progress || 0);
  const negotiating = Number(o.negotiating || 0);
  const staleCount = Number(staleResult.rows[0]?.stale_count || 0);
  const recentCount = Number(recentResult.rows[0]?.recent_count || 0);

  // Health logic from blueprint:
  // green: deals are moving
  // amber: 3+ deals in "Awaiting Response" for more than 14 days
  // red: no new opportunities added in 30 days
  let dialHealth = 'green';
  if (recentCount === 0) dialHealth = 'red';
  else if (staleCount >= 3) dialHealth = 'amber';

  const fmtN = v => `₦${Number(v).toLocaleString('en-NG')}`;

  return {
    id: 'pipeline',
    label: 'Pipeline',
    value: active,
    unit: '',
    display: fmtN(pipelineValue),
    sub: `${awaitingResponse} awaiting response · ${inProgress} in progress`,
    sub2: negotiating > 0 ? `${negotiating} negotiating` : null,
    delta: null,
    health: dialHealth,
    expanded_data: [
      { label: 'In Progress',      value: inProgress,       unit: 'deals', sub: 'Pitch work underway' },
      { label: 'Proposal Sent',    value: awaitingResponse, unit: 'deals', sub: staleCount > 0 ? `${staleCount} stale (14d+)` : 'Awaiting feedback' },
      { label: 'Negotiating',      value: negotiating,      unit: 'deals', sub: 'SLA/NDA stage' },
      { label: 'Total Value',      value: pipelineValue,    unit: '₦',     sub: 'Active pipeline' },
    ],
    raw: { active, pipelineValue, awaitingResponse, inProgress, negotiating, staleCount, recentCount },
    link_to: '/pipeline',
  };
};

// ── Weekly Intelligence mode header ──────────────────────────────

const getWeeklyIntelligenceHeader = async () => {
  const thisWeek = getWeekBounds(0);

  const [paymentsResult, submissionResult] = await Promise.all([
    query(
      `SELECT
         COALESCE(SUM(p.amount),0) AS collected_this_week
       FROM payments p
       WHERE p.payment_date BETWEEN $1 AND $2`,
      [thisWeek.start, thisWeek.end]
    ).catch(() => ({ rows: [{ collected_this_week: 0 }] })),

    query(
      `SELECT
         COUNT(wre.id)                                        AS total_brands,
         COUNT(wre.id) FILTER (WHERE wre.is_submitted)       AS submitted
       FROM weekly_reports wr
       JOIN weekly_report_entries wre ON wre.report_id = wr.id
       WHERE wr.week_start = $1`,
      [thisWeek.start]
    ).catch(() => ({ rows: [{ total_brands: 0, submitted: 0 }] })),
  ]);

  const collected = Number(paymentsResult.rows[0]?.collected_this_week || 0);
  const { total_brands, submitted } = submissionResult.rows[0] || {};

  return {
    week_start: thisWeek.start,
    week_end: thisWeek.end.split(' ')[0],
    collected_this_week: collected,
    collected_display: `₦${Number(collected).toLocaleString('en-NG')}`,
    submission_count: Number(submitted || 0),
    total_brands: Number(total_brands || 0),
  };
};

// ── Main aggregator ───────────────────────────────────────────────

/**
 * Fetch all 8 dials in parallel.
 * Individual failures are caught per-dial to avoid one bad query
 * taking down the whole dashboard.
 */
const getAllDials = async () => {
  const [
    taskVelocity,
    revenueHealth,
    clientSatisfaction,
    creativeReview,
    staffPerformance,
    goalProgress,
    clarityScore,
    pipeline,
  ] = await Promise.all([
    getTaskVelocity().catch(e => ({ id: 'task_velocity', label: 'Task Velocity', error: e.message })),
    getRevenueHealth().catch(e => ({ id: 'revenue_health', label: 'Revenue Health', error: e.message })),
    getClientSatisfaction().catch(e => ({ id: 'client_satisfaction', label: 'Client Satisfaction', error: e.message })),
    getCreativeReviewQueue().catch(e => ({ id: 'creative_review', label: 'Creative Review', error: e.message })),
    getStaffPerformance().catch(e => ({ id: 'staff_performance', label: 'Staff Performance', error: e.message })),
    getGoalProgress().catch(e => ({ id: 'goal_progress', label: 'Goal Progress', error: e.message })),
    getClarityScore().catch(e => ({ id: 'clarity_score', label: 'ClarityScore™', error: e.message })),
    getPipelineDial().catch(e => ({ id: 'pipeline', label: 'Pipeline', error: e.message })),
  ]);

  return [
    taskVelocity,
    revenueHealth,
    clientSatisfaction,
    creativeReview,
    staffPerformance,
    goalProgress,
    clarityScore,
    pipeline,
  ];
};

module.exports = {
  getAllDials,
  getPipelineDial,
  getWeeklyIntelligenceHeader,
  getTaskVelocity,
  getRevenueHealth,
  getClientSatisfaction,
  getCreativeReviewQueue,
  getStaffPerformance,
  getGoalProgress,
  getClarityScore,
};
