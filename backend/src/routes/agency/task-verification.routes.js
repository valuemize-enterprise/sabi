/**
 * Task Verification Routes
 * The foundation everything else in Phase 2 depends on.
 * Only verified tasks contribute to anyone's score.
 *
 * PUT  /api/agency/tasks/:id/verify              — Brand Admin/Global Admin verifies a done task
 * PUT  /api/agency/tasks/:id/reject-verification  — sends it back to in_progress with a reason
 * GET  /api/agency/tasks/pending-verification     — queue for the current Brand Admin (their brands)
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');
const notify       = require('../../services/notification-triggers.service');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

async function canVerify(userId, userRole, brandId) {
  if (isGlobalAdmin(userRole)) return true;
  const { data } = await supabase
    .from('staff_brand_assignments')
    .select('roles_on_brand')
    .eq('staff_id', userId)
    .eq('brand_id', brandId)
    .single();
  return (data?.roles_on_brand ?? []).includes('brand_admin');
}

// ── PUT /api/agency/tasks/:id/verify ──────────────────────────
router.put('/:id/verify', authenticate, async (req, res, next) => {
  try {
    const { data: task } = await supabase.from('tasks').select('id, title, status, brand_id, assignee_id').eq('id', req.params.id).single();
    if (!task) return sendError(res, 404, 'Task not found');
    if (task.status !== 'done') return sendError(res, 400, 'Only tasks marked "Done" can be verified');

    const allowed = await canVerify(req.user.id, req.user.role, task.brand_id);
    if (!allowed) return sendError(res, 403, 'Only the Brand Admin or a global admin can verify tasks for this brand');

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'verified',
        verified_by: req.user.role !== 'super_admin' ? req.user.id : null,
        verified_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, title, status, assignee_id')
      .single();

    if (error) throw error;

    // Notify the assignee
    if (task.assignee_id) {
      await supabase.from('notifications').insert({
        user_id:  task.assignee_id,
        type:     'task_verified',
        title:    `✅ Task Verified: ${task.title}`,
        body:     `${req.user.full_name} verified your completed task. This counts toward your weekly score.`,
        metadata: { task_id: task.id },
        is_read:  false,
      });
    }

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'VERIFY_TASK', resourceType: 'task', resourceId: task.id,
      details: { title: task.title }, req,
    });

    notify.onTaskVerified({ id: task.id, title: task.title, assignee_id: task.assignee_id, brand_id: task.brand_id }, req.user.full_name);

    sendSuccess(res, { task: data }, 'Task verified');
  } catch (err) { next(err); }
});

// ── PUT /api/agency/tasks/:id/reject-verification ─────────────
router.put('/:id/reject-verification', authenticate, async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) return sendError(res, 400, 'A reason is required when sending a task back');

    const { data: task } = await supabase.from('tasks').select('id, title, status, brand_id, assignee_id').eq('id', req.params.id).single();
    if (!task) return sendError(res, 404, 'Task not found');

    const allowed = await canVerify(req.user.id, req.user.role, task.brand_id);
    if (!allowed) return sendError(res, 403, 'Only the Brand Admin or a global admin can review this task');

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'in_progress', rejection_reason: reason.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, title, status, assignee_id, rejection_reason')
      .single();

    if (error) throw error;

    if (task.assignee_id) {
      await supabase.from('notifications').insert({
        user_id:  task.assignee_id,
        type:     'task_verification_rejected',
        title:    `↩️ Task Sent Back: ${task.title}`,
        body:     `${req.user.full_name}: "${reason.trim()}"`,
        metadata: { task_id: task.id },
        is_read:  false,
      });
    }

    notify.onTaskRejected({ id: task.id, title: task.title, assignee_id: task.assignee_id, brand_id: task.brand_id }, req.user.full_name, reason.trim());

    sendSuccess(res, { task: data }, 'Task sent back for revision');
  } catch (err) { next(err); }
});

// ── GET /api/agency/tasks/pending-verification ────────────────
// Powers the Brand Admin's "pending verification" queue widget
router.get('/pending-verification', authenticate, async (req, res, next) => {
  try {
    let brandIds = [];
    if (isGlobalAdmin(req.user.role)) {
      const { data: allBrands } = await supabase.from('brands').select('id').eq('status', 'active');
      brandIds = (allBrands ?? []).map(b => b.id);
    } else {
      const { data: assignments } = await supabase
        .from('staff_brand_assignments')
        .select('brand_id, roles_on_brand')
        .eq('staff_id', req.user.id);
      brandIds = (assignments ?? []).filter(a => (a.roles_on_brand ?? []).includes('brand_admin')).map(a => a.brand_id);
    }

    if (brandIds.length === 0) return sendSuccess(res, { tasks: [], overdueCount: 0 });

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, title, status, updated_at, brand_id, brands(name), assignee:users!assignee_id(id, full_name)')
      .in('brand_id', brandIds)
      .eq('status', 'done')
      .order('updated_at', { ascending: true });

    if (error) throw error;

    const { data: config } = await supabase.from('scoring_config').select('unverified_task_grace_days').eq('id', 1).single();
    const graceDays = config?.unverified_task_grace_days ?? 5;
    const graceMs = graceDays * 86400000;

    const enriched = (tasks ?? []).map(t => ({
      ...t,
      daysWaiting: Math.floor((Date.now() - new Date(t.updated_at).getTime()) / 86400000),
      isOverdue: (Date.now() - new Date(t.updated_at).getTime()) > graceMs,
    }));

    sendSuccess(res, {
      tasks: enriched,
      overdueCount: enriched.filter(t => t.isOverdue).length,
      graceDays,
    });
  } catch (err) { next(err); }
});

module.exports = router;
