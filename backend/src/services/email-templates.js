/**
 * ═══════════════════════════════════════════════════════════════
 * Email Template Library — Sabi Intelligence Suite
 * A product of Cerebre Media Africa · Powered by ARIA
 * ═══════════════════════════════════════════════════════════════
 *
 * DEPENDENCY-FREE. Pure functions. Each template returns:
 *   { subject, preheader, html, category, tone }
 *
 * Every template answers four questions in its body:
 *   1. What happened / what is needed
 *   2. HOW to do it (numbered steps — a mini guide)
 *   3. The IMPACT STRIP: 💥 Why it matters · ⚠️ If ignored · 🏆 What you gain
 *   4. One CTA button that deep-links to the exact page
 *
 * Tone system (per the notification blueprint):
 *   informational · inspirational · humour · urgency ·
 *   emotional · consequential · disciplinary · celebration
 *
 * Escalation styling: pass level (1|2|3) in data → urgency ribbon
 * changes colour and copy. Level 3 = disciplinary, manager is CC'd
 * by the dispatcher.
 */

'use strict';

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://sabi.cerebre.media';

// ── Brand tokens ────────────────────────────────────────────────
const C = {
  ink:    '#171226',
  soft:   '#4b4560',
  line:   '#e8e5f2',
  paper:  '#faf9fc',
  purple: '#6d28d9',   // staff / general
  amber:  '#b45309',   // admin / MD
  indigo: '#4338ca',   // brand admin
  green:  '#059669',   // client
  red:    '#b91c1c',   // super admin / disciplinary
  gold:   '#c58a1a',   // celebration
};

// ── Layout primitives (email-safe: tables + inline styles) ─────
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const base = (accent, icon, title, subtitle, inner, preheader, footerNote) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${C.line};">
  <tr><td style="background:${accent};padding:30px 36px;">
    <table role="presentation" width="100%"><tr>
      <td style="font-size:30px;line-height:1;">${icon}</td>
      <td align="right" style="color:#ffffff;opacity:.85;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;">Sabi · Cerebre Media Africa</td>
    </tr></table>
    <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-.01em;margin-top:14px;line-height:1.25;">${title}</div>
    ${subtitle ? `<div style="color:#ffffff;opacity:.9;font-size:14px;margin-top:6px;">${subtitle}</div>` : ''}
  </td></tr>
  <tr><td style="padding:32px 36px 8px;color:${C.ink};font-size:15px;line-height:1.65;">
    ${inner}
  </td></tr>
  <tr><td style="padding:8px 36px 30px;">
    <div style="border-top:1px solid ${C.line};padding-top:18px;font-size:12px;color:#8a83a3;line-height:1.6;">
      ${footerNote || `Sabi will keep a gentle eye on this and remind you until it&rsquo;s done — that&rsquo;s the job. 😉`}<br>
      <a href="${APP}/settings/notifications" style="color:${C.purple};">Manage email preferences</a> ·
      Need help? <a href="mailto:hello@cerebre.media" style="color:${C.purple};">hello@cerebre.media</a><br>
      © Cerebre Media Africa · Sabi Intelligence Suite · Powered by ARIA
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

const p = (t, muted) => `<p style="margin:0 0 14px;color:${muted ? C.soft : C.ink};font-size:${muted?'13.5px':'15px'};">${t}</p>`;

const greeting = (name) => p(`Hi <strong>${esc(name || 'there')}</strong>,`);

// The signature block — every action email carries it.
const impactStrip = (impact, ignored, gain) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${C.line};border-radius:12px;">
  <tr><td style="padding:12px 16px;border-bottom:1px solid ${C.line};font-size:13.5px;color:${C.ink};">
    <span style="font-weight:800;color:${C.purple};">💥 Why it matters&nbsp;&nbsp;</span>${impact}</td></tr>
  <tr><td style="padding:12px 16px;border-bottom:1px solid ${C.line};font-size:13.5px;color:${C.ink};">
    <span style="font-weight:800;color:${C.red};">⚠️ If ignored&nbsp;&nbsp;</span>${ignored}</td></tr>
  <tr><td style="padding:12px 16px;font-size:13.5px;color:${C.ink};">
    <span style="font-weight:800;color:${C.green};">🏆 What you gain&nbsp;&nbsp;</span>${gain}</td></tr>
</table>`;

const steps = (title, items) => `
<div style="background:${C.paper};border:1px solid ${C.line};border-radius:12px;padding:16px 20px;margin:0 0 18px;">
  <div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${C.soft};margin-bottom:8px;">${title || 'How to do it'}</div>
  <ol style="margin:0;padding-left:20px;color:${C.ink};font-size:14px;line-height:1.8;">
    ${items.map(i => `<li>${i}</li>`).join('')}
  </ol>
</div>`;

const cta = (label, url, accent) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td
  style="border-radius:10px;background:${accent || C.purple};">
  <a href="${url}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-weight:800;font-size:14.5px;text-decoration:none;">${label}</a>
</td></tr></table>`;

const ribbon = (level, text) => {
  const cfg = {
    1: { bg:'#fdf3e3', bd:'#b45309', label:'⏰ Reminder' },
    2: { bg:'#fde8e8', bd:'#dc2626', label:'🔥 Second reminder — this is now urgent' },
    3: { bg:'#7f1d1d', bd:'#7f1d1d', label:'🚨 Final notice — leadership has been copied' },
  }[level] || { bg:'#fdf3e3', bd:'#b45309', label:'⏰ Reminder' };
  const colour = level === 3 ? '#ffffff' : C.ink;
  return `<div style="background:${cfg.bg};border-left:5px solid ${cfg.bd};border-radius:0 10px 10px 0;padding:12px 16px;margin:0 0 18px;font-size:13.5px;color:${colour};">
    <strong>${cfg.label}</strong>${text ? ` — ${text}` : ''}</div>`;
};

const infoBox = (label, value) => `
<div style="background:${C.paper};border:1px solid ${C.line};border-radius:10px;padding:12px 16px;margin:0 0 12px;">
  <div style="font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${C.soft};">${label}</div>
  <div style="font-size:15px;font-weight:700;color:${C.ink};margin-top:2px;">${value}</div>
</div>`;

const dueLine = (d) => d.dueDate ? infoBox('Due date', esc(d.dueDate)) : '';

// ═══════════════════════════════════════════════════════════════
// TEMPLATE CATALOG
// key → builder(data) → { subject, preheader, html, category, tone }
// ═══════════════════════════════════════════════════════════════
const T = {};

/* ─────────────────────────── STAFF ─────────────────────────── */

// 1 · Task assigned — informational + inspirational
T.task_assigned = (d) => ({
  category: 'tasks', tone: 'informational',
  subject: `📋 New task on ${d.brandName}: ${d.taskTitle}`,
  preheader: `Assigned by ${d.assignedBy || 'your Brand Admin'}. The strategy is counting on this one.`,
  html: base(C.purple, '📋', 'You have a new task', esc(d.brandName),
    greeting(d.name) +
    p(`<strong>${esc(d.assignedBy || 'Your Brand Admin')}</strong> just assigned you a task on <strong>${esc(d.brandName)}</strong>:`) +
    infoBox('Task', esc(d.taskTitle)) + dueLine(d) +
    (d.strategyTitle ? p(`It belongs to the active strategy <strong>&ldquo;${esc(d.strategyTitle)}&rdquo;</strong> — read the strategy first so your work serves the plan.`, true) : '') +
    steps('How to knock it out', [
      `Open the task and read the full description.`,
      `Drag it to <strong>In Progress</strong> so the team knows it&rsquo;s moving.`,
      `Finish the work, paste your <strong>proof link</strong> (Canva, Sheet, Meet recording, live post).`,
      `Move it to <strong>Done</strong> — verification turns it into score points.`,
    ]) +
    impactStrip(
      `Verified tasks are <strong>30% of your weekly score</strong> — the single biggest part you fully control.`,
      `Tasks that miss their due date drag your completion rate down for the whole week.`,
      `Points, a stronger 4-week average, and a client who sees your name behind the results.`
    ) +
    cta('Open my task board →', `${APP}/tasks`, C.purple),
    `New task from ${d.assignedBy || 'your team'} on ${d.brandName}`),
});

// 2 · Task due tomorrow — urgency + humour
T.task_due_tomorrow = (d) => ({
  category: 'tasks', tone: 'urgency+humour',
  subject: `⏳ Tomorrow o! "${d.taskTitle}" is due`,
  preheader: `24 hours left. Future-you is begging present-you to start now.`,
  html: base(C.purple, '⏳', 'Due tomorrow. Yes, tomorrow.', esc(d.brandName),
    greeting(d.name) +
    p(`Friendly heads-up: <strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong> is due <strong>tomorrow</strong>. Deadlines have a funny way of arriving exactly on time — they have never once been late. 😅`) +
    dueLine(d) +
    steps('Beat the deadline in 3 moves', [
      `Finish the work today, not tonight.`,
      `Paste the <strong>proof link</strong> the moment you finish — no proof, no verification, no points.`,
      `Move the card to <strong>Done</strong> and sleep well.`,
    ]) +
    impactStrip(
      `On-time delivery keeps your verified completion rate — 30 points of your score — intact.`,
      `Miss it and it flips to <strong>overdue</strong>: the reminders get less funny and your week&rsquo;s completion rate takes the hit.`,
      `A calm morning tomorrow, points in the bank, and a Brand Admin who trusts you with the big briefs.`
    ) +
    cta('Finish it now →', `${APP}/tasks`, C.purple),
    `24-hour reminder for ${d.taskTitle}`),
});

// 3-5 · Task overdue — escalating: urgency → consequential → disciplinary
T.task_overdue = (d) => {
  const lvl = d.level || 1;
  const copy = {
    1: {
      subject: `🔴 Overdue: "${d.taskTitle}" — let's fix this today`,
      open: `<strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong> on ${esc(d.brandName)} is now <strong>${d.daysOverdue} day(s) overdue</strong>. It happens — but today is the day we close it.`,
      ribbonText: `${d.daysOverdue} day(s) past the due date.`,
    },
    2: {
      subject: `🔥 ${d.daysOverdue} days overdue: "${d.taskTitle}" is hurting your score`,
      open: `This is the second reminder for <strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong>. Every extra day now directly reduces your verified-completion score for the week — this is real points leaving your account.`,
      ribbonText: `${d.daysOverdue} days overdue. Your weekly score is actively bleeding.`,
    },
    3: {
      subject: `🚨 Final notice: "${d.taskTitle}" — ${d.daysOverdue} days overdue, leadership copied`,
      open: `<strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong> has been overdue for <strong>${d.daysOverdue} days</strong>. Your Brand Admin has now been copied on this email. In Sabi, nothing disappears — the honest move is to either finish it today or speak to your Brand Admin about re-scoping it. Silence is the only wrong answer.`,
      ribbonText: `Escalated. Finish it, or talk to your Brand Admin today.`,
    },
  }[Math.min(lvl, 3)];
  return {
    category: lvl >= 3 ? 'disciplinary' : 'tasks',
    tone: lvl === 1 ? 'urgency' : lvl === 2 ? 'consequential' : 'disciplinary',
    subject: copy.subject,
    preheader: `Overdue on ${d.brandName}. The fix takes less time than the worry.`,
    html: base(lvl >= 3 ? C.red : C.purple, '⏰', 'A task is overdue', esc(d.brandName),
      ribbon(lvl, copy.ribbonText) +
      greeting(d.name) + p(copy.open) +
      steps('The way out (today)', [
        `Open the task and finish the work — or,`,
        `If it&rsquo;s blocked, message your Brand Admin <em>now</em> with what&rsquo;s blocking you.`,
        `Attach the proof link and move it to <strong>Done</strong>.`,
      ]) +
      impactStrip(
        `Your verified completion rate is 30% of your score — and it&rsquo;s calculated weekly, no hiding place.`,
        lvl >= 2
          ? `The overdue days are already counted. Every further day deepens the dent in this week — and your 4-week average carries it for a month.`
          : `It flips from &ldquo;small delay&rdquo; to a visible dent in your week.`,
        `Closing it today stops the bleeding immediately — Sabi only ever scores what is true <em>now</em>.`
      ) +
      cta(lvl >= 3 ? 'Resolve it right now →' : 'Open the task →', `${APP}/tasks`, lvl >= 3 ? C.red : C.purple),
      `Overdue task on ${d.brandName}`,
      lvl >= 3 ? `This was a final notice. Your Brand Admin has been copied so they can help you unblock it.` : undefined),
  };
};

// 6 · Task rejected — constructive + emotional
T.task_rejected = (d) => ({
  category: 'tasks', tone: 'emotional+constructive',
  subject: `↩️ "${d.taskTitle}" came back — here's exactly why`,
  preheader: `Not a failure. A revision. The reason is written below.`,
  html: base(C.purple, '🛠️', 'Sent back for one more pass', esc(d.brandName),
    greeting(d.name) +
    p(`<strong>${esc(d.reviewerName || 'Your reviewer')}</strong> reviewed <strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong> and sent it back to <strong>In Progress</strong>. Take a breath — this is the system working, not a verdict on you. Every rejection in Sabi must come with a written reason, and here it is:`) +
    infoBox('Reason given', esc(d.reason || 'See the task card for details')) +
    steps('Turn it around', [
      `Read the reason twice — the fix is usually smaller than it feels.`,
      `Make the correction, update your <strong>proof link</strong>.`,
      `Move it back to <strong>Done</strong> — resubmissions verify fast.`,
    ]) +
    impactStrip(
      `A rejected-then-fixed task still earns <strong>full points</strong> once verified. Nothing is lost yet.`,
      `Leaving it parked means the task drifts toward overdue — and those reminders are less gentle.`,
      `The reviewer sees you take feedback like a pro. That reputation follows you into every appraisal.`
    ) +
    cta('Fix and resubmit →', `${APP}/tasks`, C.purple),
    `Revision requested on ${d.taskTitle}`),
});

// 7 · Task verified — celebration
T.task_verified = (d) => ({
  category: 'celebrations', tone: 'celebration',
  subject: `✅ Verified! "${d.taskTitle}" just paid you points`,
  preheader: `Checked, approved, counted. This is what winning quietly looks like.`,
  html: base(C.green, '🎉', 'Your work passed the gate', esc(d.brandName),
    greeting(d.name) +
    p(`<strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong> was just <strong>verified</strong> by ${esc(d.verifierName || 'your Brand Admin')}. In Sabi, nothing self-reported counts — which means this ✅ is the real thing: your work was checked and it stood.`) +
    impactStrip(
      `Verified tasks feed 30% of your weekly score and appear in the client&rsquo;s Proof of Value trail.`,
      `Nothing — you already did the right thing. Enjoy it.`,
      `Points banked, average up, and your name attached to results the client can actually see.`
    ) +
    cta('See my score climb →', `${APP}/my-score`, C.green),
    `Task verified on ${d.brandName}`,
    `No action needed — this one is pure good news. More of this, please. 🙌`),
});

// 8 · Contribution claim resolved — celebration or constructive
T.claim_resolved = (d) => {
  const ok = d.approved;
  return {
    category: 'celebrations', tone: ok ? 'celebration' : 'constructive',
    subject: ok ? `⭐ Claim approved: +${d.points} points for going beyond` : `↩️ Your contribution claim wasn't approved this time`,
    preheader: ok ? `Extra effort, officially counted.` : `Here's the reasoning — and how to claim better next time.`,
    html: base(ok ? C.gold : C.purple, ok ? '⭐' : '📝', ok ? 'Above and beyond — approved' : 'About your contribution claim', esc(d.brandName || ''),
      greeting(d.name) +
      (ok
        ? p(`Your claim <strong>&ldquo;${esc(d.claimTitle)}&rdquo;</strong> was reviewed against your core functions and approved at <strong>${d.points} points</strong>. That means a real human looked at your proof and agreed: this was beyond your job. That&rsquo;s the culture we&rsquo;re building.`)
        : p(`Your claim <strong>&ldquo;${esc(d.claimTitle)}&rdquo;</strong> was reviewed and not approved. The most common reason: the work falls <em>inside</em> your core functions — which means it earns task points instead, not contribution points.`) +
          infoBox('Reviewer note', esc(d.reason || 'Check the claim for details'))) +
      (ok ? '' : steps('Claim smarter next time', [
        `Check <strong>&ldquo;What&rsquo;s Expected of Me&rdquo;</strong> on your profile before claiming.`,
        `Only claim work clearly outside those lines.`,
        `Lead with the proof link — it does the arguing for you.`,
      ])) +
      impactStrip(
        `Contributions are worth up to 15% of your weekly score — your top two claims each week count.`,
        ok ? `Nothing — banked and counted.` : `Nothing lost — a declined claim never subtracts points.`,
        ok ? `+${d.points} points and a visible reputation as the person who shows up beyond the job description.` : `Sharper claims that get approved on the first try.`
      ) +
      cta(ok ? 'View my score →' : 'Review my core functions →', ok ? `${APP}/my-score` : `${APP}/my-profile`, ok ? C.gold : C.purple),
      ok ? `+${d.points} contribution points` : `Claim update`),
  };
};

// 9 · Weekly score published — inspirational
T.weekly_score_published = (d) => ({
  category: 'scores', tone: 'inspirational',
  subject: `📊 Your Sabi score for last week is ready: ${d.total}/100`,
  preheader: `Rolling 4-week average: ${d.rollingAvg}. The receipts are inside.`,
  html: base(C.purple, '📊', 'Your week, in numbers', 'Weekly score published',
    greeting(d.name) +
    p(`Last week&rsquo;s score has been computed: <strong>${d.total}/100</strong>, and your 4-week rolling average — the number that actually matters — now stands at <strong>${d.rollingAvg}</strong>.`) +
    p(`Remember how this is built: client satisfaction, verified tasks, your manager&rsquo;s rating, and contributions. Every point traces to something real. One bad week never defines you; four good ones do.`, true) +
    steps('Two minutes well spent', [
      `Open <strong>My Score</strong> and scan the component breakdown.`,
      `Spot your weakest category — that&rsquo;s next week&rsquo;s free points.`,
      `See something wrong? Hit <strong>Dispute</strong> — it goes straight to leadership with the audit log.`,
    ]) +
    impactStrip(
      `This average is your case for raises, bonuses and bigger briefs — evidence, not vibes.`,
      `Ignore it and you fly blind while others course-correct weekly.`,
      `Compound growth: staff who check weekly fix small dips before they become quarterly problems.`
    ) +
    cta('Open My Score →', `${APP}/my-score`, C.purple),
    `Weekly score: ${d.total}/100`),
});

// 10 · Creative of the Week — celebration
T.creative_of_week = (d) => ({
  category: 'celebrations', tone: 'celebration',
  subject: `🏆 ${d.name}, you are Creative of the Week!`,
  preheader: `The Creative Director reviewed the whole week — and picked you. +5 bonus points.`,
  html: base(C.gold, '🏆', 'Creative of the Week', 'Chosen by the Creative Director',
    greeting(d.name) +
    p(`Out of every design, video and piece of creative logged this week, the Creative Director chose <strong>yours</strong>. A <strong>+5 bonus</strong> has been added to your score and your badge is glowing on the leaderboard.`) +
    (d.workTitle ? infoBox('The winning work', esc(d.workTitle)) : '') +
    p(`Take the moment. Screenshot the badge. Then come back Monday and defend the crown. 👑`, true) +
    impactStrip(
      `Recognition in Sabi is public, weekly, and earned — the whole agency sees this.`,
      `Nothing. This email exists purely to make your day.`,
      `+5 points, the badge, and a body of work leadership is actively watching.`
    ) +
    cta('See the leaderboard →', `${APP}/my-score`, C.gold),
    `You won Creative of the Week`,
    `No action needed. Just excellence, acknowledged. 🎉`),
});

/* ──────────────────────── BRAND ADMIN ──────────────────────── */

// 11 · Daily verification queue — urgency
T.verification_queue = (d) => ({
  category: 'tasks', tone: 'urgency',
  subject: `🧾 ${d.count} task(s) waiting for your Verify — oldest: ${d.oldestDays} day(s)`,
  preheader: `Your team did the work. Your click makes it count.`,
  html: base(C.indigo, '🧾', 'Your verification queue', `${esc(d.brandName || 'Your brands')} · ${d.count} pending`,
    greeting(d.name) +
    p(`<strong>${d.count} task(s)</strong> are sitting in <strong>Done</strong>, waiting for your verification. The oldest has waited <strong>${d.oldestDays} day(s)</strong>. Your team members earn <em>nothing</em> for this work until you click Verify — you are literally holding their points.`) +
    steps('Clear it in minutes', [
      `Open your dashboard — the queue is the first widget.`,
      `Click each <strong>proof link</strong>, judge the work.`,
      `<strong>Verify</strong> to release the points, or <strong>Reject with a reason</strong> — never silence.`,
    ]) +
    impactStrip(
      `Verification is the trust engine of Sabi: it&rsquo;s what makes every score and client report real.`,
      `Tasks unverified past <strong>5 days</strong> count against <strong>YOUR</strong> Brand Admin score — not your team&rsquo;s. The clock is already running.`,
      `A team that gets same-day feedback, a clean queue, and your own Team Verified Completion score at full strength.`
    ) +
    cta('Open my verification queue →', `${APP}/dashboard`, C.indigo),
    `${d.count} tasks pending verification`),
});

// 12 · Verification deadline warning (day 4) — consequential
T.verification_deadline = (d) => ({
  category: 'tasks', tone: 'consequential',
  subject: `⚠️ Day ${d.daysWaiting}: "${d.taskTitle}" hits YOUR score tomorrow`,
  preheader: `One task, one click, one day left before it counts against you.`,
  html: base(C.indigo, '⚠️', 'Verify it today — tomorrow it costs you', esc(d.brandName),
    ribbon(2, `This task crosses the 5-day line tomorrow.`) +
    greeting(d.name) +
    p(`<strong>&ldquo;${esc(d.taskTitle)}&rdquo;</strong> (by ${esc(d.staffName)}) has been sitting in Done for <strong>${d.daysWaiting} days</strong>. From day 5, Sabi stops counting it as neutral — it counts <strong>against your own weekly score</strong>, by design, so verification never becomes the bottleneck.`) +
    p(`This is a two-minute job: open the proof, make the call.`, true) +
    impactStrip(
      `Team Verified Completion is 25% of your Brand Admin score — and it includes your verification speed.`,
      `Tomorrow this task starts subtracting from <em>your</em> number, while ${esc(d.staffName)} still waits for their points.`,
      `Verify today: your score stays clean, your teammate gets paid in points, and the queue stays a queue — not a backlog.`
    ) +
    cta('Verify it now →', `${APP}/dashboard`, C.indigo),
    `Verification deadline warning`),
});

// 13 · Rate your team reminder — nudge, consequential
T.rate_team_reminder = (d) => ({
  category: 'scores', tone: 'consequential',
  subject: `⭐ Rate your team before Sunday — or the system rates them for you`,
  preheader: `Unrated = automatic neutral 3. Your judgement deserves better than a default.`,
  html: base(C.indigo, '⭐', 'Your team needs your rating', 'Weekly ratings close Sunday night',
    greeting(d.name) +
    p(`You haven&rsquo;t rated <strong>${d.unratedCount} team member(s)</strong> this week. If Sunday midnight passes, Sabi records a neutral <strong>3/5</strong> for each of them — fair, but blind. A default can&rsquo;t see the designer who saved the campaign, or the writer who coasted.`) +
    steps('90 seconds per person', [
      `Open the <strong>Rate Your Team</strong> widget on your dashboard.`,
      `Score each person 1–5 on the week that actually happened.`,
      `Rating 2 or below? Write the note — they deserve to know why, and the system requires it.`,
    ]) +
    impactStrip(
      `Your rating is 20% of each team member&rsquo;s score — the human judgement layer no algorithm replaces.`,
      `Defaults flatten everyone to average: your stars go unrewarded, your strugglers get no signal.`,
      `A team that knows excellence is <em>seen</em> — the cheapest motivation money can&rsquo;t buy.`
    ) +
    cta('Rate my team →', `${APP}/dashboard`, C.indigo),
    `${d.unratedCount} team members unrated this week`),
});

// 14 · Claims awaiting review — nudge
T.claims_pending = (d) => ({
  category: 'tasks', tone: 'urgency',
  subject: `📝 ${d.count} contribution claim(s) need your verdict`,
  preheader: `Someone went beyond their job and is waiting to hear it counted.`,
  html: base(C.indigo, '📝', 'Contribution claims awaiting you', `${d.count} pending`,
    greeting(d.name) +
    p(`<strong>${d.count} contribution claim(s)</strong> are waiting for review. Sabi shows you each claimant&rsquo;s core functions <em>side-by-side</em> with their claim — the &ldquo;is this actually extra?&rdquo; question takes ten seconds, not a debate.`) +
    steps('The 10-second method', [
      `Open the claim, click the proof link.`,
      `Compare against the core functions shown beside it.`,
      `Approve at <strong>5 / 10 / 15</strong> points — or decline with a reason.`,
    ]) +
    impactStrip(
      `Claims are how extra effort becomes visible. Reviewing fast keeps the culture of going beyond alive.`,
      `Stale claims tell your best people that extra effort disappears into a void. They stop going beyond. Quietly.`,
      `A team that helps each other because helping is <em>counted</em> — and a reputation as the admin who sees people.`
    ) +
    cta('Review claims →', `${APP}/contribution-claims`, C.indigo),
    `${d.count} claims pending review`),
});

/* ────────────────────── ADMIN / MD / CD ────────────────────── */

// 15 · New client brief — urgency + ARIA
T.brief_received = (d) => ({
  category: 'briefs', tone: 'urgency',
  subject: `📨 New brief from ${d.brandName}: "${d.briefTitle}"`,
  preheader: `ARIA has already read it. Key insights inside. The clock on client trust starts now.`,
  html: base(C.amber, '📨', 'A client just briefed us', esc(d.brandName),
    greeting(d.name) +
    p(`<strong>${esc(d.brandName)}</strong> submitted a new brief: <strong>&ldquo;${esc(d.briefTitle)}&rdquo;</strong>. ARIA has already extracted the essentials:`) +
    infoBox('ARIA\u2019s key insights', esc(d.ariaInsights || 'Open the brief to view ARIA\u2019s analysis')) +
    (d.deadline ? infoBox('Client deadline', esc(d.deadline)) : '') +
    steps('The first-24-hours play', [
      `Open the brief and read it alongside ARIA&rsquo;s insights.`,
      `Classify it: <strong>BAU</strong> (retainer) or <strong>New Project</strong> — remember the rule: <em>if it requires a new strategy, it is not BAU</em>.`,
      `New Project? Generate the strategy with ARIA and fill the P&amp;L.`,
    ]) +
    impactStrip(
      `Speed on briefs is the loudest signal of agency quality a client ever receives.`,
      `Unclassified briefs are unpriced work — scope creep is exactly this email being ignored.`,
      `A client who feels heard within hours, and revenue captured at the moment it&rsquo;s born.`
    ) +
    cta('Open the brief →', `${APP}/clients`, C.amber),
    `New brief from ${d.brandName}`),
});

// 16 · Brief unclassified 24h — consequential
T.brief_unclassified = (d) => ({
  category: 'briefs', tone: 'consequential',
  subject: `⚠️ ${d.hoursOld}h and unclassified: "${d.briefTitle}" (${d.brandName})`,
  preheader: `Every unclassified brief is unpriced work. This is how agencies leak money.`,
  html: base(C.amber, '⚠️', 'This brief is aging', esc(d.brandName),
    ribbon(d.level || 1, `Submitted ${d.hoursOld} hours ago. Still unclassified.`) +
    greeting(d.name) +
    p(`<strong>&ldquo;${esc(d.briefTitle)}&rdquo;</strong> from ${esc(d.brandName)} has sat unclassified for <strong>${d.hoursOld} hours</strong>. Until someone answers &ldquo;BAU or New Project?&rdquo;, this work has no price, no strategy, no owner — and the client is watching the silence.`) +
    impactStrip(
      `Classification is the moment revenue is either captured or given away for free.`,
      `The team may start executing it as free retainer work — money we can never invoice retroactively without an awkward conversation.`,
      `Sixty seconds of decision-making that either protects the retainer&rsquo;s scope or opens a new invoice.`
    ) +
    cta('Classify it now →', `${APP}/clients`, C.amber),
    `Unclassified brief aging`),
});

// 17 · Strategy awaiting approval — urgency
T.strategy_pending_approval = (d) => ({
  category: 'briefs', tone: 'urgency',
  subject: `🧠 Strategy ready for approval: "${d.strategyTitle}" (${d.brandName})`,
  preheader: `The whole team is on hold until this is approved.`,
  html: base(C.amber, '🧠', 'A strategy needs your approval', esc(d.brandName),
    greeting(d.name) +
    p(`The strategy <strong>&ldquo;${esc(d.strategyTitle)}&rdquo;</strong> for ${esc(d.brandName)} is drafted and waiting for your approval. Until you approve it, no tasks flow, no work starts, no points move — the entire execution engine idles on your decision.`) +
    steps('Approve with confidence', [
      `Read the strategy — edit anything ARIA drafted that doesn&rsquo;t match your judgement.`,
      `Fill the <strong>P&amp;L</strong>: expected revenue + estimated cost (auto-suggest uses task hours × agency rate).`,
      `Approve — Sabi auto-creates the expected invoice and unlocks the task board.`,
    ]) +
    impactStrip(
      `Approval is the starting gun: strategy → tasks → verified work → client value.`,
      `Every idle day is the client&rsquo;s deadline getting closer with zero progress to show.`,
      `A launched strategy, an invoice in the ledger, and a team sprinting instead of waiting.`
    ) +
    cta('Review and approve →', `${APP}/clients`, C.amber),
    `Strategy pending approval`),
});

// 18 · Strategy P&L missing — consequential/disciplinary
T.strategy_pnl_missing = (d) => ({
  category: 'financial', tone: 'consequential',
  subject: `💸 "P&L pending": ${d.strategyTitle} has no price tag (${d.brandName})`,
  preheader: `No P&L = no invoice = free work. Sabi will not let this one slide.`,
  html: base(C.amber, '💸', 'This strategy has no price tag', esc(d.brandName),
    ribbon(d.level || 1, `The "P&L pending" badge is showing on this strategy.`) +
    greeting(d.name) +
    p(`<strong>&ldquo;${esc(d.strategyTitle)}&rdquo;</strong> is live-ish — but its P&amp;L is empty. No expected revenue. No estimated cost. Which means <strong>no invoice exists</strong> for this work, and the MD dashboard is reporting income that isn&rsquo;t being tracked.`) +
    steps('Two fields. One minute.', [
      `Open the strategy → <strong>P&amp;L</strong> tab.`,
      `Enter expected revenue; for cost, use auto-suggest (task hours × agency rate) or type it.`,
      `Save — the expected invoice is created automatically and linked to the brief.`,
    ]) +
    impactStrip(
      `The P&amp;L is where a strategy becomes a business decision instead of a hope.`,
      `Unpriced work ships, the month closes, and that revenue is gone — permanently un-invoiceable.`,
      `Clean books, an honest MD dashboard, and Brand Admin scores tied to real money.`
    ) +
    cta('Fill the P&L →', `${APP}/clients`, C.amber),
    `Strategy P&L missing`),
});

// 19 · Leadership Monday digest — informational/inspirational
T.leadership_digest = (d) => ({
  category: 'digests', tone: 'informational',
  subject: `☀️ Monday Briefing: ${d.weekLabel} across all brands`,
  preheader: `Scores, revenue, red flags — the week&rsquo;s truth in one email.`,
  html: base(C.amber, '☀️', 'Your Monday briefing', esc(d.weekLabel || 'Last week at Cerebre'),
    greeting(d.name) +
    p(`Here is last week, with nothing hidden:`) +
    infoBox('Verified tasks across all brands', esc(String(d.verifiedTasks ?? '—'))) +
    infoBox('Expected revenue from new strategies', esc(d.newRevenue ?? '—')) +
    infoBox('Client satisfaction average', esc(d.satisfactionAvg ?? '—')) +
    (d.redFlags ? infoBox('🚩 Needs your attention', esc(d.redFlags)) : '') +
    p(`Every number above is built from verified work and real client responses — this is the same data the CEO sees.`, true) +
    impactStrip(
      `Leaders who read this need no status meeting — they arrive already informed.`,
      `Skip it and Monday&rsquo;s decisions run on Friday&rsquo;s guesses.`,
      `Meetings that start at the decision, not the update.`
    ) +
    cta('Open the leadership dashboard →', `${APP}/agency/leadership`, C.amber),
    `Monday leadership digest`),
});

// 20 · Client satisfaction alert — critical
T.satisfaction_alert = (d) => ({
  category: 'critical', tone: 'urgency',
  subject: `🚨 ${d.brandName} rated us ${d.rating}/5 — respond today`,
  preheader: `A client just told us something is wrong. This email cannot wait until tomorrow.`,
  html: base(C.red, '🚨', 'A client is unhappy', esc(d.brandName),
    greeting(d.name) +
    p(`<strong>${esc(d.brandName)}</strong> answered this week&rsquo;s satisfaction prompt with a <strong>${d.rating}/5</strong>. In Sabi, client satisfaction is the anchor metric — the client controls it, and it just moved against us.`) +
    (d.comment ? infoBox('What they said', esc(d.comment)) : '') +
    steps('The recovery play — today, not this week', [
      `Call the client. Not email. <strong>Call.</strong> Listen more than you talk.`,
      `Check the brand&rsquo;s recent briefs, tasks and reports for the likely cause.`,
      `Log the fix as tasks in Sabi so the correction is visible and verified.`,
    ]) +
    impactStrip(
      `Satisfaction is 35% of staff scores and 30% of Brand Admin scores — one unhappy client dents an entire team, deservedly.`,
      `Unaddressed low ratings are how retainers quietly die: the client stops complaining and starts shopping.`,
      `Clients remember recovery more than they remember perfection. Handled fast, this becomes a loyalty story.`
    ) +
    cta('Open the brand →', `${APP}/clients`, C.red),
    `Low satisfaction rating from ${d.brandName}`,
    `This is a critical alert — it bypasses email preferences by design.`),
});

// 21 · Client gone silent — consequential
T.client_silent = (d) => ({
  category: 'critical', tone: 'consequential',
  subject: `🔕 ${d.brandName} hasn't rated us in ${d.weeksSilent} weeks`,
  preheader: `Silence is data. The carry-forward is about to expire.`,
  html: base(C.amber, '🔕', 'A client has gone quiet', esc(d.brandName),
    greeting(d.name) +
    p(`<strong>${esc(d.brandName)}</strong> has skipped the satisfaction prompt for <strong>${d.weeksSilent} consecutive weeks</strong>. Sabi carries their last rating forward for up to three weeks — after that, the weight redistributes and we lose our clearest signal of how they feel.`) +
    p(`Silent clients are rarely neutral. They are either too busy to care (fine) or too disappointed to bother (dangerous). One call tells you which.`, true) +
    steps('Re-open the channel', [
      `Have the account lead check in personally this week — warm, no agenda.`,
      `Ask one question: &ldquo;What&rsquo;s one thing we could do better?&rdquo;`,
      `Remind them the weekly prompt is one tap — and it genuinely shapes their team.`,
    ]) +
    impactStrip(
      `The client&rsquo;s voice is the anchor of the entire scoring system — by design.`,
      `Three silent weeks becomes six, and the first feedback you get is a non-renewal email.`,
      `A client who knows their opinion moves the machine — the stickiest retention tool we have.`
    ) +
    cta('View the brand →', `${APP}/clients`, C.amber),
    `${d.brandName} silent for ${d.weeksSilent} weeks`),
});

// 22 · Creative Director weekly review reminder — nudge
T.creative_review_reminder = (d) => ({
  category: 'scores', tone: 'inspirational',
  subject: `🎨 ${d.itemCount} creative pieces await your eye — and one deserves the crown`,
  preheader: `The week's design & video work is queued. Creative of the Week won't pick itself.`,
  html: base(C.amber, '🎨', 'Your creative review is ready', 'The week in design & video',
    greeting(d.name) +
    p(`<strong>${d.itemCount} pieces</strong> of creative work from the past 7 days are queued on your review page — grouped by person, every proof link one click away. Somewhere in that list is this week&rsquo;s <strong>Creative of the Week</strong>.`) +
    steps('The Friday ritual', [
      `Open <strong>/creative-review</strong> and go person by person.`,
      `Submit each weekly rating as you go (2 or below needs a note).`,
      `Crown one <strong>⭐ Creative of the Week</strong> — it awards +5 and lights up the leaderboard.`,
    ]) +
    impactStrip(
      `Your ratings are the quality bar of the creative department — 20% of every creative&rsquo;s score.`,
      `Skip it and everyone defaults to neutral 3 — your taste, the thing you were hired for, goes unrecorded.`,
      `A creative team that competes for your Friday verdict. That&rsquo;s a culture engine, and you hold the key.`
    ) +
    cta('Start the review →', `${APP}/creative-review`, C.amber),
    `${d.itemCount} creative items to review`),
});

/* ─────────────────────── SUPER ADMIN ───────────────────────── */

// 23 · Platform weekly digest
T.platform_digest = (d) => ({
  category: 'digests', tone: 'informational',
  subject: `🛡️ Sabi Platform Weekly: ${d.weekLabel}`,
  preheader: `Users, revenue, scores, audit highlights — the whole machine in one view.`,
  html: base(C.red, '🛡️', 'Platform weekly report', esc(d.weekLabel || 'The platform this week'),
    greeting(d.name) +
    infoBox('Active users this week', esc(String(d.activeUsers ?? '—'))) +
    infoBox('Tasks verified / rejected', esc(`${d.tasksVerified ?? '—'} / ${d.tasksRejected ?? '—'}`)) +
    infoBox('Expected revenue booked', esc(d.revenueBooked ?? '—')) +
    infoBox('Briefs received / classified', esc(`${d.briefsIn ?? '—'} / ${d.briefsClassified ?? '—'}`)) +
    (d.auditHighlights ? infoBox('🔎 Audit log highlights', esc(d.auditHighlights)) : '') +
    impactStrip(
      `This is the owner&rsquo;s view — the same numbers, no filter, every Monday.`,
      `Platforms drift when nobody watches the totals.`,
      `Ten minutes of reading replaces an hour of asking around.`
    ) +
    cta('Open global analytics →', `${APP}/dashboard`, C.red),
    `Platform weekly digest`),
});

// 24 · Sensitive action alert — security
T.sensitive_action = (d) => ({
  category: 'critical', tone: 'urgency',
  subject: `🔐 Sensitive action on Sabi: ${d.actionLabel}`,
  preheader: `${d.actorName} · ${d.when}. If this was expected, ignore. If not, act now.`,
  html: base(C.red, '🔐', 'Sensitive action recorded', 'Security notice',
    greeting(d.name) +
    p(`The audit log just recorded a sensitive action:`) +
    infoBox('Action', esc(d.actionLabel)) +
    infoBox('Performed by', esc(d.actorName)) +
    infoBox('When', esc(d.when)) +
    (d.details ? infoBox('Details', esc(d.details)) : '') +
    p(`If you expected this, no action is needed. If you did not, review the audit log and the account involved immediately.`, true) +
    impactStrip(
      `Deletions, weight changes and admin creation reshape the platform — the owner should always know same-day.`,
      `Unnoticed sensitive actions are how small problems become forensic investigations.`,
      `A platform where power is always accountable — because someone is always watching.`
    ) +
    cta('Open the audit log →', `${APP}/audit-log`, C.red),
    `Sensitive action: ${d.actionLabel}`,
    `Security notices bypass email preferences by design.`),
});

/* ───────────────────────── CLIENT ──────────────────────────── */

// 25 · Report published — inspirational
T.client_report_published = (d) => ({
  category: 'digests', tone: 'inspirational',
  subject: `📊 Your new ${d.brandName} intelligence report is ready`,
  preheader: `Written by ARIA from verified work and real platform data. Plain English, real numbers.`,
  html: base(C.green, '📊', 'Your report is ready', esc(d.brandName),
    greeting(d.name) +
    p(`A new intelligence report for <strong>${esc(d.brandName)}</strong> has been published to your portal. It was written by ARIA from your brand&rsquo;s verified work and live platform data — no fluff, no vanity metrics, just what moved and why.`) +
    (d.periodLabel ? infoBox('Covering', esc(d.periodLabel)) : '') +
    steps('Get the value in 5 minutes', [
      `Start with the executive summary — the whole story in one screen.`,
      `Check the &ldquo;what worked vs what didn&rsquo;t&rdquo; section — it&rsquo;s deliberately honest.`,
      `Questions? Ask ARIA directly from the portal — it wrote the report; it can defend it.`,
    ]) +
    impactStrip(
      `You should never need a meeting to know if your investment is working.`,
      `Unread reports mean decisions made on feelings while the data sits waiting.`,
      `Board-ready answers about your marketing, already written, whenever you need them.`
    ) +
    cta('Read my report →', `${APP}/client/reports`, C.green),
    `New report for ${d.brandName}`),
});

// 26 · Weekly satisfaction prompt — emotional
T.client_satisfaction_prompt = (d) => ({
  category: 'digests', tone: 'emotional',
  subject: `💬 One tap: how did we do for ${d.brandName} this week?`,
  preheader: `Your answer literally shapes how our team is scored. 10 seconds, real power.`,
  html: base(C.green, '💬', 'Your weekly say', esc(d.brandName),
    greeting(d.name) +
    p(`Every week, one question: <strong>how was our service?</strong> Here&rsquo;s the honest truth about your answer — it is the <em>anchor metric</em> of our internal scoring. Your one tap outweighs everything our team says about itself. That&rsquo;s by design: nothing self-reported counts at Cerebre.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;"><tr>
      <td align="center" style="padding:4px;"><a href="${APP}/client/dashboard?rate=5" style="display:block;background:#e6f5ef;border:1px solid #059669;border-radius:10px;padding:12px;color:#047857;font-weight:800;text-decoration:none;">😊 Great</a></td>
      <td align="center" style="padding:4px;"><a href="${APP}/client/dashboard?rate=3" style="display:block;background:#f2f0f9;border:1px solid #8a83a3;border-radius:10px;padding:12px;color:#4b4560;font-weight:800;text-decoration:none;">😐 Okay</a></td>
      <td align="center" style="padding:4px;"><a href="${APP}/client/dashboard?rate=1" style="display:block;background:#fdecec;border:1px solid #b91c1c;border-radius:10px;padding:12px;color:#b91c1c;font-weight:800;text-decoration:none;">☹️ Poor</a></td>
    </tr></table>` +
    impactStrip(
      `Your rating is the largest single component of how every person on your account is evaluated.`,
      `Skip it and your voice goes quiet in the room where your brand is discussed.`,
      `A team that adjusts to <em>your</em> standard, week by week — because you keep setting it.`
    ),
    `Rate this week's service in one tap`,
    `Honest answers help most — including the uncomfortable ones. We built the system to hear them.`),
});

// 27 · Brief received confirmation — reassuring
T.client_brief_confirmed = (d) => ({
  category: 'briefs', tone: 'informational',
  subject: `✅ We received your brief: "${d.briefTitle}"`,
  preheader: `Logged, analysed by ARIA, and already in front of leadership.`,
  html: base(C.green, '✅', 'Brief received — we&rsquo;re on it', esc(d.brandName),
    greeting(d.name) +
    p(`Your brief <strong>&ldquo;${esc(d.briefTitle)}&rdquo;</strong> is in. Here&rsquo;s what happened the second you clicked submit: our leadership team was notified, and ARIA — our AI engine — read your brief and extracted the key insights so nothing you wrote gets missed.`) +
    steps('What happens next', [
      `Leadership classifies your brief and assigns an owner.`,
      `If it needs a strategy, one is drafted and shared for your review.`,
      `You can track its live status anytime under <strong>Briefs</strong> in your portal.`,
    ]) +
    impactStrip(
      `Briefs in Sabi cannot get lost — each one is a tracked piece of work with an owner and a status.`,
      `Nothing — you did your part. This one is on us now.`,
      `A written trail, a visible status, and a faster turnaround than any WhatsApp message ever got you.`
    ) +
    cta('Track my brief →', `${APP}/client/briefs`, C.green),
    `Brief received: ${d.briefTitle}`),
});

// 28 · Brief status update — informational
T.client_brief_status = (d) => ({
  category: 'briefs', tone: 'informational',
  subject: `🔄 Update on "${d.briefTitle}": ${d.statusLabel}`,
  preheader: `Your brief just moved forward.`,
  html: base(C.green, '🔄', 'Your brief moved forward', esc(d.brandName),
    greeting(d.name) +
    p(`Status update on <strong>&ldquo;${esc(d.briefTitle)}&rdquo;</strong>:`) +
    infoBox('New status', esc(d.statusLabel)) +
    (d.note ? infoBox('Note from the team', esc(d.note)) : '') +
    impactStrip(
      `Transparency is the deal: you should always know exactly where your request stands.`,
      `Nothing to do unless the note above asks — this is us keeping you in the loop.`,
      `Zero &ldquo;any update?&rdquo; messages needed. The update finds you.`
    ) +
    cta('View the details →', `${APP}/client/briefs`, C.green),
    `Brief update: ${d.statusLabel}`),
});

// 29 · Goal achieved — celebration
T.client_goal_achieved = (d) => ({
  category: 'celebrations', tone: 'celebration',
  subject: `🎯 Goal achieved: ${d.goalTitle} (${d.brandName})`,
  preheader: `Target set. Target hit. The receipts are in your portal.`,
  html: base(C.green, '🎯', 'You hit the target', esc(d.brandName),
    greeting(d.name) +
    p(`It&rsquo;s official: <strong>&ldquo;${esc(d.goalTitle)}&rdquo;</strong> has been <strong>achieved</strong>. This wasn&rsquo;t luck — the Proof of Value trail in your portal shows exactly which work moved which metrics to get here.`) +
    impactStrip(
      `Achieved goals are the clearest possible answer to &ldquo;is my investment working?&rdquo;`,
      `Nothing — except perhaps not celebrating it internally. Forward this email. 😄`,
      `A documented win for your next board meeting, and momentum for the next, bigger target.`
    ) +
    cta('See the proof →', `${APP}/client/value`, C.green),
    `Goal achieved on ${d.brandName}`,
    `No action needed. This is what paying for results looks like. 🥂`),
});

// 30 · Goal at risk — honest urgency
T.client_goal_at_risk = (d) => ({
  category: 'digests', tone: 'urgency',
  subject: `⚠️ Straight talk: "${d.goalTitle}" is at risk`,
  preheader: `We flag problems early — that's the deal. Here's the situation and the plan.`,
  html: base(C.green, '⚠️', 'A goal needs attention', esc(d.brandName),
    greeting(d.name) +
    p(`We promised you honesty over comfort, so here it is early: <strong>&ldquo;${esc(d.goalTitle)}&rdquo;</strong> has moved to <strong>at risk</strong>. VelocityTracker shows the current pace won&rsquo;t reach the target in time — and we&rsquo;d rather tell you now, when it&rsquo;s fixable, than explain it later.`) +
    steps('What we suggest', [
      `Open the goal in your portal and see the trend for yourself.`,
      `Ask ARIA &ldquo;why is this goal at risk?&rdquo; for the data behind it.`,
      `Reply to your account lead — a 15-minute call now beats a post-mortem later.`,
    ]) +
    impactStrip(
      `Early warnings are the whole point of an intelligence platform — this is Sabi doing its job.`,
      `At-risk goals ignored for weeks become missed goals explained in apologetic meetings.`,
      `Time. The one resource a course-correction actually needs — and you just got more of it.`
    ) +
    cta('Open the goal →', `${APP}/client/goals`, C.green),
    `Goal at risk: ${d.goalTitle}`),
});

// 31 · MomentMap upcoming — opportunity + humour
T.client_moment_upcoming = (d) => ({
  category: 'digests', tone: 'humour',
  subject: `🗓️ ${d.momentName} is coming — shall we own it?`,
  preheader: `A cultural moment your brand could ride. Brands that plan early win the timeline.`,
  html: base(C.green, '🗓️', 'A moment is approaching', esc(d.brandName),
    greeting(d.name) +
    p(`MomentMap has spotted something on the horizon: <strong>${esc(d.momentName)}</strong>${d.momentDate ? ` on <strong>${esc(d.momentDate)}</strong>` : ''}. Cultural moments are like Lagos traffic — you either plan for them or you sit in them watching others move. 😄`) +
    steps('Ride it, don&rsquo;t chase it', [
      `Open MomentMap in your portal and see the full calendar.`,
      `Like this one? Submit a quick brief — one line is enough to start.`,
      `We&rsquo;ll bring the concepts; you bring the yes.`,
    ]) +
    impactStrip(
      `Content that lands <em>inside</em> a cultural moment earns multiples of normal engagement.`,
      `The moment passes either way — the only question is whether your brand was in the conversation.`,
      `Relevance. The cheapest reach money can buy is a well-timed idea.`
    ) +
    cta('Open MomentMap →', `${APP}/client/moments`, C.green),
    `Upcoming: ${d.momentName}`),
});

// 32 · Invoice payment reminder — polite consequential
T.client_invoice_reminder = (d) => ({
  category: 'financial', tone: 'consequential',
  subject: `🧾 Invoice ${d.invoiceRef} for ${d.brandName} — ${d.daysUntilDue <= 0 ? 'now due' : `due in ${d.daysUntilDue} day(s)`}`,
  preheader: `A friendly nudge from the accounts side of the house.`,
  html: base(C.green, '🧾', d.daysUntilDue <= 0 ? 'An invoice is due' : 'An invoice is coming due', esc(d.brandName),
    greeting(d.name) +
    p(`A quick note from our accounts team: invoice <strong>${esc(d.invoiceRef)}</strong>${d.amount ? ` for <strong>${esc(d.amount)}</strong>` : ''} is ${d.daysUntilDue <= 0 ? '<strong>now due</strong>' : `due in <strong>${d.daysUntilDue} day(s)</strong>`}.`) +
    (d.description ? infoBox('For', esc(d.description)) : '') +
    impactStrip(
      `Settled invoices keep your campaigns funded and your team fully allocated to your brand.`,
      `Overdue invoices eventually force the least fun conversation in agency life — let&rsquo;s never have it.`,
      `Uninterrupted momentum, and an accounts team that only ever emails you good news.`
    ) +
    cta('View invoice details →', `${APP}/client/dashboard`, C.green),
    `Invoice ${d.invoiceRef} reminder`,
    `Already paid? Wonderful — please ignore this and accept our thanks. Payments can take a day to reflect.`),
});

/* ─────────────── COMMAND CENTER (D6 addition) ──────────────── */

// 33 · Brand turned At Risk — urgency + consequential (critical, unmutable)
T.brand_status_changed = (d) => ({
  category: 'critical', tone: 'urgency+consequential',
  subject: `🔴 ${d.brandName} just turned At Risk on the Command Center`,
  preheader: `${(d.reasons || []).slice(0, 2).join(' · ')} — the two-click fix path is inside.`,
  html: base(C.red, '🛰️', 'A brand crossed the line', esc(d.brandName),
    greeting(d.name) +
    p(`The Command Center rule engine just moved <strong>${esc(d.brandName)}</strong> from <strong>${esc(d.prevStatus === 'watch' ? 'Watch' : 'Healthy')}</strong> to <strong style="color:${C.red};">At Risk</strong>. This is not a prediction — every reason below is a real record already breaching a standard the agency agreed on:`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${C.line};border-radius:12px;">
      ${(d.reasons || []).map(r => `<tr><td style="padding:11px 16px;border-bottom:1px solid ${C.line};font-size:13.5px;color:${C.ink};"><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${C.red};margin-right:9px;"></span><strong>${esc(r)}</strong></td></tr>`).join('')}
      ${d.reasonCount > (d.reasons || []).length ? `<tr><td style="padding:9px 16px;font-size:12.5px;color:${C.soft};">+ ${d.reasonCount - d.reasons.length} more on the Command Center</td></tr>` : ''}
    </table>` +
    steps('The two-click fix path', [
      `Open the <strong>Command Center</strong> — ${esc(d.brandName)} is now at the top of the list.`,
      `Expand the row: every red chip links straight to the offending record (the task, the brief, the invoice).`,
      `Fix the underlying records — the moment they clear, the brand recovers automatically. No one flips this switch manually.`,
    ]) +
    impactStrip(
      `At Risk means a client relationship is actively degrading on at least one agreed standard — money, work, or trust.`,
      `You will not receive this email again for this episode. The daily task/brief/invoice reminders continue, but this is the one flare for the whole fire.`,
      `Handled today, this becomes a line in Monday&rsquo;s digest under recoveries — the kind of line clients never see and never needed to.`
    ) +
    cta('Open the Command Center →', `${APP}/command`, C.red),
    `${d.brandName} is now At Risk`,
    `Status alerts are critical notifications and bypass email preferences by design. Recovery is automatic once the underlying records clear.`),
});

/* ═══════════════════ PEOPLE OS (D1–D7) ═══════════════════════ */

// 34 · Profile draft ready — celebration + humour
T.profile_draft_ready = (d) => ({
  category: 'people', tone: 'celebration+humour',
  subject: `✨ ${d.name}, your Sabi profile is already written. Yes, really.`,
  preheader: `We drafted it so you don't stare at a blank page. Two minutes to make it yours.`,
  html: base(C.purple, '✨', 'Your profile draft is ready', 'Written for you, waiting on you',
    greeting(d.name) +
    p(`Welcome to Cerebre! While you were finding the kitchen, ARIA wrote the first draft of your team profile — bio, skills, the works — built from what HR told us about your role as <strong>${esc(d.roleTitle)}</strong>. Blank pages are for other agencies.`) +
    steps('Make it yours in 2 minutes', [
      `Open <strong>My Profile</strong> and read the draft — fix anything we got wrong.`,
      `Add your photo (the one where you look like you mean business).`,
      `Hit <strong>Publish</strong> — nothing goes live until you do. Your facts (role, title, start date) stay synced from HR automatically.`,
    ]) +
    impactStrip(
      `Your profile is how clients and teammates meet you before they meet you — it lives on the client Team pages for your brands.`,
      `Unpublished, there&rsquo;s an empty seat with your name on it. The reminders start friendly and get less so. 😅`,
      `A polished professional presence on day one, zero writing required — and the &ldquo;What&rsquo;s Expected of Me&rdquo; card so you always know your lane.`
    ) +
    cta('Review my draft →', `${APP}/my-profile`, C.purple),
    `Your profile draft is ready to claim`),
});

// 35 · Profile reminder ladder (D5: nag, never publish)
T.profile_reminder = (d) => {
  const lvl = d.level || 1;
  const copy = {
    1: { subject: `👀 Your profile draft misses you (day ${d.daysWaiting})`,
         open: `Your profile has been sitting in draft for <strong>${d.daysWaiting} days</strong>. It&rsquo;s written. It just needs your eyes, your photo, and one click. The kettle takes longer.` },
    2: { subject: `⏰ Day ${d.daysWaiting}: clients see an empty seat where your face should be`,
         open: `Real talk: your brands&rsquo; client Team pages are live, and your slot is blank. Every day unpublished is a day the client meets everyone on the team except you.` },
    3: { subject: `🚨 Day ${d.daysWaiting}: your Brand Admin has been copied on this`,
         open: `Two weeks in draft. We never auto-publish — your profile is yours — but your Brand Admin now knows it&rsquo;s the last open item on your onboarding checklist. Five minutes ends this email thread forever.` },
  }[Math.min(lvl, 3)];
  return {
    category: lvl >= 3 ? 'disciplinary' : 'people',
    tone: lvl === 1 ? 'humour' : lvl === 2 ? 'urgency' : 'consequential',
    subject: copy.subject,
    preheader: `Review, personalize, publish — we never publish for you.`,
    html: base(lvl >= 3 ? C.red : C.purple, '📇', 'Your profile is still in draft', `Day ${d.daysWaiting}`,
      ribbon(lvl, `${d.daysWaiting} days unpublished.`) +
      greeting(d.name) + p(copy.open) +
      impactStrip(
        `A published profile completes your onboarding and puts your face next to your verified work.`,
        `It stays the one unchecked box on your onboarding — visible to HR and your Brand Admin.`,
        `Publishing takes this off everyone&rsquo;s list, including yours — and the draft is already 90% done.`
      ) +
      cta('Publish my profile →', `${APP}/my-profile`, lvl >= 3 ? C.red : C.purple),
      `Profile still in draft — day ${d.daysWaiting}`,
      lvl >= 3 ? `We will never publish on your behalf — but the checklist stays open until you do.` : undefined),
  };
};

// 36 · Role updated — celebration / informational
T.role_updated = (d) => ({
  category: 'people', tone: 'celebration',
  subject: `🎊 It's official: you're now ${d.newTitle}`,
  preheader: `HR updated your record — everything synced automatically.`,
  html: base(C.gold, '🎊', 'Your role just changed', `${esc(d.prevTitle || 'Previous role')} → ${esc(d.newTitle)}`,
    greeting(d.name) +
    p(`HR has updated your record: you are now <strong>${esc(d.newTitle)}</strong>. Sabi synced everything in one pass — your profile, your &ldquo;What&rsquo;s Expected of Me&rdquo; core functions, and the client Team pages for your brands. Nothing for you to edit.`) +
    steps('Worth two minutes', [
      `Open your profile — check the new title reads right to a client.`,
      `Read your updated core functions — your score is measured against the new lane starting now.`,
    ]) +
    impactStrip(
      `Your core functions define what counts as your job vs a contribution claim — they just changed with your role.`,
      `Nothing — this is good news with homework attached.`,
      `A title that&rsquo;s true everywhere at once, and clear expectations from day one in the new seat.`
    ) +
    cta('See my updated profile →', `${APP}/my-profile`, C.gold),
    `Role updated to ${d.newTitle}`),
});

// 37 · Leave request — to approvers
T.leave_request = (d) => ({
  category: 'people', tone: 'informational',
  subject: `🌴 Leave request: ${d.staffName} · ${d.startDate} → ${d.endDate}`,
  preheader: `${d.leaveType} leave awaiting your decision.`,
  html: base(C.indigo, '🌴', 'A leave request needs a decision', esc(d.staffName),
    greeting(d.name) +
    p(`<strong>${esc(d.staffName)}</strong> has requested <strong>${esc(d.leaveType)}</strong> leave from <strong>${esc(d.startDate)}</strong> to <strong>${esc(d.endDate)}</strong>.`) +
    (d.note ? infoBox('Their note', esc(d.note)) : '') +
    impactStrip(
      `Approved leave is automatically excluded from their scoring weeks — the fairness rules need your decision to activate.`,
      `Undecided requests leave the person planning life in limbo — and unapproved absence looks like missed work to the scoring engine.`,
      `A team that requests properly because requests get answered fast.`
    ) +
    cta('Decide in People OS →', `${APP}/people?tab=leave`, C.indigo),
    `Leave request from ${d.staffName}`),
});

// 38 · Leave decision — to the requester
T.leave_decision = (d) => ({
  category: 'people', tone: d.approved ? 'celebration' : 'informational',
  subject: d.approved
    ? `✅ Leave approved: ${d.startDate} → ${d.endDate}. Log off properly.`
    : `↩️ About your leave request (${d.startDate} → ${d.endDate})`,
  preheader: d.approved ? `Approved by ${d.approverName}. Scoring exclusion is automatic.` : `Decision from ${d.approverName} inside.`,
  html: base(d.approved ? C.green : C.indigo, d.approved ? '🏖️' : '📋',
    d.approved ? 'Your leave is approved' : 'Your leave request was declined', esc(d.leaveType + ' leave'),
    greeting(d.name) +
    (d.approved
      ? p(`<strong>${esc(d.approverName)}</strong> approved your ${esc(d.leaveType)} leave from <strong>${esc(d.startDate)}</strong> to <strong>${esc(d.endDate)}</strong>. Sabi has already excluded those weeks from your scoring — rest without the math anxiety.`)
      : p(`<strong>${esc(d.approverName)}</strong> couldn&rsquo;t approve this one. The reason is below — talk to them directly if timing can flex.`) +
        infoBox('Reason', esc(d.decisionNote || 'See your approver'))) +
    impactStrip(
      d.approved ? `Leave weeks are fully excluded from your 4-week rolling average — by design.` : `Declined requests cost you nothing on your score.`,
      d.approved ? `Just one thing: hand over open tasks before you go — verified beats &ldquo;almost done&rdquo;.` : `Nothing — resubmit with new dates anytime.`,
      d.approved ? `Actual rest. The system holds your place.` : `A clear reason and a fast path to a better slot.`
    ) +
    cta(d.approved ? 'View my leave →' : 'Request new dates →', `${APP}/my-profile`, d.approved ? C.green : C.indigo),
    d.approved ? `Leave approved` : `Leave request declined`),
});

// 39 · Probation ending — consequential, to HR (+BA CC)
T.probation_ending = (d) => ({
  category: 'people', tone: 'consequential',
  subject: `⏳ ${d.personName}'s probation ends in 7 days — decide deliberately`,
  preheader: `${d.roleTitle} · ends ${d.probationEnd}. Silence is also a decision — make a real one.`,
  html: base(C.amber, '⏳', 'A probation decision is due', esc(d.personName),
    greeting(d.name) +
    p(`<strong>${esc(d.personName)}</strong> (${esc(d.roleTitle)}) completes probation on <strong>${esc(d.probationEnd)}</strong>. In seven days they either become a confirmed part of this team or they don&rsquo;t — and the worst outcome is the one that happens by nobody deciding.`) +
    steps('The deliberate version', [
      `Open their Person File — rolling score, low-rating notes, recognition, all in one place.`,
      `Talk to their Brand Admin (copied on this email) for the ground truth.`,
      `Confirm, extend, or exit — and record it in the Person File either way.`,
    ]) +
    impactStrip(
      `Probation is the one moment the exit door is cheap and expectations are explicit.`,
      `Let it lapse and you&rsquo;ve confirmed by default — including any doubts you never wrote down.`,
      `Either a confirmed teammate who knows they earned it, or a clean early decision everyone respects.`
    ) +
    cta('Open their Person File →', `${APP}/people`, C.amber),
    `Probation decision due for ${d.personName}`),
});

// 40 · Document expiring — urgency, to HR
T.document_expiring = (d) => ({
  category: 'people', tone: 'urgency',
  subject: d.daysLeft <= 0
    ? `🔴 EXPIRED: ${d.personName}'s ${d.docLabel}`
    : `📁 ${d.daysLeft} days: ${d.personName}'s ${d.docLabel} expires`,
  preheader: `Document vault alert — renew before it becomes a compliance scramble.`,
  html: base(d.daysLeft <= 7 ? C.red : C.amber, '📁', 'A document is expiring', esc(d.personName),
    ribbon(d.level || 1, d.daysLeft <= 0 ? 'Already expired.' : `${d.daysLeft} days remaining.`) +
    greeting(d.name) +
    p(`<strong>${esc(d.personName)}</strong>&rsquo;s <strong>${esc(d.docLabel)}</strong> (${esc(d.docType)}) ${d.daysLeft <= 0 ? 'has <strong>expired</strong>' : `expires in <strong>${d.daysLeft} days</strong>`}.`) +
    impactStrip(
      `Contracts, IDs and certifications are the paperwork that lets everything else be legal.`,
      `Expired documents surface at the worst moments — client audits, disputes, visa runs.`,
      `A vault that renews on calendar time instead of crisis time.`
    ) +
    cta('Open the vault →', `${APP}/people?tab=documents`, d.daysLeft <= 7 ? C.red : C.amber),
    `${d.docLabel} expiring for ${d.personName}`),
});

// 41 · Work anniversary — celebration (D6)
T.work_anniversary = (d) => ({
  category: 'celebrations', tone: 'celebration',
  subject: `🎉 ${d.years} year${d.years > 1 ? 's' : ''} at Cerebre today, ${d.name}!`,
  preheader: `Happy work anniversary — the receipts of your impact are all in Sabi.`,
  html: base(C.gold, '🎉', `Happy ${d.years}-year anniversary!`, 'Cerebre Media Africa',
    greeting(d.name) +
    p(`<strong>${d.years} year${d.years > 1 ? 's' : ''} ago today</strong>, you joined this team. Since then: verified work with your name on it, clients who know your face from the Team page, and a score history that tells the real story. Thank you for building this with us. 🥂`) +
    impactStrip(
      `Tenure is the quiet metric — everything compounds on people who stay.`,
      `Nothing. Today is yours.`,
      `Our gratitude, publicly logged. Screenshot this one too.`
    ) +
    cta('See my journey →', `${APP}/my-profile`, C.gold),
    `Happy work anniversary!`,
    `No action needed. Just history, acknowledged. 🎊`),
});

// 42 · Birthday — celebration (D6: day only, never age)
T.birthday = (d) => ({
  category: 'celebrations', tone: 'celebration',
  subject: `🎂 Happy birthday, ${d.name}!`,
  preheader: `From everyone at Cerebre Media Africa.`,
  html: base(C.gold, '🎂', `Happy birthday, ${esc(d.name)}!`, 'From all of us at Cerebre',
    greeting(d.name) +
    p(`It&rsquo;s your day. The tasks will wait, the briefs will wait, even ARIA will wait. Have something sweet, take the long lunch, and accept the team&rsquo;s terrible singing with grace. 🎈`) +
    impactStrip(
      `Teams that celebrate people build the kind of culture clients can feel.`,
      `Only risk today: cake-related productivity loss. Acceptable.`,
      `A very good day. That&rsquo;s the whole feature.`
    ),
    `Happy birthday from Cerebre!`,
    `No CTA today. Go enjoy it. 🎉`),
});

// 43 · Offboarding started — critical, to leadership + HR
T.offboarding_started = (d) => ({
  category: 'critical', tone: 'informational',
  subject: `📤 Offboarding started: ${d.personName} (${d.roleTitle})`,
  preheader: `Access revoked, profile unpublished, ${d.openTasks} open task(s) flagged for reassignment.`,
  html: base(C.red, '📤', 'An offboarding has begun', esc(d.personName),
    greeting(d.name) +
    p(`HR has started offboarding for <strong>${esc(d.personName)}</strong> (${esc(d.roleTitle)}). The kill switch ran the full checklist automatically:`) +
    infoBox('Completed automatically', 'Account deactivated · profile removed from client Team pages · brand assignments released · exit recorded') +
    infoBox('Needs a human', `${d.openTasks} open task(s) unassigned — Brand Admins should reassign them this week`) +
    impactStrip(
      `A departed teammate still visible to clients or still holding access is both a security hole and a trust wobble — the switch closes both instantly.`,
      `Unreassigned tasks drift toward their due dates ownerless — the overdue sweeps will start flagging them.`,
      `A clean exit: history preserved (verified work, scores, recognition), access gone, clients undisturbed.`
    ) +
    cta('Review in People OS →', `${APP}/people`, C.red),
    `Offboarding: ${d.personName}`,
    `Offboarding notices are critical and bypass email preferences by design.`),
});

module.exports = { T, base, C };
