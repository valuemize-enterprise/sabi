/**
 * Financials Routes
 *
 * Brand-level (Brand Admin: view only | Global Admin: full control)
 *   GET   /api/agency/brands/:id/financials            — retainer + scope + invoices
 *   PATCH /api/agency/brands/:id/financials             — update retainer/scope (Global Admin only)
 *   POST  /api/agency/brands/:id/financials/invoices    — add a manual invoice (Global Admin only)
 *   PATCH /api/agency/financials/invoices/:invoiceId    — update invoice status (Global Admin only)
 *
 * Agency-wide (Global Admin only)
 *   GET   /api/agency/finance/overview                  — cross-brand summary for /finance page
 *   GET   /api/agency/finance/overdue                    — all overdue invoices across brands
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

// Check if user can VIEW a brand's financials (global admin OR brand admin of that brand)
async function canViewBrandFinancials(userId, userRole, brandId) {
  if (isGlobalAdmin(userRole)) return true;
  const { data } = await supabase
    .from('staff_brand_assignments')
    .select('roles_on_brand, role_on_brand')
    .eq('staff_id', userId)
    .eq('brand_id', brandId);
  return (data ?? []).some(a =>
    (a.roles_on_brand ?? []).includes('brand_admin') || a.role_on_brand === 'brand_admin'
  );
}

// Auto-flip any invoice past its due_date to 'overdue' (called on every read — no cron needed)
async function flipOverdueInvoices(brandId = null) {
  let query = supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .in('status', ['expected', 'invoiced'])
    .lt('due_date', new Date().toISOString().slice(0, 10));
  if (brandId) query = query.eq('brand_id', brandId);
  await query;
}

// ── GET /api/agency/brands/:id/financials ────────────────────
router.get('/brands/:id/financials', authenticate, async (req, res, next) => {
  try {
    const canView = await canViewBrandFinancials(req.user.id, req.user.role, req.params.id);
    if (!canView) return sendError(res, 403, 'You do not have access to this brand\'s financials');

    await flipOverdueInvoices(req.params.id);

    const [{ data: financials }, { data: invoices }] = await Promise.all([
      supabase.from('brand_financials').select('*').eq('brand_id', req.params.id).single(),
      supabase.from('invoices').select('*').eq('brand_id', req.params.id).order('due_date', { ascending: false }).limit(50),
    ]);

    // Monthly revenue summary (last 6 months, paid invoices)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const { data: paidHistory } = await supabase
      .from('invoices')
      .select('amount, paid_date, invoice_type')
      .eq('brand_id', req.params.id)
      .eq('status', 'paid')
      .gte('paid_date', sixMonthsAgo.toISOString().slice(0, 10));

    sendSuccess(res, {
      financials: financials || null,
      invoices: invoices || [],
      paidHistory: paidHistory || [],
      canEdit: isGlobalAdmin(req.user.role),
    });
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/brands/:id/financials ──────────────────
router.patch('/brands/:id/financials', authenticate, async (req, res, next) => {
  try {
    if (!isGlobalAdmin(req.user.role)) return sendError(res, 403, 'Only global admins can edit financial records');

    const {
      retainer_amount, billing_cycle, billing_day, currency,
      retainer_scope, scope_agreed_date, notes,
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    const allowed = { retainer_amount, billing_cycle, billing_day, currency, retainer_scope, scope_agreed_date, notes };
    Object.entries(allowed).forEach(([k, v]) => { if (v !== undefined) updates[k] = v; });

    // Upsert since brand_financials may not have a row yet
    const { data, error } = await supabase
      .from('brand_financials')
      .upsert({ brand_id: req.params.id, ...updates }, { onConflict: 'brand_id' })
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { financials: data }, 'Financial details updated');
  } catch (err) { next(err); }
});

// ── POST /api/agency/brands/:id/financials/invoices ──────────
router.post('/brands/:id/financials/invoices', authenticate, async (req, res, next) => {
  try {
    if (!isGlobalAdmin(req.user.role)) return sendError(res, 403, 'Only global admins can create invoices');

    const { invoice_type, amount, due_date, reference, brief_id, strategy_id } = req.body;
    if (!invoice_type || !amount || !due_date) return sendError(res, 400, 'invoice_type, amount, and due_date are required');

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        brand_id: req.params.id, invoice_type, amount, due_date,
        reference: reference || null, brief_id: brief_id || null, strategy_id: strategy_id || null,
        status: 'expected', created_by: req.user.role !== 'super_admin' ? req.user.id : null,
      })
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { invoice: data }, 'Invoice created', 201);
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/financials/invoices/:invoiceId ─────────
router.patch('/financials/invoices/:invoiceId', authenticate, async (req, res, next) => {
  try {
    if (!isGlobalAdmin(req.user.role)) return sendError(res, 403, 'Only global admins can update invoices');

    const { status, paid_date, reference } = req.body;
    const valid = ['expected','invoiced','paid','overdue','cancelled'];
    if (status && !valid.includes(status)) return sendError(res, 400, `status must be one of: ${valid.join(', ')}`);

    const updates = { updated_at: new Date().toISOString() };
    if (status)     updates.status = status;
    if (reference !== undefined) updates.reference = reference;
    if (status === 'paid') updates.paid_date = paid_date || new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', req.params.invoiceId)
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { invoice: data }, 'Invoice updated');
  } catch (err) { next(err); }
});

// ── GET /api/agency/finance/overview ──────────────────────────
router.get('/finance/overview', authenticate, async (req, res, next) => {
  try {
    if (!isGlobalAdmin(req.user.role)) return sendError(res, 403, 'Only global admins can view agency-wide financials');

    await flipOverdueInvoices();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [{ data: thisMonth }, { data: overdue }, { data: brands }] = await Promise.all([
      supabase.from('invoices').select('amount, status, invoice_type, brand_id').gte('due_date', monthStart).lte('due_date', monthEnd),
      supabase.from('invoices').select('id, amount, due_date, brand_id, invoice_type, brands(name)').eq('status', 'overdue').order('due_date', { ascending: true }),
      supabase.from('brands').select('id, name').eq('status', 'active'),
    ]);

    const expected = (thisMonth ?? []).reduce((s, i) => s + Number(i.amount), 0);
    const collected = (thisMonth ?? []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
    const retainerRevenue = (thisMonth ?? []).filter(i => i.invoice_type === 'retainer' && i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
    const projectRevenue  = (thisMonth ?? []).filter(i => i.invoice_type === 'project'  && i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);

    // Revenue by brand (paid this month)
    const byBrand = {};
    (thisMonth ?? []).filter(i => i.status === 'paid').forEach(i => {
      byBrand[i.brand_id] = (byBrand[i.brand_id] || 0) + Number(i.amount);
    });
    const revenueByBrand = (brands ?? []).map(b => ({ brand_id: b.id, brand_name: b.name, revenue: byBrand[b.id] || 0 }))
      .sort((a, b) => b.revenue - a.revenue);

    sendSuccess(res, {
      month: now.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }),
      expected, collected,
      collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
      retainerRevenue, projectRevenue,
      overdueCount: (overdue ?? []).length,
      overdueTotal: (overdue ?? []).reduce((s, i) => s + Number(i.amount), 0),
      overdueInvoices: overdue ?? [],
      revenueByBrand,
    });
  } catch (err) { next(err); }
});

module.exports = router;
