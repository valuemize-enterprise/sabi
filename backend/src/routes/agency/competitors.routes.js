/**
 * Agency Competitors Routes
 * GET  /api/agency/competitors
 * POST /api/agency/competitors
 * GET  /api/agency/competitors/:id
 * PUT  /api/agency/competitors/:id
 * DELETE /api/agency/competitors/:id
 * POST /api/agency/competitors/depth-view   (ARIA DepthView™)
 * POST /api/agency/competitors/:id/pulse    (ARIA IntelliPulse™)
 */

'use strict';

const router         = require('express').Router();
const supabase       = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }   = require('../../middleware/logger.middleware');
const depthView      = require('../../services/aria/depth-view.service');
const intelliPulse   = require('../../services/aria/intelli-pulse.service');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('competitors')
      .select('*, brands(name)', { count: 'exact' });
    if (brand_id) query = query.eq('brand_id', brand_id);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, name, website, industry, social_handles } = req.body;
    if (!brand_id || !name) return sendError(res, 400, 'brand_id and name required');

    const { data, error } = await supabase.from('competitors').insert({
      brand_id, name, website, industry, social_handles: social_handles || {}
    }).select().single();

    if (error) throw error;
    sendSuccess(res, { competitor: data }, 'Competitor added', 201);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('competitors').select('*, brands(name, industry, social_handles)').eq('id', req.params.id).single();
    if (error || !data) return sendError(res, 404, 'Competitor not found');
    sendSuccess(res, { competitor: data });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['name', 'website', 'industry', 'social_handles'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabase.from('competitors').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { competitor: data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('competitors').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Competitor removed');
  } catch (err) { next(err); }
});

// POST /api/agency/competitors/depth-view  ← ARIA DepthView™
router.post('/depth-view', authenticate, async (req, res, next) => {
  try {
    const { brand_id, competitor_ids } = req.body;
    if (!brand_id || !competitor_ids?.length) return sendError(res, 400, 'brand_id and competitor_ids required');

    const { data: brand }       = await supabase.from('brands').select('*').eq('id', brand_id).single();
    const { data: competitors } = await supabase.from('competitors').select('*').in('id', competitor_ids);

    if (!brand) return sendError(res, 404, 'Brand not found');

    const result = await depthView.analyze({ brand, competitors });

    // Update each competitor with depth view data
    await Promise.all(competitors.map(c =>
      supabase.from('competitors').update({ depth_view_data: result.comparisons[c.id] || {} }).eq('id', c.id)
    ));

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'DEPTH_VIEW_ANALYSIS', resourceType: 'brand', resourceId: brand_id, req });

    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// POST /api/agency/competitors/:id/pulse  ← ARIA IntelliPulse™
router.post('/:id/pulse', authenticate, async (req, res, next) => {
  try {
    const { data: competitor, error } = await supabase
      .from('competitors').select('*, brands(name, industry)').eq('id', req.params.id).single();
    if (error || !competitor) return sendError(res, 404, 'Competitor not found');

    const result = await intelliPulse.scan({ competitor, brand: competitor.brands });

    await supabase.from('competitors').update({
      pulse_data: result,
      last_pulse_at: new Date().toISOString()
    }).eq('id', req.params.id);

    sendSuccess(res, result);
  } catch (err) { next(err); }
});

module.exports = router;
