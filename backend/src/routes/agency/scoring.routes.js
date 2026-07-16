/**
 * Scoring Routes
 *
 * GET  /api/agency/scores/mine              — own score breakdown + history (triggers lazy compute)
 * GET  /api/agency/scores/config            — view weights (Super Admin only)
 * PATCH /api/agency/scores/config           — edit weights (Super Admin only, audit-logged)
 * POST /api/agency/scores/disputes          — flag a week's score
 * GET  /api/agency/scores/disputes          — Super Admin's dispute queue
 * PUT  /api/agency/scores/disputes/:id       — resolve/dismiss a dispute
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');
const scoringService = require('../../services/scoring.service');

// ── GET /api/agency/scores/mine ────────────────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    // Lazy compute: cheap idempotent check, only does work if a week is missing
    await scoringService.computeMissingScores().catch(err => console.error('Score computation error:', err.message));

    const isBrandAdmin = await supabase
      .from('staff_brand_assignments').select('roles_on_brand')
      .eq('staff_id', req.user.id).contains('roles_on_brand', ['brand_admin']).limit(1);
    const scoreType = (isBrandAdmin.data?.length ?? 0) > 0 ? 'brand_admin' : 'staff';

    const { data: history } = await supabase
      .from('weekly_scores').select('*')
      .eq('user_id', req.user.id).eq('score_type', scoreType)
      .order('week_start', { ascending: false })
      .limit(12);

    const rollingAvg = await scoringService.getRollingAverage(req.user.id, scoreType);

    sendSuccess(res, {
      scoreType,
      rollingAverage: rollingAvg,
      latestWeek: history?.[0] ?? null,
      history: history ?? [],
    });
  } catch (err) { next(err); }
});

// ── GET /api/agency/scores/config ──────────────────────────────
router.get('/config', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') return sendError(res, 403, 'Only the Super Admin can view scoring weights');
    const config = await scoringService.getConfig();
    sendSuccess(res, { config });
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/scores/config ────────────────────────────
router.patch('/config', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') return sendError(res, 403, 'Only the Super Admin can edit scoring weights');

    const allowed = [
      'staff_satisfaction_weight','staff_task_weight','staff_manager_rating_weight','staff_contribution_weight',
      'ba_satisfaction_weight','ba_goal_achievement_weight','ba_team_completion_weight','ba_revenue_weight',
      'monthly_revenue_target_per_brand','unverified_task_grace_days',
    ];

    const before = await scoringService.getConfig();
    const updates = { updated_by: req.user.role !== 'super_admin' ? req.user.id : null, updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    // Validate staff weights sum to 100 if any are being changed
    const staffKeys = ['staff_satisfaction_weight','staff_task_weight','staff_manager_rating_weight','staff_contribution_weight'];
    if (staffKeys.some(k => updates[k] !== undefined)) {
      const sum = staffKeys.reduce((s,k) => s + (updates[k] ?? before[k]), 0);
      if (sum !== 100) return sendError(res, 400, `Staff weights must sum to 100 (currently ${sum})`);
    }
    const baKeys = ['ba_satisfaction_weight','ba_goal_achievement_weight','ba_team_completion_weight','ba_revenue_weight'];
    if (baKeys.some(k => updates[k] !== undefined)) {
      const sum = baKeys.reduce((s,k) => s + (updates[k] ?? before[k]), 0);
      if (sum !== 100) return sendError(res, 400, `Brand Admin weights must sum to 100 (currently ${sum})`);
    }

    const { data, error } = await supabase.from('scoring_config').update(updates).eq('id', 1).select().single();
    if (error) throw error;

    await auditLog({
      actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role,
      action: 'UPDATE_SCORING_CONFIG', resourceType: 'scoring_config', resourceId: '1',
      details: { before, after: data }, req,
    });

    sendSuccess(res, { config: data }, 'Scoring weights updated. Future weeks use the new weights — past scores are unaffected.');
  } catch (err) { next(err); }
});

// ── POST /api/agency/scores/disputes ───────────────────────────
router.post('/disputes', authenticate, async (req, res, next) => {
  try {
    const { weekly_score_id, note } = req.body;
    if (!weekly_score_id || !note?.trim()) return sendError(res, 400, 'weekly_score_id and note are required');

    const { data: score } = await supabase.from('weekly_scores').select('user_id').eq('id', weekly_score_id).single();
    if (!score || score.user_id !== req.user.id) return sendError(res, 403, 'You can only dispute your own score');

    const { data, error } = await supabase
      .from('score_disputes')
      .insert({ weekly_score_id, raised_by: req.user.role !== 'super_admin' ? req.user.id : null, note: note.trim() })
      .select()
      .single();

    if (error) throw error;

    const { data: superAdmins } = await supabase.from('users').select('id').eq('role', 'super_admin');
    if (superAdmins?.length) {
      await supabase.from('notifications').insert(superAdmins.map(a => ({
        user_id: a.id, type: 'score_dispute_raised',
        title: `⚠️ Score Dispute from ${req.user.full_name}`,
        body: note.trim().slice(0, 100),
        metadata: { dispute_id: data.id }, is_read: false,
      })));
    }

    sendSuccess(res, { dispute: data }, 'Dispute submitted — a Super Admin will review it', 201);
  } catch (err) { next(err); }
});

// ── GET /api/agency/scores/disputes ────────────────────────────
router.get('/disputes', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') return sendError(res, 403, 'Only the Super Admin can view the dispute queue');

    const { data, error } = await supabase
      .from('score_disputes')
      .select('*, weekly_scores(week_start, total, score_type, components), raiser:users!raised_by(full_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    sendSuccess(res, { disputes: data ?? [] });
  } catch (err) { next(err); }
});

// ── PUT /api/agency/scores/disputes/:id ────────────────────────
router.put('/disputes/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'super_admin') return sendError(res, 403, 'Only the Super Admin can resolve disputes');

    const { status, resolution_note } = req.body;
    if (!['resolved','dismissed'].includes(status)) return sendError(res, 400, 'status must be resolved or dismissed');

    const { data, error } = await supabase
      .from('score_disputes')
      .update({ status, resolution_note: resolution_note || null, resolved_by: req.user.role !== 'super_admin' ? req.user.id : null, resolved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*, raiser:users!raised_by(id, full_name)')
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: data.raiser.id, type: 'score_dispute_resolved',
      title: `Your score dispute was ${status}`,
      body: resolution_note || '',
      metadata: { dispute_id: data.id }, is_read: false,
    });

    sendSuccess(res, { dispute: data }, 'Dispute updated');
  } catch (err) { next(err); }
});

module.exports = router;
