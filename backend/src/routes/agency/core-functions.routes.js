/**
 * Core Functions Routes
 *
 * GET    /api/agency/core-functions                — all functions grouped by role
 * GET    /api/agency/core-functions/mine            — the logged-in staff member's own expectations
 * POST   /api/agency/core-functions                 — add a function to a role (Super Admin + MD)
 * PATCH  /api/agency/core-functions/:id              — edit a function
 * DELETE /api/agency/core-functions/:id              — remove a function
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

// Only Super Admin + MD can define core functions (per blueprint)
const CAN_EDIT_ROLES = ['super_admin', 'managing_director'];
const canEdit = (role) => CAN_EDIT_ROLES.includes(role);

// ── GET /api/agency/core-functions ────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('role_core_functions')
      .select('*')
      .order('role', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Group by role for easy frontend rendering
    const grouped = {};
    (data ?? []).forEach(f => {
      if (!grouped[f.role]) grouped[f.role] = [];
      grouped[f.role].push(f);
    });

    sendSuccess(res, { functions: data ?? [], grouped, canEdit: canEdit(req.user.role) });
  } catch (err) { next(err); }
});

// ── GET /api/agency/core-functions/mine ───────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const [{ data: roleFunctions }, { data: overrides }] = await Promise.all([
      supabase.from('role_core_functions').select('*').eq('role', req.user.role).order('sort_order'),
      supabase.from('staff_function_overrides').select('*').eq('staff_id', req.user.id).order('created_at'),
    ]);

    sendSuccess(res, {
      roleFunctions: roleFunctions ?? [],
      overrides: overrides ?? [],
    });
  } catch (err) { next(err); }
});

// ── POST /api/agency/core-functions ───────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can define core functions');

    const { role, function_text, is_measurable, sort_order } = req.body;
    if (!role || !function_text) return sendError(res, 400, 'role and function_text are required');

    const { data, error } = await supabase
      .from('role_core_functions')
      .insert({
        role, function_text,
        is_measurable: !!is_measurable,
        sort_order: sort_order ?? 0,
        created_by: req.user.role !== 'super_admin' ? req.user.id : null,
      })
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { function: data }, 'Core function added', 201);
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/core-functions/:id ──────────────────────
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can edit core functions');

    const { function_text, is_measurable, sort_order } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (function_text !== undefined) updates.function_text = function_text;
    if (is_measurable !== undefined) updates.is_measurable = is_measurable;
    if (sort_order !== undefined)    updates.sort_order = sort_order;

    const { data, error } = await supabase
      .from('role_core_functions')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { function: data }, 'Core function updated');
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/core-functions/:id ─────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can remove core functions');
    await supabase.from('role_core_functions').delete().eq('id', req.params.id);
    sendSuccess(res, null, 'Core function removed');
  } catch (err) { next(err); }
});

module.exports = router;
