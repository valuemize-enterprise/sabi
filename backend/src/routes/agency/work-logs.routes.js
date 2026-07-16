/**
 * Agency Work Logs Routes
 * Work logs are how staff record everything they do for a brand.
 * These feed directly into client reports and ARIA intelligence.
 *
 * GET    /api/agency/work-logs         — list (filterable by brand, user, date, category)
 * POST   /api/agency/work-logs         — create a log entry
 * PUT    /api/agency/work-logs/:id     — update own entry
 * DELETE /api/agency/work-logs/:id     — delete own entry
 */

'use strict';

const router          = require('express').Router();
const supabase        = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }    = require('../../middleware/logger.middleware');

const VALID_CATEGORIES = [
  'strategy', 'content_copy', 'design', 'social_media',
  'analytics', 'video', 'community', 'client_comms',
  'ads', 'seo', 'other',
];

// ── GET /api/agency/work-logs ─────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, user_id, category, period, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('work_logs')
      .select(`
        id, title, description, category, hours,
        evidence_files, created_at, updated_at,
        brand_id, goal_id, user_id,
        brands  ( id, name, primary_color ),
        goals   ( id, title, metric_type, unit ),
        users   ( id, full_name, role, avatar_url )
      `, { count: 'exact' });

    // Non-admins can only see their own logs
    const ADMIN_ROLES = [
      'super_admin','ceo','managing_director',
      'creative_director','strategy_director','account_director',
    ];
    if (!ADMIN_ROLES.includes(req.user.role)) {
      query = query.eq('user_id', req.user.id);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (brand_id) query = query.eq('brand_id', brand_id);
    if (category) query = query.eq('category', category);

    // Period filter
    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      query = query.gte('created_at', weekAgo);
    } else if (period === 'month') {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      query = query.gte('created_at', start.toISOString());
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── POST /api/agency/work-logs ────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, category, title, description, goal_id, hours, evidence_files } = req.body;

    if (!brand_id)  return sendError(res, 400, 'brand_id is required');
    if (!title)     return sendError(res, 400, 'title is required');
    if (!category)  return sendError(res, 400, 'category is required');
    if (!VALID_CATEGORIES.includes(category)) {
      return sendError(res, 400, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    if (req.user.id === 'super_admin') {
      return sendError(res, 403, 'Super admin cannot create work logs');
    }

    const { data, error } = await supabase
      .from('work_logs')
      .insert({
        brand_id,
        user_id:        req.user.role !== 'super_admin' ? req.user.id : null,
        category,
        title:          title.trim(),
        description:    description || null,
        goal_id:        goal_id || null,
        hours:          parseFloat(hours) || 0,
        evidence_files: evidence_files || [],
      })
      .select(`
        id, title, description, category, hours,
        evidence_files, created_at,
        brands ( id, name ),
        goals  ( id, title ),
        users  ( id, full_name, role )
      `)
      .single();

    if (error) throw error;

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_WORK_LOG', resourceType: 'work_log', resourceId: data.id,
      details: { brand_id, category, title }, req,
    });

    sendSuccess(res, data, 'Work log created', 201);
  } catch (err) { next(err); }
});

// ── PUT /api/agency/work-logs/:id ─────────────────────────────
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    // Verify ownership (non-admins can only edit their own)
    const { data: existing } = await supabase
      .from('work_logs').select('user_id').eq('id', req.params.id).single();

    if (!existing) return sendError(res, 404, 'Work log not found');

    const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
    if (existing.user_id !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, 'You can only edit your own work logs');
    }

    const allowed = ['title','description','category','hours','goal_id','evidence_files'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('work_logs').update(updates).eq('id', req.params.id)
      .select('id, title, category, hours, updated_at').single();

    if (error) throw error;
    sendSuccess(res, data, 'Work log updated');
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/work-logs/:id ──────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('work_logs').select('user_id').eq('id', req.params.id).single();

    if (!existing) return sendError(res, 404, 'Work log not found');

    const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
    if (existing.user_id !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, 'You can only delete your own work logs');
    }

    await supabase.from('work_logs').delete().eq('id', req.params.id);
    sendSuccess(res, null, 'Work log deleted');
  } catch (err) { next(err); }
});

module.exports = router;
