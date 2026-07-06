/**
 * Agency Strategies Routes
 * Campaign and marketing strategies linked to brands.
 *
 * GET    /api/agency/strategies
 * POST   /api/agency/strategies
 * GET    /api/agency/strategies/:id
 * PUT    /api/agency/strategies/:id
 * DELETE /api/agency/strategies/:id
 */

'use strict';

const router          = require('express').Router();
const supabase        = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }    = require('../../middleware/logger.middleware');

const VALID_TYPES = ['content','social','paid','seo','email','brand','campaign','quarterly','annual','other'];
const VALID_STATUS = ['draft','active','paused','completed','archived'];

// ── GET /api/agency/strategies ────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, status, type, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('strategies')
      .select(`
        id, title, description, type, status,
        start_date, end_date, budget,
        brand_id, created_by, created_at, updated_at,
        brands ( id, name, primary_color ),
        users  ( id, full_name, role )
      `, { count: 'exact' });

    if (brand_id) query = query.eq('brand_id', brand_id);
    if (status)   query = query.eq('status', status);
    if (type)     query = query.eq('type', type);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── POST /api/agency/strategies ───────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, title, description, type, start_date, end_date, budget, goals_linked } = req.body;

    if (!brand_id) return sendError(res, 400, 'brand_id is required');
    if (!title)    return sendError(res, 400, 'title is required');
    if (type && !VALID_TYPES.includes(type)) {
      return sendError(res, 400, `type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('strategies')
      .insert({
        brand_id,
        title:         title.trim(),
        description:   description  || null,
        type:          type         || 'campaign',
        status:        'draft',
        start_date:    start_date   || null,
        end_date:      end_date     || null,
        budget:        budget       ? parseFloat(budget) : null,
        goals_linked:  goals_linked || [],
        created_by:    req.user.id !== 'super_admin' ? req.user.id : null,
      })
      .select('id, title, type, status, brand_id, created_at')
      .single();

    if (error) throw error;

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_STRATEGY', resourceType: 'strategy', resourceId: data.id,
      details: { brand_id, title, type }, req,
    });

    sendSuccess(res, { strategy: data }, 'Strategy created', 201);
  } catch (err) { next(err); }
});

// ── GET /api/agency/strategies/:id ───────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('strategies')
      .select(`
        *,
        brands ( id, name, industry, primary_color ),
        users  ( id, full_name, role )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return sendError(res, 404, 'Strategy not found');
    sendSuccess(res, { strategy: data });
  } catch (err) { next(err); }
});

// ── PUT /api/agency/strategies/:id ───────────────────────────
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['title','description','type','status','start_date','end_date','budget','content','goals_linked'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (updates.status && !VALID_STATUS.includes(updates.status)) {
      return sendError(res, 400, `status must be one of: ${VALID_STATUS.join(', ')}`);
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('strategies')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, title, type, status, updated_at')
      .single();

    if (error) throw error;
    sendSuccess(res, { strategy: data }, 'Strategy updated');
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/strategies/:id ────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await supabase.from('strategies').delete().eq('id', req.params.id);
    sendSuccess(res, null, 'Strategy deleted');
  } catch (err) { next(err); }
});

module.exports = router;
