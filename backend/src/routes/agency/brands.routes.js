/**
 * Agency Brands Routes
 * GET    /api/agency/brands
 * POST   /api/agency/brands
 * GET    /api/agency/brands/:id
 * PUT    /api/agency/brands/:id
 * DELETE /api/agency/brands/:id
 * GET    /api/agency/brands/:id/summary (ARIA-powered)
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }     = require('../../middleware/logger.middleware');
const clarityService   = require('../../services/aria/clarity-score.service');

// GET /api/agency/brands
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('brands')
      .select('id, name, industry, logo_url, status, clarity_score, primary_color, account_manager_id, created_at, users!account_manager_id(full_name)', { count: 'exact' });

    if (status)  query = query.eq('status', status);
    if (search)  query = query.ilike('name', `%${search}%`);

    // Non-directors only see their assigned brands
    const limitedRoles = ['account_manager', 'senior_strategist', 'strategist', 'copywriter', 'social_media_manager', 'analytics_specialist', 'client_success', 'creative_lead'];
    if (limitedRoles.includes(req.user.role)) {
      const { data: assignments } = await supabase
        .from('staff_brand_assignments').select('brand_id').eq('staff_id', req.user.id);
      const brandIds = assignments?.map(a => a.brand_id) || [];
      if (brandIds.length === 0) return sendPaginated(res, [], 0, page, limit);
      query = query.in('id', brandIds);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

// POST /api/agency/brands
router.post('/', authenticate, requirePermission('CREATE_BRAND'), async (req, res, next) => {
  try {
    const { name, industry, description, logo_url, website, social_handles, primary_color, account_manager_id } = req.body;
    if (!name || !industry) return sendError(res, 400, 'Name and industry are required');

    const { data, error } = await supabase.from('brands').insert({
      name, industry, description, logo_url, website,
      social_handles: social_handles || {},
      primary_color:  primary_color || '#6d28d9',
      account_manager_id: account_manager_id || req.user.id,
    }).select().single();

    if (error) throw error;

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'CREATE_BRAND', resourceType: 'brand', resourceId: data.id, details: { name }, req });

    sendSuccess(res, { brand: data }, 'Brand created', 201);
  } catch (err) { next(err); }
});

// GET /api/agency/brands/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data: brand, error } = await supabase
      .from('brands')
      .select(`
        *,
        users!account_manager_id(id, full_name, email, avatar_url),
        clients(id, full_name, email, job_title, is_active),
        goals(id, title, status, target_value, current_value, velocity_score),
        competitors(id, name, website),
        reports(id, title, type, status, published_at)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !brand) return sendError(res, 404, 'Brand not found');
    sendSuccess(res, { brand });
  } catch (err) { next(err); }
});

// PUT /api/agency/brands/:id
router.put('/:id', authenticate, requirePermission('EDIT_BRAND'), async (req, res, next) => {
  try {
    const allowed = ['name', 'industry', 'description', 'logo_url', 'website', 'social_handles', 'primary_color', 'account_manager_id', 'status'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const { data, error } = await supabase.from('brands').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'UPDATE_BRAND', resourceType: 'brand', resourceId: req.params.id, details: updates, req });

    sendSuccess(res, { brand: data });
  } catch (err) { next(err); }
});

// DELETE /api/agency/brands/:id
router.delete('/:id', authenticate, requirePermission('DELETE_BRAND'), async (req, res, next) => {
  try {
    const { error } = await supabase.from('brands').delete().eq('id', req.params.id);
    if (error) throw error;

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'DELETE_BRAND', resourceType: 'brand', resourceId: req.params.id, req });

    sendSuccess(res, null, 'Brand deleted');
  } catch (err) { next(err); }
});

// POST /api/agency/brands/:id/refresh-clarity
router.post('/:id/refresh-clarity', authenticate, async (req, res, next) => {
  try {
    const { data: brand } = await supabase.from('brands').select('*').eq('id', req.params.id).single();
    if (!brand) return sendError(res, 404, 'Brand not found');

    const { data: goals }      = await supabase.from('goals').select('*').eq('brand_id', req.params.id);
    const { data: reports }    = await supabase.from('reports').select('*').eq('brand_id', req.params.id).limit(5);
    const { data: competitors} = await supabase.from('competitors').select('*').eq('brand_id', req.params.id);

    const result = await clarityService.compute({ brand, goals, reports, competitors });

    await supabase.from('brands').update({
      clarity_score:            result.score,
      clarity_score_breakdown:  result.breakdown,
      clarity_score_updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    await supabase.from('clarity_score_history').insert({
      brand_id: req.params.id, score: result.score, breakdown: result.breakdown, ai_analysis: result.analysis
    });

    sendSuccess(res, result);
  } catch (err) { next(err); }
});

module.exports = router;
