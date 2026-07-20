/**
 * MD Weekly Pulse Routes
 * Visible to Super Admin, MD, CEO only.
 * Aggregates six panels, each with a traffic-light status.
 *
 * GET /api/agency/pulse — the full dashboard payload
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const scoringService = require('../../services/scoring.service');
const ariaService = require('../../services/aria/aria-strategy.service');

const PULSE_ROLES = ['super_admin', 'managing_director', 'ceo'];
const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

// traffic light: green = on target, amber = within 10%, red = off target
function trafficLight(actual, target, higherIsBetter = true) {
  if (target === 0 || target == null) return 'gray';
  const ratio = actual / target;
  if (higherIsBetter) {
    if (ratio >= 1) return 'green';
    if (ratio >= 0.9) return 'amber';
    return 'red';
  } else {
    if (ratio <= 1) return 'green';
    if (ratio <= 1.1) return 'amber';
    return 'red';
  }
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (!PULSE_ROLES.includes(req.user.role)) return sendError(res, 403, 'The Weekly Pulse is only visible to MD, CEO, and Super Admin');

    // Trigger any missing score computation while we're here — second lazy-compute entry point
    await scoringService.computeMissingScores().catch(() => {});

    const now = new Date();
    const weekStart = scoringService.toDateStr(scoringService.mondayOf(now));
    const weekEnd = scoringService.toDateStr(new Date(scoringService.mondayOf(now).getTime() + 7 * 86400000));
    const prevWeekStart = scoringService.toDateStr(new Date(scoringService.mondayOf(now).getTime() - 7 * 86400000));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);

    const { data: targets } = await supabase.from('agency_targets').select('*').eq('year', now.getFullYear()).single();

    // ═══════════════════════════════════════════════════════
    // PANEL 1: P&L Snapshot
    // ═══════════════════════════════════════════════════════
    const { data: monthInvoices } = await supabase.from('invoices').select('amount, status, invoice_type').gte('due_date', monthStart).lte('due_date', monthEnd);
    const expected = (monthInvoices ?? []).reduce((s,i)=>s+Number(i.amount),0);
    const collected = (monthInvoices ?? []).filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.amount),0);
    const retainerCollected = (monthInvoices ?? []).filter(i=>i.status==='paid'&&i.invoice_type==='retainer').reduce((s,i)=>s+Number(i.amount),0);
    const projectCollected  = (monthInvoices ?? []).filter(i=>i.status==='paid'&&i.invoice_type==='project').reduce((s,i)=>s+Number(i.amount),0);
    const { data: overdue } = await supabase.from('invoices').select('id, amount, brand_id, brands(name), due_date').eq('status','overdue');

    const pnl = {
      expected, collected,
      retainerCollected, projectCollected,
      overdueCount: (overdue??[]).length,
      overdueTotal: (overdue??[]).reduce((s,i)=>s+Number(i.amount),0),
      overdueInvoices: (overdue??[]).slice(0,5),
      status: trafficLight(retainerCollected, targets?.monthly_retainer_revenue_target ?? 0),
    };

    // ═══════════════════════════════════════════════════════
    // PANEL 2: Active Staff
    // ═══════════════════════════════════════════════════════
    const { data: allStaff } = await supabase.from('users').select('id, full_name, role').eq('is_active', true);
    const { data: workLogsThisWeek } = await supabase.from('work_logs').select('user_id, hours, brand_id').gte('created_at', weekStart).lt('created_at', weekEnd);

    const activityByStaff = {};
    (workLogsThisWeek ?? []).forEach(w => {
      if (!activityByStaff[w.user_id]) activityByStaff[w.user_id] = { hours: 0, brands: new Set() };
      activityByStaff[w.user_id].hours += Number(w.hours || 0);
      activityByStaff[w.user_id].brands.add(w.brand_id);
    });

    const activeStaffList = (allStaff ?? []).map(s => ({
      id: s.id, full_name: s.full_name, role: s.role,
      hours: activityByStaff[s.id]?.hours ?? 0,
      brandsCount: activityByStaff[s.id]?.brands.size ?? 0,
      hasActivity: !!activityByStaff[s.id],
    }));

    const activeStaff = {
      totalStaff: (allStaff ?? []).length,
      activeCount: activeStaffList.filter(s => s.hasActivity).length,
      zeroActivity: activeStaffList.filter(s => !s.hasActivity), // the "spotted with evidence" list
      topContributors: [...activeStaffList].sort((a,b)=>b.hours-a.hours).slice(0,5),
      status: trafficLight(activeStaffList.filter(s => s.hasActivity).length, Math.ceil((allStaff ?? []).length * ((targets?.staff_retention_target ?? 85) / 100))),
    };

    // ═══════════════════════════════════════════════════════
    // PANEL 3: Achievements (this week vs last week)
    // ═══════════════════════════════════════════════════════
    async function weekCounts(start, end) {
      const [{ count: tasksVerified }, { count: briefsResolved }, { count: strategiesApproved }, { count: contributionsVerified }] = await Promise.all([
        supabase.from('tasks').select('id',{count:'exact',head:true}).eq('status','verified').gte('verified_at',start).lt('verified_at',end),
        supabase.from('client_briefs').select('id',{count:'exact',head:true}).in('status',['accepted','completed']).gte('reviewed_at',start).lt('reviewed_at',end),
        supabase.from('strategies').select('id',{count:'exact',head:true}).eq('client_status','approved').gte('client_approved_at',start).lt('client_approved_at',end),
        supabase.from('contribution_claims').select('id',{count:'exact',head:true}).eq('status','verified').gte('reviewed_at',start).lt('reviewed_at',end),
      ]);
      return { tasksVerified: tasksVerified??0, briefsResolved: briefsResolved??0, strategiesApproved: strategiesApproved??0, contributionsVerified: contributionsVerified??0 };
    }

    const [thisWeekAch, lastWeekAch] = await Promise.all([
      weekCounts(weekStart, weekEnd),
      weekCounts(prevWeekStart, weekStart),
    ]);

    const achievements = {
      thisWeek: thisWeekAch, lastWeek: lastWeekAch,
      deltas: Object.fromEntries(Object.keys(thisWeekAch).map(k => [k, thisWeekAch[k] - lastWeekAch[k]])),
    };

    // ═══════════════════════════════════════════════════════
    // PANEL 4: Client Review
    // ═══════════════════════════════════════════════════════
    const { data: brands } = await supabase.from('brands').select('id, name').eq('status','active');
    const clientReview = [];
    for (const b of (brands ?? [])) {
      const [{ data: satNow }, { data: satPrev }, { data: openBriefs }, { data: overdueTasks }, { data: lastReport }] = await Promise.all([
        supabase.from('client_satisfaction').select('nps_score').eq('brand_id', b.id).gte('created_at', weekStart).lt('created_at', weekEnd),
        supabase.from('client_satisfaction').select('nps_score').eq('brand_id', b.id).gte('created_at', prevWeekStart).lt('created_at', weekStart),
        supabase.from('client_briefs').select('id',{count:'exact',head:true}).eq('brand_id', b.id).in('status',['submitted','acknowledged','in_review']),
        supabase.from('tasks').select('id',{count:'exact',head:true}).eq('brand_id', b.id).lt('due_date', scoringService.toDateStr(now)).not('status','in','("verified","done")'),
        supabase.from('social_reports').select('created_at').eq('brand_id', b.id).eq('published_to_client', true).order('created_at',{ascending:false}).limit(1),
      ]);
      const avgNow = satNow?.length ? satNow.reduce((s,r)=>s+r.nps_score,0)/satNow.length : null;
      const avgPrev = satPrev?.length ? satPrev.reduce((s,r)=>s+r.nps_score,0)/satPrev.length : null;
      const daysSinceReport = lastReport?.[0]?.created_at ? Math.floor((now.getTime() - new Date(lastReport[0].created_at).getTime())/86400000) : null;

      clientReview.push({
        brand_id: b.id, brand_name: b.name,
        satisfaction: avgNow, satisfactionTrend: avgNow != null && avgPrev != null ? avgNow - avgPrev : null,
        openBriefs: openBriefs?.length ?? 0, overdueTasks: overdueTasks?.length ?? 0,
        daysSinceReport,
      });
    }

    const avgSatisfaction = clientReview.filter(c => c.satisfaction != null).reduce((s,c,_,a) => s + c.satisfaction / a.length, 0) || null;
    const clientReviewStatus = avgSatisfaction != null ? trafficLight(avgSatisfaction, targets?.avg_client_satisfaction_target ?? 4) : 'gray';

    // ═══════════════════════════════════════════════════════
    // PANEL 5: Challenges (auto-flagged)
    // ═══════════════════════════════════════════════════════
    const { data: atRiskGoals } = await supabase.from('goals').select('id, title, brand_id, brands(name), current_value, target_value, deadline').eq('status','active');
    const flaggedGoals = (atRiskGoals??[]).filter(g => {
      const pct = g.current_value / Math.max(g.target_value,1);
      const daysToDeadline = g.deadline ? (new Date(g.deadline).getTime()-now.getTime())/86400000 : Infinity;
      return pct < 0.4 && daysToDeadline < 30;
    });

    const { data: unansweredBriefs } = await supabase.from('client_briefs').select('id, title, brand_id, brands(name), created_at').eq('status','submitted').lt('created_at', new Date(now.getTime()-3*86400000).toISOString());

    const { data: overdueTasksList } = await supabase.from('tasks').select('id, title, brand_id, brands(name), due_date').lt('due_date', scoringService.toDateStr(now)).not('status','in','("verified","done")');

    const staleVerificationQueue = clientReview.length; // placeholder for pending-verification aggregate below
    const { data: staleDone } = await supabase.from('tasks').select('id, title, brand_id, brands(name), updated_at').eq('status','done');
    const graceMs = 5 * 86400000;
    const staleVerifications = (staleDone??[]).filter(t => (now.getTime()-new Date(t.updated_at).getTime()) > graceMs);

    const satisfactionDrops = clientReview.filter(c => c.satisfactionTrend != null && c.satisfactionTrend <= -1);

    const challenges = {
      goalsAtRisk: flaggedGoals.slice(0,5),
      unansweredBriefs: (unansweredBriefs??[]).slice(0,5),
      overdueTasks: (overdueTasksList??[]).slice(0,5),
      staleVerifications: staleVerifications.slice(0,5),
      satisfactionDrops,
      totalFlags: flaggedGoals.length + (unansweredBriefs??[]).length + (overdueTasksList??[]).length + staleVerifications.length + satisfactionDrops.length,
    };

    // ═══════════════════════════════════════════════════════
    // PANEL 6: Goal Alignment (Brand Admins)
    // ═══════════════════════════════════════════════════════
    const { data: brandAdmins } = await supabase.from('staff_brand_assignments').select('staff_id, brand_id, users!staff_id(id,full_name), brands(id,name)').contains('roles_on_brand',['brand_admin']);
    const goalAlignment = [];
    for (const ba of (brandAdmins??[])) {
      const { data: brandGoals } = await supabase.from('goals').select('current_value,target_value').eq('brand_id', ba.brand_id).eq('status','active');
      const onTrackPct = brandGoals?.length ? Math.round((brandGoals.filter(g=>(g.current_value/Math.max(g.target_value,1))>=0.7).length / brandGoals.length)*100) : null;
      const rollingScore = await scoringService.getRollingAverage(ba.staff_id, 'brand_admin');
      goalAlignment.push({
        staff_id: ba.staff_id, staff_name: ba.users?.full_name,
        brand_id: ba.brand_id, brand_name: ba.brands?.name,
        onTrackPct, rollingScore,
      });
    }

    const avgOnTrack = goalAlignment.filter(g => g.onTrackPct != null).reduce((s,g,_,a) => s + g.onTrackPct / a.length, 0) || null;
    const goalAlignmentStatus = avgOnTrack != null ? trafficLight(avgOnTrack, targets?.goal_achievement_rate_target ?? 70) : 'gray';

    sendSuccess(res, {
      weekStart, weekEnd, targets: targets || null,
      panels: {
        pnl, activeStaff, achievements,
        clientReview: { brands: clientReview, status: clientReviewStatus },
        challenges,
        goalAlignment: { admins: goalAlignment, status: goalAlignmentStatus },
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/agency/pulse/generate-report ─────────────────────
// Calls ARIA to write the executive summary from the current pulse data
router.post('/generate-report', authenticate, async (req, res, next) => {
  try {
    if (!PULSE_ROLES.includes(req.user.role)) return sendError(res, 403, 'Only MD, CEO, and Super Admin can generate the weekly report');

    const pulseDataResponse = await fetch(`${req.protocol}://${req.get('host')}/api/agency/pulse`, {
      headers: { Authorization: req.headers.authorization },
    });
    const { data: pulseData } = await pulseDataResponse.json();

    const summary = await ariaService.generateWeeklyPulse(pulseData);

    sendSuccess(res, { summary, weekStart: pulseData.weekStart }, 'Weekly report generated');
  } catch (err) { next(err); }
});

module.exports = router;
