'use strict';

const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../utils/response.utils');

const HR_ROLES = ['hr', 'super_admin', 'admin', 'md'];
router.use(authenticate);

// GET /api/agency/scores/:userId
// Returns clarity score history + team ratings for one user.
// Staff can fetch their own; HR can fetch anyone's.
router.get('/:userId', async (req, res) => {
  try {
    const { id: callerId, role } = req.user;
    const { userId } = req.params;
    const isHR = HR_ROLES.includes(role);

    if (!isHR && callerId !== userId) {
      return res.status(403).json({ error: 'You can only view your own scores' });
    }

    // Fetch last 26 weeks of clarity scores (6 months)
    const { data: scores, error: scoresErr } = await supabase
      .from('clarity_scores')
      .select('id, score, week_start, notes, brand_id, scored_by, created_at')
      .eq('user_id', userId)
      .order('week_start', { ascending: true })
      .limit(26);

    if (scoresErr) throw new Error(scoresErr.message);

    // Fetch team ratings
    const { data: ratings, error: ratingsErr } = await supabase
      .from('team_ratings')
      .select('id, rating, category, note, period, rated_by, created_at')
      .eq('user_id', userId)
      .order('period', { ascending: false })
      .limit(20);

    if (ratingsErr) throw new Error(ratingsErr.message);

    // Enrich with rater names
    const raterIds = [...new Set(
      [...(ratings || []).map(r => r.rated_by), ...(scores || []).map(s => s.scored_by)]
        .filter(Boolean)
    )];

    const { data: raters } = raterIds.length
      ? await supabase.from('users').select('id, full_name').in('id', raterIds)
      : { data: [] };

    const raterMap = Object.fromEntries((raters || []).map(u => [u.id, u.full_name]));

    // Compute summary stats
    const scoreList = (scores || []).map(s => s.score);
    const currentScore  = scoreList.at(-1) ?? null;
    const averageScore  = scoreList.length
      ? Math.round(scoreList.reduce((a, b) => a + b, 0) / scoreList.length)
      : null;
    const prevScore     = scoreList.at(-2) ?? null;
    const trend         = currentScore != null && prevScore != null
      ? currentScore - prevScore : null;

    const avgRating = ratings?.length
      ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
      : null;

    res.json({
      user_id:       userId,
      current_score: currentScore,
      average_score: averageScore,
      trend,
      avg_rating:    avgRating,
      score_history: (scores || []).map(s => ({
        ...s,
        scored_by_name: raterMap[s.scored_by] || null,
      })),
      ratings: (ratings || []).map(r => ({
        ...r,
        rated_by_name: raterMap[r.rated_by] || null,
      })),
    });
  } catch (err) {
    console.error('[scores] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agency/scores/:userId
// Log a clarity score for a user. HR only.
router.post('/:userId', async (req, res) => {
  try {
    const { role, id: scoredBy } = req.user;
    if (!HR_ROLES.includes(role)) {
      return res.status(403).json({ error: 'HR access required' });
    }

    const { score, week_start, notes, brand_id } = req.body;
    if (!score || !week_start) {
      return res.status(400).json({ error: 'score and week_start are required' });
    }

    const { data, error } = await supabase
      .from('clarity_scores')
      .upsert(
        { user_id: req.params.userId, score, week_start, notes: notes || null, brand_id: brand_id || null, scored_by: scoredBy },
        { onConflict: 'user_id,week_start' }
      )
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ score: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agency/scores/:userId/rating
// Log a team rating for a user.
router.post('/:userId/rating', async (req, res) => {
  try {
    const { id: ratedBy } = req.user;
    const { rating, category, note, period } = req.body;

    if (!rating || !period) {
      return res.status(400).json({ error: 'rating and period are required' });
    }

    const { data, error } = await supabase
      .from('team_ratings')
      .insert({
        user_id: req.params.userId,
        rated_by: ratedBy,
        rating, category: category || null,
        note: note || null,
        period,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ rating: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agency/scores/mine
// Returns current week score and history for authenticated user
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    // Firstly check if user has used two weeks on the app
    // Go to user table check user.updated_at
    const { data: user } = await supabase
      .from('users')
      .select('updated_at')
      .eq('id', req.user.id)
      .single();

    if (!user) return sendError(res, 404, 'User not found');

    // Check if user has been on the app for 2 weeks
    const updatedAt = new Date(user.updated_at);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    if (updatedAt < twoWeeksAgo) {
      return sendError(res, 400, 'Only users with 2+ weeks on the app can view scores');
    }

    // Determine score type: staff or brand_admin
    const { data: baCheck } = await supabase
      .from('staff_brand_assignments')
      .select('roles_on_brand')
      .eq('staff_id', req.user.id)
      .contains('roles_on_brand', ['brand_admin'])
      .limit(1);

    const scoreType = (baCheck?.length ?? 0) > 0 ? 'brand_admin' : 'staff';

    // Get config
    const scoringService = require('../services/scoring.service');
    const config = await scoringService.getConfig();

    // Calculate score for current week (Monday-based week)
    // Score is calculated on Monday for the previous week and displayed this week
    const weekStart = scoringService.lastCompletedWeekStart();
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    let scoreData = null;

    if (scoreType === 'staff') {
      // Calculate staff score for the previous week (displayed this week)
      const { data: staffScore } = await scoringService.computeStaffScore(
        req.user.id, weekStart, config
      );
      scoreData = staffScore;
    } else {
      // Calculate brand admin score
      const { data: assignments } = await supabase
        .from('staff_brand_assignments')
        .select('brand_id')
        .eq('staff_id', req.user.id)
        .contains('roles_on_brand', ['brand_admin']);

      const brandIds = (assignments ?? []).map((a) => a.brand_id);
      if (brandIds.length > 0) {
        const baResult = await scoringService.computeBrandAdminScore(
          req.user.id,
          brandIds[0],
          weekStart,
          config
        );
        scoreData = baResult;
      }
    }

    // Fetch score history - last 12 weeks of weekly_scores
    const { data: history } = await supabase
      .from('weekly_scores')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('score_type', scoreType)
      .order('week_start', { ascending: false })
      .limit(12);

    // Build human-readable component breakdown
    let breakdown = null;
    if (scoreData && !scoreData.excluded && scoreData.components) {
      const c = scoreData.components;
      breakdown = {
        tasks: {
          label:       'Verified Tasks',
          points:      c.tasks?.points ?? 0,
          max:         c.tasks?.weight ?? 0,
          detail:      c.tasks?.raw != null
            ? `${c.tasks.verified ?? 0} verified out of ${c.tasks.assigned ?? 0} assigned`
            : 'No tasks assigned this week',
        },
        satisfaction: {
          label:       'Client Satisfaction',
          points:      c.satisfaction?.points ?? 0,
          max:         c.satisfaction?.weight ?? 0,
          detail:      c.satisfaction?.raw != null
            ? `Average NPS: ${c.satisfaction.raw.toFixed(1)}/10`
            : 'No client ratings this week',
        },
        contributions: {
          label:       'Contributions',
          points:      c.contributions?.points ?? 0,
          max:         c.contributions?.weight ?? 0,
          detail:      `${c.contributions?.raw ?? 0} verified contribution points`,
        },
        managerRating: {
          label:       'Manager Rating',
          points:      c.managerRating?.points ?? 0,
          max:         c.managerRating?.weight ?? 0,
          detail:      c.managerRating?.wasDefaulted
            ? 'No rating submitted — defaulted to neutral'
            : `Rated ${c.managerRating?.raw?.toFixed(1) ?? 0}/5`,
        },
        creativeBonus: {
          label:       'Creative of the Week',
          points:      c.creativeBonus?.points ?? 0,
          max:         5,
          detail:      c.creativeBonus?.isCreativeOfWeek
            ? '🏆 You were creative of the week!'
            : 'Not awarded this week',
        },
      };
    }

    // Determine rolling average
    const rollingAvg = await scoringService.getRollingAverage(req.user.id, scoreType);

    sendSuccess(res, {
      scoreType,
      rollingAverage: rollingAvg != null
        ? Math.round(rollingAvg * 100) / 100
        : null,
      latestWeek:  scoreData,
      breakdown,
      history:     (history ?? []).map(w => ({
        week_start:  w.week_start,
        total:       Math.round(Number(w.total) * 100) / 100,
        excluded:    w.excluded,
        reason:      w.excluded ? w.components?.reason : null,
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;