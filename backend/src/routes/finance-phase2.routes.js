/**
 * Finance Phase 2 Routes
 *
 * Mount in server.js (after Phase 1 /api/finance routes):
 *   const financeP2Router = require('./routes/finance-phase2.routes');
 *   app.use('/api/finance', financeP2Router);
 *
 * New endpoints:
 *   GET  /api/finance/reports/aging          → aging report (all brands)
 *   GET  /api/finance/reports/aging/:brandId → aging for one brand
 *   GET  /api/finance/reports/revenue        → revenue vs target dashboard
 *   PUT  /api/finance/reports/revenue/target → upsert a target
 *   GET  /api/finance/risk                   → all brand risk scores
 *   GET  /api/finance/risk/:brandId          → single brand risk
 *   POST /api/finance/risk/:brandId/score    → trigger ARIA scoring for a brand
 *   POST /api/finance/risk/score-all         → score all brands
 *   GET  /api/finance/scheduler/log          → auto-draft audit log
 *   POST /api/finance/scheduler/run-retainers → manual trigger (for testing)
 *   POST /api/finance/scheduler/brief/:briefId → manual brief completion trigger
 */

'use strict';

const express    = require('express');
const router     = express.Router();

const aging     = require('../services/aging-report.service');
const revenue   = require('../services/revenue-tracker.service');
const risk      = require('../services/payment-risk.service');
const scheduler = require('../services/invoice-scheduler.service');
const { authenticate } = require('../middleware/auth.middleware');
const { sendError, sendSuccess } = require('../utils/response.utils');

const FINANCE_ROLES = new Set(['super_admin', 'admin', 'md', 'accountant']);
const canAccess = req => FINANCE_ROLES.has(req.user?.role);

// ── Aging report ──────────────────────────────────────────────────────────────

router.get('/reports/aging', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const report = await aging.getAgingReport();
    sendSuccess(res, { report });
  } catch (err) { next(err); }
});

router.get('/reports/aging/:brandId', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const detail = await aging.getBrandAging(req.params.brandId);
    sendSuccess(res, { invoices: detail });
  } catch (err) { next(err); }
});

// ── Revenue vs targets ────────────────────────────────────────────────────────

router.get('/reports/revenue', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const dashboard = await revenue.getRevenueDashboard();
    sendSuccess(res, { dashboard });
  } catch (err) { next(err); }
});

router.put('/reports/revenue/target', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'md'].includes(req.user?.role)) {
      return sendError(res, 403, 'Only MD or Super Admin can update revenue targets');
    }
    const { year, quarter, target_type, amount } = req.body;
    if (!year || !target_type || !amount) {
      return sendError(res, 400, 'year, target_type, and amount are required');
    }
    const target = await revenue.upsertTarget(year, quarter || null, target_type, amount, req.user.id);
    sendSuccess(res, { target }, 'Target updated');
  } catch (err) { next(err); }
});

// ── Payment risk ──────────────────────────────────────────────────────────────

router.get('/risk', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const scores = await risk.getAllRiskScores();
    sendSuccess(res, { scores });
  } catch (err) { next(err); }
});

router.get('/risk/:brandId', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const score = await risk.getBrandRisk(req.params.brandId);
    sendSuccess(res, { score });
  } catch (err) { next(err); }
});

router.post('/risk/:brandId/score', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const result = await risk.scoreBrand(req.params.brandId);
    sendSuccess(res, { result }, 'Risk score computed');
  } catch (err) { next(err); }
});

router.post('/risk/score-all', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'admin', 'md'].includes(req.user?.role)) {
      return sendError(res, 403, 'Super Admin only');
    }
    // Non-blocking — kicks off async and returns immediately
    risk.scoreAllBrands().then(results =>
      console.log(`[finance-risk] Score-all complete: ${results.length} brands processed`)
    ).catch(err => console.error('[finance-risk] Score-all failed:', err.message));

    sendSuccess(res, {}, 'Risk scoring started — all brands will be scored in the background');
  } catch (err) { next(err); }
});

// ── Scheduler ─────────────────────────────────────────────────────────────────

router.get('/scheduler/log', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const log = await scheduler.getSchedulerLog(req.query.brand_id || null);
    sendSuccess(res, { log });
  } catch (err) { next(err); }
});

// Manual trigger — for testing or running outside of cron schedule
router.post('/scheduler/run-retainers', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'admin', 'md', 'accountant'].includes(req.user?.role)) {
      return sendError(res, 403, 'Finance access required');
    }
    const result = await scheduler.runRetainerSchedule(req.user.id);
    sendSuccess(res, { result }, `Processed ${result.processed} retainer(s), skipped ${result.skipped}`);
  } catch (err) { next(err); }
});

// Brief completion trigger — call this from your briefs route when a brief is marked delivered
router.post('/scheduler/brief/:briefId', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const result = await scheduler.onBriefCompleted(req.params.briefId, req.user.id);
    sendSuccess(res, result, result.skipped ? result.reason : 'Project invoice drafted');
  } catch (err) { next(err); }
});

module.exports = router;

// ── Digest ────────────────────────────────────────────────────────────────────
// POST /api/finance/digest/send — trigger manually (cron calls this or use the endpoint)
router.post('/digest/send', authenticate, async (req, res, next) => {
  try {
    if (!['super_admin', 'md', 'accountant'].includes(req.user?.role)) {
      return sendError(res, 403, 'Finance access required');
    }
    const digest = require('../services/finance-digest.service');
    const result = await digest.sendWeeklyDigest();
    sendSuccess(res, result, `Digest sent to ${result.sent} recipient(s)`);
  } catch (err) { next(err); }
});
