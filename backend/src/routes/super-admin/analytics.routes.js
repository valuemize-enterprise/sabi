'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const [
      { count: brands },
      { count: activeStaff },
      { count: activeClients },
      { count: totalReports },
      { data: brandsByIndustry },
      { data: roleBreakdown },
    ] = await Promise.all([
      supabase.from('brands').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('brands').select('industry'),
      supabase.from('users').select('role'),
    ]);

    const industryMap = (brandsByIndustry || []).reduce((a, b) => { a[b.industry] = (a[b.industry] || 0) + 1; return a; }, {});
    const roleMap     = (roleBreakdown || []).reduce((a, b) => { a[b.role] = (a[b.role] || 0) + 1; return a; }, {});

    sendSuccess(res, { brands, activeStaff, activeClients, totalReports, industryBreakdown: industryMap, roleBreakdown: roleMap });
  } catch (err) { next(err); }
});

module.exports = router;
