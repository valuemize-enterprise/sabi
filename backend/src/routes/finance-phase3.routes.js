/**
 * Finance Phase 3 Routes
 *
 * Mount in server.js:
 *   const financeP3 = require('./routes/finance-phase3.routes');
 *   app.use('/api/finance', financeP3);
 *   app.use('/api/client-portal', financeP3); // client portal routes use a different prefix
 *
 * OR mount separately:
 *   const { financeRouter, clientPortalRouter } = require('./routes/finance-phase3.routes');
 *   app.use('/api/finance', financeRouter);
 *   app.use('/api/client-portal', clientPortalRouter);
 *
 * Finance endpoints:
 *   GET  /api/finance/expenses                 → list expenses
 *   POST /api/finance/expenses                 → create expense
 *   PUT  /api/finance/expenses/:id             → update expense
 *   DEL  /api/finance/expenses/:id             → delete expense
 *   GET  /api/finance/expenses/summary         → category totals for a period
 *   GET  /api/finance/reports/pnl              → monthly P&L (?year=2026&brand_id=...)
 *   GET  /api/finance/reports/pnl/annual       → year-over-year summary
 *   GET  /api/finance/reports/pnl/brands       → per-brand P&L (?year=2026)
 *   GET  /api/finance/reports/vat              → quarterly VAT (?year=2026&quarter=3)
 *   GET  /api/finance/reports/vat/annual       → full year VAT summary
 *   GET  /api/finance/invoices/:id/pdf         → download invoice as PDF
 *   POST /api/finance/portal/invite            → send client portal invite email
 *
 * Client portal endpoints (no staff JWT — uses portal JWT):
 *   GET  /api/client-portal/auth               → exchange magic-link token for portal JWT
 *   GET  /api/client-portal/invoices           → client's invoice list
 *   GET  /api/client-portal/invoices/:id       → invoice detail + line items
 *   GET  /api/client-portal/invoices/:id/pdf   → download invoice PDF
 *   GET  /api/client-portal/brand              → brand info for portal header
 */

'use strict';

const express  = require('express');
const exp      = require('../services/expense.service');
const pnl      = require('../services/pnl-report.service');
const vat      = require('../services/vat-report.service');
const pdf      = require('../services/invoice-pdf.service');
const portal   = require('../services/client-portal.service');
const inv           = require('../services/invoice.service');
const { getInvoice } = require('../services/invoice.service');
const  supabase    = require('../config/supabase');
const { authenticate } = require('../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../utils/response.utils');

const FINANCE_ROLES = exp.FINANCE_ROLES;
const canAccess = req => FINANCE_ROLES.has(req.user?.role);

// ══════════════════════════════════════════════════════════════════
// FINANCE ROUTER
// ══════════════════════════════════════════════════════════════════
const financeRouter = express.Router();

// ── Expenses ──────────────────────────────────────────────────────────────────


// GET /api/finance/summary
// financeRouter.get('/summary', async (req, res) => {
//   try {
//     const { data: invoices, error } = await supabase
//       .from('invoices')
//       .select('id, amount, status, due_date');

//     if (error) throw new Error(error.message);

//     const all     = invoices || [];
//     const today   = new Date().toISOString().split('T')[0];
//     const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

//     const counts = {
//       draft:   all.filter(i => i.status === 'draft').length,
//       sent:    all.filter(i => i.status === 'sent').length,
//       overdue: all.filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date < today)).length,
//       paid:    all.filter(i => i.status === 'paid').length,
//     };

//     const sum = (arr) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);

//     res.json({
//       counts,
//       total_outstanding: sum(all.filter(i => ['sent', 'overdue'].includes(i.status))),
//       total_paid_month:  sum(all.filter(i => i.status === 'paid' && i.due_date >= monthStart)),
//       overdue_amount:    sum(all.filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date < today))),
//       total_invoices:    all.length,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

financeRouter.get('/expenses/summary', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const summary = await exp.getExpenseSummary(req.query);
    sendSuccess(res, { summary });
  } catch (err) { next(err); }
});

financeRouter.get('/expenses', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const result = await exp.listExpenses(req.query);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

financeRouter.post('/expenses', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const expense = await exp.createExpense(req.body, req.user.id);
    sendSuccess(res, { expense }, 'Expense recorded', 201);
  } catch (err) { next(err); }
});

// ── GET /api/finance/brands ──────────────────────────────────────────────────
financeRouter.get('/brands', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const brands = await inv.getBrands();
    sendSuccess(res, { brands });
  } catch (err) { next(err); }
});

financeRouter.put('/expenses/:id', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const expense = await exp.updateExpense(req.params.id, req.body);
    sendSuccess(res, { expense });
  } catch (err) { next(err); }
});

financeRouter.delete('/expenses/:id', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    await exp.deleteExpense(req.params.id);
    sendSuccess(res, {}, 'Expense deleted');
  } catch (err) { next(err); }
});

// ── P&L reports ───────────────────────────────────────────────────────────────

financeRouter.get('/reports/pnl/annual', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const summary = await pnl.getAnnualSummary();
    sendSuccess(res, { summary });
  } catch (err) { next(err); }
});

financeRouter.get('/reports/pnl/brands', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const year = req.query.year || new Date().getFullYear();
    const brands = await pnl.getBrandPnLSummary(year);
    sendSuccess(res, { brands, year: Number(year) });
  } catch (err) { next(err); }
});

financeRouter.get('/reports/pnl', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const { year = new Date().getFullYear(), brand_id } = req.query;
    const report = await pnl.getMonthlyPnL(year, brand_id || null);
    sendSuccess(res, { report });
  } catch (err) { next(err); }
});

// ── VAT reports ───────────────────────────────────────────────────────────────

financeRouter.get('/reports/vat/annual', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const year   = req.query.year || new Date().getFullYear();
    const report = await vat.getAnnualVAT(year);
    sendSuccess(res, { report });
  } catch (err) { next(err); }
});

financeRouter.get('/reports/vat', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const year    = req.query.year    || new Date().getFullYear();
    const quarter = req.query.quarter || Math.ceil((new Date().getMonth() + 1) / 3);
    const report  = await vat.getQuarterlyVAT(year, quarter);
    sendSuccess(res, { report });
  } catch (err) { next(err); }
});

// ── Invoice PDF download ──────────────────────────────────────────────────────

financeRouter.get('/invoices/:id/pdf', authenticate, async (req, res, next) => {
  try {
    const invoice = await getInvoice(req.params.id);
    const pdfBuffer = await pdf.generateInvoicePDF(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) { next(err); }
});

// ── Client portal invite ──────────────────────────────────────────────────────

financeRouter.post('/portal/invite', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const { brand_id, email } = req.body;
    if (!brand_id || !email) return sendError(res, 400, 'brand_id and email are required');
    const result = await portal.sendPortalInvite(brand_id, email, req.user.id);
    sendSuccess(res, result, 'Portal invite sent');
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════
// CLIENT PORTAL ROUTER (no staff auth — uses portal JWT)
// ══════════════════════════════════════════════════════════════════
const clientPortalRouter = express.Router();

// Client portal JWT middleware
function portalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return sendError(res, 401, 'Portal authentication required');
  try {
    req.portalUser = portal.verifyPortalToken(auth.split(' ')[1]);
    next();
  } catch (err) {
    sendError(res, 401, err.message);
  }
}

// Exchange magic-link token for portal JWT
clientPortalRouter.get('/auth', async (req, res, next) => {
  try {
    const { token } = req.query;
    const result = await portal.authenticateToken(token);
    sendSuccess(res, result, 'Portal access granted');
  } catch (err) { next(err); }
});

// Client invoice list
clientPortalRouter.get('/invoices', portalAuth, async (req, res, next) => {
  try {
    const invoices = await portal.getClientInvoices(req.portalUser.brand_id);
    sendSuccess(res, { invoices });
  } catch (err) { next(err); }
});

// Single invoice with line items
clientPortalRouter.get('/invoices/:id', portalAuth, async (req, res, next) => {
  try {
    const invoice = await portal.getClientInvoiceDetail(req.params.id, req.portalUser.brand_id);
    sendSuccess(res, { invoice });
  } catch (err) { next(err); }
});

// Invoice PDF from client portal
clientPortalRouter.get('/invoices/:id/pdf', portalAuth, async (req, res, next) => {
  try {
    const invoice   = await portal.getClientInvoiceDetail(req.params.id, req.portalUser.brand_id);
    const pdfBuffer = await pdf.generateInvoicePDF(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) { next(err); }
});

// Brand info for portal header
clientPortalRouter.get('/brand', portalAuth, async (req, res, next) => {
  try {
    const brand = await portal.getClientBrandInfo(req.portalUser.brand_id);
    sendSuccess(res, { brand, email: req.portalUser.email });
  } catch (err) { next(err); }
});

module.exports = { financeRouter, clientPortalRouter };
