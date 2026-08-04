// ═══════════════════════════════════════════════════════════════════
// status-machine.service.js
// Sabi Intelligence Suite — Phase C: People OS
//
// Governs employment status transitions.
// Every transition has defined allowed paths and side effects.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const supabase = require('../config/supabase');
const { query } = require('../db/db');

// ── Valid transitions ─────────────────────────────────────────────
// Map of current status → allowed next statuses
const TRANSITIONS = {
  probation:  ['active', 'terminated'],
  active:     ['on_leave', 'suspended', 'resigned', 'terminated', 'probation'],
  on_leave:   ['active'],
  suspended:  ['active', 'terminated'],
  resigned:   [],          // terminal — cannot transition out
  terminated: [],          // terminal — cannot transition out
};

const TERMINAL = new Set(['resigned', 'terminated']);

// ── Validate a proposed transition ───────────────────────────────

const validateTransition = (from, to) => {
  if (!TRANSITIONS[from]) {
    throw Object.assign(
      new Error(`Unknown current status: ${from}`),
      { status: 400 }
    );
  }
  if (TERMINAL.has(from)) {
    throw Object.assign(
      new Error(`Cannot change status of a staff member who has ${from}. This status is final.`),
      { status: 409 }
    );
  }
  if (!TRANSITIONS[from].includes(to)) {
    const allowed = TRANSITIONS[from].join(', ') || 'none';
    throw Object.assign(
      new Error(
        `Cannot move from '${from}' to '${to}'. Allowed transitions from ${from}: ${allowed}`
      ),
      { status: 400 }
    );
  }
};

// ── Apply side effects for a given transition ─────────────────────

const applyTransitionSideEffects = async (userId, recordId, from, to, reason, changedBy) => {
  const effects = [];

  // ── → suspended: disable Sabi login access ─────────────────────
  if (to === 'suspended') {
    const { error } = await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) console.error('[status-machine] Failed to suspend user:', error.message);
    else effects.push('login_suspended');

    // Notify Super Admins
    await notifySuperAdmins(userId, 'staff_suspended', {
      reason,
      changedBy,
      message: `A staff member has been suspended in Sabi.`,
    });
    effects.push('superadmins_notified');
  }

  // ── suspended → active: restore login access ───────────────────
  if (from === 'suspended' && to === 'active') {
    const { error } = await supabase
      .from('users')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) console.error('[status-machine] Failed to restore user:', error.message);
    else effects.push('login_restored');
  }

  // ── → terminated: immediate access revocation ──────────────────
  if (to === 'terminated') {
    const { error } = await supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) console.error('[status-machine] Failed to terminate user access:', error.message);
    else effects.push('access_revoked');

    // Set exit_date to today
    await supabase
      .from('people_records')
      .update({ exit_date: new Date().toISOString().split('T')[0], exit_reason: reason })
      .eq('id', recordId);
    effects.push('exit_date_set');

    // Notify Super Admins immediately
    await notifySuperAdmins(userId, 'staff_terminated', {
      reason,
      changedBy,
      message: `A staff member has been terminated. Their Sabi access has been revoked.`,
    });
    effects.push('superadmins_notified');
  }

  // ── → resigned: set exit date, notify Super Admins ────────────
  if (to === 'resigned') {
    await supabase
      .from('people_records')
      .update({ exit_date: new Date().toISOString().split('T')[0], exit_reason: reason })
      .eq('id', recordId);
    effects.push('exit_date_set');

    await notifySuperAdmins(userId, 'staff_resigned', {
      reason,
      changedBy,
      message: `A staff member has submitted their resignation.`,
    });
    effects.push('superadmins_notified');
  }

  // ── probation → active: mark probation complete ────────────────
  if (from === 'probation' && to === 'active') {
    await supabase
      .from('people_records')
      .update({ probation_completed_at: new Date().toISOString().split('T')[0] })
      .eq('id', recordId);
    effects.push('probation_completed');

    // Notify the staff member
    await supabase.from('notifications').insert({
      user_id:  userId,
      type:     'probation_complete',
      title:    'Probation Complete',
      body:     'Your probation period has been completed. Welcome to the full team.',
      metadata: { changedBy },
    }).catch(e => console.error('[status-machine] Probation notification failed:', e.message));
    effects.push('staff_notified');
  }

  return effects;
};

// ── Notify Super Admins helper ────────────────────────────────────

const notifySuperAdmins = async (affectedUserId, type, { message, changedBy, reason }) => {
  const { data: admins } = await supabase
    .from('users')
    .select('id')
    .in('role', ['super_admin'])
    .eq('is_active', true);

  if (!admins?.length) return;

  const notifications = admins.map(a => ({
    user_id:  a.id,
    type,
    title:    type === 'staff_terminated' ? 'Staff Member Terminated'
            : type === 'staff_suspended'  ? 'Staff Member Suspended'
            : 'Staff Resignation Logged',
    body:     message,
    metadata: { affected_user_id: affectedUserId, changed_by: changedBy, reason },
  }));

  await supabase
    .from('notifications')
    .insert(notifications)
    .catch(e => console.error('[status-machine] SA notification failed:', e.message));
};

module.exports = { validateTransition, applyTransitionSideEffects, TRANSITIONS };
