/**
 * Client Brand Identity Route
 * GET /api/client/brand/identity — client reads own brand identity
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select(`
        id, name, logo_url, tagline, mission_statement, brand_story,
        brand_archetype, brand_voice, target_audience,
        brand_colors, brand_fonts, dos_and_donts,
        brand_guidelines_url, brand_assets, social_handles,
        industry, website, primary_color, created_at
      `)
      .eq('id', req.client.brand_id)
      .single();

    if (error || !data) return sendError(res, 404, 'Brand not found');
    sendSuccess(res, { identity: data });
  } catch (err) { next(err); }
});

module.exports = router;
