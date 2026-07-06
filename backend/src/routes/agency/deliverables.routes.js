/**
 * Agency Deliverables Routes
 * Staff upload work files. Admins approve before clients can see them.
 *
 * GET    /api/agency/deliverables              — list (by brand, status)
 * POST   /api/agency/deliverables              — upload a deliverable
 * PUT    /api/agency/deliverables/:id/approve  — admin approves (makes client-visible)
 * PUT    /api/agency/deliverables/:id/reject   — admin rejects with reason
 * DELETE /api/agency/deliverables/:id          — delete
 */

'use strict';

const router          = require('express').Router();
const supabase        = require('../../config/supabase');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }    = require('../../middleware/logger.middleware');

const VALID_FILE_TYPES = ['copy','design','video','report','strategy','photo','other'];
const ADMIN_ROLES = [
  'super_admin','ceo','managing_director',
  'creative_director','strategy_director','account_director',
];

// ── GET /api/agency/deliverables ──────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, status, file_type, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('deliverables')
      .select(`
        id, title, description, file_type, file_url, file_name,
        status, client_visible, rejection_reason,
        brand_id, goal_id, created_at, approved_at,
        brands         ( id, name ),
        users!user_id  ( id, full_name, role )
      `, { count: 'exact' });

    if (brand_id)  query = query.eq('brand_id', brand_id);
    if (status)    query = query.eq('status', status);
    if (file_type) query = query.eq('file_type', file_type);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── POST /api/agency/deliverables ─────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, title, file_type, description, file_url, file_name, goal_id } = req.body;

    if (!brand_id)  return sendError(res, 400, 'brand_id is required');
    if (!title)     return sendError(res, 400, 'title is required');
    if (!file_type) return sendError(res, 400, 'file_type is required');
    if (!VALID_FILE_TYPES.includes(file_type)) {
      return sendError(res, 400, `file_type must be one of: ${VALID_FILE_TYPES.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('deliverables')
      .insert({
        brand_id,
        user_id:        req.user.id,
        title:          title.trim(),
        file_type,
        description:    description   || null,
        file_url:       file_url      || null,
        file_name:      file_name     || null,
        goal_id:        goal_id       || null,
        status:         'pending',
        client_visible: false,
      })
      .select(`
        id, title, file_type, status, client_visible, created_at,
        users!user_id ( id, full_name, role )
      `)
      .single();

    if (error) throw error;

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_DELIVERABLE', resourceType: 'deliverable', resourceId: data.id,
      details: { brand_id, title, file_type }, req,
    });

    sendSuccess(res, data, 'Deliverable submitted for approval', 201);
  } catch (err) { next(err); }
});

// ── PUT /api/agency/deliverables/:id/approve ─────────────────
router.put('/:id/approve', authenticate, async (req, res, next) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, 'Only admins can approve deliverables');
    }

    const { data, error } = await supabase
      .from('deliverables')
      .update({
        status:         'approved',
        client_visible: true,
        approved_by:    req.user.id,
        approved_at:    new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', req.params.id)
      .select('id, title, status, client_visible, approved_at')
      .single();

    if (error) throw error;
    if (!data)  return sendError(res, 404, 'Deliverable not found');

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'APPROVE_DELIVERABLE', resourceType: 'deliverable', resourceId: req.params.id, req,
    });

    sendSuccess(res, data, 'Deliverable approved — now visible to client');
  } catch (err) { next(err); }
});

// ── PUT /api/agency/deliverables/:id/reject ──────────────────
router.put('/:id/reject', authenticate, async (req, res, next) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, 'Only admins can reject deliverables');
    }

    const { reason } = req.body;
    if (!reason) return sendError(res, 400, 'A rejection reason is required');

    const { data, error } = await supabase
      .from('deliverables')
      .update({
        status:           'rejected',
        client_visible:   false,
        rejection_reason: reason,
        approved_by:      null,
        approved_at:      null,
      })
      .eq('id', req.params.id)
      .select('id, title, status, rejection_reason')
      .single();

    if (error) throw error;
    if (!data)  return sendError(res, 404, 'Deliverable not found');

    sendSuccess(res, data, 'Deliverable rejected');
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/deliverables/:id ──────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('deliverables').select('user_id').eq('id', req.params.id).single();

    if (!existing) return sendError(res, 404, 'Deliverable not found');
    if (existing.user_id !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, 'You can only delete your own deliverables');
    }

    await supabase.from('deliverables').delete().eq('id', req.params.id);

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'DELETE_DELIVERABLE', resourceType: 'deliverable', resourceId: req.params.id, req,
    });

    sendSuccess(res, null, 'Deliverable deleted');
  } catch (err) { next(err); }
});

module.exports = router;
