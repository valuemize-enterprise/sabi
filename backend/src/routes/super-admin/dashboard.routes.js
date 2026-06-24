'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const [
      { count: totalBrands },
      { count: totalStaff },
      { count: totalClients },
      { count: totalReports },
      { count: activeGoals },
      { data: recentAudit },
      { data: topBrands },
    ] = await Promise.all([
      supabase.from('brands').select('id',   { count: 'exact', head: true }),
      supabase.from('users').select('id',    { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('clients').select('id',  { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reports').select('id',  { count: 'exact', head: true }),
      supabase.from('goals').select('id',    { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('audit_logs').select('id, actor_email, actor_role, action, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('brands').select('id, name, logo_url, clarity_score, industry, status').order('clarity_score', { ascending: false }).limit(5),
    ]);

    sendSuccess(res, {
      stats: { totalBrands, totalStaff, totalClients, totalReports, activeGoals },
      recentAudit: recentAudit || [],
      topBrands:   topBrands  || [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
