/**
 * Client Dashboard Routes
 * GET /api/client/dashboard
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess }        = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const brandId = req.client.brand_id;

    const [
      { data: brand },
      { data: activeGoals },
      { data: recentReports },
      { data: clarityHistory },
      { data: upcomingEvents },
    ] = await Promise.all([
      supabase.from('brands').select('id, name, logo_url, primary_color, industry, clarity_score, clarity_score_breakdown, clarity_score_updated_at').eq('id', brandId).single(),
      supabase.from('goals').select('id, title, metric_type, target_value, current_value, unit, status, deadline, velocity_score').eq('brand_id', brandId).eq('status', 'active').limit(5),
      supabase.from('reports').select('id, title, type, status, clarity_score, published_at').eq('brand_id', brandId).eq('status', 'published').order('published_at', { ascending: false }).limit(3),
      supabase.from('clarity_score_history').select('score, computed_at').eq('brand_id', brandId).order('computed_at', { ascending: false }).limit(12),
      supabase.from('calendar_events').select('id, title, event_date, event_type, ai_recommendation').or(`is_global.eq.true,brand_id.eq.${brandId}`).gte('event_date', new Date().toISOString().split('T')[0]).order('event_date').limit(4),
    ]);

    sendSuccess(res, {
      brand,
      activeGoals:    activeGoals || [],
      recentReports:  recentReports || [],
      clarityHistory: clarityHistory || [],
      upcomingEvents: upcomingEvents || [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
