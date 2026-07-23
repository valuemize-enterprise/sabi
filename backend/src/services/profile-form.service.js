'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Profile Form Service
 * Handles the staff-filled Staff Update Form (personal, family, medical,
 * education, languages, experience, guarantor, declaration).
 *
 * DATA TIERS (enforced structurally, same pattern as people.service.js)
 *   TIER 1 — Public profile     : name only (served from people_records)
 *   TIER 2 — Internal           : all fields except medical block
 *   TIER 3 — HR Confidential    : blood_group, genotype, allergies,
 *                                 medical_conditions, emergency_contact_*
 *             Every Tier-3 read by non-self is audit-logged to tier3_access_log.
 *
 * STATE MACHINE
 *   not_started → draft → submitted → verified
 *                                 ↘ rejected → [staff revises] → submitted
 *
 * ROUTES (mounted in profile-form.routes.js)
 *   GET    /api/people/me/profile                  — staff: own form
 *   PUT    /api/people/me/profile/save             — staff: draft save
 *   POST   /api/people/me/profile                  — staff: final submit
 *   GET    /api/people/:userId/profile             — HR: tiered read + audit
 *   PATCH  /api/people/:userId/profile/verify      — HR: verify
 *   PATCH  /api/people/:userId/profile/reject      — HR: reject with reason
 *   PATCH  /api/people/:userId/profile/guarantor-received — HR: mark physical form
 * ═══════════════════════════════════════════════════════════════════════════
 */

const supabase = require('../config/supabase');
const dispatch     = require('./email-dispatch.service');

// ── Role sets ─────────────────────────────────────────────────────────────
const HR_ROLES      = new Set(['hr', 'super_admin']);
const T3_LOG_ROLES  = new Set(['md', 'admin']); // reads Tier 3 but gets logged
const ALLOWED_BLOOD = new Set(['A+','A−','B+','B−','O+','O−','AB+','AB−']);
const ALLOWED_GENO  = new Set(['AA','AS','SS','AC','SC']);

// ── Tier field lists ───────────────────────────────────────────────────────
const TIER2_FIELDS = [
  'id','user_id','profile_state','submitted_at','verified_at','rejected_at',
  'rejection_reason','hr_notes',
  // Identity
  'surname','first_name','middle_name','date_of_birth','nationality',
  'place_of_birth','country_of_birth','state_of_origin','lga','hometown','religion',
  // Marital
  'marital_status','date_of_marriage','spouse_name','spouse_nationality','spouse_profession',
  // Contact
  'home_address','phone','personal_email',
  // NOK
  'nok_name','nok_relationship','nok_phone','nok_email','nok_address',
  // Family / Education / Languages / Experience
  'family_members','secondary_school','tertiary_education','professional_qualifications',
  'languages','total_years_experience','has_criminal_record','criminal_record_details',
  'work_history',
  // Guarantor
  'guarantor_name','guarantor_relationship','guarantor_profession','guarantor_company',
  'guarantor_office_address','guarantor_phone','guarantor_email','guarantor_comments',
  'guarantor_form_acknowledged',
  // Declaration
  'declaration_1','declaration_2','digital_signature','signature_date',
  'created_at','updated_at',
];

const TIER3_ONLY_FIELDS = [
  'blood_group','genotype','allergy_1','allergy_2','medical_conditions',
  'emergency_contact_name','emergency_contact_phone','emergency_contact_address',
];

const TIER3_FIELDS = [...TIER2_FIELDS, ...TIER3_ONLY_FIELDS];

// ── Helpers ───────────────────────────────────────────────────────────────
const sel    = (fields)  => fields.join(', ');
const omit   = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const pick   = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));

function assertHR(caller) {
  if (!HR_ROLES.has(caller.role)) {
    const e = new Error('HR or Super Admin access required.');
    e.status = 403;
    throw e;
  }
}

async function logTier3(readerId, subjectUserId, fieldGroup) {
  await supabase.from('tier3_access_log').insert({
    reader_id: readerId, subject_user_id: subjectUserId,
    field_group: fieldGroup, context: 'profile_form',
  }).then(() => {}, (e) => console.error('[tier3-log]', e?.message));
}

async function appendHistory(userId, actorId, event, note = null, snapshot = null) {
  await supabase.from('staff_profile_history')
    .insert({ user_id: userId, actor_id: actorId, event, note, snapshot })
    .then(() => {}, (e) => console.error('[profile-history]', e?.message));
}

async function userFor(userId) {
  const { data, error } = await supabase.from('users')
    .select('id, email, full_name, role, is_active')
    .eq('id', userId).single();
  if (error || !data) throw Object.assign(new Error('User not found.'), { status: 404 });
  return data;
}

async function hrEmails() {
  const { data } = await supabase.from('users')
    .select('email, full_name')
    .in('role', ['hr', 'super_admin'])
    .eq('is_active', true);
  return (data || []).map(u => u.email).filter(Boolean);
}

// ── Validation ────────────────────────────────────────────────────────────
const REQUIRED_ON_SUBMIT = {
  personal:    ['surname', 'first_name', 'date_of_birth', 'nationality', 'home_address', 'phone'],
  family:      ['nok_name', 'nok_relationship', 'nok_phone', 'nok_address'],
  medical:     ['blood_group', 'genotype', 'emergency_contact_name', 'emergency_contact_phone'],
  guarantor:   ['guarantor_name', 'guarantor_relationship', 'guarantor_phone'],
  declaration: ['digital_signature', 'declaration_1', 'declaration_2'],
};

function validateForSubmission(data) {
  const errors = [];
  for (const [section, fields] of Object.entries(REQUIRED_ON_SUBMIT)) {
    for (const field of fields) {
      const val = data[field];
      const empty = val === null || val === undefined || val === '' || val === false;
      if (empty) errors.push(`${section}.${field} is required`);
    }
  }
  if (data.blood_group && !ALLOWED_BLOOD.has(data.blood_group))
    errors.push('medical.blood_group is invalid');
  if (data.genotype && !ALLOWED_GENO.has(data.genotype))
    errors.push('medical.genotype is invalid');
  return errors;
}

// ── Sanitise input — strip unknown columns before upsert ─────────────────
const WRITABLE_COLUMNS = new Set([
  ...TIER3_FIELDS,
  // remove computed / audit columns staff must not write
].filter(f => !['id','user_id','verified_at','verified_by','rejected_at','rejected_by',
                  'hr_notes','profile_state','submitted_at','created_at','updated_at'].includes(f)));

function sanitise(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([k]) => WRITABLE_COLUMNS.has(k))
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET own form data — staff sees everything including Tier 3 (their own data).
 * Never audit-logged for self-reads.
 */
async function getOwnForm(userId) {
  const { data, error } = await supabase
    .from('staff_profile_submissions')
    .select(sel(TIER3_FIELDS))
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Return null-safe defaults for array columns
  if (!data) return { profile_state: 'not_started', user_id: userId };
  return normaliseArrays(data);
}

/**
 * HR reads someone else's form — tier-gated + audit logged for Tier-3.
 */
async function getFormForHR(callerId, subjectUserId, callerRole) {
  const fields = HR_ROLES.has(callerRole) || callerRole === 'super_admin'
    ? TIER3_FIELDS
    : callerRole === 'md'
    ? TIER3_FIELDS    // MD reads full data, audit-logged
    : TIER2_FIELDS;   // admin sees Tier 2 only

  const { data, error } = await supabase
    .from('staff_profile_submissions')
    .select(sel(fields))
    .eq('user_id', subjectUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Audit log Tier-3 access for roles that aren't HR/Super Admin
  if (data && T3_LOG_ROLES.has(callerRole)) {
    await logTier3(callerId, subjectUserId, 'medical');
  }

  if (!data) return { profile_state: 'not_started', user_id: subjectUserId };
  return normaliseArrays(data);
}

/**
 * Staff saves a draft — partial data, no validation.
 * Upserts on (user_id) unique constraint.
 */
async function saveDraft(userId, input) {
  const clean = sanitise(input);

  const { data, error } = await supabase
    .from('staff_profile_submissions')
    .upsert({
      ...clean,
      user_id:       userId,
      profile_state: clean.profile_state === 'submitted' ? 'submitted' : 'draft',
      // Don't reset submitted/verified timestamps if already there
    }, { onConflict: 'user_id', ignoreDuplicates: false })
    .select(sel(TIER2_FIELDS))
    .single();

  if (error) throw new Error(error.message);

  // Update quick-lookup on people_records
  await supabase.from('people_records')
    .update({ form_submission_state: 'draft' })
    .eq('user_id', userId)
    .then(() => {}, () => {}); // best-effort

  await appendHistory(userId, userId, 'draft_saved');
  return normaliseArrays(data);
}

/**
 * Staff submits the form — validates all required fields, flips state to
 * 'submitted', triggers HR notification email.
 */
async function submitForm(userId, input) {
  const clean = sanitise(input);

  // Full validation before accepting the submission
  const errors = validateForSubmission(clean);
  if (errors.length) {
    const e = new Error(`Validation failed: ${errors.join('; ')}`);
    e.status = 422;
    e.errors = errors;
    throw e;
  }

  const now = new Date().toISOString();

  

  const { data, error } = await supabase
    .from('staff_profile_submissions')
    .upsert({
      ...clean,
      user_id:       userId,
      profile_state: 'submitted',
      submitted_at:  now,
      rejected_at:   null,
      rejected_by:   null,
      rejection_reason: null,
    }, { onConflict: 'user_id', ignoreDuplicates: false })
    .select(sel(TIER2_FIELDS))
    .single();

  if (error) {
    console.error('Supabase error :', error);
    throw new Error(error.message);
}

  // The trigger fn_sync_form_state handles people_records + users updates.
  // Belt-and-suspenders for environments where triggers may be disabled:
  const { data: peopledata, error: peopleerror } = await supabase.from('people_records')
    .update({ form_submission_state: 'submitted', form_submitted_at: now })
    .eq('user_id', userId)
    .then(() => {}, () => {});

    if (peopleerror) {
    console.error('Supabase error peopledata:', peopleerror);
    throw new Error(error.message);
}

  console.log('peoples data from supabase:', peopledata)

  await appendHistory(userId, userId, 'submitted', null, {
    digital_signature: clean.digital_signature,
    submitted_at: now,
  });

  // ── Notify HR ─────────────────────────────────────────────────────────
  const [subject, hrEmailList] = await Promise.all([
    userFor(userId),
    hrEmails(),
  ]);

  if (hrEmailList.length) {
    await dispatch.send('profile_form_submitted', {
      to: { email: hrEmailList[0], full_name: 'HR' },
      cc: hrEmailList.slice(1).map(e => ({ email: e })),
      entityId: userId,
      dedupe: 'one-shot',
      data: {
        staffName:  subject.full_name,
        staffEmail: subject.email,
        reviewUrl:  `${process.env.APP_URL}/people?tab=registry`,
        submittedAt: new Date(now).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      },
    });
  }

  // Notify the staff member as well
  await dispatch.send('profile_form_submitted_ack', {
    to: { email: subject.email, full_name: subject.full_name },
    entityId: userId,
    dedupe: 'one-shot',
    data: { name: subject.full_name?.split(' ')[0] },
  });

  return normaliseArrays(data);
}

/**
 * HR verifies the form — flips state to 'verified', notifies staff.
 */
async function verifyForm(callerId, subjectUserId, hrNotes = null) {
  assertHR(await userFor(callerId));

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('staff_profile_submissions')
    .update({
      profile_state: 'verified',
      verified_at:   now,
      verified_by:   callerId,
      hr_notes:      hrNotes,
      rejected_at:   null,
      rejection_reason: null,
    })
    .eq('user_id', subjectUserId)
    .eq('profile_state', 'submitted')   // safety: can only verify a submitted form
    .select(sel(TIER2_FIELDS))
    .single();

  if (error) throw new Error(error.message);

  await appendHistory(subjectUserId, callerId, 'verified', hrNotes);

  // Notify staff
  const staff = await userFor(subjectUserId);
  await dispatch.send('profile_form_verified', {
    to: { email: staff.email, full_name: staff.full_name },
    entityId: subjectUserId,
    dedupe: 'one-shot',
    data: { name: staff.full_name?.split(' ')[0], hrNotes },
  });

  return normaliseArrays(data);
}

/**
 * HR rejects the form — flips state to 'rejected', tells staff what to fix.
 */
async function rejectForm(callerId, subjectUserId, reason) {
  if (!reason?.trim()) {
    const e = new Error('A rejection reason is required so the staff member knows what to fix.');
    e.status = 400;
    throw e;
  }
  assertHR(await userFor(callerId));

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('staff_profile_submissions')
    .update({
      profile_state:    'rejected',
      rejected_at:      now,
      rejected_by:      callerId,
      rejection_reason: reason,
    })
    .eq('user_id', subjectUserId)
    .in('profile_state', ['submitted'])
    .select(sel(TIER2_FIELDS))
    .single();

  if (error) throw new Error(error.message);

  await appendHistory(subjectUserId, callerId, 'rejected', reason);

  // Notify staff
  const staff = await userFor(subjectUserId);
  await dispatch.send('profile_form_rejected', {
    to: { email: staff.email, full_name: staff.full_name },
    entityId: subjectUserId,
    dedupe: 'one-shot',
    data: { name: staff.full_name?.split(' ')[0], reason, editUrl: `${process.env.APP_URL}/my-profile` },
  });

  return normaliseArrays(data);
}

/**
 * HR marks the physical Guarantor's Form as received.
 * Separate from the digital section — the physical form has legal weight.
 */
async function markGuarantorReceived(callerId, subjectUserId) {
  assertHR(await userFor(callerId));

  // Update people_records (the canonical flag lives there)
  const { error: e1 } = await supabase.from('people_records')
    .update({ guarantor_form_received: true })
    .eq('user_id', subjectUserId);
  if (e1) throw new Error(e1.message);

  await appendHistory(subjectUserId, callerId, 'guarantor_received',
    'Physical Guarantor Form received and filed by HR.');

  return { success: true };
}

/**
 * HR summary — which staff have/haven't submitted (no Tier-3 data).
 * Wraps the v_profile_form_summary view.
 */
async function formSummaryForHR(callerId) {
  assertHR(await userFor(callerId));

  const { data, error } = await supabase
    .from('v_profile_form_summary')
    .select('*')
    .order('form_submitted_at', { ascending: false, nullsLast: true });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Full history log for a specific person's form — HR/Super Admin only.
 */
async function formHistory(callerId, subjectUserId) {
  assertHR(await userFor(callerId));

  const { data, error } = await supabase
    .from('staff_profile_history')
    .select('id, event, note, actor_id, created_at')
    .eq('user_id', subjectUserId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── normalise JSONB arrays from DB (null → []) ────────────────────────────
function normaliseArrays(row) {
  if (!row) return row;
  const lists = [
    'family_members','tertiary_education','professional_qualifications',
    'languages','work_history',
  ];
  const out = { ...row };
  for (const k of lists) {
    if (out[k] == null) out[k] = [];
  }
  return out;
}

// ── Enrich the profile generator with form data (called from generator) ───
/**
 * Returns the subset of form data useful for ARIA bio enrichment.
 * Never includes Tier-3 fields — bio is public-facing.
 */
async function getGeneratorContext(userId) {
  const { data } = await supabase
    .from('staff_profile_submissions')
    .select([
      'languages',
      'tertiary_education',
      'professional_qualifications',
      'total_years_experience',
      'work_history',
    ].join(', '))
    .eq('user_id', userId)
    .in('profile_state', ['submitted', 'verified'])
    .maybeSingle();

  if (!data) return null;
  return normaliseArrays(data);
}

module.exports = {
  getOwnForm,
  getFormForHR,
  saveDraft,
  submitForm,
  verifyForm,
  rejectForm,
  markGuarantorReceived,
  formSummaryForHR,
  formHistory,
  getGeneratorContext,
  TIER2_FIELDS,
  TIER3_FIELDS,
  TIER3_ONLY_FIELDS,
};
