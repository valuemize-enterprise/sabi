/**
 * Finance Routes — Sabi Finance Module Phase 1
 *
 * Mount in server.js:
 *   const financeRouter = require('./routes/finance.routes');
 *   app.use('/api/finance', financeRouter);
 *
 * Endpoints:
 *   GET    /api/finance/summary                       → overview stats
 *   GET    /api/finance/brands                        → brands list for dropdowns
 *   GET    /api/finance/brands/:brandId               → per-brand financial summary
 *   GET    /api/finance/invoices                      → list with filters
 *   POST   /api/finance/invoices                      → create invoice
 *   GET    /api/finance/invoices/:id                  → single invoice + line items + payments
 *   PUT    /api/finance/invoices/:id                  → update (draft only)
 *   POST   /api/finance/invoices/:id/send             → send to client
 *   POST   /api/finance/invoices/:id/cancel           → cancel invoice
 *   POST   /api/finance/invoices/:id/payments         → record payment
 *   POST   /api/finance/auto-draft/retainer/:brandId  → auto-draft retainer
 *   POST   /api/finance/auto-draft/brief/:briefId     → auto-draft from brief
 *   GET    /api/finance/payments                      → all payments (with filters)
 */

'use strict';

const router        = express.Router();
const { authenticate }    = require('../middleware/auth.middleware');
const { sendSuccess, sendError } = require('');
const inv           = require('../services/invoice.service');
const finEmail      = require('../services/finance-email.service');
const  supabase   = require('../config/supabase');

const FINANCE_ROLES = inv.FINANCE_ROLES;

function canAccess(req) {
  return FINANCE_ROLES.has(req.user?.role);
}


// ── GET /api/finance/summary ─────────────────────────────────────────────────
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const summary = await inv.getSummary();
    sendSuccess(res, { summary });
  } catch (err) { next(err); }
});

// ── GET /api/finance/brands/:brandId ─────────────────────────────────────────
router.get('/brands/:brandId', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const financials = await inv.getBrandFinancials(req.params.brandId);
    sendSuccess(res, { financials });
  } catch (err) { next(err); }
});

// ── GET /api/finance/invoices ─────────────────────────────────────────────────
router.get('/invoices', authenticate, async (req, res, next) => {
  try {
    const { brand_id, status, type, from_date, to_date, limit, offset } = req.query;
    const result = await inv.listInvoices(
      { brand_id, status, type, from_date, to_date, limit: Number(limit) || 50, offset: Number(offset) || 0 },
      req.user
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// ── POST /api/finance/invoices ────────────────────────────────────────────────
router.post('/invoices', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.createInvoice(req.body, req.user.id);
    sendSuccess(res, { invoice }, 'Invoice created', 201);
  } catch (err) { next(err); }
});

// ── GET /api/finance/invoices/:id ─────────────────────────────────────────────
router.get('/invoices/:id', authenticate, async (req, res, next) => {
  try {
    const invoice = await inv.getInvoice(req.params.id);
    sendSuccess(res, { invoice });
  } catch (err) { next(err); }
});

// ── PUT /api/finance/invoices/:id ─────────────────────────────────────────────
router.put('/invoices/:id', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.updateInvoice(req.params.id, req.body, req.user.id);
    sendSuccess(res, { invoice });
  } catch (err) { next(err); }
});

// ── POST /api/finance/invoices/:id/send ──────────────────────────────────────
router.post('/invoices/:id/send', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.sendInvoice(req.params.id, req.user.id);

    // Fire email to client (non-blocking — don't fail the request if email fails)
    finEmail.sendInvoiceEmail(invoice).catch(e =>
      console.error('[finance] Invoice email failed:', e.message)
    );

    sendSuccess(res, { invoice }, 'Invoice sent to client');
  } catch (err) { next(err); }
});

// ── POST /api/finance/invoices/:id/cancel ─────────────────────────────────────
router.post('/invoices/:id/cancel', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.cancelInvoice(req.params.id);
    sendSuccess(res, { invoice }, 'Invoice cancelled');
  } catch (err) { next(err); }
});

// ── POST /api/finance/invoices/:id/payments ───────────────────────────────────
router.post('/invoices/:id/payments', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const result  = await inv.recordPayment(req.params.id, req.body, req.user.id);

    // Send payment confirmation email
    const fullInvoice = await inv.getInvoice(req.params.id);
    finEmail.sendPaymentConfirmation(fullInvoice, result.payment).catch(e =>
      console.error('[finance] Payment confirmation email failed:', e.message)
    );

    sendSuccess(res, result, 'Payment recorded');
  } catch (err) { next(err); }
});

// ── POST /api/finance/auto-draft/retainer/:brandId ───────────────────────────
router.post('/auto-draft/retainer/:brandId', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.autoDraftRetainer(req.params.brandId, req.user.id);
    sendSuccess(res, { invoice }, 'Retainer invoice drafted', 201);
  } catch (err) { next(err); }
});

// ── POST /api/finance/auto-draft/brief/:briefId ──────────────────────────────
router.post('/auto-draft/brief/:briefId', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const invoice = await inv.autoDraftFromBrief(req.params.briefId, req.user.id);
    sendSuccess(res, { invoice }, 'Project invoice drafted from brief', 201);
  } catch (err) { next(err); }
});

// ── GET /api/finance/payments ─────────────────────────────────────────────────
router.get('/payments', authenticate, async (req, res, next) => {
  try {
    if (!canAccess(req)) return sendError(res, 403, 'Finance access required');
    const { brand_id, from_date, to_date, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('payments')
      .select(`*, invoice:invoices(invoice_number, type), brand:brands(name)`, { count: 'exact' })
      .order('payment_date', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (brand_id)  query = query.eq('brand_id', brand_id);
    if (from_date) query = query.gte('payment_date', from_date);
    if (to_date)   query = query.lte('payment_date', to_date);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    sendSuccess(res, { payments: data || [], total: count || 0 });
  } catch (err) { next(err); }
});

module.exports = router;
