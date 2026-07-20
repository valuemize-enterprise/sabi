/**
 * ═══════════════════════════════════════════════════════════════
 * Notification Sweeper — the time-bound "nag until done" engine
 * ═══════════════════════════════════════════════════════════════
 * Scans the database for conditions that need a nudge and sends
 * the right email at the right escalation level.
 *
 * IDEMPOTENT BY DESIGN — safe to run every hour, or ten times an
 * hour. The dedupe contract in email-dispatch.service.js guarantees
 * each (type, entity, level/day/week) fires exactly once. This is
 * the same philosophy as the lazy scoring engine: no cron
 * dependency, works on Render free tier.
 *
 * How to run it (pick ONE):
 *   A. Render Cron Job → POST /api/system/notifications/sweep hourly
 *   B. UptimeRobot / GitHub Actions pinging the same endpoint
 *   C. Fallback setInterval while the server is awake (wired in
 *      SERVER_PATCH — runs hourly, skips if a sweep ran <50 min ago)
 *
 * Sweeps and their schedule gates (all Africa/Lagos):
 *   every run   → task_due_tomorrow, task_overdue L1/L2/L3,
 *                 verification_deadline (day 4),
 *                 brief_unclassified (24h / 48h),
 *                 strategy_pnl_missing (24h / 72h)
 *   daily 8am   → verification_queue, claims_pending,
 *                 client_invoice_reminder, client_silent check
 *   Fri 3pm     → creative_review_reminder, rate_team_reminder
 *   Mon 7:30am  → leadership_digest, platform_digest
 *   Wed 10am    → client_satisfaction_prompt (mid-week = best response)
 *   daily 9am   → client_moment_upcoming (7 days ahead)
 */

'use strict';

const supabase = require('../config/supabase');
const dispatch = require('./email-dispatch.service');
const { watchBrandStatus } = require('./brand-status-watch.service');
const { runPeopleSweeps } = require('./people-sweeps.service');

// ── Lagos time helpers ─────────────────────────────────────────
const lagos = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
const hourIs   = (h) => lagos().getHours() === h;
const dayIs    = (d) => lagos().getDay() === d;   // 0 Sun … 6 Sat
const todayISO = () => lagos().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.floor((b - a) / 86400000);

async function users(filter) {
  let q = supabase.from('users').select('id, email, full_name, role').eq('is_active', true);
  if (filter?.roles) q = q.in('role', filter.roles);
  const { data } = await q;
  return data || [];
}

async function brandName(id, cache) {
  if (cache.has(id)) return cache.get(id);
  const { data } = await supabase.from('brands').select('name').eq('id', id).single();
  cache.set(id, data?.name || 'your brand');
  return cache.get(id);
}

// ═══════════════ 1 · TASK DEADLINES (every run) ════════════════
async function sweepTaskDeadlines(stats, brands) {
  const now = lagos();
  const { data: tasks } = await supabase.from('tasks')
    .select('id, title, brand_id, assignee_id, due_date, status')
    .in('status', ['todo', 'in_progress', 'in_review'])
    .not('due_date', 'is', null)
    .not('assignee_id', 'is', null);

  for (const t of tasks || []) {
    const due = new Date(t.due_date);
    const diff = daysBetween(now, due); // negative = overdue
    const { data: u } = await supabase.from('users')
      .select('id, email, full_name').eq('id', t.assignee_id).single();
    if (!u) continue;
    const bn = await brandName(t.brand_id, brands);
    const common = { name: u.full_name, taskTitle: t.title, brandName: bn, dueDate: t.due_date };

    if (diff === 0 || diff === 1) {
      // due today/tomorrow — one shot per task
      stats.push(await dispatch.send('task_due_tomorrow', {
        to: u, entityId: t.id, dedupe: 'once', data: common,
      }));
    } else if (diff < 0) {
      const overdueDays = Math.abs(diff);
      // Escalation ladder: L1 at day 1, L2 at day 3, L3 at day 5 (Brand Admin CC'd)
      const level = overdueDays >= 5 ? 3 : overdueDays >= 3 ? 2 : 1;
      let cc = [];
      if (level === 3) {
        const { data: bas } = await supabase.from('staff_brand_assignments')
          .select('users!staff_id(email)').contains('roles_on_brand', ['brand_admin']).eq('brand_id', t.brand_id);
        cc = (bas || []).map(r => r.users?.email).filter(Boolean);
      }
      stats.push(await dispatch.send('task_overdue', {
        to: u, entityId: t.id, dedupe: 'level', level, cc,
        data: { ...common, daysOverdue: overdueDays },
      }));
    }
  }
}

// ═══════ 2 · VERIFICATION AGING (every run + daily queue) ══════
async function sweepVerification(stats, brands) {
  const now = lagos();
  const { data: doneTasks } = await supabase.from('tasks')
    .select('id, title, brand_id, assignee_id, updated_at')
    .eq('status', 'done');

  // group by brand for the daily queue digest
  const byBrand = new Map();
  for (const t of doneTasks || []) {
    const waiting = daysBetween(new Date(t.updated_at), now);
    if (!byBrand.has(t.brand_id)) byBrand.set(t.brand_id, []);
    byBrand.get(t.brand_id).push({ ...t, waiting });
  }

  for (const [bId, list] of byBrand) {
    const { data: bas } = await supabase.from('staff_brand_assignments')
      .select('users!staff_id(id, email, full_name)').contains('roles_on_brand', ['brand_admin']).eq('brand_id', bId);
    const admins = (bas || []).map(r => r.users).filter(Boolean);
    if (!admins.length) continue;
    const bn = await brandName(bId, brands);

    // 2a · day-4 single-task warning — every run, once per task
    for (const t of list.filter(x => x.waiting === 4)) {
      const { data: staff } = await supabase.from('users')
        .select('full_name').eq('id', t.assignee_id).single();
      for (const a of admins) {
        stats.push(await dispatch.send('verification_deadline', {
          to: a, entityId: t.id, dedupe: 'once',
          data: { name: a.full_name, taskTitle: t.title, brandName: bn,
                  staffName: staff?.full_name || 'a teammate', daysWaiting: t.waiting },
        }));
      }
    }

    // 2b · daily queue digest at 8am — once per admin per day
    if (hourIs(8) && list.length) {
      const oldest = Math.max(...list.map(x => x.waiting));
      for (const a of admins) {
        stats.push(await dispatch.send('verification_queue', {
          to: a, entityId: null, dedupe: 'daily',
          data: { name: a.full_name, brandName: bn, count: list.length, oldestDays: oldest },
        }));
      }
    }
  }
}

// ═══════ 3 · BRIEFS UNCLASSIFIED (every run: 24h L1, 48h L2) ═══
async function sweepBriefs(stats, brands) {
  const now = lagos();
  const { data: briefs } = await supabase.from('client_briefs')
    .select('id, title, brand_id, created_at, classification, status')
    .is('classification', null)
    .not('status', 'in', '("rejected","closed")');

  const admins = await users({ roles: ['super_admin', 'admin', 'md'] });
  for (const b of briefs || []) {
    const hoursOld = Math.floor((now - new Date(b.created_at)) / 3600000);
    if (hoursOld < 24) continue;
    const level = hoursOld >= 48 ? 2 : 1;
    const bn = await brandName(b.brand_id, brands);
    for (const a of admins) {
      stats.push(await dispatch.send('brief_unclassified', {
        to: a, entityId: b.id, dedupe: 'level', level,
        data: { name: a.full_name, briefTitle: b.title, brandName: bn, hoursOld, level },
      }));
    }
  }
}

// ═══ 4 · STRATEGY P&L MISSING (every run: 24h L1, 72h L2) ══════
async function sweepPnl(stats, brands) {
  const now = lagos();
  const { data: strategies } = await supabase.from('strategies')
    .select('id, title, brand_id, approved_at, expected_revenue')
    .eq('status', 'approved')
    .is('expected_revenue', null);

  const admins = await users({ roles: ['super_admin', 'admin', 'md'] });
  for (const s of strategies || []) {
    const hoursOld = Math.floor((now - new Date(s.approved_at || now)) / 3600000);
    if (hoursOld < 24) continue;
    const level = hoursOld >= 72 ? 2 : 1;
    const bn = await brandName(s.brand_id, brands);
    for (const a of admins) {
      stats.push(await dispatch.send('strategy_pnl_missing', {
        to: a, entityId: s.id, dedupe: 'level', level,
        data: { name: a.full_name, strategyTitle: s.title, brandName: bn, level },
      }));
    }
  }
}

// ═══════ 5 · FRIDAY 3PM — ratings + creative review ════════════
async function sweepFriday(stats) {
  if (!(dayIs(5) && hourIs(15))) return;

  // 5a · rate-your-team: brand admins with unrated members this week
  const { data: bas } = await supabase.from('staff_brand_assignments')
    .select('brand_id, users!staff_id(id, email, full_name)').contains('roles_on_brand', ['brand_admin']);
  const grouped = new Map();
  for (const r of bas || []) {
    if (!r.users) continue;
    if (!grouped.has(r.users.id)) grouped.set(r.users.id, { user: r.users, brandIds: [] });
    grouped.get(r.users.id).brandIds.push(r.brand_id);
  }
  for (const { user, brandIds } of grouped.values()) {
    const { count: teamCount } = await supabase.from('staff_brand_assignments')
      .select('staff_id', { count: 'exact', head: true }).in('brand_id', brandIds);
    const { count: rated } = await supabase.from('weekly_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('rater_id', user.id).gte('created_at', mondayISO());
    const unrated = Math.max(0, (teamCount || 0) - (rated || 0));
    if (unrated > 0) {
      stats.push(await dispatch.send('rate_team_reminder', {
        to: user, entityId: null, dedupe: 'weekly',
        data: { name: user.full_name, unratedCount: unrated },
      }));
    }
  }

  // 5b · Creative Director review reminder
  const cds = await users({ roles: ['creative_director', 'creative_lead'] });
  const { count: itemCount } = await supabase.from('work_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
  for (const cd of cds) {
    stats.push(await dispatch.send('creative_review_reminder', {
      to: cd, entityId: null, dedupe: 'weekly',
      data: { name: cd.full_name, itemCount: itemCount || 0 },
    }));
  }
}

// ═══════ 6 · DAILY 8AM — claims pending, invoices ══════════════
async function sweepDaily8(stats, brands) {
  if (!hourIs(8)) return;

  // 6a · contribution claims pending
  const { data: claims } = await supabase.from('contribution_claims')
    .select('brand_id').eq('status', 'pending');
  const byBrand = new Map();
  for (const c of claims || []) byBrand.set(c.brand_id, (byBrand.get(c.brand_id) || 0) + 1);
  for (const [bId, count] of byBrand) {
    const { data: bas } = await supabase.from('staff_brand_assignments')
      .select('users!staff_id(id, email, full_name)').contains('roles_on_brand', ['brand_admin']).eq('brand_id', bId);
    for (const r of bas || []) {
      if (!r.users) continue;
      stats.push(await dispatch.send('claims_pending', {
        to: r.users, entityId: null, dedupe: 'daily',
        data: { name: r.user.full_name, count },
      }));
    }
  }

  // 6b · client invoice reminders: T-3, due day, then every 7 days overdue
  const { data: invoices } = await supabase.from('invoices')
    .select('id, brand_id, reference, amount_label, due_date, description, status')
    .in('status', ['expected', 'sent'])
    .not('due_date', 'is', null);
  for (const inv of invoices || []) {
    const dUntil = daysBetween(lagos(), new Date(inv.due_date));
    const fire = dUntil === 3 || dUntil === 0 || (dUntil < 0 && Math.abs(dUntil) % 7 === 0);
    if (!fire) continue;
    const bn = await brandName(inv.brand_id, brands);
    const { data: contacts } = await supabase.from('client_users')
      .select('id, email, full_name').eq('brand_id', inv.brand_id).eq('is_active', true);
    for (const c of contacts || []) {
      stats.push(await dispatch.send('client_invoice_reminder', {
        to: c, entityId: inv.id, dedupe: 'daily',
        data: { name: c.full_name, brandName: bn, invoiceRef: inv.reference,
                amount: inv.amount_label, description: inv.description, daysUntilDue: dUntil },
      }));
    }
  }

  // 6c · silent clients (3+ weeks without a satisfaction rating)
  const { data: allBrands } = await supabase.from('brands').select('id, name').eq('is_active', true);
  const admins = await users({ roles: ['super_admin', 'admin', 'md'] });
  for (const b of allBrands || []) {
    const { data: last } = await supabase.from('client_satisfaction')
      .select('created_at').eq('brand_id', b.id)
      .order('created_at', { ascending: false }).limit(1);
    const lastAt = last?.[0]?.created_at;
    if (!lastAt) continue;
    const weeksSilent = Math.floor(daysBetween(new Date(lastAt), lagos()) / 7);
    if (weeksSilent >= 3) {
      for (const a of admins) {
        stats.push(await dispatch.send('client_silent', {
          to: a, entityId: b.id, dedupe: 'weekly',
          data: { name: a.full_name, brandName: b.name, weeksSilent },
        }));
      }
    }
  }
}

// ═══════ 7 · WEDNESDAY 10AM — client satisfaction prompt ═══════
async function sweepSatisfactionPrompt(stats) {
  if (!(dayIs(3) && hourIs(10))) return;
  const { data: allBrands } = await supabase.from('brands').select('id, name').eq('is_active', true);
  for (const b of allBrands || []) {
    // skip if this week already rated
    const { count } = await supabase.from('client_satisfaction')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', b.id).gte('created_at', mondayISO());
    if (count > 0) continue;
    const { data: contacts } = await supabase.from('client_users')
      .select('id, email, full_name').eq('brand_id', b.id).eq('is_active', true);
    for (const c of contacts || []) {
      stats.push(await dispatch.send('client_satisfaction_prompt', {
        to: c, entityId: b.id, dedupe: 'weekly',
        data: { name: c.full_name, brandName: b.name },
      }));
    }
  }
}

// ═══════ 8 · MONDAY 7:30AM WINDOW — digests ════════════════════
async function sweepDigests(stats) {
  if (!(dayIs(1) && hourIs(7))) return;
  const weekLabel = `Week of ${mondayISO(-7)}`;

  // shared numbers
  const since = mondayISO(-7), until = mondayISO();
  const { count: verifiedTasks } = await supabase.from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'verified').gte('verified_at', since).lt('verified_at', until);
  const { data: sats } = await supabase.from('client_satisfaction')
    .select('nps_score').gte('created_at', since).lt('created_at', until);
  const satAvg = sats?.length
    ? (sats.reduce((s, x) => s + x.nps_score, 0) / sats.length).toFixed(1) + ' / 10'
    : 'No ratings this week';

  const { redFlagsSummary } = require('./brand-status-watch.service');
  const redFlags = await redFlagsSummary(); // null when all clear
  const leadership = await users({ roles: ['admin', 'md'] });
  for (const l of leadership) {
    stats.push(await dispatch.send('leadership_digest', {
      to: l, entityId: null, dedupe: 'weekly',
      data: { name: l.full_name, weekLabel, verifiedTasks, satisfactionAvg: satAvg, redFlags },
    }));
  }
  const superAdmins = await users({ roles: ['super_admin'] });
  for (const s of superAdmins) {
    stats.push(await dispatch.send('platform_digest', {
      to: s, entityId: null, dedupe: 'weekly',
      data: { name: s.full_name, weekLabel, tasksVerified: verifiedTasks },
    }));
  }
}

// ═══════ 9 · DAILY 9AM — MomentMap 7-day lookahead ═════════════
async function sweepMoments(stats) {
  if (!hourIs(9)) return;
  const target = new Date(lagos()); target.setDate(target.getDate() + 7);
  const targetISO = target.toISOString().slice(0, 10);
  const { data: moments } = await supabase.from('cultural_moments')
    .select('id, name, date').eq('date', targetISO);
  if (!moments?.length) return;
  const { data: allBrands } = await supabase.from('brands').select('id, name').eq('is_active', true);
  for (const m of moments) {
    for (const b of allBrands || []) {
      const { data: contacts } = await supabase.from('client_users')
        .select('id, email, full_name').eq('brand_id', b.id).eq('is_active', true);
      for (const c of contacts || []) {
        stats.push(await dispatch.send('client_moment_upcoming', {
          to: c, entityId: m.id, dedupe: 'once',
          data: { name: c.full_name, brandName: b.name, momentName: m.name, momentDate: m.date },
        }));
      }
    }
  }
}

// ── util ───────────────────────────────────────────────────────
function mondayISO(offsetDays = 0) {
  const d = lagos();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetDays);
  return d.toISOString().slice(0, 10);
}

// ═══════════════════════ MAIN ENTRY ════════════════════════════
async function runSweep() {
  const started = Date.now();
  const stats = [];
  const brands = new Map();
  const sweeps = [
    ['brand_status',        () => watchBrandStatus().then(r => stats.push(...Array(r.alerts).fill({ success: true })))],
    ['task_deadlines',      () => sweepTaskDeadlines(stats, brands)],
    ['verification',        () => sweepVerification(stats, brands)],
    ['briefs',              () => sweepBriefs(stats, brands)],
    ['strategy_pnl',        () => sweepPnl(stats, brands)],
    ['friday',              () => sweepFriday(stats)],
    ['daily_8am',           () => sweepDaily8(stats, brands)],
    ['satisfaction_prompt', () => sweepSatisfactionPrompt(stats)],
    ['digests',             () => sweepDigests(stats)],
    ['moments',             () => sweepMoments(stats)],
    ['people',              () => runPeopleSweeps(stats)],
  ];
  for (const [label, fn] of sweeps) {
    try { await fn(); }
    catch (err) { console.error(`[sweep:${label}]`, err.message); }
  }
  const sent = stats.filter(r => r?.success && !r.skipped).length;
  const deduped = stats.filter(r => r?.skipped === 'dedupe').length;
  console.log(`[sweep] done in ${Date.now() - started}ms — sent ${sent}, deduped ${deduped}, evaluated ${stats.length}`);
  return { sent, deduped, evaluated: stats.length, ms: Date.now() - started };
}

module.exports = { runSweep };
