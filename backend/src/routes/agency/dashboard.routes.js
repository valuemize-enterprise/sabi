/**
 * Agency Dashboard Routes
 * GET /api/agency/dashboard — aggregated stats for the logged-in user
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess }  = require('../../utils/response.utils');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    // Brand IDs this user can see
    let brandIds = [];
    const wideBoys = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

    if (wideBoys.includes(role)) {
      const { data } = await supabase.from('brands').select('id').eq('status', 'active');
      brandIds = data?.map(b => b.id) || [];
    } else {
      const { data } = await supabase.from('staff_brand_assignments').select('brand_id').eq('staff_id', userId);
      brandIds = data?.map(a => a.brand_id) || [];
    }

    let activeStaffQuery = supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true).neq('role', 'super_admin');

    if (!wideBoys.includes(role) && brandIds.length) {
      const { data: staffIds } = await supabase.from('staff_brand_assignments').select('staff_id').in('brand_id', brandIds);
      const uniqueStaffIds = [...new Set(staffIds?.map(s => s.staff_id) || [])];
      if (uniqueStaffIds.length) {
        activeStaffQuery = activeStaffQuery.in('id', uniqueStaffIds);
      } else {
        activeStaffQuery = activeStaffQuery.eq('id', '__none__');
      }
    }

    const [
      { count: totalBrands },
      { count: activeGoals },
      { count: pendingTasks },
      { count: activeStaff },
      { count: publishedReports },
      { data: recentReports },
      { data: topBrands },
    ] = await Promise.all([
      supabase.from('brands').select('id', { count: 'exact', head: true }).in('id', brandIds),
      supabase.from('goals').select('id', { count: 'exact', head: true }).in('brand_id', brandIds).eq('status', 'active'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).in('brand_id', brandIds).eq('assigned_to', userId).eq('status', 'todo'),
      activeStaffQuery,
      supabase.from('reports').select('id', { count: 'exact', head: true }).in('brand_id', brandIds).eq('status', 'published'),
      supabase.from('reports').select('id, title, type, status, published_at, brands(name, logo_url)').in('brand_id', brandIds).order('created_at', { ascending: false }).limit(5),
      supabase.from('brands').select('id, name, logo_url, clarity_score, industry').in('id', brandIds).order('clarity_score', { ascending: false }).limit(5),
    ]);

    sendSuccess(res, {
      stats: { totalBrands, activeGoals, pendingTasks, activeStaff, publishedReports },
      recentReports: recentReports || [],
      topBrands:     topBrands || [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
