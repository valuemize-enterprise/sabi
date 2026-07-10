'use client';

const ROLE_META: Record<string, { label: string; color: string; level: 'super' | 'admin' | 'brand_admin' | 'staff' }> = {
  super_admin:          { label: 'Super Admin',         color: 'bg-red-500/15 text-red-400 border-red-500/25',           level: 'super'       },
  ceo:                  { label: 'CEO',                 color: 'bg-red-500/10 text-red-300 border-red-400/20',           level: 'admin'       },
  managing_director:    { label: 'Managing Director',   color: 'bg-orange-500/15 text-orange-400 border-orange-500/25', level: 'admin'       },
  creative_director:    { label: 'Creative Director',   color: 'bg-pink-500/15 text-pink-400 border-pink-500/25',       level: 'admin'       },
  strategy_director:    { label: 'Strategy Director',   color: 'bg-purple-500/15 text-purple-400 border-purple-500/25', level: 'admin'       },
  account_director:     { label: 'Account Director',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',       level: 'admin'       },
  // Brand-level admin role (role_on_brand, not system role)
  brand_admin:          { label: 'Brand Admin',         color: 'bg-violet-500/15 text-violet-300 border-violet-500/30', level: 'brand_admin' },
  // Staff roles
  account_manager:      { label: 'Account Manager',     color: 'bg-sky-500/15 text-sky-400 border-sky-500/25',          level: 'staff'       },
  brand_manager:        { label: 'Brand Manager',       color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25', level: 'staff'       },
  senior_strategist:    { label: 'Senior Strategist',   color: 'bg-teal-500/15 text-teal-400 border-teal-500/25',       level: 'staff'       },
  strategist:           { label: 'Strategist',          color: 'bg-green-500/15 text-green-400 border-green-500/25',    level: 'staff'       },
  creative_lead:        { label: 'Creative Lead',       color: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25', level: 'staff'    },
  copywriter:           { label: 'Copywriter',          color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',    level: 'staff'       },
  social_media_manager: { label: 'Social Media Manager',color: 'bg-lime-500/15 text-lime-400 border-lime-500/25',       level: 'staff'       },
  analytics_specialist: { label: 'Analytics Specialist',color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',       level: 'staff'       },
  content_creator:      { label: 'Content Creator',     color: 'bg-rose-500/15 text-rose-400 border-rose-500/25',       level: 'staff'       },
  art_director:     { label: 'Art Director',    color: 'bg-pink-500/15 text-pink-400 border-pink-500/25',       level: 'staff'       },
  community_manager:    { label: 'Community Manager',   color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', level: 'staff'    },
  client_success:       { label: 'Client Success',      color: 'bg-violet-500/15 text-violet-400 border-violet-500/25', level: 'staff'       },
};

export function RoleChip({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? {
    label: role?.replace(/_/g, ' ') ?? role,
    color: 'bg-white/5 text-white/40 border-white/10',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${meta.color}`}>
      {role === 'brand_admin' && <span className="mr-1">🛡️</span>}
      {meta.label}
    </span>
  );
}

export function RoleLevelChip({ role }: { role: string }) {
  const meta  = ROLE_META[role];
  const level = meta?.level ?? 'staff';
  const cfg: Record<string, string> = {
    super:       'bg-red-500/10 text-red-400 border-red-500/20',
    admin:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
    brand_admin: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    staff:       'bg-white/5 text-white/35 border-white/10',
  };
  const lbl: Record<string, string> = {
    super: 'Super Admin', admin: 'Admin Level', brand_admin: 'Brand Admin', staff: 'Staff',
  };
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide ${cfg[level]}`}>
      {lbl[level]}
    </span>
  );
}

export const ALL_ROLES = ROLE_META;

export const ADMIN_SELECTABLE_ROLES = Object.entries(ROLE_META)
  .filter(([, v]) => v.level === 'admin')
  .map(([k]) => k);

export const STAFF_SELECTABLE_ROLES = Object.entries(ROLE_META)
  .filter(([, v]) => v.level === 'staff')
  .map(([k]) => k);

export const INTERNAL_ADMIN_ROLES = Object.entries(ROLE_META)
  .filter(([, v]) => v.level === 'super' || v.level === 'admin')
  .map(([k]) => k);

// Brand-level roles for the team assignment picker
export const BRAND_ROLE_OPTIONS = [
  { value: 'brand_admin',          label: 'Brand Admin',           icon: '🛡️',  desc: 'Full control of this brand only — assigned by Super Admin',      elevated: true  },
  { value: 'account_manager',      label: 'Account Manager',       icon: '👔',  desc: 'Overall client relationship owner',                              elevated: false },
  { value: 'brand_manager',        label: 'Brand Manager',         icon: '🎯',  desc: 'Day-to-day brand stewardship',                                   elevated: false },
  { value: 'creative_director',    label: 'Creative Director',     icon: '🎨',  desc: 'Oversees all creative output',                                   elevated: false },
  { value: 'senior_strategist',    label: 'Senior Strategist',     icon: '🧠',  desc: 'Leads strategy and planning',                                    elevated: false },
  { value: 'strategist',           label: 'Strategist',            icon: '📊',  desc: 'Executes campaign strategies',                                   elevated: false },
  { value: 'copywriter',           label: 'Copywriter',            icon: '✍️',  desc: 'Writes all brand copy',                                          elevated: false },
  { value: 'social_media_manager', label: 'Social Media Manager',  icon: '📱',  desc: 'Social content and scheduling',                                  elevated: false },
  { value: 'analytics_specialist', label: 'Analytics Specialist',  icon: '📈',  desc: 'Data and ClarityScore™',                                         elevated: false },
  { value: 'content_creator',      label: 'Content Creator',       icon: '🎬',  desc: 'Video and content assets',                                       elevated: false },
  { value: 'art_director',     label: 'Art Director',      icon: '🖌️',  desc: 'Visual assets and design',                                       elevated: false },
  { value: 'community_manager',    label: 'Community Manager',     icon: '💬',  desc: 'Community engagement',                                           elevated: false },
  { value: 'contributor',          label: 'Contributor',           icon: '👤',  desc: 'General contributor to this account',                            elevated: false },
];
