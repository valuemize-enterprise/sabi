'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('goals')
      .select('id, title, metric_type, target_value, current_value, unit, status, deadline, velocity_score, velocity_data, created_at')
      .eq('brand_id', req.client.brand_id).order('created_at', { ascending: false });
    if (error) throw error;
    sendSuccess(res, { goals: data });
  } catch (err) { next(err); }
});

router.get('/:id', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('goals')
      .select('*, tasks(id, title, status, completed_at, metric_impact)')
      .eq('id', req.params.id).eq('brand_id', req.client.brand_id).single();
    if (error || !data) return sendError(res, 404, 'Goal not found');
    sendSuccess(res, { goal: data });
  } catch (err) { next(err); }
});

module.exports = router;
