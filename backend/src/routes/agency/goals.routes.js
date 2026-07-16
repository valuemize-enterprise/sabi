/**
 * Agency Goals Routes
 * GET  /api/agency/goals
 * POST /api/agency/goals
 * GET  /api/agency/goals/:id
 * PUT  /api/agency/goals/:id
 * POST /api/agency/goals/:id/track-velocity  (ARIA VelocityTracker™)
 * DELETE /api/agency/goals/:id
 */

'use strict';

const router           = require('express').Router();
const supabase         = require('../../config/supabase');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }     = require('../../middleware/logger.middleware');
const velocityService  = require('../../services/aria/velocity-tracker.service');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('goals')
      .select('*, brands(name, logo_url)', { count: 'exact' });

    if (brand_id) query = query.eq('brand_id', brand_id);
    if (status)   query = query.eq('status', status);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requirePermission('CREATE_GOAL'), async (req, res, next) => {
  try {
    const { brand_id, title, description, metric_type, target_value, unit, deadline } = req.body;
    if (!brand_id || !title || !metric_type || target_value === undefined) {
      return sendError(res, 400, 'brand_id, title, metric_type, and target_value required');
    }

    const { data, error } = await supabase.from('goals').insert({
      brand_id, title, description, metric_type,
      target_value: parseFloat(target_value),
      unit: unit || '#',
      deadline,
      created_by: req.user.role !== 'super_admin' ? req.user.id : null,
    }).select().single();

    if (error) throw error;
    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_GOAL', resourceType: 'goal', resourceId: data.id, details: { title }, req });

    sendSuccess(res, { goal: data }, 'Goal created', 201);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*, brands(name, logo_url), tasks(id, title, status, completed_at)')
      .eq('id', req.params.id).single();

    if (error || !data) return sendError(res, 404, 'Goal not found');
    sendSuccess(res, { goal: data });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, requirePermission('EDIT_GOAL'), async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'target_value', 'current_value', 'unit', 'deadline', 'status'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.status === 'achieved') updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase.from('goals').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { goal: data });
  } catch (err) { next(err); }
});

// POST /api/agency/goals/:id/track-velocity  ← ARIA VelocityTracker™
router.post('/:id/track-velocity', authenticate, async (req, res, next) => {
  try {
    const { data: goal, error } = await supabase.from('goals').select('*, brands(name, industry)').eq('id', req.params.id).single();
    if (error || !goal) return sendError(res, 404, 'Goal not found');

    const { data: tasks } = await supabase.from('tasks').select('*').eq('goal_id', req.params.id);
    const result = await velocityService.analyze({ goal, tasks: tasks || [], brand: goal.brands });

    await supabase.from('goals').update({ velocity_score: result.velocityScore, velocity_data: result }).eq('id', req.params.id);

    sendSuccess(res, result);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('goals').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Goal deleted');
  } catch (err) { next(err); }
});

module.exports = router;
