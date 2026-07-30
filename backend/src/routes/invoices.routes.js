/**
 * Finance Routes — Sabi Intelligence Suite · Phase 1
 *
 * Mount in server.js:
 *   const financeRouter = require('./routes/invoices.routes');
 *   app.use('/api/finance', financeRouter);
 *
 * Endpoints:
 *   GET  /api/finance/summary                      → agency stats (accountant view)
 *   GET  /api/finance/invoices                     → list invoices
 *   POST /api/finance/invoices                     → create invoice
 *   GET  /api/finance/invoices/:id                 → get with line items + payments
 *   PATCH /api/finance/invoices/:id                → update draft
 *   POST /api/finance/invoices/:id/send            → mark sent
 *   POST /api/finance/invoices/:id/cancel          → cancel
 *   POST /api/finance/invoices/:id/payments        → record payment
 *   GET  /api/finance/brands/:brandId/summary      → brand dial (Command Center)
 *   POST /api/finance/sweep/overdue                → mark overdue (cron use)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { sendSuccess, sendError } = require('../utils/response');
const inv = require('../services/invoices.service');

const canAccess = (user) => inv.FINANCE_ROLES.has(user?.role) || user?.role === 'brand_admin';

// ── GET /api/finance/summary ─────────────────────────────────────────────────
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    if (!inv.FINANCE_ROLES.has(req.user.role)) return sendError(res, 403, 'Finance access required');
    const summary = await inv.getAgencyFinancialSummary();
    sendSuccess(res, { summary });
  } catch (err) { next(err); }
});

// ── GET /api/finance/invoices ────────────────────────────────────────────────
router.get('/invoices', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req.user)) return sendError(res, 403, 'Finance access required');
    const invoices = await inv.listInvoices(req.query, req.user);
    sendSuccess(res, { invoices });
  } catch (err) { next(err); }
});

// ── POST /api/finance/invoices ───────────────────────────────────────────────
router.post('/invoices', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req.user)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.createInvoice(req.body, req.user.id);
    sendSuccess(res, { invoice }, 'Invoice created', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
});

// ── GET /api/finance/invoices/:id ────────────────────────────────────────────
router.get('/invoices/:id', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req.user)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.getInvoice(req.params.id);
    sendSuccess(res, { invoice });
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
});

// ── PATCH /api/finance/invoices/:id ─────────────────────────────────────────
router.patch('/invoices/:id', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req.user)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.updateInvoice(req.params.id, req.body, req.user.id);
    sendSuccess(res, { invoice }, 'Invoice updated');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
});

// ── POST /api/finance/invoices/:id/send ──────────────────────────────────────
router.post('/invoices/:id/send', authenticate, async (req, res, next) => {
  try {
    if (!inv.FINANCE_ROLES.has(req.user.role)) return sendError(res, 403, 'Only finance team can send invoices');
    const invoice = await inv.sendInvoice(req.params.id, req.user.id);
    sendSuccess(res, { invoice }, 'Invoice marked as sent');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
});

// ── POST /api/finance/invoices/:id/cancel ────────────────────────────────────
router.post('/invoices/:id/cancel', authenticate, async (req, res, next) => {
  try {
    if (!inv.FINANCE_ROLES.has(req.user.role)) return sendError(res, 403, 'Only finance team can cancel invoices');
    const invoice = await inv.cancelInvoice(req.params.id, req.user.id);
    sendSuccess(res, { invoice }, 'Invoice cancelled');
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
});

// ── POST /api/finance/invoices/:id/payments ──────────────────────────────────
router.post('/invoices/:id/payments', authenticate, async (req, res, next) => {
  try {
    if (!inv.FINANCE_ROLES.has(req.user.role)) return sendError(res, 403, 'Only finance team can record payments');
    const result = await inv.recordPayment(req.params.id, req.body, req.user.id);
    sendSuccess(res, result, 'Payment recorded', 201);
  } catch (err) {
    if (err.status) return sendError(res, err.status, err.message);
    next(err);
  }
});

// ── GET /api/finance/brands/:brandId/summary ─────────────────────────────────
// Used by Command Center to populate the financial dial.
// Accessible by finance roles AND brand admins (for their own brand page).
router.get('/brands/:brandId/summary', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req.user)) return sendError(res, 403, 'Finance access required');
    const summary = await inv.getBrandFinancialSummary(req.params.brandId);
    sendSuccess(res, { summary });
  } catch (err) { next(err); }
});

// ── POST /api/finance/sweep/overdue ──────────────────────────────────────────
// Called by your sweep runner (cron). Marks sent invoices past due_date as overdue.
router.post('/sweep/overdue', authenticate, async (req, res, next) => {
  try {
    if (!inv.FINANCE_ROLES.has(req.user.role)) return sendError(res, 403, 'Finance access required');
    const result = await inv.markOverdueInvoices();
    sendSuccess(res, result, `Marked ${result.marked} invoice(s) as overdue`);
  } catch (err) { next(err); }
});

module.exports = router;
