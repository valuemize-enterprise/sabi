/**
 * Client Satisfaction Routes
 *
 * GET  /api/client/satisfaction         — client's past submissions
 * POST /api/client/satisfaction         — submit a satisfaction response
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const scoringService = require('../../services/scoring.service');

// ── GET /api/client/satisfaction/prompt-status ───────────────
// Checks if this client already rated this week — powers the dashboard prompt
router.get('/prompt-status', authenticateClient, async (req, res, next) => {
  try {
    const weekStart = scoringService.toDateStr(scoringService.mondayOf(new Date()));

    const { data } = await supabase
      .from('client_satisfaction')
      .select('id')
      .eq('client_id', req.client.id)
      .gte('created_at', weekStart)
      .limit(1);

    res.json({ success: true, data: { submittedThisWeek: (data ?? []).length > 0 } });
  } catch (err) { next(err); }
});

// ── GET /api/client/satisfaction ─────────────────────────────
router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('client_satisfaction')
      .select('id, nps_score, quality_score, communication_score, comment, period, created_at')
      .eq('client_id', req.client.id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    sendSuccess(res, { submissions: data || [] });
  } catch (err) { next(err); }
});

// ── POST /api/client/satisfaction ────────────────────────────
router.post('/', authenticateClient, async (req, res, next) => {
  try {
    const { nps_score, quality_score, communication_score, comment, period } = req.body;

    if (nps_score === undefined || nps_score === null) {
      return sendError(res, 400, 'nps_score (0–10) is required');
    }
    if (nps_score < 0 || nps_score > 10) {
      return sendError(res, 400, 'nps_score must be between 0 and 10');
    }

    // Auto-generate period if not provided (YYYY-MM)
    const surveyPeriod = period || new Date().toISOString().slice(0, 7);

    const { data, error } = await supabase
      .from('client_satisfaction')
      .insert({
        client_id:           req.client.id,
        brand_id:            req.client.brand_id,
        nps_score:           Number(nps_score),
        quality_score:       quality_score       ? Number(quality_score)       : null,
        communication_score: communication_score ? Number(communication_score) : null,
        comment:             comment || null,
        period:              surveyPeriod,
      })
      .select('id, nps_score, period, created_at')
      .single();

    if (error) {
      // Unique constraint on client+period means only one submission per month
      if (error.code === '23505') {
        return sendError(res, 409, 'You have already submitted feedback for this period');
      }
      throw error;
    }

    sendSuccess(res, data, 'Thank you for your feedback', 201);
  } catch (err) { next(err); }
});

module.exports = router;
