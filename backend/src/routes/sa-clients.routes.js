/**
 * Super Admin → Clients Route
 * Mounts at: /api/super-admin/clients
 *
 * HOW TO REGISTER:
 * In backend/src/server.js, add the following line alongside the existing super-admin routes:
 *   app.use('/api/super-admin/clients', require('./routes/super-admin/clients.routes'));
 */

'use strict';

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');

// ── GET /api/super-admin/clients ──────────────────────────────
// List all client portal accounts (across all brands)
router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { brand_id, is_active, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('clients')
      .select('id, email, full_name, job_title, phone, brand_id, is_active, must_reset_password, last_login, created_at, brands(name, logo_url, industry)', { count: 'exact' });

    if (brand_id)   query = query.eq('brand_id', brand_id);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;

    // Strip password hashes (defensive, schema already omits them via select)
    const safe = (data || []).map(({ password_hash, ...rest }) => rest);
    sendPaginated(res, safe, count, page, limit);
  } catch (err) { next(err); }
});

// ── POST /api/super-admin/clients ─────────────────────────────
// Create a new client portal account (linked to a brand)
router.post('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { email, full_name, brand_id, job_title, phone, company_name } = req.body;

    if (!email || !full_name || !brand_id) {
      return sendError(res, 400, 'email, full_name, and brand_id are required');
    }

    // Verify brand exists
    const { data: brand, error: brandErr } = await supabase
      .from('brands').select('id, name').eq('id', brand_id).single();
    if (brandErr || !brand) return sendError(res, 404, 'Brand not found');

    // Generate temp password
    const tempPassword = `Client${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(tempPassword, 12);

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        email:         email.toLowerCase().trim(),
        full_name,
        brand_id,
        job_title:     job_title || null,
        phone:         phone || null,
        company_name:  company_name || null,
        password_hash: hash,
        must_reset_password: true,
        is_active:     true,
      })
      .select('id, email, full_name, job_title, brand_id, is_active')
      .single();

    if (error) {
      if (error.code === '23505') return sendError(res, 409, 'A client with this email already exists');
      throw error;
    }

    await auditLog({
      actorId: 'super_admin', actorEmail: 'cerebreplus@gmail.com', actorRole: 'super_admin',
      action: 'SA_CREATE_CLIENT', resourceType: 'client', resourceId: client.id,
      details: { email, brand_id, brand_name: brand.name }, req,
    });

    sendSuccess(res, {
      client,
      brand_name:    brand.name,
      temp_password: tempPassword,
    }, 'Client account created', 201);
  } catch (err) { next(err); }
});

// ── PUT /api/super-admin/clients/:id/deactivate ───────────────
router.put('/:id/deactivate', authenticateSuperAdmin, async (req, res, next) => {
  try {
    await supabase.from('clients').update({ is_active: false }).eq('id', req.params.id);
    await auditLog({ actorId: 'super_admin', actorEmail: 'cerebreplus@gmail.com', actorRole: 'super_admin',
      action: 'SA_DEACTIVATE_CLIENT', resourceType: 'client', resourceId: req.params.id, req });
    sendSuccess(res, null, 'Client deactivated');
  } catch (err) { next(err); }
});

// ── PUT /api/super-admin/clients/:id/activate ────────────────
router.put('/:id/activate', authenticateSuperAdmin, async (req, res, next) => {
  try {
    await supabase.from('clients').update({ is_active: true }).eq('id', req.params.id);
    sendSuccess(res, null, 'Client activated');
  } catch (err) { next(err); }
});

// ── PUT /api/super-admin/clients/:id/reset-password ──────────
router.put('/:id/reset-password', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const temp = `Client${Math.random().toString(36).slice(2, 8)}!`;
    const hash = await bcrypt.hash(temp, 12);
    await supabase.from('clients').update({ password_hash: hash, must_reset_password: true }).eq('id', req.params.id);
    await auditLog({ actorId: 'super_admin', actorEmail: 'cerebreplus@gmail.com', actorRole: 'super_admin',
      action: 'SA_RESET_CLIENT_PASSWORD', resourceType: 'client', resourceId: req.params.id, req });
    sendSuccess(res, { temp_password: temp }, 'Password reset successfully');
  } catch (err) { next(err); }
});

module.exports = router;
