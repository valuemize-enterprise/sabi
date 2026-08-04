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
  // NB: no `users!user_id(...)` join — people_records.user_id has no real
  // FK constraint (migration 009), so PostgREST can't resolve the relationship.
  const { data: record, error: fetchErr } = await supabase
    .from('people_records')
    .select('*')
    .eq('id', recordId)
    .single();

  if (fetchErr || !record) {
    throw Object.assign(new Error('Person record not found'), { status: 404 });
  }

  const userId    = record.user_id;
  const oldValue  = record[fieldName];
  const tier      = TIER_3_FIELDS.has(fieldName) ? 3 : EDITABLE_FIELDS.has(fieldName) ? 2 : 1;

  // 4. Employment status machine validation
  if (fieldName === 'employment_status') {
    validateTransition(record.employment_status, newValue);
  }

  // 5. Serialise value for storage in change log
  const serialise = v => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

  // 6. Update people_records
  const { data: updated, error: updateErr } = await supabase
    .from('people_records')
    .update({ [fieldName]: newValue, updated_at: new Date().toISOString() })
    .eq('id', recordId)
    .select('*')
    .single();

  if (updateErr) {
    throw new Error(`Failed to update record: ${updateErr.message}`);
  }

  // 7. Write to change log (non-blocking — the update already succeeded)
  try {
    await supabase.from('people_record_changes').insert({
      record_id:  recordId,
      user_id:    userId,
      changed_by: caller.id,
      field_name: fieldName,
      old_value:  serialise(oldValue),
      new_value:  serialise(newValue),
      reason:     reason || null,
      tier,
    });
  } catch (e) {
    console.error('[people-edit] Change log insert failed:', e.message);
  }

  // 8. Tier-3 extra audit log
  if (TIER_3_FIELDS.has(fieldName)) {
    try {
      await supabase.from('tier3_access_log').insert({
        accessor_id:  caller.id,
        subject_id:   userId,
        accessed_at:  new Date().toISOString(),
        action:       'write',
        field:        fieldName,
        notes:        reason || 'HR edit',
      });
    } catch { /* non-blocking */ }
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

const getAlertsData = async () => {
  const [internships, probations, contracts, disciplinary] = await Promise.allSettled([
    // Interns completing within 30 days
    query(
      `SELECT pr.id, pr.internship_type, pr.internship_end_date,
              u.full_name, u.id AS user_id,
              (pr.internship_end_date::date - CURRENT_DATE) AS days_remaining
       FROM people_records pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.employment_category = 'intern'
         AND pr.employment_status = 'active'
         AND pr.internship_end_date IS NOT NULL
         AND pr.internship_end_date::date <= (CURRENT_DATE + INTERVAL '30 days')::date
       ORDER BY pr.internship_end_date ASC`
    ),
    // Staff on probation with end date within 14 days
    query(
      `SELECT pr.id, pr.probation_end, u.full_name, u.id AS user_id,
              (pr.probation_end::date - CURRENT_DATE) AS days_remaining
       FROM people_records pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.employment_status = 'probation'
         AND pr.probation_end IS NOT NULL
         AND pr.probation_end::date <= (CURRENT_DATE + INTERVAL '14 days')::date
       ORDER BY pr.probation_end ASC`
    ),
    // Contracts expiring within 30 days
    query(
      `SELECT pr.id, pr.contract_end_date, u.full_name, u.id AS user_id,
              (pr.contract_end_date::date - CURRENT_DATE) AS days_remaining
       FROM people_records pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.employment_type = 'contract'
         AND pr.employment_status = 'active'
         AND pr.contract_end_date IS NOT NULL
         AND pr.contract_end_date::date <= (CURRENT_DATE + INTERVAL '30 days')::date
       ORDER BY pr.contract_end_date ASC`
    ),
    // Unresolved disciplinary records
    supabase
      .from('disciplinary_records')
      .select('id, type, date_issued, user_id, users!user_id(full_name)')
      .eq('is_resolved', false)
      .order('date_issued', { ascending: false }),
  ]);

  return {
    internships:  internships.status  === 'fulfilled' ? internships.value.rows  : [],
    probations:   probations.status   === 'fulfilled' ? probations.value.rows   : [],
    contracts:    contracts.status    === 'fulfilled' ? contracts.value.rows    : [],
    disciplinary: disciplinary.status === 'fulfilled' ? (disciplinary.value.data || []) : [],
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
