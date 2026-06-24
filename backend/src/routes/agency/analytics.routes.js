/**
 * Agency Analytics Routes
 * GET /api/agency/analytics/overview
 * GET /api/agency/analytics/brands/:id
 * GET /api/agency/analytics/goals/:brand_id
 * GET /api/agency/analytics/clarity-history/:brand_id
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate, requirePermission } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/overview', authenticate, requirePermission('VIEW_ANALYTICS'), async (req, res, next) => {
  try {
    const [
      { count: totalBrands },
      { count: totalClients },
      { count: totalStaff },
      { count: totalReports },
      { count: activeGoals },
      { data: avgClarity },
    ] = await Promise.all([
      supabase.from('brands').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('goals').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('brands').select('clarity_score'),
    ]);

    const avg = avgClarity?.length
      ? Math.round(avgClarity.reduce((s, b) => s + (b.clarity_score || 0), 0) / avgClarity.length)
      : 0;

    sendSuccess(res, {
      totalBrands, totalClients, totalStaff, totalReports, activeGoals,
      avgClarityScore: avg,
    });
  } catch (err) { next(err); }
});

router.get('/brands/:id', authenticate, async (req, res, next) => {
  try {
    const brandId = req.params.id;
    const [
      { data: goalStats },
      { data: taskStats },
      { data: clarityHistory },
      { data: reportCounts },
    ] = await Promise.all([
      supabase.from('goals').select('status').eq('brand_id', brandId),
      supabase.from('tasks').select('status').eq('brand_id', brandId),
      supabase.from('clarity_score_history').select('score, computed_at').eq('brand_id', brandId).order('computed_at', { ascending: true }).limit(30),
      supabase.from('reports').select('type, status').eq('brand_id', brandId),
    ]);

    const goalSummary = goalStats?.reduce((acc, g) => { acc[g.status] = (acc[g.status] || 0) + 1; return acc; }, {}) || {};
    const taskSummary = taskStats?.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}) || {};

    sendSuccess(res, {
      goals: goalSummary,
      tasks: taskSummary,
      clarityHistory: clarityHistory || [],
      reports: reportCounts || [],
    });
  } catch (err) { next(err); }
});

router.get('/clarity-history/:brand_id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('clarity_score_history')
      .select('score, breakdown, ai_analysis, computed_at')
      .eq('brand_id', req.params.brand_id)
      .order('computed_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    sendSuccess(res, { history: data });
  } catch (err) { next(err); }
});

module.exports = router;
