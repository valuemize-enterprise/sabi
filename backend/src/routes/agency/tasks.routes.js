/**
 * Agency Tasks Routes — Proof of Value Engine
 * GET  /api/agency/tasks
 * POST /api/agency/tasks
 * PUT  /api/agency/tasks/:id
 * POST /api/agency/tasks/:id/complete  (triggers Proof of Value Engine)
 * DELETE /api/agency/tasks/:id
 */

'use strict';

const router          = require('express').Router();
const supabase        = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }    = require('../../middleware/logger.middleware');
const povService      = require('../../services/aria/proof-of-value.service');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, goal_id, status, assigned_to, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('tasks')
      .select('*, brands(name), goals(title, metric_type, target_value, current_value), users!assigned_to(full_name, avatar_url)', { count: 'exact' });

    if (brand_id)    query = query.eq('brand_id', brand_id);
    if (goal_id)     query = query.eq('goal_id', goal_id);
    if (status)      query = query.eq('status', status);
    if (assigned_to) query = query.eq('assigned_to', assigned_to);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, goal_id, title, description, assigned_to, priority, due_date } = req.body;
    if (!brand_id || !title) return sendError(res, 400, 'brand_id and title required');

    const { data, error } = await supabase.from('tasks').insert({
      brand_id, goal_id, title, description,
      assigned_to: assigned_to || (req.user.role !== 'super_admin' ? req.user.id : null),
      priority: priority || 'medium', due_date,
    }).select().single();

    if (error) throw error;
    sendSuccess(res, { task: data }, 'Task created', 201);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'assigned_to', 'status', 'priority', 'due_date'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const { data, error } = await supabase.from('tasks').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { task: data });
  } catch (err) { next(err); }
});

// POST /api/agency/tasks/:id/complete  ← ARIA Proof of Value Engine
router.post('/:id/complete', authenticate, async (req, res, next) => {
  try {
    const { metric_before, metric_after, metric_notes } = req.body;
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, goals(*, brands(name, industry))')
      .eq('id', req.params.id).single();

    if (error || !task) return sendError(res, 404, 'Task not found');

    const povResult = await povService.analyze({
      task, goal: task.goals,
      brand: task.goals?.brands,
      metricBefore: metric_before, metricAfter: metric_after, metricNotes: metric_notes,
    });

    const { data: updated } = await supabase.from('tasks').update({
      status:       'done',
      completed_at: new Date().toISOString(),
      proof_of_value_data: povResult,
      metric_impact: { before: metric_before, after: metric_after, notes: metric_notes },
    }).eq('id', req.params.id).select().single();

    // Update goal current_value if linked
    if (task.goal_id && metric_after !== undefined) {
      await supabase.from('goals').update({ current_value: parseFloat(metric_after) }).eq('id', task.goal_id);
    }

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'COMPLETE_TASK', resourceType: 'task', resourceId: req.params.id, req });

    sendSuccess(res, { task: updated, proof_of_value: povResult });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Task deleted');
  } catch (err) { next(err); }
});

module.exports = router;
