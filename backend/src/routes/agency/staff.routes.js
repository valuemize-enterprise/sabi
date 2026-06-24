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

module.exports = router;
