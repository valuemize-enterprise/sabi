/**
 * AudienceIQ™ Routes — NEW FEATURE
 * AI-powered Nigerian consumer audience profiling
 *
 * GET  /api/agency/audience
 * POST /api/agency/audience/generate  (ARIA AudienceIQ™)
 * GET  /api/agency/audience/:id
 * PUT  /api/agency/audience/:id
 * DELETE /api/agency/audience/:id
 */

'use strict';

const router         = require('express').Router();
const supabase       = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const { auditLog }   = require('../../middleware/logger.middleware');
const audienceIQ     = require('../../services/aria/audience-iq.service');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('audience_profiles')
      .select('id, brand_id, profile_name, segment_type, demographics, created_at, brands(name)', { count: 'exact' });
    if (brand_id) query = query.eq('brand_id', brand_id);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

// POST /api/agency/audience/generate  ← ARIA AudienceIQ™
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const {
      brand_id, profile_name, segment_type,
      age_range, gender, location, income_level,
      education, occupation, lifestyle, goals_and_aspirations,
      pain_points, brand_relationship, purchase_behaviour,
      digital_behaviour, nigerian_context,
    } = req.body;

    if (!brand_id || !profile_name) return sendError(res, 400, 'brand_id and profile_name required');

    const { data: brand } = await supabase.from('brands').select('*').eq('id', brand_id).single();
    if (!brand) return sendError(res, 404, 'Brand not found');

    const demographics  = { age_range, gender, location, income_level, education, occupation };
    const behaviourals  = { purchase_behaviour, digital_behaviour, brand_relationship };
    const psychoInput   = { lifestyle, goals_and_aspirations, pain_points };
    const nigerianCtx   = nigerian_context || {};

    const result = await audienceIQ.generate({
      brand, profile_name, segment_type: segment_type || 'primary',
      demographics, behaviourals, psychoInput, nigerianCtx,
    });

    const { data: profile, error: insertErr } = await supabase.from('audience_profiles').insert({
      brand_id, profile_name, segment_type: segment_type || 'primary',
      demographics, behaviourals,
      psychographics:   result.psychographics,
      nigerian_context: result.nigerian_context,
      ai_insights:      result.ai_insights,
      ai_strategy:      result.ai_strategy,
      created_by:       req.user.role !== 'super_admin' ? req.user.id : null,
    }).select().single();

    if (insertErr) throw insertErr;

    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'GENERATE_AUDIENCE_PROFILE', resourceType: 'audience_profile', resourceId: profile.id,
      details: { brand_id, profile_name }, req });

    sendSuccess(res, { profile }, 'AudienceIQ™ profile generated', 201);
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('audience_profiles')
      .select('*, brands(name, industry, logo_url)')
      .eq('id', req.params.id).single();
    if (error || !data) return sendError(res, 404, 'Audience profile not found');
    sendSuccess(res, { profile: data });
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['profile_name', 'segment_type', 'demographics', 'psychographics', 'behaviourals', 'nigerian_context', 'ai_insights', 'ai_strategy'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabase.from('audience_profiles').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { profile: data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('audience_profiles').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Profile deleted');
  } catch (err) { next(err); }
});

module.exports = router;
