/**
 * Agency Briefs Routes — Admin view of client briefs
 *
 * GET  /api/agency/briefs                  — list all briefs (filterable by brand)
 * GET  /api/agency/briefs/:id              — single brief with AI insights
 * PUT  /api/agency/briefs/:id/status       — update status (acknowledged, accepted, etc.)
 * POST /api/agency/briefs/:id/convert-task — convert brief into a task
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const notify = require('../../services/notification-triggers.service');

const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

// ── GET /api/agency/briefs ────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, status, priority, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('client_briefs')
      .select(`
        id, title, brief_type, status, priority, deadline, created_at, updated_at,
        brand_id,
        brands   ( id, name, primary_color ),
        clients  ( id, full_name, job_title )
      `, { count: 'exact' });

    if (brand_id) query = query.eq('brand_id', brand_id);
    if (status)   query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);

    // Non-admins only see their assigned brands
    if (!ADMIN_ROLES.includes(req.user.role)) {
      const { data: assigned } = await supabase
        .from('staff_brand_assignments')
        .select('brand_id')
        .eq('staff_id', req.user.id)
        .contains('roles_on_brand', ['brand_admin']);
      const ids = (assigned ?? []).map(a => a.brand_id);
      if (ids.length === 0) return sendPaginated(res, [], 0, page, limit);
      query = query.in('brand_id', ids);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── GET /api/agency/briefs/:id ────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('client_briefs')
      .select(`
        *,
        brands  ( id, name, industry ),
        clients ( id, full_name, job_title, email )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return sendError(res, 404, 'Brief not found');
    sendSuccess(res, { brief: data });
  } catch (err) { next(err); }
});

// ── PUT /api/agency/briefs/:id/status ────────────────────────
router.put('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    const valid = ['acknowledged','in_review','accepted','rejected','completed'];
    if (!valid.includes(status)) return sendError(res, 400, `status must be one of: ${valid.join(', ')}`);

    const { data, error } = await supabase
      .from('client_briefs')
      .update({
        status,
        admin_notes:  admin_notes || null,
        reviewed_by:  req.user.role !== 'super_admin' ? req.user.id : null,
        reviewed_at:  new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, title, status, brand_id, clients(id)')
      .single();

    if (error) throw error;

    // Notify the client about the status update
    if (data?.clients?.id) {
      await supabase.from('client_notifications').insert({
        client_id: data.clients.id,
        brand_id:  data.brand_id,
        type:      'brief_status_updated',
        title:     `Brief Update: ${data.title}`,
        body:      `Your brief has been ${status.replace('_', ' ')}.${admin_notes ? ' Note: ' + admin_notes : ''}`,
        metadata:  { brief_id: data.id, status },
      });
    }

    notify.onBriefStatusChanged({ id: data.id, title: data.title, brand_id: data.brand_id }, status, admin_notes);

    sendSuccess(res, { brief: data }, 'Brief status updated');
  } catch (err) { next(err); }
});

// ── POST /api/agency/briefs/:id/convert-task ─────────────────
// Convert an accepted brief into a task (assign to a staff member)
router.post('/:id/convert-task', authenticate, async (req, res, next) => {
  try {
    const { assignee_id, priority = 'medium', due_date, strategy_id } = req.body;

    const { data: brief } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!brief) return sendError(res, 404, 'Brief not found');

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        brand_id:     brief.brand_id,
        title:        brief.title,
        description:  brief.description,
        status:       'todo',
        priority,
        due_date:     due_date || brief.deadline || null,
        assignee_id:  assignee_id || null,
        strategy_id:  strategy_id || null,
        brief_id:     brief.id,
        created_by:   req.user.role !== 'super_admin' ? req.user.id : null,
        tags:         [brief.brief_type],
      })
      .select('id, title, status')
      .single();

    if (error) throw error;

    // Mark brief as accepted
    await supabase.from('client_briefs').update({ status: 'accepted' }).eq('id', brief.id);

    // Notify the assignee
    if (assignee_id) {
      await supabase.from('notifications').insert({
        user_id:  assignee_id,
        type:     'task_assigned',
        title:    `📋 New Task Assigned: ${task.title}`,
        body:     `You have been assigned a task from a client brief. Priority: ${priority}.`,
        metadata: { task_id: task.id, brief_id: brief.id },
        is_read:  false,
      });
    }

    notify.onTaskAssigned({ id: task.id, title: task.title, brand_id: brief.brand_id, assignee_id: assignee_id || null, strategy_id: strategy_id || null }, req.user.full_name);

    sendSuccess(res, { task }, 'Brief converted to task', 201);
  } catch (err) { next(err); }
});

module.exports = router;
