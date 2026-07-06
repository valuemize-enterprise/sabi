/**
 * Agency Staff Routes
 * GET    /api/agency/staff
 * POST   /api/agency/staff
 * GET    /api/agency/staff/:id
 * PUT    /api/agency/staff/:id
 * DELETE /api/agency/staff/:id
 * POST   /api/agency/staff/:id/deactivate
 * POST   /api/agency/staff/:id/assign-brands
 */

'use strict';

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../../config/supabase');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');
const { canManage } = require('../../config/roles.config');

router.get('/', authenticate, requirePermission('VIEW_ALL_STAFF'), async (req, res, next) => {
  try {
    const { role, department, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('users')
      .select('id, email, full_name, role, department, phone, avatar_url, is_active, last_login, created_at', { count: 'exact' });
    if (role)       query = query.eq('role', role);
    if (department) query = query.eq('department', department);
    if (search)     query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.post('/', authenticate, requirePermission('CREATE_STAFF'), async (req, res, next) => {
  try {
    const { email, full_name, role, department, phone } = req.body;
    if (!email || !full_name || !role) return sendError(res, 400, 'email, full_name, and role required');
    if (!canManage(req.user.role, role)) return sendError(res, 403, 'Cannot create a user with this role');

    const tempPassword = `Sabi${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(tempPassword, 12);

    const { data, error } = await supabase.from('users').insert({
      email: email.toLowerCase().trim(), full_name, role, department, phone,
      password_hash: hash, must_reset_password: true,
    }).select('id, email, full_name, role, department, is_active').single();

    if (error) {
      if (error.code === '23505') return sendError(res, 409, 'A user with this email already exists');
      throw error;
    }

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_STAFF', resourceType: 'user', resourceId: data.id, details: { email, role }, req });

    sendSuccess(res, { user: data, temp_password: tempPassword }, 'Staff member created', 201);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, department, phone, avatar_url, is_active, last_login, created_at, staff_brand_assignments(brand_id, role_on_brand, brands(name, logo_url))')
      .eq('id', req.params.id).single();
    if (error || !data) return sendError(res, 404, 'Staff member not found');
    sendSuccess(res, { user: data });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['full_name', 'department', 'phone', 'avatar_url'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabase.from('users').update(updates).eq('id', req.params.id).select('id, email, full_name, role, department, phone, avatar_url').single();
    if (error) throw error;
    sendSuccess(res, { user: data });
  } catch (err) { next(err); }
});

router.post('/:id/deactivate', authenticate, requirePermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const { data: target } = await supabase.from('users').select('role').eq('id', req.params.id).single();
    if (!target) return sendError(res, 404, 'User not found');
    if (!canManage(req.user.role, target.role)) return sendError(res, 403, 'Cannot deactivate this user');

    await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'DEACTIVATE_STAFF', resourceType: 'user', resourceId: req.params.id, req });

    sendSuccess(res, null, 'Staff member deactivated');
  } catch (err) { next(err); }
});

router.post('/:id/assign-brands', authenticate, requirePermission('MANAGE_USERS'), async (req, res, next) => {
  try {
    const { brand_ids, role_on_brand = 'contributor' } = req.body;
    if (!brand_ids?.length) return sendError(res, 400, 'brand_ids array required');

    await supabase.from('staff_brand_assignments').delete().eq('staff_id', req.params.id);
    await supabase.from('staff_brand_assignments').insert(
      brand_ids.map(bid => ({ staff_id: req.params.id, brand_id: bid, role_on_brand }))
    );
    sendSuccess(res, null, 'Brand assignments updated');
  } catch (err) { next(err); }
});


/**
 * BACKEND PATCH — Add to backend/src/routes/agency/staff.routes.js
 *
 * Add these two routes BEFORE the `module.exports = router;` line
 * at the bottom of staff.routes.js.
 *
 * These routes let the logged-in staff member fetch their own
 * assigned brands and personal dashboard data.
 */

// ── GET /api/agency/staff/me/brands ──────────────────────────
// Returns brands assigned to the currently logged-in staff member
// Used by: /my-brands page, /dashboard (staff view)
router.get('/me/brands', authenticate, async (req, res, next) => {
  try {
    const isSa = req.user.id === 'super_admin';
    let query = supabase
      .from('staff_brand_assignments')
      .select(`
        id,
        role_on_brand,
        brand_id,
        brands (
          id,
          name,
          primary_color,
          industry,
          clarity_score,
          status,
          clarity_score_updated_at,
          website
        )
      `);
    if (!isSa) query = query.eq('staff_id', req.user.id);
    const { data: assignments, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    // For each brand, count open tasks assigned to this user
    const brandIds = (assignments || []).map(a => a.brand_id);
    let taskCounts = {};

    if (brandIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('brand_id')
        .in('brand_id', brandIds)
        .eq('assigned_to', req.user.id !== 'super_admin' ? req.user.id : null)
        .in('status', ['todo', 'in_progress']);

      if (tasks) {
        taskCounts = tasks.reduce((acc, t) => {
          acc[t.brand_id] = (acc[t.brand_id] || 0) + 1;
          return acc;
        }, {});
      }
    }

    // Flatten: merge brand data + assignment role + open task count
    const brands = (assignments || []).map(a => ({
      // Spread brand fields
      ...a.brands,
      // Add assignment-level fields
      brand_id:      a.brand_id,
      role_on_brand: a.role_on_brand,
      open_tasks:    taskCounts[a.brand_id] || 0,
    }));

    sendSuccess(res, brands);
  } catch (err) { next(err); }
});

// ── GET /api/agency/staff/me/dashboard ───────────────────────
// Personal dashboard stats for the logged-in staff member
// Used by: /dashboard (staff view)
router.get('/me/dashboard', authenticate, async (req, res, next) => {
  try {
    const staffId = req.user.id;

    // Count brands
    const { count: brandCount } = await supabase
      .from('staff_brand_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('staff_id', staffId);

    // Count open tasks
    const { count: openTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', staffId)
      .in('status', ['todo', 'in_progress']);

    // Count completed tasks this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: doneTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', staffId)
      .eq('status', 'done')
      .gte('completed_at', monthStart.toISOString());

    // Count work logs this month
    const { count: workLogs } = await supabase
      .from('work_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', staffId)
      .gte('created_at', monthStart.toISOString());

    sendSuccess(res, {
      brands_count:     brandCount  ?? 0,
      open_tasks:       openTasks   ?? 0,
      tasks_done_month: doneTasks   ?? 0,
      work_logs_month:  workLogs    ?? 0,
    });
  } catch (err) { next(err); }
});

// ── GET /api/agency/staff/me/ratings ─────────────────────────
// Performance ratings for the logged-in staff member
// Used by: /staff/ratings page
router.get('/me/ratings', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('staff_ratings')
      .select('id, score, category, comment, period, reviewer_name, created_at')
      .eq('staff_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    sendSuccess(res, data || []);
  } catch (err) { next(err); }
});


module.exports = router;
