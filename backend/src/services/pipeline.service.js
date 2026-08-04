// ═══════════════════════════════════════════════════════════════════
// pipeline.service.js
// Sabi Intelligence Suite — New Business Pipeline
// Phase 0: Opportunities CRUD + stage management + analytics
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query } = require('../db/db');

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Returns the Monday of the current ISO week as a DATE string (YYYY-MM-DD)
 */
const getCurrentWeekStart = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
};

/**
 * Calculates days since a given timestamp
 */
const daysSince = (ts) => {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Staleness level for a deal based on days in current stage
 *   green  = < 7 days
 *   amber  = 7–14 days
 *   red    = > 14 days
 */
const stalenessLevel = (days) => {
  if (days < 7) return 'green';
  if (days <= 14) return 'amber';
  return 'red';
};

// ── Opportunities ─────────────────────────────────────────────────

/**
 * List all opportunities with optional filters.
 * Joins users table for lead BA name.
 * Enriches each record with days_in_stage and staleness.
 */
const listOpportunities = async ({ stage, lead_ba_id, service_type, sort_by = 'updated_at', sort_dir = 'desc' } = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (stage) {
    conditions.push(`o.stage = $${idx++}`);
    params.push(stage);
  }
  if (lead_ba_id) {
    conditions.push(`o.lead_ba_id = $${idx++}`);
    params.push(lead_ba_id);
  }
  if (service_type) {
    conditions.push(`$${idx++} = ANY(o.service_types)`);
    params.push(service_type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Allowed sort columns to prevent SQL injection
  const safeSortCols = ['updated_at', 'created_at', 'estimated_value', 'stage_changed_at', 'company_name'];
  const safeSortDir = sort_dir === 'asc' ? 'ASC' : 'DESC';
  const sortCol = safeSortCols.includes(sort_by) ? `o.${sort_by}` : 'o.updated_at';

  const sql = `
    SELECT
      o.*,
      u.name            AS lead_ba_name,
      u.email           AS lead_ba_email,
      EXTRACT(EPOCH FROM (NOW() - o.stage_changed_at)) / 86400 AS days_in_stage,
      (
        SELECT COUNT(*)
        FROM opportunity_weekly_notes own
        WHERE own.opportunity_id = o.id
      ) AS notes_count,
      (
        SELECT own.notes
        FROM opportunity_weekly_notes own
        WHERE own.opportunity_id = o.id
        ORDER BY own.week_start DESC
        LIMIT 1
      ) AS latest_note
    FROM opportunities o
    LEFT JOIN users u ON u.id = o.lead_ba_id
    ${where}
    ORDER BY ${sortCol} ${safeSortDir}
  `;

  const result = await query(sql, params);
  return result.rows.map(row => ({
    ...row,
    days_in_stage: Math.floor(Number(row.days_in_stage) || 0),
    staleness: stalenessLevel(Math.floor(Number(row.days_in_stage) || 0)),
  }));
};

/**
 * Get a single opportunity by ID with full detail:
 * stage history, weekly notes, and basic analytics on the deal.
 */
const getOpportunityById = async (id) => {
  const oppResult = await query(
    `SELECT
      o.*,
      u.name  AS lead_ba_name,
      u.email AS lead_ba_email,
      EXTRACT(EPOCH FROM (NOW() - o.stage_changed_at)) / 86400 AS days_in_stage,
      b.name  AS converted_brand_name
    FROM opportunities o
    LEFT JOIN users u ON u.id = o.lead_ba_id
    LEFT JOIN brands b ON b.id = o.converted_brand_id
    WHERE o.id = $1`,
    [id]
  );

  if (!oppResult.rows.length) return null;
  const opp = oppResult.rows[0];

  const histResult = await query(
    `SELECT sh.*, u.name AS changed_by_name
     FROM opportunity_stage_history sh
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.opportunity_id = $1
     ORDER BY sh.changed_at ASC`,
    [id]
  );

  const notesResult = await query(
    `SELECT own.*, u.name AS added_by_name
     FROM opportunity_weekly_notes own
     LEFT JOIN users u ON u.id = own.added_by
     WHERE own.opportunity_id = $1
     ORDER BY own.week_start DESC`,
    [id]
  );

  return {
    ...opp,
    days_in_stage: Math.floor(Number(opp.days_in_stage) || 0),
    staleness: stalenessLevel(Math.floor(Number(opp.days_in_stage) || 0)),
    stage_history: histResult.rows,
    weekly_notes: notesResult.rows,
  };
};

/**
 * Create a new opportunity.
 * Logs the initial stage to stage_history.
 */
const createOpportunity = async (data, created_by) => {
  const {
    company_name, deal_title, description, service_types = [],
    source, stage = 'introduction', estimated_value,
    date_briefed, client_deadline, agency_deadline,
    lead_ba_id, accountable_team_text, notes,
  } = data;

  const result = await query(
    `INSERT INTO opportunities (
      company_name, deal_title, description, service_types,
      source, stage, estimated_value,
      date_briefed, client_deadline, agency_deadline,
      lead_ba_id, accountable_team_text, notes,
      created_by, stage_changed_at
    ) VALUES (
      $1,$2,$3,$4,
      $5,$6,$7,
      $8,$9,$10,
      $11,$12,$13,
      $14, NOW()
    )
    RETURNING *`,
    [
      company_name, deal_title, description || null, service_types,
      source || null, stage, estimated_value || null,
      date_briefed || null, client_deadline || null, agency_deadline || null,
      lead_ba_id || null, accountable_team_text || null, notes || null,
      created_by,
    ]
  );

  const opp = result.rows[0];

  // Log initial stage entry
  await query(
    `INSERT INTO opportunity_stage_history
      (opportunity_id, from_stage, to_stage, changed_by, change_notes)
     VALUES ($1, NULL, $2, $3, 'Opportunity created')`,
    [opp.id, opp.stage, created_by]
  );

  return opp;
};

/**
 * Update an opportunity's fields (not stage — use changeStage for that).
 */
const updateOpportunity = async (id, data) => {
  const allowed = [
    'company_name', 'deal_title', 'description', 'service_types',
    'source', 'estimated_value', 'date_briefed', 'client_deadline',
    'agency_deadline', 'lead_ba_id', 'accountable_team_text', 'notes',
    'lost_reason', 'lost_notes',
  ];

  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const field of allowed) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      params.push(data[field]);
    }
  }

  if (!setClauses.length) throw new Error('No valid fields to update');

  params.push(id);
  const result = await query(
    `UPDATE opportunities SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0] || null;
};

/**
 * Change an opportunity's stage.
 * Updates stage_changed_at so staleness resets to 0.
 * Logs the transition to opportunity_stage_history.
 * For Won: accepts converted_brand_id (Phase 3 wire-up, optional for now).
 * For Lost: requires lost_reason.
 */
const changeStage = async (id, new_stage, changed_by, { change_notes, lost_reason, lost_notes, converted_brand_id } = {}) => {
  const current = await query('SELECT stage FROM opportunities WHERE id = $1', [id]);
  if (!current.rows.length) throw new Error('Opportunity not found');

  const from_stage = current.rows[0].stage;
  if (from_stage === new_stage) return getOpportunityById(id); // no-op

  const extraUpdates = [];
  const params = [new_stage, id];
  let idx = 3;

  if (new_stage === 'agreement' && converted_brand_id) {
    extraUpdates.push(`converted_brand_id = $${idx++}`);
    params.splice(params.length - 1, 0, converted_brand_id);
  }
  if (new_stage === 'lost_paused') {
    if (lost_reason) {
      extraUpdates.push(`lost_reason = $${idx++}`);
      params.splice(params.length - 1, 0, lost_reason);
    }
    if (lost_notes) {
      extraUpdates.push(`lost_notes = $${idx++}`);
      params.splice(params.length - 1, 0, lost_notes);
    }
  }

  const extraSql = extraUpdates.length ? `, ${extraUpdates.join(', ')}` : '';

  await query(
    `UPDATE opportunities
     SET stage = $1, stage_changed_at = NOW(), updated_at = NOW()${extraSql}
     WHERE id = $2`,
    params
  );

  await query(
    `INSERT INTO opportunity_stage_history
      (opportunity_id, from_stage, to_stage, changed_by, change_notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, from_stage, new_stage, changed_by, change_notes || null]
  );

  return getOpportunityById(id);
};

/**
 * Delete an opportunity. Admin/Super Admin only — enforced in route middleware.
 */
const deleteOpportunity = async (id) => {
  await query('DELETE FROM opportunities WHERE id = $1', [id]);
};

// ── Weekly Notes ──────────────────────────────────────────────────

/**
 * Get all weekly notes for an opportunity.
 */
const getWeeklyNotes = async (opportunity_id) => {
  const result = await query(
    `SELECT own.*, u.name AS added_by_name
     FROM opportunity_weekly_notes own
     LEFT JOIN users u ON u.id = own.added_by
     WHERE own.opportunity_id = $1
     ORDER BY own.week_start DESC`,
    [opportunity_id]
  );
  return result.rows;
};

/**
 * Upsert this week's note for an opportunity.
 * If ARIA draft is provided, saves it. If user notes are provided, saves them.
 * Both can coexist.
 */
const upsertWeeklyNote = async (opportunity_id, { week_start, notes, aria_draft }, added_by) => {
  const week = week_start || getCurrentWeekStart();

  const result = await query(
    `INSERT INTO opportunity_weekly_notes
       (opportunity_id, week_start, notes, aria_draft, added_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (opportunity_id, week_start)
     DO UPDATE SET
       notes      = COALESCE(EXCLUDED.notes, opportunity_weekly_notes.notes),
       aria_draft = COALESCE(EXCLUDED.aria_draft, opportunity_weekly_notes.aria_draft),
       added_by   = EXCLUDED.added_by,
       updated_at = NOW()
     RETURNING *`,
    [opportunity_id, week, notes || null, aria_draft || null, added_by]
  );

  // Also update the opportunity's `notes` field with the latest narrative
  if (notes) {
    await query(
      'UPDATE opportunities SET notes = $1, updated_at = NOW() WHERE id = $2',
      [notes, opportunity_id]
    );
  }

  return result.rows[0];
};

// ── Analytics ─────────────────────────────────────────────────────

/**
 * Pipeline analytics overview.
 * Returns: total pipeline value, deals by stage, win rate,
 * avg deal size, avg days to close, staleness summary.
 */
const getAnalytics = async () => {
  // Active pipeline (not won or lost)
  const activeResult = await query(
    `SELECT
       COUNT(*)                               AS active_count,
       COALESCE(SUM(estimated_value), 0)     AS total_pipeline_value,
       COALESCE(AVG(estimated_value), 0)     AS avg_deal_size
     FROM opportunities
     WHERE stage NOT IN ('agreement', 'onboarded', 'lost_paused')`
  );

  // Deals by stage
  const byStageResult = await query(
    `SELECT stage, COUNT(*) AS count,
       COALESCE(SUM(estimated_value), 0) AS stage_value
     FROM opportunities
     WHERE stage NOT IN ('agreement', 'onboarded', 'lost_paused')
     GROUP BY stage
     ORDER BY ARRAY_POSITION(
       ARRAY['introduction','proposal','pitch','second_pitch','decision'],
       stage
     )`
  );

  // Win rate this quarter
  const winRateResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE stage IN ('agreement', 'onboarded'))                    AS won_count,
       COUNT(*) FILTER (WHERE stage IN ('agreement', 'onboarded', 'lost_paused'))     AS closed_count,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE stage IN ('agreement', 'onboarded')) /
         NULLIF(COUNT(*) FILTER (WHERE stage IN ('agreement', 'onboarded', 'lost_paused')), 0), 1
       )                                                                               AS win_rate_pct
     FROM opportunities
     WHERE created_at >= DATE_TRUNC('quarter', NOW())`
  );

  // Avg days to close (won deals this quarter)
  const avgCloseResult = await query(
    `SELECT ROUND(AVG(
       EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 86400
     ), 1) AS avg_days_to_close
     FROM opportunities o
     JOIN opportunity_stage_history sh ON sh.opportunity_id = o.id
     WHERE o.stage IN ('agreement', 'onboarded')
       AND sh.to_stage IN ('agreement', 'onboarded')
       AND sh.changed_at >= DATE_TRUNC('quarter', NOW())`
  );

  // Staleness breakdown (active deals only)
  const stalenessResult = await query(
    `SELECT
       COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - stage_changed_at)) / 86400 < 7)    AS green_count,
       COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - stage_changed_at)) / 86400 BETWEEN 7 AND 14) AS amber_count,
       COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (NOW() - stage_changed_at)) / 86400 > 14)   AS red_count
     FROM opportunities
     WHERE stage NOT IN ('agreement', 'onboarded', 'lost_paused')`
  );

  // Weighted pipeline forecast (for MD view integration)
  // Weights: decision=70%, second_pitch=50%, pitch=30%, proposal=15%, introduction=5%
  const forecastResult = await query(
    `SELECT COALESCE(SUM(
       estimated_value * CASE stage
         WHEN 'decision'      THEN 0.70
         WHEN 'second_pitch'  THEN 0.50
         WHEN 'pitch'         THEN 0.30
         WHEN 'proposal'      THEN 0.15
         WHEN 'introduction'  THEN 0.05
         ELSE 0
       END
     ), 0) AS weighted_forecast
     FROM opportunities
     WHERE stage NOT IN ('agreement', 'onboarded', 'lost_paused')
       AND estimated_value IS NOT NULL`
  );

  const active = activeResult.rows[0];
  const winRate = winRateResult.rows[0];
  const avgClose = avgCloseResult.rows[0];
  const staleness = stalenessResult.rows[0];
  const forecast = forecastResult.rows[0];

  return {
    active_count: Number(active.active_count),
    total_pipeline_value: Number(active.total_pipeline_value),
    avg_deal_size: Number(active.avg_deal_size),
    by_stage: byStageResult.rows.map(r => ({
      stage: r.stage,
      count: Number(r.count),
      value: Number(r.stage_value),
    })),
    win_rate_pct: Number(winRate.win_rate_pct) || 0,
    won_count: Number(winRate.won_count),
    closed_count: Number(winRate.closed_count),
    avg_days_to_close: Number(avgClose.avg_days_to_close) || null,
    staleness: {
      green: Number(staleness.green_count),
      amber: Number(staleness.amber_count),
      red: Number(staleness.red_count),
    },
    weighted_forecast: Number(forecast.weighted_forecast),
  };
};

/**
 * Get all deals that need attention (staleness alerts for ARIA).
 * Returned for weekly report injection and MD pulse.
 */
const getStalenessAlerts = async () => {
  const result = await query(
    `SELECT
       o.id, o.company_name, o.deal_title, o.stage,
       o.lead_ba_id,
       u.name AS lead_ba_name,
       FLOOR(EXTRACT(EPOCH FROM (NOW() - o.stage_changed_at)) / 86400) AS days_in_stage,
       o.notes,
       (
         SELECT own.week_start
         FROM opportunity_weekly_notes own
         WHERE own.opportunity_id = o.id
         ORDER BY own.week_start DESC LIMIT 1
       ) AS last_note_week
     FROM opportunities o
     LEFT JOIN users u ON u.id = o.lead_ba_id
     WHERE o.stage NOT IN ('won', 'lost_paused')
       AND EXTRACT(EPOCH FROM (NOW() - o.stage_changed_at)) / 86400 > 7
     ORDER BY days_in_stage DESC`
  );

  return result.rows.map(r => ({
    ...r,
    days_in_stage: Number(r.days_in_stage),
    staleness: stalenessLevel(Number(r.days_in_stage)),
    alert_message: buildStalenessMessage(r),
  }));
};

const buildStalenessMessage = (opp) => {
  const days = Number(opp.days_in_stage);
  const stageLabel = {
    introduction: 'Introduction',
    proposal: 'Proposal',
    pitch: 'Pitch',
    second_pitch: 'Second Pitch',
    decision: 'Decision',
    agreement: 'Agreement',
    onboarded: 'Onboarded',
    lost_paused: 'Lost / Paused',
  }[opp.stage] || opp.stage;

  if (opp.stage === 'pitch' && days > 14) {
    return `${opp.company_name} — pitch was shared ${days} days ago with no update logged. Recommend a follow-up call before Friday's report.`;
  }
  if (opp.stage === 'decision' && days > 28) {
    return `${opp.company_name} — ${opp.deal_title} has been in Decision for ${days} days. Escalate to MD if not closing this week.`;
  }
  return `${opp.company_name} — ${days} days in "${stageLabel}" without a stage update.`;
};

module.exports = {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  changeStage,
  deleteOpportunity,
  getWeeklyNotes,
  upsertWeeklyNote,
  getAnalytics,
  getStalenessAlerts,
  getCurrentWeekStart,
};
