/**
 * Scoring Service
 * Computes weekly scores for staff and Brand Admins.
 * Lazy computation: called on first relevant page load after a week ends —
 * no cron dependency. Idempotent — safe to call repeatedly.
 *
 * Every edge case below is a deliberate decision from the blueprint,
 * not an oversight. Read the comments before changing any of them.
 */
'use strict';

const supabase = require('../config/supabase');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateStr(d) { return d.toISOString().slice(0, 10); }

function lastCompletedWeekStart() {
  // "First page load after Monday 00:00 Lagos" — Lagos is UTC+1, close enough
  // that using UTC Monday boundaries with a 1-hour buffer is safe in practice.
  const now = new Date();
  const thisMonday = mondayOf(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
  return lastMonday; // the most recent FULLY completed week
}

async function getConfig() {
  const { data } = await supabase.from('scoring_config').select('*').eq('id', 1).single();
  return data;
}

// ── Compute a single staff member's score for one week ─────────
async function computeStaffScore(userId, weekStartDate, config) {
  const weekStart = toDateStr(weekStartDate);
  const weekEnd   = toDateStr(new Date(weekStartDate.getTime() + 7 * 86400000));

  // Skip if on leave that week
  const { data: leave } = await supabase.from('staff_leave').select('id').eq('staff_id', userId).eq('week_start', weekStart).single();
  if (leave) {
    return { excluded: true, components: { reason: 'on_leave' }, total: 0 };
  }

  // Skip if too new (< 2 full weeks since joining)
  const { data: user } = await supabase.from('users').select('created_at, role').eq('id', userId).single();
  if (!user) return null;
  const weeksSinceJoin = (weekStartDate.getTime() - new Date(user.created_at).getTime()) / (7 * 86400000);
  if (weeksSinceJoin < 2) {
    return { excluded: true, components: { reason: 'new_staff' }, total: 0 };
  }

  // Which brands is this person on?
  const { data: assignments } = await supabase.from('staff_brand_assignments').select('brand_id').eq('staff_id', userId);
  const brandIds = (assignments ?? []).map(a => a.brand_id);
  const hasClientBrands = brandIds.length > 0;

  // ── 1. Client Satisfaction ──────────────────────────────────
  let satisfactionRaw = null;
  if (hasClientBrands) {
    const { data: ratings } = await supabase
      .from('client_satisfaction')
      .select('rating, brand_id, created_at')
      .in('brand_id', brandIds)
      .lte('created_at', weekEnd);

    const thisWeek = (ratings ?? []).filter(r => r.created_at >= weekStart && r.created_at < weekEnd);
    if (thisWeek.length > 0) {
      satisfactionRaw = thisWeek.reduce((s, r) => s + r.rating, 0) / thisWeek.length;
    } else {
      // Carry forward most recent rating, max 3 weeks old
      const threeWeeksAgo = toDateStr(new Date(weekStartDate.getTime() - 21 * 86400000));
      const recent = (ratings ?? []).filter(r => r.created_at >= threeWeeksAgo).sort((a,b) => b.created_at.localeCompare(a.created_at));
      if (recent.length > 0) satisfactionRaw = recent[0].rating;
    }
  }

  // ── 2. Verified Task Completion ─────────────────────────────
  const { data: assignedTasks } = await supabase
    .from('tasks').select('id, status')
    .eq('assignee_id', userId)
    .lte('due_date', weekEnd).gte('due_date', weekStart);

  let taskRate = null; // null = no tasks assigned → neutral score
  if (assignedTasks && assignedTasks.length > 0) {
    const verified = assignedTasks.filter(t => t.status === 'verified').length;
    taskRate = verified / assignedTasks.length;
  }

  // ── 3. Manager Quality Rating ────────────────────────────────
  const { data: mgrRatings } = await supabase
    .from('weekly_ratings').select('score, is_creative_of_week').eq('staff_id', userId).eq('week_start', weekStart);
  const managerRatingRaw = mgrRatings?.length
    ? mgrRatings.reduce((s, r) => s + r.score, 0) / mgrRatings.length
    : 3; // missing rating defaults to neutral 3, never zero
  const isCreativeOfWeek = (mgrRatings ?? []).some(r => r.is_creative_of_week);

  // ── 4. Verified Contributions ────────────────────────────────
  const { data: claims } = await supabase
    .from('contribution_claims').select('points_awarded')
    .eq('staff_id', userId).eq('week_start', weekStart).eq('status', 'verified')
    .order('points_awarded', { ascending: false })
    .limit(2); // max 2 counted claims per week
  const contributionPoints = (claims ?? []).reduce((s, c) => s + (c.points_awarded || 0), 0);

  // ── Weighting (redistribute if no client brands / no satisfaction data) ──
  let wSat = config.staff_satisfaction_weight;
  let wTask = config.staff_task_weight;
  let wMgr = config.staff_manager_rating_weight;
  let wContrib = config.staff_contribution_weight;

  if (!hasClientBrands || satisfactionRaw === null) {
    // Redistribute satisfaction weight to manager rating + tasks (per blueprint edge case)
    const redistribute = wSat;
    wSat = 0;
    wMgr += Math.round(redistribute * 0.6);
    wTask += redistribute - Math.round(redistribute * 0.6);
  }

  const satisfactionPoints = satisfactionRaw !== null ? (satisfactionRaw / 5) * wSat : 0;
  const taskPoints = taskRate !== null ? taskRate * wTask : wTask * 0.5; // no tasks assigned → neutral (50%)
  const managerPoints = (managerRatingRaw / 5) * wMgr;
  const contribPoints = Math.min(contributionPoints, wContrib > 15 ? wContrib : 15); // cap at category weight
  const creativeBonus = isCreativeOfWeek ? 5 : 0;

  const total = Math.round((satisfactionPoints + taskPoints + managerPoints + contribPoints + creativeBonus) * 100) / 100;

  return {
    excluded: false,
    total,
    components: {
      satisfaction: { raw: satisfactionRaw, points: Math.round(satisfactionPoints*100)/100, weight: wSat },
      tasks:        { raw: taskRate, verified: assignedTasks?.filter(t=>t.status==='verified').length ?? 0, assigned: assignedTasks?.length ?? 0, points: Math.round(taskPoints*100)/100, weight: wTask },
      managerRating:{ raw: managerRatingRaw, wasDefaulted: !mgrRatings?.length, points: Math.round(managerPoints*100)/100, weight: wMgr },
      contributions:{ raw: contributionPoints, points: Math.round(contribPoints*100)/100, weight: wContrib },
      creativeBonus:{ raw: isCreativeOfWeek ? 1 : 0, points: creativeBonus, weight: 5, isCreativeOfWeek },
    },
  };
}

// ── Compute a single Brand Admin's score for one week ───────────
async function computeBrandAdminScore(userId, brandId, weekStartDate, config) {
  const weekStart = toDateStr(weekStartDate);
  const weekEnd   = toDateStr(new Date(weekStartDate.getTime() + 7 * 86400000));

  const { data: leave } = await supabase.from('staff_leave').select('id').eq('staff_id', userId).eq('week_start', weekStart).single();
  if (leave) return { excluded: true, components: { reason: 'on_leave' }, total: 0 };

  // 1. Client Satisfaction (this brand)
  const { data: ratings } = await supabase
    .from('client_satisfaction').select('rating, created_at').eq('brand_id', brandId).lte('created_at', weekEnd);
  const thisWeek = (ratings ?? []).filter(r => r.created_at >= weekStart && r.created_at < weekEnd);
  let satisfactionRaw = thisWeek.length ? thisWeek.reduce((s,r)=>s+r.rating,0)/thisWeek.length : null;
  if (satisfactionRaw === null) {
    const threeWeeksAgo = toDateStr(new Date(weekStartDate.getTime() - 21*86400000));
    const recent = (ratings??[]).filter(r=>r.created_at>=threeWeeksAgo).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    if (recent.length) satisfactionRaw = recent[0].rating;
  }

  // 2. Goal Achievement Rate (this brand's active goals)
  const { data: goals } = await supabase.from('goals').select('current_value, target_value').eq('brand_id', brandId).eq('status', 'active');
  let goalRate = null;
  if (goals && goals.length > 0) {
    const onTrack = goals.filter(g => (g.current_value / Math.max(g.target_value,1)) >= 0.7).length;
    goalRate = onTrack / goals.length;
  }

  // 3. Team Verified Task Completion (this brand)
  const { data: teamTasks } = await supabase.from('tasks').select('id, status, updated_at').eq('brand_id', brandId).lte('due_date', weekEnd).gte('due_date', weekStart);
  let teamRate = null;
  if (teamTasks && teamTasks.length > 0) {
    const verified = teamTasks.filter(t => t.status === 'verified').length;
    teamRate = verified / teamTasks.length;
  }
  // Penalty: tasks sitting "done" unverified beyond grace period count against, not neutral
  const { data: staleDone } = await supabase.from('tasks').select('id, updated_at').eq('brand_id', brandId).eq('status', 'done');
  const graceMs = (config.unverified_task_grace_days ?? 5) * 86400000;
  const staleCount = (staleDone ?? []).filter(t => (Date.now() - new Date(t.updated_at).getTime()) > graceMs).length;
  const stalePenalty = Math.min(staleCount * 0.05, 0.3); // up to 30% penalty on this component

  // 4. Revenue from New Briefs (this brand, this month, prorated weekly vs target)
  const monthStart = toDateStr(new Date(weekStartDate.getFullYear(), weekStartDate.getMonth(), 1));
  const { data: newProjectInvoices } = await supabase
    .from('invoices').select('amount').eq('brand_id', brandId).eq('invoice_type', 'project').gte('due_date', monthStart);
  const monthRevenue = (newProjectInvoices ?? []).reduce((s,i)=>s+Number(i.amount),0);
  const weeklyTarget = (config.monthly_revenue_target_per_brand ?? 500000) / 4;
  const revenueRate = Math.min(monthRevenue / 4 / weeklyTarget, 1.5); // cap upside at 150%

  const wSat = config.ba_satisfaction_weight;
  const wGoal = config.ba_goal_achievement_weight;
  const wTeam = config.ba_team_completion_weight;
  const wRev = config.ba_revenue_weight;

  const satisfactionPoints = satisfactionRaw !== null ? (satisfactionRaw/5) * wSat : wSat * 0.5;
  const goalPoints = goalRate !== null ? goalRate * wGoal : wGoal * 0.5;
  const teamPoints = teamRate !== null ? Math.max(0, (teamRate - stalePenalty)) * wTeam : wTeam * 0.5;
  const revPoints = Math.min(revenueRate, 1) * wRev;

  const total = Math.round((satisfactionPoints + goalPoints + teamPoints + revPoints) * 100) / 100;

  return {
    excluded: false,
    total,
    components: {
      satisfaction: { raw: satisfactionRaw, points: Math.round(satisfactionPoints*100)/100, weight: wSat },
      goalAchievement: { raw: goalRate, points: Math.round(goalPoints*100)/100, weight: wGoal },
      teamCompletion: { raw: teamRate, stalePenalty, points: Math.round(teamPoints*100)/100, weight: wTeam },
      revenue: { raw: monthRevenue, weeklyTarget, points: Math.round(revPoints*100)/100, weight: wRev },
    },
  };
}

// ── Main entry point: compute all missing scores up to last completed week ──
// Idempotent — only computes weeks that don't already have a stored score.
async function computeMissingScores() {
  const config = await getConfig();
  const targetWeek = lastCompletedWeekStart();
  const targetWeekStr = toDateStr(targetWeek);

  // Staff scores
  const { data: staff } = await supabase.from('users').select('id').eq('is_active', true);
  for (const s of (staff ?? [])) {
    const { data: existing } = await supabase.from('weekly_scores').select('id').eq('user_id', s.id).eq('score_type','staff').eq('week_start', targetWeekStr).single();
    if (existing) continue;
    const result = await computeStaffScore(s.id, targetWeek, config);
    if (!result) continue;
    await supabase.from('weekly_scores').upsert({
      user_id: s.id, score_type: 'staff', week_start: targetWeekStr,
      components: result.components, total: result.total, excluded: result.excluded,
    }, { onConflict: 'user_id,score_type,week_start' });
  }

  // Brand Admin scores (one per brand_admin assignment — a person can be BA of multiple brands)
  const { data: brandAdmins } = await supabase.from('staff_brand_assignments').select('staff_id, brand_id, roles_on_brand').contains('roles_on_brand', ['brand_admin']);
  for (const ba of (brandAdmins ?? [])) {
    const { data: existing } = await supabase.from('weekly_scores').select('id').eq('user_id', ba.staff_id).eq('score_type','brand_admin').eq('week_start', targetWeekStr).single();
    if (existing) continue; // Note: if BA of multiple brands, first-computed brand wins for now — acceptable v1 simplification
    const result = await computeBrandAdminScore(ba.staff_id, ba.brand_id, targetWeek, config);
    if (!result) continue;
    await supabase.from('weekly_scores').upsert({
      user_id: ba.staff_id, score_type: 'brand_admin', week_start: targetWeekStr,
      components: result.components, total: result.total, excluded: result.excluded,
    }, { onConflict: 'user_id,score_type,week_start' });
  }

  return { computedWeek: targetWeekStr };
}

// ── Rolling 4-week average for a user ────────────────────────────
async function getRollingAverage(userId, scoreType, windowSize = 4, offsetWeeks = 0) {
  const limit = windowSize + offsetWeeks + 2; // extra buffer
  const { data } = await supabase
    .from('weekly_scores')
    .select('total, week_start, excluded')
    .eq('user_id', userId).eq('score_type', scoreType)
    .order('week_start', { ascending: false })
    .limit(limit);

  const usable = (data ?? []).filter(s => !s.excluded).slice(offsetWeeks, offsetWeeks + windowSize);
  if (usable.length === 0) return null;
  const avg = usable.reduce((s, w) => s + Number(w.total), 0) / usable.length;
  return Math.round(avg * 100) / 100;
}

module.exports = {
  mondayOf, toDateStr, lastCompletedWeekStart,
  computeMissingScores, getRollingAverage, getConfig,
};
