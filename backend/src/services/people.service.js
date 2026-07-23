/**
 * ═══════════════════════════════════════════════════════════════
 * People Service — the HR source of truth, tier-enforced
 * Sabi Intelligence Suite · People OS
 * ═══════════════════════════════════════════════════════════════
 * The tier whitelists at the top are the security centerpiece:
 * every read path selects through them. Widening generator access
 * requires editing TIER1_FIELDS — visible in any code review.
 */

'use strict';

const bcrypt   = require('bcryptjs');
const supabase = require('../config/supabase');
const dispatch = require('./email-dispatch.service');

// ═══════════════ TIER WHITELISTS (blueprint §03) ═══════════════
const TIER1_FIELDS = [
  'user_id', 'display_name', 'role_key', 'role_title',
  'department', 'start_date', 'spark_line',
];
const TIER2_FIELDS = [
  ...TIER1_FIELDS, 'work_phone', 'employment_type', 'tp_cohort',
  'probation_end', 'onboarding', 'status', 'exit_date',
];
const TIER3_FIELDS = [
  ...TIER2_FIELDS, 'personal_email', 'personal_phone', 'date_of_birth',
  'emergency_contact', 'comp_band', 'hr_notes',
];
const HR_ROLES = new Set(['hr', 'super_admin']);
const T3_AUDITED_ROLES = new Set(['md']); // MD reads allowed but logged (D-matrix)

const sel = (fields) => ['id', ...fields].join(', ');

async function logTier3Read(readerId, subjectUserId, context) {
  await supabase.from('tier3_access_log')
    .insert({ reader_id: readerId, subject_user_id: subjectUserId, context })
    .then(() => {}, (e) => console.error('[tier3-log]', e?.message));
}

/** Tier-aware single-record read. Returns null if the caller's role has no path. */
async function getRecord(subjectUserId, caller, context = 'person_file') {
  const isSelf = caller.id === subjectUserId;
  let fields;
  if (HR_ROLES.has(caller.role)) fields = TIER3_FIELDS;
  else if (T3_AUDITED_ROLES.has(caller.role)) fields = TIER3_FIELDS; // logged below
  else if (isSelf) fields = TIER3_FIELDS;                            // own record, own data
  else if (caller.role === 'admin' || caller.role === 'md') fields = TIER2_FIELDS;
  else fields = TIER1_FIELDS;

  const { data, error } = await supabase.from('people_records')
    .select(sel(fields)).eq('user_id', subjectUserId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data && fields === TIER3_FIELDS && T3_AUDITED_ROLES.has(caller.role) && !isSelf) {
    await logTier3Read(caller.id, subjectUserId, context);
  }
  return data;
}

// ═══════════════ CREATE — the onboarding trigger ═══════════════
const ONBOARDING_STEPS = ['record_created', 'invite_sent', 'portal_activated',
                          'profile_draft', 'profile_published', 'first_task_done'];

async function createRecord(input, creator) {
  const {
    email, display_name, role_key, role_title, department = null,
    start_date, spark_line = null, employment_type = 'full_time',
    tp_cohort = null, probation_end = null,
    personal_email = null, personal_phone = null, date_of_birth = null,
    emergency_contact = null, comp_band = null,
  } = input;
   const tempPassword = `Sabi${Math.random().toString(36).slice(2, 8)}!`;
      const hash = await bcrypt.hash(tempPassword, 12);

  // 1 · ensure the user exists (reuse the existing invite flow's shape)
  let { data: user } = await supabase.from('users')
    .select('id, email, full_name').eq('email', email).maybeSingle();
  if (!user) {
    const { data: created, error } = await supabase.from('users')
      .insert({
        email, full_name: display_name, role: 'staff',
        is_active: true, onboarding_state: 'invited',
        password_hash: hash,
      }).select('id, email, full_name').single();
    if (error) throw new Error(`User create failed: ${error.message}`);
    user = created;
    // Existing invitation email flow — same door as always:
    try {
      const emailService = require('./email.service');
      if (emailService?.sendStaffInvite) await emailService.sendStaffInvite(user);
    } catch { /* invite service optional in dev */ }
  }

  // 2 · the People Record
  const onboarding = Object.fromEntries(ONBOARDING_STEPS.map(s => [s, false]));
  onboarding.record_created = true;
  onboarding.invite_sent = true;

  const { data: record, error: recErr } = await supabase.from('people_records')
    .insert({
      user_id: user.id, display_name, role_key, role_title, department,
      start_date, spark_line, employment_type, tp_cohort, probation_end,
      personal_email, personal_phone, date_of_birth, emergency_contact,
      comp_band, status: 'onboarding', onboarding, created_by: creator.id,
    }).select(sel(TIER3_FIELDS)).single();
  if (recErr) throw new Error(`Record create failed: ${recErr.message}`);

  const emailService = require('./email.service');
   await emailService.sendWelcomeStaff({
        name: record.display_name,
        email: user.email,
        role: user.role,
        tempPassword,
      }).catch(() => {});

  // 3 · generate the profile draft (Tier-1 only — see profile-generator)
  const { generateProfile } = require('./profile-generator.service');
  generateProfile(user.id).catch(e => console.error('[people] generate failed:', e.message));

  return { user, record };
}

// ═══════════════ UPDATE + role sync propagation ════════════════
async function updateRecord(subjectUserId, patch, caller) {
  if (!HR_ROLES.has(caller.role)) throw Object.assign(new Error('HR only'), { status: 403 });

  const allowed = TIER3_FIELDS.filter(f => f !== 'user_id');
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
  clean.updated_at = new Date().toISOString();

  const { data: before } = await supabase.from('people_records')
    .select('role_key, role_title, display_name').eq('user_id', subjectUserId).single();
  const { data: after, error } = await supabase.from('people_records')
    .update(clean).eq('user_id', subjectUserId).select(sel(TIER3_FIELDS)).single();
  if (error) throw new Error(error.message);

  // Sync propagation (§02 step 6): role/title/name changes flow everywhere
  if (before && (clean.role_key || clean.role_title || clean.display_name)) {
    const roleChanged = clean.role_key && clean.role_key !== before.role_key;
    await supabase.from('users').update({
      ...(clean.display_name ? { full_name: clean.display_name } : {}),
      ...(clean.role_key ? { staff_role: clean.role_key } : {}),
    }).eq('id', subjectUserId);
    await supabase.from('staff_profiles').update({
      ...(clean.role_title ? { role_title: clean.role_title } : {}),
      ...(clean.display_name ? { display_name: clean.display_name } : {}),
    }).eq('user_id', subjectUserId).then(() => {}, () => {});

    if (roleChanged) {
      const { data: u } = await supabase.from('users')
        .select('id, email, full_name').eq('id', subjectUserId).single();
      if (u) await dispatch.send('role_updated', {
        to: u, entityId: subjectUserId, dedupe: 'always',
        data: { name: u.full_name, newTitle: after.role_title, prevTitle: before.role_title },
      });
    }
    await supabase.from('audit_log').insert({
      actor_id: caller.id, action: 'people_record_updated',
      details: { subject: subjectUserId, fields: Object.keys(clean) },
    }).then(() => {}, () => {});
  }
  return after;
}

async function setOnboardingStep(userId, step, done = true) {
  const { data } = await supabase.from('people_records')
    .select('onboarding').eq('user_id', userId).single();
  const ob = { ...(data?.onboarding || {}), [step]: done };
  await supabase.from('people_records').update({ onboarding: ob }).eq('user_id', userId);
  return ob;
}

// ═══════════════ REGISTRY + PERSON FILE + INSIGHTS ═════════════
async function registry(caller) {
  const fields = HR_ROLES.has(caller.role) || T3_AUDITED_ROLES.has(caller.role)
    ? TIER2_FIELDS : TIER1_FIELDS;
  const [{ data: records }, { data: profiles }, { data: leaves, error:leaveError }, { data: docs }] =
    await Promise.all([
      supabase.from('people_records').select(sel(fields)).neq('status', 'exited')
        .order('display_name'),
      supabase.from('staff_profiles').select('user_id, state, generated_at'),
      supabase.from('leave_requests').select('user_id, start_date, end_date, status')
        .eq('status', 'approved').gte('end_date', new Date().toISOString().slice(0, 10)),
      supabase.from('people_documents').select('user_id, expiry_date')
        .not('expiry_date', 'is', null),
    ]);


  const profByUser = new Map((profiles || []).map(p => [p.user_id, p]));
  const today = new Date();
  const soon = new Date(today.getTime() + 30 * 86400000);
  const onLeaveNow = new Set((leaves || [])
    .filter(l => new Date(l.start_date) <= today && new Date(l.end_date) >= today)
    .map(l => l.user_id));
  const expiringByUser = new Map();
  for (const d of docs || []) {
    const exp = new Date(d.expiry_date);
    if (exp <= soon) expiringByUser.set(d.user_id, (expiringByUser.get(d.user_id) || 0) + 1);
  }

  const people = (records || []).map(r => {
    const prof = profByUser.get(r.user_id);
    const draftDays = prof?.state === 'draft' && prof.generated_at
      ? Math.floor((today - new Date(prof.generated_at)) / 86400000) : null;
    return {
      ...r,
      profile_state: prof?.state || 'none',
      profile_draft_days: draftDays,
      on_leave_now: onLeaveNow.has(r.user_id),
      probation_active: r.probation_end ? new Date(r.probation_end) >= today : false,
      docs_expiring: expiringByUser.get(r.user_id) || 0,
    };
  });

  return {
    people,
    stats: {
      active: people.filter(p => p.status !== 'onboarding').length,
      onboarding: people.filter(p => p.status === 'onboarding').length,
      on_probation: people.filter(p => p.probation_active).length,
      on_leave_now: people.filter(p => p.on_leave_now).length,
      docs_expiring: [...expiringByUser.values()].reduce((s, n) => s + n, 0),
      drafts_unclaimed: people.filter(p => p.profile_state === 'draft').length,
    },
  };
}

async function personFile(subjectUserId, caller) {
  const record = await getRecord(subjectUserId, caller);
  if (!record) return null;
  const canT3 = HR_ROLES.has(caller.role) || T3_AUDITED_ROLES.has(caller.role)
    || caller.id === subjectUserId;

  const [profQ, leaveQ, docsQ, scoreQ, ratingsQ, recogQ, disputesQ] = await Promise.all([
    supabase.from('staff_profiles').select('state, generated_at, published_at, generation_version')
      .eq('user_id', subjectUserId).maybeSingle(),
    supabase.from('leave_requests').select('id, leave_type, start_date, end_date, status, decision_note')
      .eq('user_id', subjectUserId).order('created_at', { ascending: false }).limit(10),
    canT3 ? supabase.from('people_documents')
      .select('id, doc_type, label, expiry_date, created_at')
      .eq('user_id', subjectUserId).order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
    supabase.from('weekly_scores').select('rolling_avg, week_start')
      .eq('user_id', subjectUserId).order('week_start', { ascending: false }).limit(1),
    supabase.from('weekly_ratings').select('rating, note, created_at')
      .eq('ratee_id', subjectUserId).lte('rating', 2)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('contribution_claims').select('title, points, status, created_at')
      .eq('user_id', subjectUserId).eq('status', 'approved')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('score_disputes').select('reason, status, created_at')
      .eq('user_id', subjectUserId).order('created_at', { ascending: false }).limit(3)
      .then(r => r, () => ({ data: [] })),
  ]);

  if (canT3 && docsQ.data && caller.id !== subjectUserId && !HR_ROLES.has(caller.role)) {
    await logTier3Read(caller.id, subjectUserId, 'documents');
  }

  return {
    record,
    profile: profQ.data || { state: 'none' },
    leave_history: leaveQ.data || [],
    documents: docsQ.data,                     // null when caller has no Tier-3 path
    performance: {                              // HR lens (D2): averages + flags, no weekly detail
      rolling_avg: scoreQ.data?.[0]?.rolling_avg ?? null,
      low_ratings: ratingsQ.data || [],
      recognition: recogQ.data || [],
      disputes: disputesQ.data || [],
    },
  };
}

async function insights(caller) {
  if (!HR_ROLES.has(caller.role) && !T3_AUDITED_ROLES.has(caller.role)) {
    throw Object.assign(new Error('HR only'), { status: 403 });
  }
  const { data: records } = await supabase.from('people_records')
    .select('role_key, employment_type, start_date, status, date_of_birth, display_name, user_id');
  const active = (records || []).filter(r => r.status !== 'exited');
  const today = new Date();

  const byRole = {}, byType = {};
  let tenureSum = 0;
  for (const r of active) {
    byRole[r.role_key] = (byRole[r.role_key] || 0) + 1;
    byType[r.employment_type] = (byType[r.employment_type] || 0) + 1;
    tenureSum += (today - new Date(r.start_date)) / (365.25 * 86400000);
  }
  const in30 = (m, d) => {
    const next = new Date(today.getFullYear(), m, d);
    if (next < today) next.setFullYear(next.getFullYear() + 1);
    return (next - today) / 86400000 <= 30;
  };
  return {
    headcount: active.length,
    by_role: byRole, by_type: byType,
    avg_tenure_years: active.length ? +(tenureSum / active.length).toFixed(1) : 0,
    exited_total: (records || []).length - active.length,
    upcoming_anniversaries: active
      .filter(r => in30(new Date(r.start_date).getMonth(), new Date(r.start_date).getDate()))
      .map(r => ({ name: r.display_name, date: r.start_date })),
    upcoming_birthdays: active                   // day+month only — year never surfaced (D6)
      .filter(r => r.date_of_birth && in30(new Date(r.date_of_birth).getMonth(), new Date(r.date_of_birth).getDate()))
      .map(r => ({ name: r.display_name,
                   day: new Date(r.date_of_birth).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' }) })),
  };
}

// ═══════════════ OFFBOARDING — the kill switch (§05) ═══════════
async function beginOffboarding(subjectUserId, caller, exitDate = null) {
  if (!HR_ROLES.has(caller.role)) throw Object.assign(new Error('HR only'), { status: 403 });
  const checklist = [];

  // 1 · deactivate access
  await supabase.from('users').update({ is_active: false }).eq('id', subjectUserId);
  checklist.push('account_deactivated');
  // 2 · unpublish from client-visible surfaces (internal record kept)
  await supabase.from('staff_profiles').update({ state: 'draft' }).eq('user_id', subjectUserId);
  checklist.push('profile_unpublished');
  // 3 · release brand assignments
  await supabase.from('staff_brand_assignments').delete().eq('staff_id', subjectUserId);
  checklist.push('brand_assignments_released');
  // 4 · flag open tasks for reassignment (kept, unassigned, visible to Brand Admins)
  const { data: openTasks } = await supabase.from('tasks')
    .select('id, brand_id').eq('assignee_id', subjectUserId)
    .not('status', 'in', '("verified","archived")');
  if (openTasks?.length) {
    await supabase.from('tasks').update({ assignee_id: null })
      .in('id', openTasks.map(t => t.id));
  }
  checklist.push(`tasks_flagged:${openTasks?.length || 0}`);
  // 5 · record the exit
  await supabase.from('people_records').update({
    status: 'offboarding', exit_date: exitDate || new Date().toISOString().slice(0, 10),
  }).eq('user_id', subjectUserId);
  checklist.push('exit_recorded');

  await supabase.from('audit_log').insert({
    actor_id: caller.id, action: 'offboarding_started',
    details: { subject: subjectUserId, checklist },
  }).then(() => {}, () => {});

  // leadership + HR notice
  const { data: leaders } = await supabase.from('users')
    .select('id, email, full_name').in('role', ['super_admin', 'md', 'hr']).eq('is_active', true);
  const { data: person } = await supabase.from('people_records')
    .select('display_name, role_title').eq('user_id', subjectUserId).single();
  await dispatch.sendToMany('offboarding_started', leaders || [], {
    entityId: subjectUserId, dedupe: 'once',
    data: { personName: person?.display_name, roleTitle: person?.role_title,
            openTasks: openTasks?.length || 0 },
  });

  return { checklist };
}

module.exports = {
  TIER1_FIELDS, TIER2_FIELDS, TIER3_FIELDS, HR_ROLES,
  getRecord, createRecord, updateRecord, setOnboardingStep,
  registry, personFile, insights, beginOffboarding, logTier3Read,
};
