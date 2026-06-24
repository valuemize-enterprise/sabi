/**
 * Agency Calendar Routes — MomentMap™
 * GET  /api/agency/calendar
 * POST /api/agency/calendar
 * PUT  /api/agency/calendar/:id
 * DELETE /api/agency/calendar/:id
 * POST /api/agency/calendar/recommend  (ARIA MomentMap™)
 */

'use strict';

const router         = require('express').Router();
const supabase       = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const momentMapService = require('../../services/aria/moment-map.service');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, month, year } = req.query;
    let query = supabase.from('calendar_events').select('*');

    // Get global + brand-specific events
    if (brand_id) {
      query = query.or(`is_global.eq.true,brand_id.eq.${brand_id}`);
    } else {
      query = query.eq('is_global', true);
    }

    if (month && year) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end   = new Date(year, month, 0).toISOString().split('T')[0];
      query = query.gte('event_date', start).lte('event_date', end);
    }

    const { data, error } = await query.order('event_date', { ascending: true });
    if (error) throw error;
    sendSuccess(res, { events: data });
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, title, description, event_date, event_type, is_global } = req.body;
    if (!title || !event_date || !event_type) return sendError(res, 400, 'title, event_date, and event_type required');

    const { data, error } = await supabase.from('calendar_events').insert({
      brand_id: is_global ? null : brand_id,
      title, description, event_date, event_type,
      is_global: is_global || false,
      created_by: req.user.id,
    }).select().single();

    if (error) throw error;
    sendSuccess(res, { event: data }, 'Event created', 201);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const allowed = ['title', 'description', 'event_date', 'event_type', 'relevance_score', 'ai_recommendation'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabase.from('calendar_events').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { event: data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabase.from('calendar_events').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Event deleted');
  } catch (err) { next(err); }
});

// POST /api/agency/calendar/recommend  ← ARIA MomentMap™
router.post('/recommend', authenticate, async (req, res, next) => {
  try {
    const { brand_id, month, year } = req.body;
    if (!brand_id) return sendError(res, 400, 'brand_id required');

    const { data: brand } = await supabase.from('brands').select('*').eq('id', brand_id).single();
    if (!brand) return sendError(res, 404, 'Brand not found');

    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .or(`is_global.eq.true,brand_id.eq.${brand_id}`)
      .gte('event_date', `${year || new Date().getFullYear()}-${String(month || new Date().getMonth() + 1).padStart(2, '0')}-01`);

    const result = await momentMapService.recommend({ brand, events: events || [], month, year });

    // Save AI recommendations to events
    if (result.recommendations?.length) {
      await Promise.all(result.recommendations.map(rec =>
        rec.event_id
          ? supabase.from('calendar_events').update({ ai_recommendation: rec.recommendation, relevance_score: rec.relevance }).eq('id', rec.event_id)
          : Promise.resolve()
      ));
    }

    sendSuccess(res, result);
  } catch (err) { next(err); }
});

module.exports = router;
