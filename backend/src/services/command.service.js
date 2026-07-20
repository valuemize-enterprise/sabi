/**
 * ═══════════════════════════════════════════════════════════════
 * Brand Command Center — Rule Engine & Aggregation Service
 * Sabi Intelligence Suite · Cerebre Media Africa
 * ═══════════════════════════════════════════════════════════════
 * Blueprint contract (approved v1):
 *   • Zero new write paths — this is a READ layer over Phases 1–3.
 *   • ≤ 12 batched queries regardless of brand count (never per-brand).
 *   • Rules, not a weighted score: each domain → green|amber|red|grey,
 *     brand status = worst domain, every non-green emits a reason chip.
 *   • Thresholds live in THRESHOLDS below — tunable, one place.
 *   • 60s in-memory cache keyed by scope ('full' | 'ba:<userId>').
 *
 * Exports:
 *   computeCommand({ brandAdminUserId? }) → { computed_at, summary, brands[] }
 *   computeBrandDetails(brandId)          → offending records for the drawer
 *   THRESHOLDS                            → for tests / settings display
 */

'use strict';

const supabase = require('../config/supabase');

// ── Thresholds (Section 04 of the blueprint, D5-approved) ──────
const THRESHOLDS = {
  invoice_overdue_red_days: 7,       // financial red
  invoice_due_soon_days: 3,          // financial amber
  pnl_pending_red_hours: 72,         // strategy red
  strategy_lagging_pct: 25,          // strategy amber (behind past halfway date)
  brief_unclassified_red_hours: 48,  // briefs red
  brief_unclassified_amber_hours: 24,// briefs amber
  briefs_open_amber: 5,              // briefs amber (volume)
  tasks_overdue_red: 3,              // tasks red
  unverified_red_days: 5,            // tasks red (mirrors Brand Admin scoring rule)
  unverified_amber_days: 3,          // tasks amber
  goals_at_risk_red_pct: 50,         // goals red
  team_leave_amber_pct: 30,          // team amber
  satisfaction_red_rating: 6,        // satisfaction red (NPS detractor threshold 0-6)
  silent_red_weeks: 3,               // satisfaction red (carry-forward expired)
  silent_amber_weeks: 2,             // satisfaction amber
  new_brand_grace_days: 14,          // grey instead of red for young brands
  score_bands: [[80, 'A'], [65, 'B'], [50, 'C'], [0, 'Building']],
  cache_ttl_ms: 60_000,
};

// ── Time helpers (Africa/Lagos everywhere) ─────────────────────
const lagos = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
const daysBetween  = (a, b) => Math.floor((b - a) / 86400000);
const hoursBetween = (a, b) => Math.floor((b - a) / 3600000);
function weekBounds() {
  const d = lagos();
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 7);
  return { mon: mon.toISOString(), sun: sun.toISOString() };
}
function monthStart() {
  const d = lagos(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

// ── Domain result helper ───────────────────────────────────────
const WORST = { grey: 0, green: 0, amber: 1, red: 2 };
const dom = (state, metrics = {}, reasons = []) => ({ state, ...metrics, _reasons: reasons });
const chip = (domain, severity, label) => ({ domain, severity, label });

// ═══════════════════════ BATCHED FETCH ═════════════════════════
// One query per table. Grouped by brand_id in memory.
async function fetchAll() {
  const now = lagos();
  const { mon, sun } = weekBounds();
  const tenWeeksAgo = new Date(now.getTime() - 70 * 86400000).toISOString();

  const [
    brandsQ, brandAdminsQ, brandStaffQ, leaveQ, invoicesQ,
    strategiesQ, tasksQ, briefsQ, goalsQ, satisfactionQ, scoresQ,
  ] = await Promise.all([
    supabase.from('brands')
      .select('id, name, status, created_at')
      .eq('status', 'active'),
    supabase.from('staff_brand_assignments')
      .select('brand_id, staff_id, users!staff_id(id, full_name, email)')
      .contains('roles_on_brand', ['brand_admin']),
    supabase.from('staff_brand_assignments')
      .select('brand_id, staff_id'),
    supabase.from('staff_leave')
      .select('staff_id, week_start')
      .eq('week_start', mon.slice(0, 10)),
    supabase.from('invoices')
      .select('id, brand_id, reference, amount, due_date, status, created_at')
      .in('status', ['expected', 'sent', 'paid']),
    supabase.from('strategies')
      .select('id, brand_id, title, status, created_at, expected_revenue, start_date, end_date')
      .eq('status', 'active'),
    supabase.from('tasks')
      .select('id, brand_id, title, status, due_date, updated_at, strategy_id, assignee_id')
      .neq('status', 'archived'),
    supabase.from('client_briefs')
      .select('id, brand_id, title, status, brief_type, created_at')
      .not('status', 'in', '(closed,rejected)'),
    supabase.from('goals')
      .select('id, brand_id, title, status, velocity_score')
      .eq('status', 'active'),
    supabase.from('client_satisfaction')
      .select('brand_id, nps_score, created_at')
      .gte('created_at', tenWeeksAgo)
      .order('created_at', { ascending: false }),
    supabase.from('weekly_scores')
      .select('user_id, total, week_start')
      .eq('score_type', 'staff')
      .order('week_start', { ascending: false })
      .limit(1000),
  ]);

  const err = [brandsQ, brandAdminsQ, brandStaffQ, leaveQ, invoicesQ, strategiesQ,
               tasksQ, briefsQ, goalsQ, satisfactionQ, scoresQ].find(q => q.error);
  if (err) throw new Error(`Command aggregation query failed: ${err.error.message}`);

  return {
    now, mon, sun,
    brands: brandsQ.data || [],
    brandAdmins: brandAdminsQ.data || [],
    brandStaff: brandStaffQ.data || [],
    leave: leaveQ.data || [],
    invoices: invoicesQ.data || [],
    strategies: strategiesQ.data || [],
    tasks: tasksQ.data || [],
    briefs: briefsQ.data || [],
    goals: goalsQ.data || [],
    satisfaction: satisfactionQ.data || [],
    scores: scoresQ.data || [],
  };
}

const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(r);
  }
  return m;
};

// ═══════════════════ DOMAIN RULE FUNCTIONS ═════════════════════
const H = THRESHOLDS;

function ruleFinancial(invoices, now) {
  const open = invoices.filter(i => i.status !== 'paid');
  if (!invoices.length) return dom('grey', { overdue_amount: 0, overdue_days: 0, invoiced_mtd: 0, expected_mtd: 0 });

  const mtd = monthStart();
  const invoicedMtd = invoices
    .filter(i => i.status === 'paid' && i.created_at >= mtd)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const expectedMtd = invoices
    .filter(i => i.created_at >= mtd)
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  let worstDays = 0, overdueAmt = 0, dueSoon = false;
  for (const i of open) {
    if (!i.due_date) continue;
    const d = daysBetween(new Date(i.due_date), now);
    if (d > 0) { worstDays = Math.max(worstDays, d); overdueAmt += Number(i.amount || 0); }
    else if (Math.abs(d) <= H.invoice_due_soon_days) dueSoon = true;
  }

  const metrics = { overdue_amount: overdueAmt, overdue_days: worstDays, invoiced_mtd: invoicedMtd, expected_mtd: expectedMtd };
  if (worstDays > H.invoice_overdue_red_days)
    return dom('red', metrics, [chip('financial', 'red', `Invoice ${worstDays}d overdue`)]);
  if (worstDays >= 1)
    return dom('amber', metrics, [chip('financial', 'amber', `Invoice ${worstDays}d overdue`)]);
  if (dueSoon)
    return dom('amber', metrics, [chip('financial', 'amber', 'Invoice due soon')]);
  return dom('green', metrics);
}

function ruleStrategy(strategies, tasks, briefs, brandAgeDays, now) {
  const active = strategies
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

  if (!active) {
    if (brandAgeDays <= H.new_brand_grace_days)
      return dom('grey', { title: null, progress_pct: 0, pnl_pending: false });
    const openNewProject = briefs.some(b => b.brief_type === 'campaign');
    return openNewProject
      ? dom('red', { title: null, progress_pct: 0, pnl_pending: false },
            [chip('strategy', 'red', 'No active strategy, project briefs open')])
      : dom('grey', { title: null, progress_pct: 0, pnl_pending: false });
  }

  const sTasks = tasks.filter(t => t.strategy_id === active.id);
  const verified = sTasks.filter(t => t.status === 'verified').length;
  const progress = sTasks.length ? Math.round((verified / sTasks.length) * 100) : 0;
  const pnlPending = active.expected_revenue == null;
  const metrics = { title: active.title, progress_pct: progress, pnl_pending: pnlPending };
  const reasons = [];

  if (pnlPending) {
    const hrs = hoursBetween(new Date(active.created_at || now), now);
    if (hrs > H.pnl_pending_red_hours)
      return dom('red', metrics, [chip('strategy', 'red', `P&L pending ${Math.floor(hrs / 24)}d`)]);
    reasons.push(chip('strategy', 'amber', `P&L pending ${hrs}h`));
  }
  // Lagging: behind threshold past the halfway date
  if (active.start_date && active.end_date) {
    const half = new Date((new Date(active.start_date).getTime() + new Date(active.end_date).getTime()) / 2);
    if (now > half && progress < H.strategy_lagging_pct)
      reasons.push(chip('strategy', 'amber', `Strategy ${progress}% past halfway`));
  }
  return reasons.length ? dom('amber', metrics, reasons) : dom('green', metrics);
}

function ruleBriefs(briefs, now) {
  if (!briefs.length) return dom('grey', { open: 0, unclassified: 0, oldest_unclassified_hours: 0 });
  const unclassified = briefs.filter(b => b.brief_type == null);
  const oldestH = unclassified.length
    ? Math.max(...unclassified.map(b => hoursBetween(new Date(b.created_at), now))) : 0;
  const metrics = { open: briefs.length, unclassified: unclassified.length, oldest_unclassified_hours: oldestH };

  if (oldestH > H.brief_unclassified_red_hours)
    return dom('red', metrics, [chip('briefs', 'red', `Brief unclassified ${oldestH}h`)]);
  const reasons = [];
  if (oldestH >= H.brief_unclassified_amber_hours)
    reasons.push(chip('briefs', 'amber', `Brief unclassified ${oldestH}h`));
  if (briefs.length > H.briefs_open_amber)
    reasons.push(chip('briefs', 'amber', `${briefs.length} briefs open`));
  return reasons.length ? dom('amber', metrics, reasons) : dom('green', metrics);
}

function ruleTasks(tasks, now, mon, sun) {
  const dueWeek = tasks.filter(t => t.due_date && t.due_date >= mon.slice(0, 10) && t.due_date < sun.slice(0, 10));
  const verifiedWeek = dueWeek.filter(t => t.status === 'verified').length;
  const overdue = tasks.filter(t =>
    t.due_date && new Date(t.due_date) < now && t.status !== 'verified' && t.status !== 'done').length;
  const doneAging = tasks
    .filter(t => t.status === 'done')
    .map(t => daysBetween(new Date(t.updated_at), now));
  const unverified5d = doneAging.filter(d => d >= H.unverified_red_days).length;
  const unverified3d = doneAging.filter(d => d >= H.unverified_amber_days && d < H.unverified_red_days).length;

  const metrics = { verified_week: verifiedWeek, due_week: dueWeek.length, overdue, unverified_5d: unverified5d };
  if (!tasks.length) return dom('grey', metrics);

  const reasons = [];
  if (overdue >= H.tasks_overdue_red) reasons.push(chip('tasks', 'red', `${overdue} tasks overdue`));
  if (unverified5d > 0) reasons.push(chip('tasks', 'red', `${unverified5d} unverified ${H.unverified_red_days}d+`));
  if (reasons.some(r => r.severity === 'red')) return dom('red', metrics, reasons);
  if (overdue > 0) reasons.push(chip('tasks', 'amber', `${overdue} overdue`));
  if (unverified3d > 0) reasons.push(chip('tasks', 'amber', `${unverified3d} awaiting verification`));
  return reasons.length ? dom('amber', metrics, reasons) : dom('green', metrics);
}

function ruleGoals(goals, brandAgeDays) {
  if (!goals.length) {
    if (brandAgeDays <= H.new_brand_grace_days)
      return dom('grey', { on_track: 0, at_risk: 0, achieved: 0, velocity: null });
    // Absence of targets is itself a leadership signal (blueprint 06)
    return dom('grey', { on_track: 0, at_risk: 0, achieved: 0, velocity: null },
               [chip('goals', 'amber', 'No goals set')]);
  }
  const atRisk = goals.filter(g => g.status === 'at_risk').length;
  const metrics = {
    on_track: goals.filter(g => g.status === 'on_track').length,
    at_risk: atRisk,
    achieved: goals.filter(g => g.status === 'achieved').length,
    velocity: goals.some(g => g.velocity_score < 3) ? 'down'
            : goals.some(g => g.velocity_score > 6) ? 'up' : 'flat',
  };
  const pct = Math.round((atRisk / goals.length) * 100);
  if (pct > H.goals_at_risk_red_pct)
    return dom('red', metrics, [chip('goals', 'red', `${atRisk} of ${goals.length} goals at risk`)]);
  if (atRisk > 0)
    return dom('amber', metrics, [chip('goals', 'amber', `${atRisk} goal${atRisk > 1 ? 's' : ''} at risk`)]);
  return dom('green', metrics);
}

function ruleTeam(staffIds, adminRow, leaveUserIds, scoreByUser) {
  const onLeave = staffIds.filter(id => leaveUserIds.has(id)).length;
  const avgs = staffIds.map(id => scoreByUser.get(id)).filter(v => v != null);
  const avg = avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null;
  const band = avg == null ? null : (H.score_bands.find(([min]) => avg >= min) || [0, 'Building'])[1];
  const metrics = {
    assigned: staffIds.length, on_leave: onLeave,
    brand_admin: adminRow?.users?.full_name || null, score_band: band,
  };
  if (!adminRow)
    return dom('red', metrics, [chip('team', 'red', 'No Brand Admin assigned')]);
  if (staffIds.length && (onLeave / staffIds.length) * 100 > H.team_leave_amber_pct)
    return dom('amber', metrics, [chip('team', 'amber', `${onLeave} of ${staffIds.length} on leave`)]);
  return dom('green', metrics);
}

function ruleSatisfaction(rows, brandAgeDays, now) {
  if (!rows.length) {
    if (brandAgeDays <= H.new_brand_grace_days)
      return dom('grey', { nps_score: null, trend: null, weeks_silent: 0 });
    return dom('amber', { nps_score: null, trend: null, weeks_silent: 99 },
               [chip('satisfaction', 'amber', 'Never rated')]);
  }
  const latest = rows[0]; // pre-sorted desc
  const weeksSilent = Math.floor(daysBetween(new Date(latest.created_at), now) / 7);
  const prior = rows.slice(1, 5);
  const priorAvg = prior.length ? prior.reduce((s, r) => s + r.nps_score, 0) / prior.length : latest.nps_score;
  const trend = latest.nps_score > priorAvg + 0.3 ? 'up' : latest.nps_score < priorAvg - 0.3 ? 'down' : 'flat';
  const metrics = { nps_score: latest.nps_score, trend, weeks_silent: weeksSilent };

  const reasons = [];
  // NPS detractors are 0-6 (red threshold)
  if (latest.nps_score <= H.satisfaction_red_rating)
    reasons.push(chip('satisfaction', 'red', `NPS ${latest.nps_score}/10 (Detractor)`));
  if (weeksSilent >= H.silent_red_weeks)
    reasons.push(chip('satisfaction', 'red', `Silent ${weeksSilent} wks`));
  if (reasons.some(r => r.severity === 'red')) return dom('red', metrics, reasons);
  if (weeksSilent >= H.silent_amber_weeks)
    reasons.push(chip('satisfaction', 'amber', `Silent ${weeksSilent} wks`));
  if (latest.nps_score === 7 || latest.nps_score === 8) reasons.push(chip('satisfaction', 'amber', `NPS ${latest.nps_score}/10 (Passive)`));
  if (trend === 'down') reasons.push(chip('satisfaction', 'amber', 'Satisfaction falling'));
  return reasons.length ? dom('amber', metrics, reasons) : dom('green', metrics);
}

// ═══════════════════════ ASSEMBLY ══════════════════════════════
function assembleBrand(b, data) {
  const now = data.now;
  const ageDays = daysBetween(new Date(b.created_at), now);
  const invoices = data.invByBrand.get(b.id) || [];
  const strategies = data.stratByBrand.get(b.id) || [];
  const tasks = data.taskByBrand.get(b.id) || [];
  const briefs = data.briefByBrand.get(b.id) || [];
  const goals = data.goalByBrand.get(b.id) || [];
  const sat = data.satByBrand.get(b.id) || [];
  const staffIds = (data.staffByBrand.get(b.id) || []).map(r => r.staff_id);
  const adminRow = (data.adminByBrand.get(b.id) || [])[0] || null;

  const domains = {
    financial:    ruleFinancial(invoices, now),
    strategy:     ruleStrategy(strategies, tasks, briefs, ageDays, now),
    briefs:       ruleBriefs(briefs, now),
    tasks:        ruleTasks(tasks, now, data.mon, data.sun),
    goals:        ruleGoals(goals, ageDays),
    team:         ruleTeam(staffIds, adminRow, data.leaveUserIds, data.scoreByUser),
    satisfaction: ruleSatisfaction(sat, ageDays, now),
  };

  // worst-of resolver + reason chips (red chips first)
  let worst = 0;
  const reasons = [];
  for (const d of Object.values(domains)) {
    worst = Math.max(worst, WORST[d.state]);
    reasons.push(...d._reasons);
  }
  reasons.sort((a, b) => (b.severity === 'red') - (a.severity === 'red'));
  const status = worst === 2 ? 'at_risk' : worst === 1 ? 'watch' : 'healthy';

  const clean = {};
  for (const [k, d] of Object.entries(domains)) {
    const { _reasons, ...rest } = d;
    clean[k] = rest;
  }
  return {
    id: b.id, name: b.name, retainer_tier: null,
    is_new: ageDays <= H.new_brand_grace_days,
    status, reasons, ...clean,
  };
}

// ── Cache ──────────────────────────────────────────────────────
const cache = new Map(); // scopeKey → { ts, payload }

async function computeCommand({ brandAdminUserId = null } = {}) {
  const scope = brandAdminUserId ? `ba:${brandAdminUserId}` : 'full';
  const hit = cache.get(scope);
  if (hit && Date.now() - hit.ts < H.cache_ttl_ms) return hit.payload;

  const data = await fetchAll();
  data.invByBrand   = groupBy(data.invoices, 'brand_id');
  data.stratByBrand = groupBy(data.strategies, 'brand_id');
  data.taskByBrand  = groupBy(data.tasks, 'brand_id');
  data.briefByBrand = groupBy(data.briefs, 'brand_id');
  data.goalByBrand  = groupBy(data.goals, 'brand_id');
  data.satByBrand   = groupBy(data.satisfaction, 'brand_id');
  data.staffByBrand = groupBy(data.brandStaff, 'brand_id');
  data.adminByBrand = groupBy(data.brandAdmins, 'brand_id');
  data.leaveUserIds = new Set(data.leave.map(l => l.staff_id));
  // latest rolling_avg per user (rows pre-sorted desc by week_start)
  data.scoreByUser = new Map();
  for (const s of data.scores) {
    if (!data.scoreByUser.has(s.user_id)) data.scoreByUser.set(s.user_id, Number(s.total));
  }

  let brandList = data.brands;
  if (brandAdminUserId) {
    const mine = new Set(
      data.brandAdmins.filter(r => r.users?.id === brandAdminUserId).map(r => r.brand_id));
    brandList = brandList.filter(b => mine.has(b.id));
  }

  const brands = brandList.map(b => assembleBrand(b, data));
  // worst-first, then retainer tier weight, then name
  const ORDER = { at_risk: 0, watch: 1, healthy: 2 };
  const TIER  = { enterprise: 0, growth: 1, starter: 2 };
  brands.sort((a, b) =>
    ORDER[a.status] - ORDER[b.status]
    || (TIER[a.retainer_tier] ?? 3) - (TIER[b.retainer_tier] ?? 3)
    || a.name.localeCompare(b.name));

  const sats = brands.map(b => b.satisfaction.rating).filter(r => r != null);
  const payload = {
    computed_at: new Date().toISOString(),
    summary: {
      brands: brands.length,
      at_risk: brands.filter(b => b.status === 'at_risk').length,
      watch: brands.filter(b => b.status === 'watch').length,
      healthy: brands.filter(b => b.status === 'healthy').length,
      expected_revenue_mtd: brands.reduce((s, b) => s + (b.financial.expected_mtd || 0), 0),
      avg_satisfaction: sats.length ? +(sats.reduce((s, r) => s + r, 0) / sats.length).toFixed(1) : null,
    },
    brands,
  };
  cache.set(scope, { ts: Date.now(), payload });
  return payload;
}

// ═══════════════ DRAWER: offending records (2-click rule) ══════
async function computeBrandDetails(brandId) {
  const now = lagos();
  const [tasksQ, briefsQ, invQ, goalsQ] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, status, due_date, updated_at, assignee:users!tasks_assignee_id_fkey(full_name)')
      .eq('brand_id', brandId).neq('status', 'archived'),
    supabase.from('client_briefs')
      .select('id, title, classification, created_at, status')
      .eq('brand_id', brandId).is('classification', null)
      .not('status', 'in', '(closed,rejected)'),
    supabase.from('invoices')
      .select('id, reference, amount, due_date, status')
      .eq('brand_id', brandId).in('status', ['expected', 'sent']),
    supabase.from('goals')
      .select('id, title, status').eq('brand_id', brandId)
      .eq('status', 'at_risk'),
  ]);

  const tasks = tasksQ.data || [];
  return {
    overdue_tasks: tasks
      .filter(t => t.due_date && new Date(t.due_date) < now && !['verified', 'done'].includes(t.status))
      .map(t => ({ id: t.id, title: t.title, assignee: t.assignee?.full_name || 'Unassigned',
                   days_overdue: daysBetween(new Date(t.due_date), now) }))
      .sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 5),
    unverified_tasks: tasks
      .filter(t => t.status === 'done')
      .map(t => ({ id: t.id, title: t.title, assignee: t.assignee?.full_name || 'Unassigned',
                   days_waiting: daysBetween(new Date(t.updated_at), now) }))
      .sort((a, b) => b.days_waiting - a.days_waiting).slice(0, 5),
    unclassified_briefs: (briefsQ.data || [])
      .map(b => ({ id: b.id, title: b.title, hours_old: hoursBetween(new Date(b.created_at), now) }))
      .sort((a, b) => b.hours_old - a.hours_old).slice(0, 5),
    overdue_invoices: (invQ.data || [])
      .filter(i => i.due_date && new Date(i.due_date) < now)
      .map(i => ({ id: i.id, reference: i.reference, amount: i.amount,
                   days_overdue: daysBetween(new Date(i.due_date), now) })),
    goals_at_risk: (goalsQ.data || []).map(g => ({ id: g.id, title: g.title })),
  };
}

module.exports = { computeCommand, computeBrandDetails, THRESHOLDS };
