/**
 * Brief Classification & Project P&L Routes
 *
 * PATCH /api/agency/briefs/:id/classify              — set work_type (retainer / new_project)
 * PATCH /api/agency/strategies/:id/pnl                — set expected_revenue + estimated_cost
 * GET   /api/agency/strategies/:id/pnl/cost-suggestion — auto-suggest cost from task hours
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

async function canManageBrand(userId, userRole, brandId) {
  if (isGlobalAdmin(userRole)) return true;
  const { data } = await supabase
    .from('staff_brand_assignments')
    .select('roles_on_brand')
    .eq('staff_id', userId)
    .eq('brand_id', brandId)
    .single();
  return (data?.roles_on_brand ?? []).includes('brand_admin');
}

// ── PATCH /api/agency/briefs/:id/classify ────────────────────
// "If it requires a new strategy, it is not BAU." — the rule, enforced in UI + here
router.patch('/briefs/:id/classify', authenticate, async (req, res, next) => {
  try {
    const { work_type } = req.body;
    if (!['retainer', 'new_project'].includes(work_type)) {
      return sendError(res, 400, 'work_type must be "retainer" or "new_project"');
    }

    const { data: brief } = await supabase.from('client_briefs').select('brand_id').eq('id', req.params.id).single();
    if (!brief) return sendError(res, 404, 'Brief not found');

    const canManage = await canManageBrand(req.user.id, req.user.role, brief.brand_id);
    if (!canManage) return sendError(res, 403, 'Only admins and brand admins can classify briefs');

    const { data, error } = await supabase
      .from('client_briefs')
      .update({
        work_type,
        classified_by: req.user.role !== 'super_admin' ? req.user.id : null,
        classified_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, title, work_type, brand_id')
      .single();

    if (error) throw error;
    sendSuccess(res, { brief: data }, `Brief classified as ${work_type === 'new_project' ? 'New Project' : 'Retainer Work'}`);
  } catch (err) { next(err); }
});

// ── GET /api/agency/strategies/:id/pnl/cost-suggestion ───────
// Auto-suggest cost = sum(estimated_hours on strategy's tasks) × agency average_hourly_rate
router.get('/strategies/:id/pnl/cost-suggestion', authenticate, async (req, res, next) => {
  try {
    const [{ data: tasks }, { data: settings }] = await Promise.all([
      supabase.from('tasks').select('estimated_hours').eq('strategy_id', req.params.id),
      supabase.from('agency_settings').select('average_hourly_rate').eq('id', 1).single(),
    ]);

    const totalHours = (tasks ?? []).reduce((s, t) => s + (Number(t.estimated_hours) || 0), 0);
    const rate = Number(settings?.average_hourly_rate ?? 5000);
    const suggestedCost = totalHours * rate;

    sendSuccess(res, { totalHours, hourlyRate: rate, suggestedCost });
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/strategies/:id/pnl ─────────────────────
// Sets expected_revenue + estimated_cost, auto-creates the linked 'expected' invoice
router.patch('/strategies/:id/pnl', authenticate, async (req, res, next) => {
  try {
    const { expected_revenue, estimated_cost, due_date } = req.body;

    if (expected_revenue == null || expected_revenue < 0) return sendError(res, 400, 'expected_revenue is required and must be ≥ 0');
    if (estimated_cost == null || estimated_cost < 0)     return sendError(res, 400, 'estimated_cost is required and must be ≥ 0');

    const { data: strategy } = await supabase.from('strategies').select('id, brand_id, title, brief_id, pnl_status').eq('id', req.params.id).single();
    if (!strategy) return sendError(res, 404, 'Strategy not found');

    const canManage = await canManageBrand(req.user.id, req.user.role, strategy.brand_id);
    if (!canManage) return sendError(res, 403, 'Only admins and brand admins can set project P&L');

    const { data: updated, error } = await supabase
      .from('strategies')
      .update({ expected_revenue, estimated_cost, pnl_status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, title, brand_id, brief_id, expected_revenue, estimated_cost, pnl_status')
      .single();

    if (error) throw error;

    // Auto-create the 'expected' invoice linked to this strategy/brief
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        brand_id:     strategy.brand_id,
        invoice_type: 'project',
        brief_id:     strategy.brief_id || null,
        strategy_id:  strategy.id,
        amount:       expected_revenue,
        due_date:     due_date || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), // default 30 days out
        status:       'expected',
        reference:    `Project: ${strategy.title}`,
        created_by:   req.user.role !== 'super_admin' ? req.user.id : null,
      })
      .select()
      .single();

    if (invErr) throw invErr;

    sendSuccess(res, {
      strategy: updated,
      invoice,
      grossMargin: expected_revenue - estimated_cost,
    }, 'P&L saved and invoice created');
  } catch (err) { next(err); }
});

module.exports = router;
