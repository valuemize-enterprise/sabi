/**
 * People OS timed sweeps — plugs into the existing notification
 * sweeper (one line in the sweeps array, see docs/PATCHES.md).
 * Idempotent via the dispatcher's dedupe contract, like everything else.
 *
 *   every run  → profile_reminder ladder (day 3 L1 / 7 L2 / 14 L3+CC BA)  [D5]
 *   daily 8am  → probation_ending (7 days out), document_expiring (30d/7d),
 *                work_anniversary + birthday (D6 — day+month only)
 */

'use strict';

const supabase = require('../config/supabase');
const dispatch = require('./email-dispatch.service');

const lagos = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
const hourIs = (h) => lagos().getHours() === h;
const daysBetween = (a, b) => Math.floor((b - a) / 86400000);

async function brandAdminEmailsFor(userId) {
  const { data: myBrands } = await supabase.from('staff_brand_assignments')
    .select('brand_id').eq('staff_id', userId);
  if (!myBrands?.length) return [];
  const { data: bas } = await supabase.from('staff_brand_assignments')
    .select('users!staff_id(email)').contains('roles_on_brand', ['brand_admin'])
    .in('brand_id', myBrands.map(b => b.brand_id));
  return [...new Set((bas || []).map(r => r.users?.email).filter(Boolean))];
}

// ── 1 · profile claim ladder (every run) — D5: nag, never publish
async function sweepProfileReminders(stats) {
  const now = lagos();
  const { data: drafts } = await supabase.from('staff_profiles')
    .select('user_id, generated_at').eq('state', 'draft')
    .not('generated_at', 'is', null);

  for (const d of drafts || []) {
    const days = daysBetween(new Date(d.generated_at), now);
    if (days < 3) continue;
    const level = days >= 14 ? 3 : days >= 7 ? 2 : 1;
    const { data: u } = await supabase.from('users')
      .select('id, email, full_name, is_active').eq('id', d.user_id).single();
    if (!u?.is_active) continue;
    const cc = level === 3 ? await brandAdminEmailsFor(d.user_id) : [];
    stats.push(await dispatch.send('profile_reminder', {
      to: u, entityId: d.user_id, dedupe: 'level', level, cc,
      data: { name: u.full_name?.split(' ')[0], daysWaiting: days, level },
    }));
  }
}

// ── 2 · probation ending in 7 days (daily 8am) → HR + Brand Admins
async function sweepProbation(stats) {
  if (!hourIs(8)) return;
  const now = lagos();
  const { data: records } = await supabase.from('people_records')
    .select('user_id, display_name, role_title, probation_end')
    .not('probation_end', 'is', null).neq('status', 'exited');

  const ending = (records || []).filter(r =>
    daysBetween(now, new Date(r.probation_end)) === 7);
  if (!ending.length) return;

  const { data: hr } = await supabase.from('users')
    .select('id, email, full_name').in('role', ['hr', 'super_admin']).eq('is_active', true);

  for (const r of ending) {
    const baEmails = await brandAdminEmailsFor(r.user_id);
    stats.push(...await dispatch.sendToMany('probation_ending', hr || [], {
      entityId: r.user_id, dedupe: 'once', cc: baEmails,
      data: { personName: r.display_name, roleTitle: r.role_title,
              probationEnd: r.probation_end },
    }));
  }
}

// ── 3 · document expiry: 30d L1, 7d L2 (daily 8am) → HR
async function sweepDocuments(stats) {
  if (!hourIs(8)) return;
  const now = lagos();
  const { data: docs } = await supabase.from('people_documents')
    .select('id, user_id, label, doc_type, expiry_date')
    .not('expiry_date', 'is', null);
  const { data: hr } = await supabase.from('users')
    .select('id, email, full_name').in('role', ['hr', 'super_admin']).eq('is_active', true);

  for (const d of docs || []) {
    const days = daysBetween(now, new Date(d.expiry_date));
    if (days !== 30 && days !== 7 && days !== 0) continue;
    const level = days <= 7 ? 2 : 1;
    const { data: person } = await supabase.from('people_records')
      .select('display_name').eq('user_id', d.user_id).single();
    stats.push(...await dispatch.sendToMany('document_expiring', hr || [], {
      entityId: d.id, dedupe: 'level', level,
      data: { personName: person?.display_name || 'a team member',
              docLabel: d.label, docType: d.doc_type,
              daysLeft: Math.max(days, 0), level },
    }));
  }
}

// ── 4 · anniversaries + birthdays (daily 8am, once/yr) — D6
async function sweepCelebrations(stats) {
  if (!hourIs(8)) return;
  const now = lagos();
  const year = now.getFullYear();
  const sameDay = (d) => d && new Date(d).getMonth() === now.getMonth()
    && new Date(d).getDate() === now.getDate();

  const { data: records } = await supabase.from('people_records')
    .select('user_id, display_name, start_date, date_of_birth')
    .eq('status', 'active');

  for (const r of records || []) {
    const { data: u } = await supabase.from('users')
      .select('id, email, full_name, is_active').eq('id', r.user_id).single();
    if (!u?.is_active) continue;

    if (sameDay(r.start_date)) {
      const years = year - new Date(r.start_date).getFullYear();
      if (years >= 1) stats.push(await dispatch.send('work_anniversary', {
        to: u, entityId: `${r.user_id}:${year}`, dedupe: 'once', // once per person per year
        data: { name: r.display_name.split(' ')[0], years },
      }));
    }
    if (sameDay(r.date_of_birth)) {
      stats.push(await dispatch.send('birthday', {
        to: u, entityId: `${r.user_id}:${year}`, dedupe: 'once', // once per person per year
        data: { name: r.display_name.split(' ')[0] },
      }));
    }
  }
}

async function runPeopleSweeps(stats = []) {
  const sweeps = [
    ['profile_reminders', () => sweepProfileReminders(stats)],
    ['probation',         () => sweepProbation(stats)],
    ['documents',         () => sweepDocuments(stats)],
    ['celebrations',      () => sweepCelebrations(stats)],
  ];
  for (const [label, fn] of sweeps) {
    try { await fn(); }
    catch (err) { console.error(`[people-sweep:${label}]`, err.message); }
  }
  return stats;
}

module.exports = { runPeopleSweeps };
