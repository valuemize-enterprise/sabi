/**
 * Leaderboard Routes
 *
 * GET /api/agency/leaderboard?type=staff|brand_admin&period=week|month|all
 *
 * Visibility design (per blueprint):
 * - Everyone sees: rank, name, avatar, normalized score band, trend arrow, Creative-of-Week badge
 * - NOT component breakdowns of others (that's only on their own /my-score)
 * - Leadership (global admins) get an extra `fullScore` field for internal reference
 * - Bottom of the list shows encouraging framing, not harsh last-place language
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const scoringService = require('../../services/scoring.service');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

function scoreBand(score) {
  if (score >= 90) return { band: 'Exceptional', color: 'purple' };
  if (score >= 75) return { band: 'Strong',      color: 'green'  };
  if (score >= 60) return { band: 'Solid',       color: 'blue'   };
  if (score >= 40) return { band: 'Building',    color: 'amber'  };
  return               { band: 'Building momentum', color: 'gray' };
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const type = req.query.type === 'brand_admin' ? 'brand_admin' : 'staff';
    const period = ['week','month','all'].includes(req.query.period) ? req.query.period : 'week';

    let weekFilter = {};
    if (period === 'week') {
      const lastWeek = scoringService.toDateStr(scoringService.lastCompletedWeekStart());
      weekFilter = { week_start: lastWeek };
    } else if (period === 'month') {
      const monthAgo = scoringService.toDateStr(new Date(Date.now() - 28 * 86400000));
      weekFilter = { gte_week_start: monthAgo };
    }
    // period === 'all' → no date filter, use rolling average per user instead

    let entries = [];

    if (period === 'all') {
      // Rank by rolling 4-week average
      const roleFilter = type === 'brand_admin'
        ? await supabase.from('staff_brand_assignments').select('staff_id').contains('roles_on_brand', ['brand_admin'])
        : await supabase.from('users').select('id as staff_id').eq('is_active', true);

      const userIds = [...new Set((roleFilter.data ?? []).map((r) => r.staff_id ?? r.id))];

      entries = await Promise.all(userIds.map(async (uid) => {
        const { data: user } = await supabase.from('users').select('id, full_name, avatar_url, role').eq('id', uid).single();
        const [avg, prevAvg] = await Promise.all([
          scoringService.getRollingAverage(uid, type),
          scoringService.getRollingAverage(uid, type, 4, 4), // 4-week window starting 4 weeks ago
        ]);
        return { user, score: avg, prevScore: prevAvg };
      }));
    } else {
      let query = supabase.from('weekly_scores').select('user_id, total, excluded, week_start, users!user_id(id, full_name, avatar_url, role)').eq('score_type', type).eq('excluded', false);
      if (weekFilter.week_start) query = query.eq('week_start', weekFilter.week_start);
      if (weekFilter.gte_week_start) query = query.gte('week_start', weekFilter.gte_week_start);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch previous period scores for trend
      let prevQuery = supabase.from('weekly_scores').select('user_id, total, excluded, week_start').eq('score_type', type).eq('excluded', false);
      if (period === 'week') {
        const prevWeekStart = scoringService.toDateStr(new Date(scoringService.lastCompletedWeekStart().getTime() - 7 * 86400000));
        prevQuery = prevQuery.eq('week_start', prevWeekStart);
      } else {
        const prevMonthStart = scoringService.toDateStr(new Date(Date.now() - 56 * 86400000));
        const prevMonthEnd = scoringService.toDateStr(new Date(Date.now() - 28 * 86400000));
        prevQuery = prevQuery.gte('week_start', prevMonthStart).lt('week_start', prevMonthEnd);
      }
      const { data: prevData } = await prevQuery;

      if (period === 'month') {
        // Average across the period's weeks per user
        const byUser = {};
        (data ?? []).forEach((row) => {
          if (!byUser[row.user_id]) byUser[row.user_id] = { user: row.users, scores: [] };
          byUser[row.user_id].scores.push(Number(row.total));
        });
        const prevByUser = {};
        (prevData ?? []).forEach((row) => {
          if (!prevByUser[row.user_id]) prevByUser[row.user_id] = [];
          prevByUser[row.user_id].push(Number(row.total));
        });
        entries = Object.values(byUser).map((v) => {
          const score = v.scores.reduce((s,n)=>s+n,0)/v.scores.length;
          const uid = v.user?.id;
          const prevScores = prevByUser[uid];
          const prevScore = prevScores?.length ? prevScores.reduce((s,n)=>s+n,0)/prevScores.length : null;
          return { user: v.user, score, prevScore };
        });
      } else {
        const prevByUser = {};
        (prevData ?? []).forEach((row) => { prevByUser[row.user_id] = Number(row.total); });
        entries = (data ?? []).map((row) => ({
          user: row.users,
          score: Number(row.total),
          prevScore: prevByUser[row.user_id] ?? null,
        }));
      }
    }

    // Filter out nulls, sort descending
    entries = entries.filter(e => e.user && e.score != null).sort((a,b) => b.score - a.score);

    // Get Creative of the Week badges for this week (staff leaderboard only)
    let creativeOfWeekIds = new Set();
    if (type === 'staff' && period === 'week') {
      const lastWeek = scoringService.toDateStr(scoringService.lastCompletedWeekStart());
      const { data: cow } = await supabase.from('weekly_ratings').select('staff_id').eq('week_start', lastWeek).eq('is_creative_of_week', true);
      creativeOfWeekIds = new Set((cow ?? []).map((c) => c.staff_id));
    }

    const showFullScore = isGlobalAdmin(req.user.role);

    const ranked = entries.map((e, i) => {
      const sb = scoreBand(e.score);
      let trend = 'same';
      if (e.prevScore != null && e.score != null) {
        const diff = e.score - e.prevScore;
        if (diff > 0.5) trend = 'up';
        else if (diff < -0.5) trend = 'down';
      }
      return {
        rank: i + 1,
        user_id: e.user.id,
        full_name: e.user.full_name,
        avatar_url: e.user.avatar_url,
        role: e.user.role,
        scoreBand: sb.band,
        scoreBandColor: sb.color,
        isCreativeOfWeek: creativeOfWeekIds.has(e.user.id),
        isSelf: e.user.id === req.user.id,
        trend,
        // Full numeric score visible to leadership and to the person themselves
        fullScore: (showFullScore || e.user.id === req.user.id) ? Math.round(e.score * 10) / 10 : undefined,
      };
    });

    sendSuccess(res, { type, period, leaderboard: ranked, myRank: ranked.find(r => r.isSelf)?.rank ?? null });
  } catch (err) { next(err); }
});

module.exports = router;
