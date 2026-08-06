// ═══════════════════════════════════════════════════════════════
// scores.routes.js
// Mount in server.js:
//   const scoresRouter = require('./src/routes/scores.routes');
//   app.use('/api/agency/scores', requireAuth, scoresRouter);
// ═══════════════════════════════════════════════════════════════

'use strict';

const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth.middleware');

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

module.exports = router;
