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

// ── 2 · profile form nag (daily 9am) — form submission nag
async function sweepProfileFormNag(stats) {
  if (!hourIs(9)) return;
  const now = lagos();

  // Staff who have not submitted (state is 'not_started' or 'draft')
  const { data: records } = await supabase
    .from('people_records')
    .select(`
      user_id, display_name, start_date,
      form_submission_state,
      users:user_id ( email, full_name, is_active )
    `)
    .in('form_submission_state', ['not_started', 'draft'])
    .eq('status', 'active');

  for (const r of records || []) {
    const u = r.users;
    if (!u?.is_active || !u?.email) continue;

    const daysSince = daysBetween(new Date(r.start_date), now);
    if (daysSince < 7) continue; // grace period

    const level = daysSince >= 21 ? 3 : daysSince >= 14 ? 2 : 1;
    const firstName = u.full_name?.split(' ')[0] || 'there';

    // CC Brand Admin at level 2, MD at level 3
    let cc = [];
    if (level >= 2) {
      const { data: ba } = await supabase
        .from('brand_admins')
        .select('users:user_id ( email )')
        .eq('user_id_staff', r.user_id);  // ← adjust to your brand_admins join table name
      if (ba?.length) cc = ba.map(b => b.users?.email).filter(Boolean);
    }
    if (level >= 3) {
      const { data: md } = await supabase
        .from('users').select('email').eq('role', 'md').eq('is_active', true);
      if (md?.length) cc = [...cc, ...md.map(m => m.email).filter(Boolean)];
    }

    stats.push(await dispatch.send('profile_form_nag', {
      to: { email: u.email, full_name: u.full_name },
      entityId: r.user_id,
      dedupe: 'level',
      level,
      cc: cc.map(email => ({ email })),
      data: { name: firstName, daysSince, level },
    }));
  }
}

// ── 3 · probation ending in 7 days (daily 8am) → HR + Brand Admins
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

// ── 4 · guarantor physical form reminder (daily 9am) → HR
async function sweepGuarantorFormReminder(stats) {
  if (!hourIs(9)) return;
  const now = lagos();

  const { data: records } = await supabase
    .from('people_records')
    .select(`
      user_id, display_name, start_date, probation_end, guarantor_form_received
    `)
    .eq('status', 'active')
    .eq('guarantor_form_received', false)
    .not('probation_end', 'is', null);

  for (const r of records || []) {
    if (!r.probation_end) continue;
    const daysUntilProbation = daysBetween(now, new Date(r.probation_end));
    if (daysUntilProbation > 14 || daysUntilProbation < 0) continue;

    // Get guarantor details from the form submission
    const { data: form } = await supabase
      .from('staff_profile_submissions')
      .select('guarantor_name, guarantor_phone, guarantor_email')
      .eq('user_id', r.user_id)
      .maybeSingle();

    // Notify HR
    const { data: hrs } = await supabase
      .from('users').select('id, email, full_name').in('role', ['hr','super_admin'])
      .eq('is_active', true);

    for (const hr of hrs || []) {
      stats.push(await dispatch.send('guarantor_form_reminder', {
        to: { email: hr.email, full_name: hr.full_name },
        entityId: r.user_id,
        dedupe: 'daily',
        data: {
          name:             hr.full_name?.split(' ')[0],
          staffName:        r.display_name,
          guarantorName:    form?.guarantor_name || 'Not provided',
          guarantorPhone:   form?.guarantor_phone || 'Not provided',
          guarantorEmail:   form?.guarantor_email || null,
          probationDate:    r.probation_end,
          daysUntilProbation,
        },
      }));
    }
  }
}

// ── 5 · document expiry: 30d L1, 7d L2 (daily 8am) → HR
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

// ── 7 · verification aging alert to HR (daily 10am)
async function sweepVerificationAging(stats) {
  if (!hourIs(10)) return;
  const now = lagos();

  const { data: pending } = await supabase
    .from('staff_profile_submissions')
    .select('user_id, submitted_at')
    .eq('profile_state', 'submitted')
    .not('submitted_at', 'is', null);

  for (const s of pending || []) {
    const daysWaiting = daysBetween(new Date(s.submitted_at), now);
    if (daysWaiting < 3) continue;  // give HR 3 days before nagging

    const { data: staffUser } = await supabase
      .from('users').select('full_name').eq('id', s.user_id).single();

    const { data: hrs } = await supabase
      .from('users').select('id, email, full_name').in('role', ['hr','super_admin'])
      .eq('is_active', true);

    for (const hr of hrs || []) {
      // Reuse the profile_form_submitted template with a modified subject via level flag
      stats.push(await dispatch.send('profile_form_submitted', {
        to:       { email: hr.email, full_name: hr.full_name },
        entityId: s.user_id,
        dedupe:   'daily',
        data: {
          name:        hr.full_name?.split(' ')[0],
          staffName:   staffUser?.full_name || 'A staff member',
          staffEmail:  '',
          reviewUrl:   `${process.env.APP_URL}/people?tab=registry`,
          submittedAt: `${daysWaiting} days ago — still pending verification`,
        },
      }));
    }
  }
}

async function runPeopleSweeps(stats = []) {
  const sweeps = [
    ['profile_reminders',        () => sweepProfileReminders(stats)],
    ['profile_form_nag',         () => sweepProfileFormNag(stats)],
    ['guarantor_form_reminder',  () => sweepGuarantorFormReminder(stats)],
    ['verification_aging',       () => sweepVerificationAging(stats)],
    ['probation',                () => sweepProbation(stats)],
    ['documents',                () => sweepDocuments(stats)],
    ['celebrations',             () => sweepCelebrations(stats)],
  ];
  for (const [label, fn] of sweeps) {
    try { await fn(); }
    catch (err) { console.error(`[people-sweep:${label}]`, err.message); }
  }
  return stats;
}

module.exports = { runPeopleSweeps };
