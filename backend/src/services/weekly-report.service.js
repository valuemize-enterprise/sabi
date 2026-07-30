// ═══════════════════════════════════════════════════════════════════
// weekly-report.service.js
// Sabi Intelligence Suite — Weekly Intelligence Report (Phase 1)
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query } = require('../db/db');

// ── Week helpers ──────────────────────────────────────────────────

/**
 * Returns { week_start, week_end } for the current ISO week.
 * week_start = Monday, week_end = Sunday.
 */
const getCurrentWeek = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  return {
    week_start: mon.toISOString().split('T')[0],
    week_end: sun.toISOString().split('T')[0],
  };
};

/**
 * Formats a YYYY-MM-DD date string to a human-readable label.
 * e.g. "2026-07-28" → "28 Jul 2026"
 */
const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// ── Weekly Report (container) ────────────────────────────────────

/**
 * Get or create the weekly_reports record for a given week.
 */
const getOrCreateReport = async (week_start) => {
  // Calculate week_end from week_start
  const mon = new Date(week_start);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const week_end = sun.toISOString().split('T')[0];

  const existing = await query(
    'SELECT * FROM weekly_reports WHERE week_start = $1',
    [week_start]
  );
  if (existing.rows.length) return existing.rows[0];

  const created = await query(
    'INSERT INTO weekly_reports (week_start, week_end) VALUES ($1, $2) RETURNING *',
    [week_start, week_end]
  );
  return created.rows[0];
};

// ── Brand Admin's brand list ──────────────────────────────────────

/**
 * Get all brands assigned to a brand admin (or all brands for admin/MD/SA).
 * Returns each brand with its entry status for the current week.
 */
const getBrandAdminBrands = async (brand_admin_id, week_start, user_role) => {
  const { week_end } = (() => {
    const mon = new Date(week_start);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { week_end: sun.toISOString().split('T')[0] };
  })();

  let brandsQuery;
  let params;

  if (['admin', 'md', 'super_admin'].includes(user_role)) {
    // Leadership sees all brands
    brandsQuery = `
      SELECT
        b.id, b.name, b.logo_url,
        bu.user_id AS brand_admin_id,
        u.name     AS brand_admin_name,
        wre.id     AS entry_id,
        wre.is_submitted,
        wre.submitted_at,
        wre.aria_generated_at,
        CASE
          WHEN wre.id IS NULL              THEN 'not_started'
          WHEN wre.is_submitted            THEN 'submitted'
          WHEN wre.aria_generated_at IS NOT NULL THEN 'draft'
          ELSE 'not_started'
        END AS status
      FROM brands b
      JOIN brand_users bu ON bu.brand_id = b.id AND bu.role = 'brand_admin'
      JOIN users u ON u.id = bu.user_id
      LEFT JOIN weekly_reports wr ON wr.week_start = $1
      LEFT JOIN weekly_report_entries wre
        ON wre.report_id = wr.id AND wre.brand_id = b.id
      ORDER BY u.name, b.name`;
    params = [week_start];
  } else {
    // Brand Admin sees only their brands
    brandsQuery = `
      SELECT
        b.id, b.name, b.logo_url,
        $2::uuid AS brand_admin_id,
        u.name   AS brand_admin_name,
        wre.id   AS entry_id,
        wre.is_submitted,
        wre.submitted_at,
        wre.aria_generated_at,
        CASE
          WHEN wre.id IS NULL              THEN 'not_started'
          WHEN wre.is_submitted            THEN 'submitted'
          WHEN wre.aria_generated_at IS NOT NULL THEN 'draft'
          ELSE 'not_started'
        END AS status
      FROM brand_users bu
      JOIN brands b ON b.id = bu.brand_id
      JOIN users u ON u.id = bu.user_id
      LEFT JOIN weekly_reports wr ON wr.week_start = $1
      LEFT JOIN weekly_report_entries wre
        ON wre.report_id = wr.id
       AND wre.brand_id = b.id
       AND wre.brand_admin_id = $2
      WHERE bu.user_id = $2
      ORDER BY b.name`;
    params = [week_start, brand_admin_id];
  }

  const result = await query(brandsQuery, params);
  return result.rows;
};

// ── Entry (per brand per week) ────────────────────────────────────

/**
 * Get or create a weekly_report_entries record for a brand in a given week.
 */
const getOrCreateEntry = async (report_id, brand_id, brand_admin_id) => {
  const existing = await query(
    `SELECT wre.*, b.name AS brand_name, u.name AS brand_admin_name
     FROM weekly_report_entries wre
     JOIN brands b ON b.id = wre.brand_id
     JOIN users u ON u.id = wre.brand_admin_id
     WHERE wre.report_id = $1 AND wre.brand_id = $2 AND wre.brand_admin_id = $3`,
    [report_id, brand_id, brand_admin_id]
  );

  if (existing.rows.length) return existing.rows[0];

  await query(
    `INSERT INTO weekly_report_entries (report_id, brand_id, brand_admin_id)
     VALUES ($1, $2, $3)`,
    [report_id, brand_id, brand_admin_id]
  );

  return getOrCreateEntry(report_id, brand_id, brand_admin_id);
};

/**
 * Get a specific entry with all its comments.
 */
const getEntryWithComments = async (entry_id) => {
  const entryResult = await query(
    `SELECT wre.*,
            b.name  AS brand_name,
            u.name  AS brand_admin_name,
            wr.week_start,
            wr.week_end
     FROM weekly_report_entries wre
     JOIN brands b ON b.id = wre.brand_id
     JOIN users u ON u.id = wre.brand_admin_id
     JOIN weekly_reports wr ON wr.id = wre.report_id
     WHERE wre.id = $1`,
    [entry_id]
  );

  if (!entryResult.rows.length) return null;
  const entry = entryResult.rows[0];

  const commentsResult = await query(
    `SELECT rc.*, u.name AS author_name, u.role AS author_role
     FROM report_comments rc
     JOIN users u ON u.id = rc.author_id
     WHERE rc.entry_id = $1
     ORDER BY rc.created_at ASC`,
    [entry_id]
  );

  return { ...entry, comments: commentsResult.rows };
};

/**
 * Save edits to any section of an entry.
 * section param maps to the 'edited_*' fields.
 */
const updateEntry = async (entry_id, sections) => {
  const allowed = [
    'edited_payment', 'edited_achievements', 'edited_todos',
    'edited_goals', 'edited_social', 'edited_pipeline',
    'brand_admin_notes',
  ];

  const setClauses = [];
  const params = [];
  let idx = 1;

  for (const field of allowed) {
    if (sections[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      params.push(sections[field]);
    }
  }

  if (!setClauses.length) throw new Error('No valid fields provided');

  params.push(entry_id);
  const result = await query(
    `UPDATE weekly_report_entries
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING *`,
    params
  );

  return result.rows[0];
};

/**
 * Save ARIA-generated drafts to an entry.
 * Called after ARIA generation completes.
 */
const saveAriaDrafts = async (entry_id, drafts) => {
  const {
    aria_draft_payment, aria_draft_achievements, aria_draft_todos,
    aria_draft_goals, aria_draft_social, aria_draft_pipeline,
  } = drafts;

  const result = await query(
    `UPDATE weekly_report_entries SET
      aria_draft_payment      = COALESCE($1, aria_draft_payment),
      aria_draft_achievements = COALESCE($2, aria_draft_achievements),
      aria_draft_todos        = COALESCE($3, aria_draft_todos),
      aria_draft_goals        = COALESCE($4, aria_draft_goals),
      aria_draft_social       = COALESCE($5, aria_draft_social),
      aria_draft_pipeline     = COALESCE($6, aria_draft_pipeline),
      aria_generated_at       = NOW(),
      updated_at              = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      aria_draft_payment || null,
      aria_draft_achievements || null,
      aria_draft_todos || null,
      aria_draft_goals || null,
      aria_draft_social || null,
      aria_draft_pipeline || null,
      entry_id,
    ]
  );

  return result.rows[0];
};

/**
 * Submit an entry for MD review.
 * Automatically fills edited sections from ARIA drafts if the BA left them blank.
 */
const submitEntry = async (entry_id, brand_admin_id) => {
  const entry = await getEntryWithComments(entry_id);
  if (!entry) throw new Error('Entry not found');
  if (entry.brand_admin_id !== brand_admin_id) throw new Error('Not authorized');
  if (entry.is_submitted) throw new Error('Already submitted');

  // Where BA has not edited a section, use the ARIA draft as-is
  const result = await query(
    `UPDATE weekly_report_entries SET
      edited_payment      = COALESCE(NULLIF(edited_payment, ''),      aria_draft_payment),
      edited_achievements = COALESCE(NULLIF(edited_achievements, ''), aria_draft_achievements),
      edited_todos        = COALESCE(NULLIF(edited_todos, ''),        aria_draft_todos),
      edited_goals        = COALESCE(NULLIF(edited_goals, ''),        aria_draft_goals),
      edited_social       = COALESCE(NULLIF(edited_social, ''),       aria_draft_social),
      edited_pipeline     = COALESCE(NULLIF(edited_pipeline, ''),     aria_draft_pipeline),
      is_submitted        = TRUE,
      submitted_at        = NOW(),
      updated_at          = NOW()
     WHERE id = $1
     RETURNING *`,
    [entry_id]
  );

  return result.rows[0];
};

// ── Raw data gathering (for ARIA context) ────────────────────────

/**
 * Gather all the data ARIA needs to draft a brand's weekly report.
 * Queries tasks, invoices, briefs, goals, and pipeline.
 * Returns structured data — passed to the ARIA service.
 */
const gatherWeekData = async (brand_id, brand_admin_id, week_start, week_end) => {
  const weekStart = week_start;
  const weekEnd = week_end + ' 23:59:59';

  const [
    tasks_completed,
    tasks_open,
    invoices_this_week,
    payments_this_week,
    briefs_active,
    goals,
    pipeline_notes,
  ] = await Promise.all([

    // Tasks verified/completed this week for this brand
    query(
      `SELECT t.title, t.description, t.proof_link, u.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.brand_id = $1
         AND t.status IN ('done', 'verified')
         AND t.updated_at BETWEEN $2 AND $3
       ORDER BY t.updated_at DESC
       LIMIT 20`,
      [brand_id, weekStart, weekEnd]
    ).catch(() => ({ rows: [] })),

    // Open/in-progress tasks (to-do list for next week)
    query(
      `SELECT t.title, t.description, t.status, t.due_date,
              u.name AS assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.brand_id = $1
         AND t.status IN ('todo', 'to_do', 'in_progress', 'in_verification')
       ORDER BY t.due_date ASC NULLS LAST, t.created_at ASC
       LIMIT 15`,
      [brand_id]
    ).catch(() => ({ rows: [] })),

    // Invoices sent/created this week
    query(
      `SELECT inv.invoice_number, inv.amount, inv.status, inv.due_date, inv.description
       FROM invoices inv
       WHERE inv.brand_id = $1
         AND inv.created_at BETWEEN $2 AND $3
       ORDER BY inv.created_at DESC`,
      [brand_id, weekStart, weekEnd]
    ).catch(() => ({ rows: [] })),

    // Payments received this week
    query(
      `SELECT p.amount, p.payment_date, p.reference, inv.invoice_number
       FROM payments p
       LEFT JOIN invoices inv ON inv.id = p.invoice_id
       WHERE inv.brand_id = $1
         AND p.payment_date BETWEEN $2 AND $3
       ORDER BY p.payment_date DESC`,
      [brand_id, weekStart, weekEnd]
    ).catch(() => ({ rows: [] })),

    // Active briefs and their status
    query(
      `SELECT b.title, b.status, b.is_bau, b.created_at, b.description
       FROM briefs b
       WHERE b.brand_id = $1
         AND b.status NOT IN ('closed', 'cancelled', 'archived')
       ORDER BY b.created_at DESC
       LIMIT 10`,
      [brand_id]
    ).catch(() => ({ rows: [] })),

    // Brand goals / OKR status
    query(
      `SELECT g.title, g.description, g.progress_pct, g.status,
              g.target_value, g.current_value, g.deadline
       FROM brand_goals g
       WHERE g.brand_id = $1
         AND g.status NOT IN ('completed', 'cancelled')
       ORDER BY g.deadline ASC NULLS LAST
       LIMIT 8`,
      [brand_id]
    ).catch(() => ({ rows: [] })),

    // Pipeline notes for this BA's opportunities (Phase 1 integration)
    query(
      `SELECT
         o.company_name, o.deal_title, o.stage, o.estimated_value,
         own.notes AS weekly_note,
         own.week_start AS note_week,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - o.stage_changed_at)) / 86400) AS days_in_stage
       FROM opportunities o
       LEFT JOIN opportunity_weekly_notes own
         ON own.opportunity_id = o.id AND own.week_start = $2
       WHERE o.lead_ba_id = $1
         AND o.stage NOT IN ('won', 'lost_paused')
       ORDER BY o.stage_changed_at ASC`,
      [brand_admin_id, weekStart]
    ).catch(() => ({ rows: [] })),
  ]);

  // Outstanding invoices (overdue)
  const overdue_invoices = await query(
    `SELECT inv.invoice_number, inv.amount, inv.due_date, inv.status
     FROM invoices inv
     WHERE inv.brand_id = $1
       AND inv.status IN ('sent', 'overdue')
       AND inv.due_date < CURRENT_DATE
     ORDER BY inv.due_date ASC`,
    [brand_id]
  ).catch(() => ({ rows: [] }));

  return {
    week_start: weekStart,
    week_end: weekEnd,
    tasks_completed: tasks_completed.rows,
    tasks_open: tasks_open.rows,
    invoices_this_week: invoices_this_week.rows,
    payments_this_week: payments_this_week.rows,
    overdue_invoices: overdue_invoices.rows,
    briefs_active: briefs_active.rows,
    goals: goals.rows,
    pipeline_notes: pipeline_notes.rows,
  };
};

// ── MD Consolidated View ──────────────────────────────────────────

/**
 * Full consolidated view for MD/Admin/Super Admin.
 * Returns all entries for the given week, grouped by brand admin,
 * with submission status and comment counts.
 */
const getConsolidatedView = async (week_start) => {
  const report = await query(
    'SELECT * FROM weekly_reports WHERE week_start = $1',
    [week_start]
  );

  if (!report.rows.length) {
    return { report: null, entries: [], submission_summary: { total: 0, submitted: 0, draft: 0, not_started: 0 } };
  }

  const reportRow = report.rows[0];

  const entries = await query(
    `SELECT
       wre.*,
       b.name   AS brand_name,
       b.logo_url,
       u.name   AS brand_admin_name,
       u.email  AS brand_admin_email,
       (
         SELECT COUNT(*) FROM report_comments rc
         WHERE rc.entry_id = wre.id AND NOT rc.resolved
       )        AS unresolved_comment_count,
       (
         SELECT COUNT(*) FROM report_comments rc
         WHERE rc.entry_id = wre.id AND rc.flagged AND NOT rc.resolved
       )        AS flagged_count
     FROM weekly_report_entries wre
     JOIN brands b ON b.id = wre.brand_id
     JOIN users u ON u.id = wre.brand_admin_id
     WHERE wre.report_id = $1
     ORDER BY wre.is_submitted DESC, u.name, b.name`,
    [reportRow.id]
  );

  // Submission summary
  const total = entries.rows.length;
  const submitted = entries.rows.filter(e => e.is_submitted).length;
  const draft = entries.rows.filter(e => !e.is_submitted && e.aria_generated_at).length;
  const not_started = total - submitted - draft;

  return {
    report: reportRow,
    entries: entries.rows,
    submission_summary: { total, submitted, draft, not_started },
  };
};

/**
 * List the past N weekly reports (for the report history page).
 */
const listReports = async (limit = 12) => {
  const result = await query(
    `SELECT
       wr.*,
       COUNT(wre.id)                                           AS total_brands,
       COUNT(wre.id) FILTER (WHERE wre.is_submitted)          AS submitted_count
     FROM weekly_reports wr
     LEFT JOIN weekly_report_entries wre ON wre.report_id = wr.id
     GROUP BY wr.id
     ORDER BY wr.week_start DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

// ── Comments ─────────────────────────────────────────────────────

/**
 * Add a comment on a specific section of an entry.
 */
const addComment = async (entry_id, section, comment, author_id, flagged = false) => {
  const result = await query(
    `INSERT INTO report_comments
       (entry_id, section, author_id, comment, flagged)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [entry_id, section, author_id, comment, flagged]
  );
  return result.rows[0];
};

/**
 * Resolve a comment.
 */
const resolveComment = async (comment_id, resolved_by) => {
  const result = await query(
    `UPDATE report_comments SET
       resolved = TRUE, resolved_by = $1, resolved_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [resolved_by, comment_id]
  );
  return result.rows[0];
};

// ── Submission status helpers ─────────────────────────────────────

/**
 * Get total submission status for a week (used by Command Centre sidebar chip).
 */
const getWeekSubmissionStatus = async (week_start) => {
  const result = await query(
    `SELECT
       COUNT(wre.id)                                  AS total,
       COUNT(wre.id) FILTER (WHERE wre.is_submitted) AS submitted
     FROM weekly_reports wr
     JOIN weekly_report_entries wre ON wre.report_id = wr.id
     WHERE wr.week_start = $1`,
    [week_start]
  );

  const row = result.rows[0];
  return {
    total: Number(row?.total || 0),
    submitted: Number(row?.submitted || 0),
    week_start,
  };
};

module.exports = {
  getCurrentWeek,
  formatDate,
  getOrCreateReport,
  getBrandAdminBrands,
  getOrCreateEntry,
  getEntryWithComments,
  updateEntry,
  saveAriaDrafts,
  submitEntry,
  gatherWeekData,
  getConsolidatedView,
  listReports,
  addComment,
  resolveComment,
  getWeekSubmissionStatus,
};
