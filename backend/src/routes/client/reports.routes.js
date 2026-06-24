'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');

// GET /api/client/reports — only published reports for their brand
router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('reports')
      .select('id, title, type, period_start, period_end, narrative, clarity_score, published_at, content, metrics', { count: 'exact' })
      .eq('brand_id', req.client.brand_id)
      .eq('status', 'published');
    if (type) query = query.eq('type', type);
    const { data, count, error } = await query.order('published_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.get('/:id', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('reports')
      .select('*').eq('id', req.params.id).eq('brand_id', req.client.brand_id).eq('status', 'published').single();
    if (error || !data) return sendError(res, 404, 'Report not found');
    sendSuccess(res, { report: data });
  } catch (err) { next(err); }
});

module.exports = router;
