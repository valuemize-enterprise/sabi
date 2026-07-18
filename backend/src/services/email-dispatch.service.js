/**
 * ═══════════════════════════════════════════════════════════════
 * Email Dispatch Service — Sabi Intelligence Suite
 * ═══════════════════════════════════════════════════════════════
 * The ONE door every notification email leaves through.
 *
 * Responsibilities:
 *   1. Render the template (email-templates.js)
 *   2. Enforce the dedupe contract via email_log.dedupe_key
 *      → this is what makes "nag until done" possible WITHOUT spam
 *   3. Respect email_preferences (except critical/disciplinary)
 *   4. CC leadership on level-3 (disciplinary) escalations
 *   5. Log every send / skip / failure
 *
 * Usage:
 *   const dispatch = require('./email-dispatch.service');
 *   await dispatch.send('task_assigned', {
 *     to: { id: user.id, email: user.email },
 *     data: { name: user.full_name, taskTitle, brandName, ... },
 *     entityId: task.id,                       // for dedupe
 *     dedupe: 'once',                          // once | level | daily | weekly | always
 *     level: 1,                                // escalation level
 *     cc: ['brandadmin@cerebre.media'],        // optional
 *   });
 */

'use strict';

const { Resend } = require('resend');
const supabase = require('../config/supabase');
const { T } = require('./email-templates');

const resend   = new Resend(process.env.RESEND_API_KEY);
const FROM     = process.env.EMAIL_REPLY_TO     || 'Sabi Intelligence <noreply@cerebre.media>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'hello@cerebre.media';
const ENABLED  = process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'false';

// Categories that can never be muted by user preferences
const UNMUTABLE = new Set(['critical', 'disciplinary']);

// Lagos-local date helpers (all recurrence keys use Africa/Lagos)
const lagosNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
const dayKey  = () => lagosNow().toISOString().slice(0, 10);            // YYYY-MM-DD
const weekKey = () => {
  const d = lagosNow();
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `W${monday.toISOString().slice(0, 10)}`;                        // week-of-Monday
};

function buildDedupeKey(type, { dedupe = 'once', entityId, userId, level = 1 }) {
  switch (dedupe) {
    case 'level':  return `${type}:${entityId}:L${level}`;
    case 'daily':  return `${type}:${userId}:${dayKey()}`;
    case 'weekly': return `${type}:${userId}:${weekKey()}`;
    case 'always': return `${type}:${entityId || userId}:${Date.now()}`; // never dedupes
    case 'once':
    default:       return `${type}:${entityId || userId}`;
  }
}

async function prefEnabled(userId, category) {
  if (!userId || UNMUTABLE.has(category)) return true;
  const { data } = await supabase
    .from('email_preferences')
    .select('enabled')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle();
  return data ? data.enabled : true; // default: on
}

async function send(type, opts) {
  const builder = T[type];
  if (!builder) throw new Error(`Unknown email template: ${type}`);
  const { to, data = {}, entityId = null, dedupe = 'once', level = 1, cc = [] } = opts;
  if (!to?.email) return { success: false, skipped: 'no_recipient' };

  const tpl = builder({ ...data, level });
  const category = level >= 3 ? 'disciplinary' : tpl.category;
  const dedupeKey = buildDedupeKey(type, { dedupe, entityId, userId: to.id, level });

  if (!ENABLED) return { success: true, skipped: 'globally_disabled' };

  // Preference check
  if (!(await prefEnabled(to.id, category))) {
    await logRow({ to, type, entityId, level, dedupeKey: `${dedupeKey}:pref`, subject: tpl.subject, status: 'skipped' });
    return { success: true, skipped: 'preference' };
  }

  // Dedupe: insert first — the unique index is the lock. If it exists, skip.
  const { error: insErr } = await supabase.from('email_log').insert({
    user_id: to.id || null, email_address: to.email, email_type: type,
    entity_id: entityId, level, dedupe_key: dedupeKey,
    subject: tpl.subject, status: 'sending',
    metadata: { tone: tpl.tone, cc },
  });
  if (insErr) {
    if (String(insErr.code) === '23505' || /duplicate/i.test(insErr.message || '')) {
      return { success: true, skipped: 'dedupe' };   // already sent — the whole point
    }
    console.error('[email] log insert failed:', insErr.message);
  }

  // Send via Resend
  try {
    const payload = {
      from: FROM, to: [to.email], reply_to: REPLY_TO,
      subject: tpl.subject, html: tpl.html,
    };
    if (cc.length) payload.cc = cc;
    const { data: sent, error } = await resend.emails.send(payload);
    if (error) throw new Error(error.message);
    await supabase.from('email_log')
      .update({ status: 'sent', resend_id: sent?.id || null })
      .eq('dedupe_key', dedupeKey);
    return { success: true, id: sent?.id };
  } catch (err) {
    console.error(`[email] send failed (${type} → ${to.email}):`, err.message);
    await supabase.from('email_log')
      .update({ status: 'failed', metadata: { error: err.message } })
      .eq('dedupe_key', dedupeKey);
    return { success: false, error: err.message };
  }
}

async function logRow({ to, type, entityId, level, dedupeKey, subject, status }) {
  await supabase.from('email_log').insert({
    user_id: to.id || null, email_address: to.email, email_type: type,
    entity_id: entityId, level, dedupe_key: dedupeKey, subject, status,
  }).then(() => {}, () => {}); // best-effort
}

/** Fan out one template to many recipients (e.g. all admins). */
async function sendToMany(type, recipients, common) {
  const results = [];
  for (const r of recipients) {
    results.push(await send(type, {
      ...common,
      to: { id: r.id, email: r.email },
      data: { ...common.data, name: r.full_name || r.name },
    }));
  }
  return results;
}

module.exports = { send, sendToMany };
