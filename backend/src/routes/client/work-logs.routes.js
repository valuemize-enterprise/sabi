/**
 * Client Work Logs Routes
 * Clients see all work their Cerebre team has logged for their brand.
 * This is the most important client-facing endpoint — it proves what was done.
 *
 * GET /api/client/work-logs   — all work logs for the client's brand
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendPaginated } = require('../../utils/response.utils');

// ── GET /api/client/work-logs ─────────────────────────────────
router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { category, period, page = 1, limit = 100 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('work_logs')
      .select(`
        id, title, description, category, hours,
        created_at, brand_id, goal_id,
        goals ( id, title, metric_type, unit ),
        users ( id, full_name, role, avatar_url )
      `, { count: 'exact' })
      .eq('brand_id', req.client.brand_id);

    if (category) query = query.eq('category', category);

    // Period filter
    if (period === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      query = query.gte('created_at', weekAgo);
    } else if (period === 'month') {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      query = query.gte('created_at', start.toISOString());
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;

    // Summary stats for the client
    const all = data || [];
    const totalHours = all.reduce((s, l) => s + (l.hours || 0), 0);
    const byCategory = all.reduce((acc, l) => {
      acc[l.category] = (acc[l.category] || 0) + 1;
      return acc;
    }, {});
    const teamMembers = [...new Set(all.map(l => l.users?.full_name).filter(Boolean))];

    sendPaginated(res, all, count, page, limit);
  } catch (err) { next(err); }
});

module.exports = router;
