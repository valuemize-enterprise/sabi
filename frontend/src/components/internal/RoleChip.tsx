'use client';

/** Role-to-colour map for every role in the system */
const ROLE_META: Record<string, { label: string; color: string; level: 'super' | 'admin' | 'staff' }> = {
  super_admin:          { label: 'Super Admin',        color: 'bg-red-500/15 text-red-400 border-red-500/25',        level: 'super' },
  ceo:                  { label: 'CEO',                color: 'bg-red-500/10 text-red-300 border-red-400/20',        level: 'admin' },
  managing_director:    { label: 'Managing Director',  color: 'bg-orange-500/15 text-orange-400 border-orange-500/25', level: 'admin' },
  creative_director:    { label: 'Creative Director',  color: 'bg-pink-500/15 text-pink-400 border-pink-500/25',     level: 'admin' },
  strategy_director:    { label: 'Strategy Director',  color: 'bg-purple-500/15 text-purple-400 border-purple-500/25', level: 'admin' },
  account_director:     { label: 'Account Director',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',     level: 'admin' },
  account_manager:      { label: 'Account Manager',    color: 'bg-sky-500/15 text-sky-400 border-sky-500/25',        level: 'staff' },
  senior_strategist:    { label: 'Senior Strategist',  color: 'bg-teal-500/15 text-teal-400 border-teal-500/25',     level: 'staff' },
  strategist:           { label: 'Strategist',         color: 'bg-green-500/15 text-green-400 border-green-500/25',  level: 'staff' },
  creative_lead:        { label: 'Creative Lead',      color: 'bg-purple-500/10 text-purple-300 border-purple-400/20', level: 'staff' },
  copywriter:           { label: 'Copywriter',         color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',  level: 'staff' },
  social_media_manager: { label: 'Social Media Manager', color: 'bg-lime-500/15 text-lime-400 border-lime-500/25',   level: 'staff' },
  analytics_specialist: { label: 'Analytics Specialist', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',  level: 'staff' },
  client_success:       { label: 'Client Success',     color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25', level: 'staff' },
};

/**
 * RoleChip — coloured badge for a user role
 * Usage: <RoleChip role="account_manager" />
 */
export function RoleChip({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? {
    label: role.replace(/_/g, ' '),
    color: 'bg-white/5 text-white/40 border-white/10',
    level: 'staff',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${meta.color}`}>
      {meta.label}
    </span>
  );
}

/**
 * RoleLevelChip — shows whether a role is Admin-level or Staff-level
 */
export function RoleLevelChip({ role }: { role: string }) {
  const meta  = ROLE_META[role];
  const level = meta?.level ?? 'staff';
  const cfg: Record<string, string> = {
    super: 'bg-red-500/10 text-red-400 border-red-500/20',
    admin: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    staff: 'bg-white/5 text-white/35 border-white/10',
  };
  const lbl: Record<string, string> = {
    super: 'Super Admin',
    admin: 'Admin Level',
    staff: 'Staff',
  };
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide ${cfg[level]}`}>
      {lbl[level]}
    </span>
  );
}

/** The same metadata, exported for use in dropdowns etc. */
export const ALL_ROLES = ROLE_META;

/** Roles that can be selected when creating an admin-level user (Super Admin only) */
export const ADMIN_SELECTABLE_ROLES = Object.entries(ROLE_META)
  .filter(([, v]) => v.level === 'admin')
  .map(([key]) => key);

/** Roles that can be selected when creating a staff user */
export const STAFF_SELECTABLE_ROLES = Object.entries(ROLE_META)
  .filter(([, v]) => v.level === 'staff')
  .map(([key]) => key);

/** All roles that get access to the internal admin dashboard */
export const INTERNAL_ADMIN_ROLES = Object.entries(ROLE_META)
  .filter(([, v]) => v.level === 'super' || v.level === 'admin')
  .map(([key]) => key);
