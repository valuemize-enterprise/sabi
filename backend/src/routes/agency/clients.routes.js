/**
 * Agency Clients Routes (brand portal users)
 * GET  /api/agency/clients
 * POST /api/agency/clients
 * GET  /api/agency/clients/:id
 * PUT  /api/agency/clients/:id
 * POST /api/agency/clients/:id/deactivate
 * POST /api/agency/clients/:id/reset-password
 */

'use strict';

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('clients')
      .select('id, email, full_name, job_title, brand_id, is_active, last_login, created_at, brands(name, logo_url)', { count: 'exact' });
    if (brand_id) query = query.eq('brand_id', brand_id);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { email, full_name, job_title, phone, brand_id } = req.body;
    if (!email || !full_name || !brand_id) return sendError(res, 400, 'email, full_name, and brand_id required');

    const tempPassword = `Client${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(tempPassword, 12);

    const { data, error } = await supabase.from('clients').insert({
      email: email.toLowerCase().trim(), full_name, job_title, phone, brand_id,
      password_hash: hash, must_reset_password: true,
    }).select('id, email, full_name, job_title, brand_id, is_active').single();

    if (error) {
      if (error.code === '23505') return sendError(res, 409, 'Client with this email already exists');
      throw error;
    }

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_CLIENT', resourceType: 'client', resourceId: data.id, details: { email, brand_id }, req });

    sendSuccess(res, { client: data, temp_password: tempPassword }, 'Client created', 201);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, email, full_name, job_title, phone, brand_id, avatar_url, is_active, last_login, created_at, brands(name, logo_url, industry, primary_color)')
      .eq('id', req.params.id).single();
    if (error || !data) return sendError(res, 404, 'Client not found');
    sendSuccess(res, { client: data });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['full_name', 'job_title', 'phone', 'avatar_url'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabase.from('clients').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { client: data });
  } catch (err) { next(err); }
});

router.post('/:id/deactivate', authenticate, async (req, res, next) => {
  try {
    await supabase.from('clients').update({ is_active: false }).eq('id', req.params.id);
    sendSuccess(res, null, 'Client deactivated');
  } catch (err) { next(err); }
});

router.post('/:id/reset-password', authenticate, async (req, res, next) => {
  try {
    const tempPassword = `Client${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(tempPassword, 12);
    await supabase.from('clients').update({ password_hash: hash, must_reset_password: true }).eq('id', req.params.id);

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'RESET_CLIENT_PASSWORD', resourceType: 'client', resourceId: req.params.id, req });

    sendSuccess(res, { temp_password: tempPassword }, 'Password reset. Share this with the client securely.');
  } catch (err) { next(err); }
});

module.exports = router;
