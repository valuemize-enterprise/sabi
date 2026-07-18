/**
 * ═══════════════════════════════════════════════════════════════
 * Notification Triggers — event-driven emails
 * ═══════════════════════════════════════════════════════════════
 * One function per app event. Call these from your existing routes
 * (exact call sites listed in docs/ROUTE_PATCHES.md).
 *
 * Design rules:
 *   • Fire-and-forget: NEVER let an email failure break an API
 *     response. Every function swallows its own errors.
 *   • Pairs with in-app notifications — the email is the "until you
 *     act" channel; the bell is the "while you're here" channel.
 */

'use strict';

const supabase = require('../config/supabase');
const dispatch = require('./email-dispatch.service');

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://sabi.cerebre.media';

// ── helpers ─────────────────────────────────────────────────────
const safe = (fn) => async (...args) => {
  try { return await fn(...args); }
  catch (err) { console.error(`[notify] ${fn.name || 'trigger'} failed:`, err.message); }
};

async function getUser(id) {
  const { data } = await supabase.from('users')
    .select('id, email, full_name, role').eq('id', id).single();
  return data;
}

async function getAdmins() {
  const { data } = await supabase.from('users')
    .select('id, email, full_name')
    .in('role', ['super_admin', 'admin', 'md'])
    .eq('is_active', true);
  return data || [];
}

async function getBrandAdmins(brandId) {
  const { data } = await supabase.from('brand_admins')
    .select('user:users(id, email, full_name)')
    .eq('brand_id', brandId);
  return (data || []).map(r => r.user).filter(Boolean);
}

async function getBrand(brandId) {
  const { data } = await supabase.from('brands')
    .select('id, name').eq('id', brandId).single();
  return data;
}

async function getClientContacts(brandId) {
  const { data } = await supabase.from('client_users')
    .select('id, email, full_name')
    .eq('brand_id', brandId).eq('is_active', true);
  return data || [];
}

// ═══════════════════════ TASKS ════════════════════════════════

/** Call after a task is assigned (tasks routes + brief convert-task). */
const onTaskAssigned = safe(async function onTaskAssigned(task, assignedByName) {
  if (!task.assignee_id) return;
  const [user, brand] = await Promise.all([getUser(task.assignee_id), getBrand(task.brand_id)]);
  if (!user) return;
  let strategyTitle = null;
  if (task.strategy_id) {
    const { data: s } = await supabase.from('strategies').select('title').eq('id', task.strategy_id).single();
    strategyTitle = s?.title;
  }
  await dispatch.send('task_assigned', {
    to: user, entityId: task.id, dedupe: 'once',
    data: {
      name: user.full_name, taskTitle: task.title, brandName: brand?.name || 'your brand',
      assignedBy: assignedByName, dueDate: task.due_date, strategyTitle,
    },
  });
});

/** Call when done → verified. */
const onTaskVerified = safe(async function onTaskVerified(task, verifierName) {
  if (!task.assignee_id) return;
  const [user, brand] = await Promise.all([getUser(task.assignee_id), getBrand(task.brand_id)]);
  if (!user) return;
  await dispatch.send('task_verified', {
    to: user, entityId: task.id, dedupe: 'once',
    data: { name: user.full_name, taskTitle: task.title, brandName: brand?.name, verifierName },
  });
});

/** Call when done → in_progress (rejection). Reason is mandatory in the route. */
const onTaskRejected = safe(async function onTaskRejected(task, reviewerName, reason) {
  if (!task.assignee_id) return;
  const [user, brand] = await Promise.all([getUser(task.assignee_id), getBrand(task.brand_id)]);
  if (!user) return;
  await dispatch.send('task_rejected', {
    to: user, entityId: task.id, dedupe: 'always', // every rejection deserves its email
    data: { name: user.full_name, taskTitle: task.title, brandName: brand?.name, reviewerName, reason },
  });
});

// ═══════════════════ CONTRIBUTION CLAIMS ══════════════════════

/** Call when a claim is approved or declined. */
const onClaimResolved = safe(async function onClaimResolved(claim, approved, points, reason) {
  const user = await getUser(claim.user_id);
  if (!user) return;
  const brand = claim.brand_id ? await getBrand(claim.brand_id) : null;
  await dispatch.send('claim_resolved', {
    to: user, entityId: claim.id, dedupe: 'once',
    data: { name: user.full_name, claimTitle: claim.title, brandName: brand?.name, approved, points, reason },
  });
});

// ═══════════════════════ BRIEFS ═══════════════════════════════

/** Call on POST /api/client/briefs (client submits). */
const onBriefSubmitted = safe(async function onBriefSubmitted(brief, ariaInsights) {
  const brand = await getBrand(brief.brand_id);
  // 1 → confirmation to the client contact(s)
  const contacts = await getClientContacts(brief.brand_id);
  await dispatch.sendToMany('client_brief_confirmed', contacts, {
    entityId: brief.id, dedupe: 'once',
    data: { briefTitle: brief.title, brandName: brand?.name },
  });
  // 2 → urgent alert to all admins (+ brand admins of that brand)
  const [admins, brandAdmins] = await Promise.all([getAdmins(), getBrandAdmins(brief.brand_id)]);
  const seen = new Set(); const recipients = [];
  for (const r of [...admins, ...brandAdmins]) {
    if (!seen.has(r.id)) { seen.add(r.id); recipients.push(r); }
  }
  await dispatch.sendToMany('brief_received', recipients, {
    entityId: brief.id, dedupe: 'once',
    data: {
      briefTitle: brief.title, brandName: brand?.name,
      ariaInsights: ariaInsights || brief.aria_insights, deadline: brief.deadline,
    },
  });
});

/** Call when a brief's status changes (existing route already notifies in-app). */
const onBriefStatusChanged = safe(async function onBriefStatusChanged(brief, statusLabel, note) {
  const brand = await getBrand(brief.brand_id);
  const contacts = await getClientContacts(brief.brand_id);
  await dispatch.sendToMany('client_brief_status', contacts, {
    entityId: brief.id, dedupe: 'always',
    data: { briefTitle: brief.title, brandName: brand?.name, statusLabel, note },
  });
});

// ═══════════════════ STRATEGIES ═══════════════════════════════

/** Call when a strategy is submitted for approval. */
const onStrategySubmitted = safe(async function onStrategySubmitted(strategy) {
  const brand = await getBrand(strategy.brand_id);
  const admins = await getAdmins();
  await dispatch.sendToMany('strategy_pending_approval', admins, {
    entityId: strategy.id, dedupe: 'once',
    data: { strategyTitle: strategy.title, brandName: brand?.name },
  });
});

// ═══════════════════ SCORES & RECOGNITION ═════════════════════

/** Call from the lazy scoring engine after a week's scores are computed. */
const onScoresPublished = safe(async function onScoresPublished(weekScores) {
  // weekScores: [{ user_id, total, rolling_avg }]
  for (const s of weekScores) {
    const user = await getUser(s.user_id);
    if (!user) continue;
    await dispatch.send('weekly_score_published', {
      to: user, entityId: s.user_id, dedupe: 'weekly',
      data: { name: user.full_name, total: Math.round(s.total), rollingAvg: Math.round(s.rolling_avg) },
    });
  }
});

/** Call when the CD nominates Creative of the Week. */
const onCreativeOfWeek = safe(async function onCreativeOfWeek(userId, workTitle) {
  const user = await getUser(userId);
  if (!user) return;
  await dispatch.send('creative_of_week', {
    to: user, entityId: userId, dedupe: 'weekly',
    data: { name: user.full_name, workTitle },
  });
});

// ═══════════════ CLIENT SATISFACTION & GOALS ══════════════════

/** Call when a client submits a satisfaction rating. Alerts leadership if ≤ 2. */
const onSatisfactionSubmitted = safe(async function onSatisfactionSubmitted(entry) {
  if (entry.rating > 2) return;
  const brand = await getBrand(entry.brand_id);
  const admins = await getAdmins();
  await dispatch.sendToMany('satisfaction_alert', admins, {
    entityId: entry.id, dedupe: 'once',
    data: { brandName: brand?.name, rating: entry.rating, comment: entry.comment },
  });
});

/** Call when a goal's status changes. */
const onGoalStatusChanged = safe(async function onGoalStatusChanged(goal, newStatus) {
  const brand = await getBrand(goal.brand_id);
  const contacts = await getClientContacts(goal.brand_id);
  if (newStatus === 'achieved') {
    await dispatch.sendToMany('client_goal_achieved', contacts, {
      entityId: goal.id, dedupe: 'once',
      data: { goalTitle: goal.title, brandName: brand?.name },
    });
  } else if (newStatus === 'at_risk') {
    await dispatch.sendToMany('client_goal_at_risk', contacts, {
      entityId: goal.id, dedupe: 'level', level: 1, // re-alertable if it recovers then slips again? keep once per level
      data: { goalTitle: goal.title, brandName: brand?.name },
    });
  }
});

// ═══════════════════ REPORTS & AUDIT ══════════════════════════

/** Call when a report is published to a client portal. */
const onReportPublished = safe(async function onReportPublished(report) {
  const brand = await getBrand(report.brand_id);
  const contacts = await getClientContacts(report.brand_id);
  await dispatch.sendToMany('client_report_published', contacts, {
    entityId: report.id, dedupe: 'once',
    data: { brandName: brand?.name, periodLabel: report.period_label },
  });
});

/** Call from audit middleware on sensitive actions (deletes, weight changes, admin creation). */
const onSensitiveAction = safe(async function onSensitiveAction({ actionLabel, actorName, details }) {
  const { data: superAdmins } = await supabase.from('users')
    .select('id, email, full_name').eq('role', 'super_admin');
  await dispatch.sendToMany('sensitive_action', superAdmins || [], {
    entityId: null, dedupe: 'always',
    data: {
      actionLabel, actorName, details,
      when: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
    },
  });
});

module.exports = {
  onTaskAssigned, onTaskVerified, onTaskRejected,
  onClaimResolved,
  onBriefSubmitted, onBriefStatusChanged,
  onStrategySubmitted,
  onScoresPublished, onCreativeOfWeek,
  onSatisfactionSubmitted, onGoalStatusChanged,
  onReportPublished, onSensitiveAction,
};
