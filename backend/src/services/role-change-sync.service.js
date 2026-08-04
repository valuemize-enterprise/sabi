// ═══════════════════════════════════════════════════════════════════
// role-change-sync.service.js
// Sabi Intelligence Suite — Phase C: People OS
//
// When HR changes a staff member's role_key in People OS,
// this service propagates the change across:
//   1. users.role (system permission level, if role maps to one)
//   2. staff_brand_assignments.role_on_brand for all active assignments
//   3. In-app notification to the affected staff member
// ═══════════════════════════════════════════════════════════════════

'use strict';

const supabase = require('../config/supabase');

// ── role_key → system role mapping ───────────────────────────────
// Maps people_records.role_key values to users.role system roles.
// Only keys listed here trigger a users.role update.
// All other role_key values update the title/display only.

const ROLE_KEY_TO_SYSTEM_ROLE = {
  // Leadership / management
  'md':                    'md',
  'managing_director':     'md',
  'creative_director':     'creative_director',
  'account_director':      'admin',
  'strategy_director':     'admin',
  'hr':                    'hr',
  'hr_manager':            'hr',

  // Brand-level
  'brand_admin':           'brand_admin',
  'account_manager':       'brand_admin',
  'ba':                    'brand_admin',

  // Operational staff (no elevated system access)
  'copywriter':            'staff',
  'senior_copywriter':     'staff',
  'designer':              'staff',
  'senior_designer':       'staff',
  'videographer':          'staff',
  'photographer':          'staff',
  'strategist':            'staff',
  'social_media_manager':  'staff',
  'community_manager':     'staff',
  'project_manager':       'staff',
  'content_creator':       'staff',
  'pr_officer':            'staff',
  'intern':                'staff',
};

// ── role_key → assignment role mapping ───────────────────────────
// Maps people_records.role_key to the role column in staff_brand_assignments

const ROLE_KEY_TO_ASSIGNMENT_ROLE = {
  'creative_director': 'creative_director',
  'account_director':  'brand_admin',
  'brand_admin':       'brand_admin',
  'account_manager':   'brand_admin',
  'ba':                'brand_admin',
};

// ── Main sync function ────────────────────────────────────────────

/**
 * Synchronise a role change across the Sabi system.
 *
 * @param {string} userId        - The staff member's users.id
 * @param {string} newRoleKey    - The new role_key from people_records
 * @param {string} newRoleTitle  - The human-readable title (e.g. "Senior Copywriter")
 * @param {string} changedByName - Name of the HR user who made the change (for notification)
 * @returns {{ systemRoleUpdated: boolean, assignmentsUpdated: number }}
 */
const syncRoleChange = async (userId, newRoleKey, newRoleTitle, changedByName) => {
  const result = { systemRoleUpdated: false, assignmentsUpdated: 0 };

  // 1. Update users.role if there's a known system role mapping
  const newSystemRole = ROLE_KEY_TO_SYSTEM_ROLE[newRoleKey?.toLowerCase()];
  if (newSystemRole) {
    const { error } = await supabase
      .from('users')
      .update({ role: newSystemRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[role-sync] users.role update failed:', error.message);
    } else {
      result.systemRoleUpdated = true;
    }
  }

  // 2. Update staff_brand_assignments.role_on_brand for all active assignments
  const newAssignmentRole = ROLE_KEY_TO_ASSIGNMENT_ROLE[newRoleKey?.toLowerCase()];
  if (newAssignmentRole) {
    const { data: updated, error } = await supabase
      .from('staff_brand_assignments')
      .update({ role_on_brand: newAssignmentRole, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_active', true)
      .select('id');

    if (error) {
      console.error('[role-sync] brand assignments update failed:', error.message);
    } else {
      result.assignmentsUpdated = updated?.length || 0;
    }
  }

  // 3. Send in-app notification to the staff member
  await supabase
    .from('notifications')
    .insert({
      user_id:  userId,
      type:     'role_updated',
      title:    'Your Role Has Been Updated',
      body:     `Your role in Sabi has been updated to ${newRoleTitle}. Your access and task assignments have been updated accordingly.${newSystemRole ? ` Your system permissions have also been updated.` : ''}`,
      metadata: {
        new_role_key:    newRoleKey,
        new_role_title:  newRoleTitle,
        new_system_role: newSystemRole || null,
        changed_by:      changedByName,
      },
    })
    .catch(e => console.error('[role-sync] Notification insert failed:', e.message));

  console.log(
    `[role-sync] User ${userId}: role_key → ${newRoleKey}`,
    `| system role: ${newSystemRole || 'unchanged'}`,
    `| assignments updated: ${result.assignmentsUpdated}`
  );

  return result;
};

module.exports = { syncRoleChange, ROLE_KEY_TO_SYSTEM_ROLE };
