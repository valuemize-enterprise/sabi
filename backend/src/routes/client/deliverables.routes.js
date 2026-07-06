/**
 * Client Deliverables Routes
 * Clients can only see deliverables that have been approved by an admin.
 *
 * GET /api/client/deliverables          — approved deliverables for client's brand
 * GET /api/client/deliverables/:id      — single deliverable
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');

// ── GET /api/client/deliverables ──────────────────────────────
router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { file_type, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('deliverables')
      .select(`
        id, title, description, file_type, file_url,
        file_name, approved_at, created_at,
        users!user_id ( id, full_name, role )
      `, { count: 'exact' })
      .eq('brand_id', req.client.brand_id)
      .eq('status', 'approved')
      .eq('client_visible', true);

    if (file_type) query = query.eq('file_type', file_type);

    const { data, count, error } = await query
      .order('approved_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── GET /api/client/deliverables/:id ─────────────────────────
router.get('/:id', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('deliverables')
      .select(`
        id, title, description, file_type, file_url,
        file_name, approved_at, created_at,
        users!user_id ( id, full_name, role )
      `)
      .eq('id', req.params.id)
      .eq('brand_id', req.client.brand_id)
      .eq('status', 'approved')
      .eq('client_visible', true)
      .single();

    if (error || !data) return sendError(res, 404, 'Deliverable not found');
    sendSuccess(res, data);
  } catch (err) { next(err); }
});

module.exports = router;
