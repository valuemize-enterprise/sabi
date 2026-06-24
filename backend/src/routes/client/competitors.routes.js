'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('competitors')
      .select('id, name, website, industry, depth_view_data, pulse_data, last_pulse_at, created_at')
      .eq('brand_id', req.client.brand_id).order('name');
    if (error) throw error;
    sendSuccess(res, { competitors: data });
  } catch (err) { next(err); }
});

module.exports = router;
