// ═══════════════════════════════════════════════════════════════════
// people-edit.service.js
// Sabi Intelligence Suite — Phase C: People OS
//
// All write operations for People OS:
//   • updatePeopleRecord()    — single field inline edit
//   • Support staff CRUD
//   • Vacancies CRUD
//   • Disciplinary records CRUD
//   • Change history retrieval
//   • Alerts dashboard
//   • Internship fields upsert
// ═══════════════════════════════════════════════════════════════════

'use strict';

const supabase = require('../config/supabase');
const { query } = require('../db/db');
const { validateTransition, applyTransitionSideEffects } = require('./status-machine.service');
const { syncRoleChange } = require('./role-change-sync.service');

// ── Field definitions ─────────────────────────────────────────────

// Fields that require a written reason before saving
const REASON_REQUIRED = new Set([
  'role_key', 'role_title', 'employment_status',
  'comp_band', 'start_date',
]);

// Fields in Tier 3 — written to tier3_access_log as well
const TIER_3_FIELDS = new Set([
  'personal_email', 'personal_phone', 'date_of_birth',
  'emergency_contact', 'comp_band', 'hr_notes',
]);

// All fields HR can edit
const EDITABLE_FIELDS = new Set([
  // Tier 1
  'display_name', 'role_key', 'role_title', 'department', 'start_date', 'spark_line',
  // Tier 2
  'work_phone', 'employment_type', 'employment_category', 'tp_cohort',
  'probation_end', 'employment_status', 'contract_end_date', 'line_manager_id',
  // Tier 3
  'personal_email', 'personal_phone', 'date_of_birth',
  'emergency_contact', 'comp_band', 'hr_notes',
]);

// ── updatePeopleRecord ────────────────────────────────────────────
/**
 * Update a single field on a person's record.
 * Writes to people_records, logs to people_record_changes,
 * and applies any side effects.
 *
 * @param {string} recordId   — people_records.id
 * @param {string} fieldName  — the column to update
 * @param {*}      newValue   — the new value
 * @param {string} reason     — required for sensitive fields
 * @param {object} caller     — { id, full_name, role } of the HR user
 */
const updatePeopleRecord = async (recordId, fieldName, newValue, reason, caller) => {
  // 1. Validate field is editable
  if (!EDITABLE_FIELDS.has(fieldName)) {
    throw Object.assign(
      new Error(`Field '${fieldName}' is not editable through People OS`),
      { status: 400 }
    );
  }

  // 2. Require reason for sensitive fields
  if (REASON_REQUIRED.has(fieldName) && !reason?.trim()) {
    throw Object.assign(
      new Error(`A reason is required when changing ${fieldName}`),
      { status: 400 }
    );
  }

  // 3. Load current record
  const { data: record, error: fetchErr } = await supabase
    .from('people_records')
    .select('*, users!user_id(id, full_name, role, email)')
    .eq('user_id', recordId)
    .maybeSingle();

  if (fetchErr || !record) {
    console.log('fetchErr :', fetchErr)
    throw Object.assign(new Error('Person record not found'), { status: 404 });
  }

  const userId    = record.user_id;
  const oldValue  = record[fieldName];
  const tier      = TIER_3_FIELDS.has(fieldName) ? 3 : EDITABLE_FIELDS.has(fieldName) ? 2 : 1;

  // 4. Employment status machine validation
 if (fieldName === 'employment_status' && record.employment_status !== newValue) {
  validateTransition(record.employment_status, newValue);
}

  // 5. Serialise value for storage in change log
  const serialise = v => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

  // 6. Update people_records
  const { data: updated, error: updateErr } = await supabase
    .from('people_records')
    .update({ [fieldName]: newValue, updated_at: new Date().toISOString() })
    .eq('id', record.id)
    .select('*')
    .single();

  if (updateErr) {
    throw new Error(`Failed to update record: ${updateErr.message}`);
  }

  // 7. Write to change log
  const {error:ChangesError} =  await supabase.from('people_record_changes').insert({
    record_id:  record.id,
    user_id:    userId,
    changed_by: caller.id,
    field_name: fieldName,
    old_value:  serialise(oldValue),
    new_value:  serialise(newValue),
    reason:     reason || null,
    tier,
  })
   if(ChangesError) {
    throw new Error(`Failed to log change: ${ChangesError.message}`);
   }

  // 8. Tier-3 extra audit log
  if (TIER_3_FIELDS.has(fieldName)) {
    await supabase.from('tier3_access_log').insert({
      accessor_id:  caller.id,
      subject_id:   userId,
      accessed_at:  new Date().toISOString(),
      action:       'write',
      field:        fieldName,
      notes:        reason || 'HR edit',
    }).catch(() => {}); // non-blocking
  }

  // 9. Apply side effects
  if (fieldName === 'employment_status') {
    await applyTransitionSideEffects(
      userId, recordId, record.employment_status, newValue, reason, caller.id
    );
  }

  if (fieldName === 'role_key' || fieldName === 'role_title') {
    const newRoleKey   = fieldName === 'role_key'   ? newValue : record.role_key;
    const newRoleTitle = fieldName === 'role_title' ? newValue : record.role_title;
    await syncRoleChange(userId, newRoleKey, newRoleTitle, caller.full_name);
  }

  return updated;
};

// ── Internship fields upsert ──────────────────────────────────────

const upsertInternshipFields = async (recordId, {
  employment_category, internship_type, internship_duration,
  internship_start_date, internship_end_date,
}, callerId) => {
  const { data, error } = await supabase
    .from('people_records')
    .update({
      employment_category,
      internship_type,
      internship_duration,
      internship_start_date,
      internship_end_date,
      internship_alert_sent: false, // reset alert when dates change
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .select('*')
    .single();

  if (error) throw new Error(`Internship update failed: ${error.message}`);
  return data;
};

// ── Change history ────────────────────────────────────────────────

const getChangeHistory = async (recordId) => {
  const { data, error } = await supabase
    .from('people_record_changes')
    .select(`
      id, field_name, old_value, new_value, reason, tier, changed_at,
      changed_by_user:users!changed_by(id, full_name, role)
    `)
    .eq('record_id', recordId)
    .not('field_name', 'eq', 'probation_alert')  // exclude internal sweep markers
    .order('changed_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`History fetch failed: ${error.message}`);
  return data || [];
};

// ── Disciplinary records ──────────────────────────────────────────

const getDisciplinaryLog = async (userId) => {
  const { data, error } = await supabase
    .from('disciplinary_records')
    .select(`
      id, type, date_issued, description, outcome, is_resolved,
      resolved_at, created_at,
      created_by_user:users!created_by(id, full_name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Disciplinary fetch failed: ${error.message}`);
  return data || [];
};

const createDisciplinaryEntry = async (userId, { type, date_issued, description, outcome }, callerId) => {
  const { data, error } = await supabase
    .from('disciplinary_records')
    .insert({ user_id: userId, type, date_issued, description, outcome, created_by: callerId })
    .select('*')
    .single();

  if (error) throw new Error(`Disciplinary insert failed: ${error.message}`);
  return data;
};

const resolveDisciplinaryEntry = async (entryId, outcome, callerId) => {
  const { data, error } = await supabase
    .from('disciplinary_records')
    .update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: callerId,
      outcome,
    })
    .eq('id', entryId)
    .select('*')
    .single();

  if (error) throw new Error(`Disciplinary resolve failed: ${error.message}`);
  return data;
};

// ── Support staff directory ───────────────────────────────────────

const getSupportStaff = async () => {
  const { data, error } = await supabase
    .from('support_staff_directory')
    .select('*')
    .order('full_name');
  if (error) throw new Error(error.message);
  return data || [];
};

const createSupportStaff = async (payload, callerId) => {
  const { data, error } = await supabase
    .from('support_staff_directory')
    .insert({ ...payload, created_by: callerId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const updateSupportStaff = async (id, payload) => {
  const { data, error } = await supabase
    .from('support_staff_directory')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ── Vacancies ─────────────────────────────────────────────────────

const getVacancies = async () => {
  const { data, error } = await supabase
    .from('vacancies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
};

const createVacancy = async (payload, callerId) => {
  const { data, error } = await supabase
    .from('vacancies')
    .insert({ ...payload, created_by: callerId })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const updateVacancy = async (id, payload, callerId) => {
  const updates = { ...payload, updated_at: new Date().toISOString() };
  if (payload.status === 'filled' && !payload.date_filled) {
    updates.date_filled  = new Date().toISOString().split('T')[0];
    updates.filled_by    = callerId;
  }
  const { data, error } = await supabase
    .from('vacancies')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
};

// ── Alerts dashboard ──────────────────────────────────────────────
// Uses supabase client only — no raw pg query() dependency.
// Date thresholds computed in JS to avoid SQL date arithmetic.

const getAlertsData = async () => {
  const now     = new Date();
  const in14d   = new Date(now.getTime() + 14  * 86400000).toISOString().split('T')[0];
  const in30d   = new Date(now.getTime() + 30  * 86400000).toISOString().split('T')[0];
  const today   = now.toISOString().split('T')[0];

  const [internships, probations, contracts, disciplinary] = await Promise.allSettled([

    // Interns completing within 30 days
    supabase
      .from('people_records')
      .select('id, internship_type, internship_end_date, user_id, users!user_id(full_name)')
      .eq('employment_category', 'intern')
      .eq('employment_status', 'active')
      .not('internship_end_date', 'is', null)
      .gte('internship_end_date', today)
      .lte('internship_end_date', in30d)
      .order('internship_end_date', { ascending: true }),

    // Staff on probation ending within 14 days
    supabase
      .from('people_records')
      .select('id, probation_end, user_id, users!user_id(full_name)')
      .eq('employment_status', 'probation')
      .not('probation_end', 'is', null)
      .gte('probation_end', today)
      .lte('probation_end', in14d)
      .order('probation_end', { ascending: true }),

    // Contracts expiring within 30 days
    supabase
      .from('people_records')
      .select('id, contract_end_date, employment_type, user_id, users!user_id(full_name)')
      .eq('employment_type', 'contract')
      .eq('employment_status', 'active')
      .not('contract_end_date', 'is', null)
      .gte('contract_end_date', today)
      .lte('contract_end_date', in30d)
      .order('contract_end_date', { ascending: true }),

    // Unresolved disciplinary records
    supabase
      .from('disciplinary_records')
      .select('id, type, date_issued, user_id, users!user_id(full_name)')
      .eq('is_resolved', false)
      .order('date_issued', { ascending: false }),
  ]);

  // Normalise each result — Supabase returns { data, error } not rows[]
  const toRows = (settled) => {
    if (settled.status !== 'fulfilled') return [];
    const val = settled.value;
    // Supabase result shape: { data: [...], error: null }
    if (val && Array.isArray(val.data)) {
      return val.data.map(r => ({
        ...r,
        full_name: r.users?.full_name || null,
        days_remaining: r.internship_end_date
          ? Math.ceil((new Date(r.internship_end_date) - now) / 86400000)
          : r.probation_end
          ? Math.ceil((new Date(r.probation_end) - now) / 86400000)
          : r.contract_end_date
          ? Math.ceil((new Date(r.contract_end_date) - now) / 86400000)
          : null,
      }));
    }
    return [];
  };

  return {
    internships:  toRows(internships),
    probations:   toRows(probations),
    contracts:    toRows(contracts),
    disciplinary: toRows(disciplinary),
  };
};


module.exports = {
  updatePeopleRecord,
  upsertInternshipFields,
  getChangeHistory,
  getDisciplinaryLog,
  createDisciplinaryEntry,
  resolveDisciplinaryEntry,
  getSupportStaff,
  createSupportStaff,
  updateSupportStaff,
  getVacancies,
  createVacancy,
  updateVacancy,
  getAlertsData,
};