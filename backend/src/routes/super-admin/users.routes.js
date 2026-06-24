'use strict';
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');

// All staff + clients
router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { type = 'staff', role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const table  = type === 'clients' ? 'clients' : 'users';
    let query = supabase.from(table).select('*', { count: 'exact' });
    if (role && type === 'staff') query = query.eq('role', role);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;

    const safeData = (data || []).map(u => { const { password_hash, ...rest } = u; return rest; });
    sendPaginated(res, safeData, count, page, limit);
  } catch (err) { next(err); }
});

router.post('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { email, full_name, role, department } = req.body;
    if (!email || !full_name || !role) return sendError(res, 400, 'email, full_name, role required');
    const temp = `Sabi${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(temp, 12);
    const { data, error } = await supabase.from('users').insert({ email: email.toLowerCase(), full_name, role, department, password_hash: hash, must_reset_password: true }).select('id, email, full_name, role').single();
    if (error) throw error;
    await auditLog({ actorId: 'super_admin', actorEmail: 'cerebreplus@gmail.com', actorRole: 'super_admin', action: 'SA_CREATE_USER', resourceType: 'user', resourceId: data.id, req });
    sendSuccess(res, { user: data, temp_password: temp }, 'User created', 201);
  } catch (err) { next(err); }
});

router.put('/:id/deactivate', authenticateSuperAdmin, async (req, res, next) => {
  try {
    await supabase.from('users').update({ is_active: false }).eq('id', req.params.id);
    await auditLog({ actorId: 'super_admin', actorEmail: 'cerebreplus@gmail.com', actorRole: 'super_admin', action: 'SA_DEACTIVATE_USER', resourceType: 'user', resourceId: req.params.id, req });
    sendSuccess(res, null, 'User deactivated');
  } catch (err) { next(err); }
});

router.put('/:id/activate', authenticateSuperAdmin, async (req, res, next) => {
  try {
    await supabase.from('users').update({ is_active: true }).eq('id', req.params.id);
    sendSuccess(res, null, 'User activated');
  } catch (err) { next(err); }
});

router.put('/:id/reset-password', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const temp = `Sabi${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(temp, 12);
    await supabase.from('users').update({ password_hash: hash, must_reset_password: true }).eq('id', req.params.id);
    sendSuccess(res, { temp_password: temp });
  } catch (err) { next(err); }
});

module.exports = router;
