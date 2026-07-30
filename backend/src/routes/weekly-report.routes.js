// ═══════════════════════════════════════════════════════════════════
// weekly-report.routes.js
// Sabi Intelligence Suite — Weekly Intelligence Report (Phase 1)
//
// Mount in server.js:
//   const weeklyReportRouter = require('./routes/weekly-report.routes');
//   app.use('/api/weekly-report', requireAuth, weeklyReportRouter);
//
// Roles:
//   Brand Admin  → view/edit their own brands' entries
//   Admin / MD / Super Admin → consolidated view + comments on all
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router = express.Router();
const weeklyReportService = require('../services/weekly-report.service');
const ariaService = require('../services/weekly-report-aria.service');

const LEADERSHIP = ['admin', 'md', 'super_admin'];
const ALL_EDITORS = ['brand_admin', 'admin', 'md', 'super_admin'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ── Current week helpers ──────────────────────────────────────────

// GET /api/weekly-report/current-week
// Returns the current week's start/end dates — used to initialise the page
router.get('/current-week', requireRoles(...ALL_EDITORS), (req, res) => {
  res.json(weeklyReportService.getCurrentWeek());
});

// GET /api/weekly-report/history
// List past weekly reports (for archive/history view)
router.get('/history', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const reports = await weeklyReportService.listReports(24);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load report history', message: err.message });
  }
});

// GET /api/weekly-report/status
// Quick submission status for the current week (used by sidebar badge)
router.get('/status', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const { week_start } = weeklyReportService.getCurrentWeek();
    const status = await weeklyReportService.getWeekSubmissionStatus(week_start);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get status', message: err.message });
  }
});

// ── Brand list for the BA's left panel ───────────────────────────

// GET /api/weekly-report/brands?week_start=YYYY-MM-DD
// Returns the brand list with per-brand submission status
router.get('/brands', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const week_start = req.query.week_start || weeklyReportService.getCurrentWeek().week_start;
    const brands = await weeklyReportService.getBrandAdminBrands(
      req.user.id,
      week_start,
      req.user.role
    );
    res.json({ brands, week_start });
  } catch (err) {
    console.error('[WeeklyReport] getBrands error:', err);
    res.status(500).json({ error: 'Failed to load brands', message: err.message });
  }
});

// ── Report entry (per brand) ──────────────────────────────────────

// GET /api/weekly-report/entry?week_start=YYYY-MM-DD&brand_id=UUID
// Get or create an entry for this brand + week. Creates the weekly_report
// container if needed. Returns the full entry with comments.
router.get('/entry', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const { week_start, brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });

    const effectiveWeekStart = week_start || weeklyReportService.getCurrentWeek().week_start;
    const report = await weeklyReportService.getOrCreateReport(effectiveWeekStart);

    // For leadership, use the BA's ID from query param; for BA, use their own ID
    const brand_admin_id = LEADERSHIP.includes(req.user.role)
      ? (req.query.brand_admin_id || req.user.id)
      : req.user.id;

    const entry = await weeklyReportService.getOrCreateEntry(
      report.id,
      brand_id,
      brand_admin_id
    );

    const entryWithComments = await weeklyReportService.getEntryWithComments(entry.id);
    res.json({ entry: entryWithComments, report });
  } catch (err) {
    console.error('[WeeklyReport] getEntry error:', err);
    res.status(500).json({ error: 'Failed to load entry', message: err.message });
  }
});

// POST /api/weekly-report/entry/:entry_id/generate
// Trigger ARIA to generate all draft sections for an entry.
// This is the "Generate with ARIA" action — can be called on demand or
// triggered automatically when the BA first opens the report for the week.
router.post('/entry/:entry_id/generate', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const { entry_id } = req.params;
    const entry = await weeklyReportService.getEntryWithComments(entry_id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Only the assigned BA or leadership can trigger generation
    if (!LEADERSHIP.includes(req.user.role) && entry.brand_admin_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Gather the raw week data
    const weekData = await weeklyReportService.gatherWeekData(
      entry.brand_id,
      entry.brand_admin_id,
      entry.week_start,
      entry.week_end
    );

    // Generate all sections
    const drafts = await ariaService.generateAllDrafts(
      entry.brand_name,
      entry.brand_admin_name,
      weekData
    );

    // Persist drafts
    const updated = await weeklyReportService.saveAriaDrafts(entry_id, drafts);

    res.json({
      entry: updated,
      message: 'ARIA has drafted all six sections. Review and edit before submitting.',
    });
  } catch (err) {
    console.error('[WeeklyReport] generateDrafts error:', err);
    res.status(500).json({ error: 'ARIA generation failed', message: err.message });
  }
});

// PATCH /api/weekly-report/entry/:entry_id
// Save BA edits to one or more sections.
// Body: { edited_payment, edited_achievements, edited_todos, edited_goals, edited_pipeline, brand_admin_notes }
router.patch('/entry/:entry_id', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const { entry_id } = req.params;
    const entry = await weeklyReportService.getEntryWithComments(entry_id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    if (!LEADERSHIP.includes(req.user.role) && entry.brand_admin_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (entry.is_submitted && !LEADERSHIP.includes(req.user.role)) {
      return res.status(400).json({ error: 'Submitted reports cannot be edited' });
    }

    const updated = await weeklyReportService.updateEntry(entry_id, req.body);
    res.json({ entry: updated });
  } catch (err) {
    console.error('[WeeklyReport] updateEntry error:', err);
    res.status(500).json({ error: 'Failed to save entry', message: err.message });
  }
});

// POST /api/weekly-report/entry/:entry_id/submit
// Brand Admin submits their report for the week.
router.post('/entry/:entry_id/submit', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const { entry_id } = req.params;
    const entry = await weeklyReportService.getEntryWithComments(entry_id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    if (!LEADERSHIP.includes(req.user.role) && entry.brand_admin_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const submitted = await weeklyReportService.submitEntry(entry_id, entry.brand_admin_id);
    res.json({ entry: submitted, message: `${entry.brand_name}'s report submitted for ${entry.week_start}.` });
  } catch (err) {
    console.error('[WeeklyReport] submitEntry error:', err);
    res.status(500).json({ error: 'Failed to submit', message: err.message });
  }
});

// ── MD Consolidated View ──────────────────────────────────────────

// GET /api/weekly-report/consolidated?week_start=YYYY-MM-DD
// Full consolidated view for MD/Admin/Super Admin
router.get('/consolidated', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const week_start = req.query.week_start || weeklyReportService.getCurrentWeek().week_start;
    const consolidated = await weeklyReportService.getConsolidatedView(week_start);
    res.json(consolidated);
  } catch (err) {
    console.error('[WeeklyReport] consolidated error:', err);
    res.status(500).json({ error: 'Failed to load consolidated view', message: err.message });
  }
});

// POST /api/weekly-report/consolidated/aria-summary?week_start=YYYY-MM-DD
// Generate ARIA's MD opening paragraph
router.post('/consolidated/aria-summary', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const week_start = req.query.week_start || weeklyReportService.getCurrentWeek().week_start;
    const consolidated = await weeklyReportService.getConsolidatedView(week_start);

    if (!consolidated.report) {
      return res.json({ summary: null, message: 'No report exists for this week yet.' });
    }

    const summary = await ariaService.generateMDOpeningParagraph(
      week_start,
      consolidated.entries,
      consolidated.submission_summary,
      req.body.pipeline_analytics || null
    );

    res.json({ summary, week_start });
  } catch (err) {
    console.error('[WeeklyReport] aria-summary error:', err);
    res.status(500).json({ error: 'ARIA summary generation failed', message: err.message });
  }
});

// ── Comments ──────────────────────────────────────────────────────

// POST /api/weekly-report/entry/:entry_id/comment
// MD/leadership adds a comment on a specific section
router.post('/entry/:entry_id/comment', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const { entry_id } = req.params;
    const { section, comment, flagged = false } = req.body;

    const validSections = ['payment', 'achievements', 'todos', 'goals', 'social', 'pipeline', 'general'];
    if (!validSections.includes(section)) {
      return res.status(400).json({ error: `Invalid section. Must be one of: ${validSections.join(', ')}` });
    }
    if (!comment?.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const newComment = await weeklyReportService.addComment(
      entry_id, section, comment, req.user.id, Boolean(flagged)
    );

    res.status(201).json({ comment: newComment });
  } catch (err) {
    console.error('[WeeklyReport] addComment error:', err);
    res.status(500).json({ error: 'Failed to add comment', message: err.message });
  }
});

// PATCH /api/weekly-report/comment/:comment_id/resolve
// Resolve a comment
router.patch('/comment/:comment_id/resolve', requireRoles(...ALL_EDITORS), async (req, res) => {
  try {
    const resolved = await weeklyReportService.resolveComment(
      req.params.comment_id,
      req.user.id
    );
    res.json({ comment: resolved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve comment', message: err.message });
  }
});

module.exports = router;
