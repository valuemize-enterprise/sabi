/**
 * Agency Targets Routes
 *
 * GET   /api/agency/targets?year=2026        — get targets for a year (defaults to current)
 * POST  /api/agency/targets                  — create targets for a new year
 * PATCH /api/agency/targets/:year             — update targets
 * PUT   /api/agency/targets/:year/midyear-review — mark mid-year review done
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

const CAN_EDIT_ROLES = ['super_admin', 'managing_director'];
const canEdit = (role) => CAN_EDIT_ROLES.includes(role);

// ── GET /api/agency/targets ────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can view agency targets');

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const { data, error } = await supabase.from('agency_targets').select('*').eq('year', year).single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows, that's fine
    sendSuccess(res, { targets: data || null, year });
  } catch (err) { next(err); }
});

// ── POST /api/agency/targets ───────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can set agency targets');

    const {
      year, monthly_retainer_revenue_target, quarterly_project_revenue_target,
      active_brands_target, avg_client_satisfaction_target,
      goal_achievement_rate_target, staff_retention_target, notes,
    } = req.body;

    if (!year) return sendError(res, 400, 'year is required');

    const { data, error } = await supabase
      .from('agency_targets')
      .insert({
        year, monthly_retainer_revenue_target, quarterly_project_revenue_target,
        active_brands_target, avg_client_satisfaction_target,
        goal_achievement_rate_target, staff_retention_target, notes,
        set_by: req.user.role !== 'super_admin' ? req.user.id : null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return sendError(res, 409, `Targets for ${year} already exist — use PATCH to update`);
      throw error;
    }

    sendSuccess(res, { targets: data }, `Targets set for ${year}`, 201);
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/targets/:year ────────────────────────────
router.patch('/:year', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can edit agency targets');

    const allowed = [
      'monthly_retainer_revenue_target','quarterly_project_revenue_target',
      'active_brands_target','avg_client_satisfaction_target',
      'goal_achievement_rate_target','staff_retention_target','notes',
    ];
    const updates = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const { data, error } = await supabase
      .from('agency_targets')
      .update(updates)
      .eq('year', Number(req.params.year))
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { targets: data }, 'Targets updated');
  } catch (err) { next(err); }
});

// ── PUT /api/agency/targets/:year/midyear-review ───────────────
router.put('/:year/midyear-review', authenticate, async (req, res, next) => {
  try {
    if (!canEdit(req.user.role)) return sendError(res, 403, 'Only Super Admin and MD can complete the mid-year review');

    const { data, error } = await supabase
      .from('agency_targets')
      .update({ midyear_reviewed_at: new Date().toISOString(), midyear_reviewed_by: req.user.role !== 'super_admin' ? req.user.id : null })
      .eq('year', Number(req.params.year))
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { targets: data }, 'Mid-year review recorded');
  } catch (err) { next(err); }
});

module.exports = router;
