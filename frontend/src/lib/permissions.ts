/**
 * permissions.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for all role checks in Sabi.
 *
 * Brand Admin concept:
 *   A staff member with role_on_brand = 'brand_admin' for a specific
 *   brand has full admin control over THAT brand only.
 *   They cannot see other brands, access platform settings, or
 *   create global admins. Only the Super Admin can assign brand_admin.
 *
 * Usage:
 *   import { isGlobalAdmin, canManageBrand, useBrandRole } from '@/lib/permissions';
 */

// ── System-level role groups ──────────────────────────────────
export const SUPER_ADMIN_ROLE = 'super_admin';

/** Roles that have global access to all brands and platform management */
export const GLOBAL_ADMIN_ROLES = [
  'super_admin',
  'ceo',
  'managing_director',
  'creative_director',
  'strategy_director',
  'account_director',
] as const;

/** All staff-level system roles */
export const STAFF_ROLES = [
  'account_manager',
  'brand_manager',
  'senior_strategist',
  'strategist',
  'creative_lead',
  'copywriter',
  'social_media_manager',
  'analytics_specialist',
  'client_success',
  'content_creator',
  'graphic_designer',
  'community_manager',
] as const;

// ── Brand-level roles (role_on_brand in staff_brand_assignments) ──
export const BRAND_ROLES = [
  'brand_admin',           // ← Elevated: full control of this brand
  'account_manager',
  'brand_manager',
  'creative_director',
  'senior_strategist',
  'strategist',
  'copywriter',
  'social_media_manager',
  'analytics_specialist',
  'content_creator',
  'graphic_designer',
  'community_manager',
  'contributor',
] as const;

export type GlobalAdminRole = typeof GLOBAL_ADMIN_ROLES[number];
export type StaffRole       = typeof STAFF_ROLES[number];
export type BrandRole       = typeof BRAND_ROLES[number];

// ── Role metadata for UI ──────────────────────────────────────
export const BRAND_ROLE_META: Record<string, { label: string; icon: string; desc: string; isElevated: boolean }> = {
  brand_admin:          { label: 'Brand Admin',           icon: '🛡️',  desc: 'Full control over this brand only', isElevated: true  },
  account_manager:      { label: 'Account Manager',       icon: '👔',  desc: 'Overall client relationship',       isElevated: false },
  brand_manager:        { label: 'Brand Manager',         icon: '🎯',  desc: 'Day-to-day brand stewardship',      isElevated: false },
  creative_director:    { label: 'Creative Director',     icon: '🎨',  desc: 'Oversees all creative output',      isElevated: false },
  senior_strategist:    { label: 'Senior Strategist',     icon: '🧠',  desc: 'Leads strategy and planning',       isElevated: false },
  strategist:           { label: 'Strategist',            icon: '📊',  desc: 'Executes campaign strategies',      isElevated: false },
  copywriter:           { label: 'Copywriter',            icon: '✍️',  desc: 'Writes all brand copy',             isElevated: false },
  social_media_manager: { label: 'Social Media Manager',  icon: '📱',  desc: 'Social content and scheduling',     isElevated: false },
  analytics_specialist: { label: 'Analytics Specialist',  icon: '📈',  desc: 'Data and ClarityScore™',            isElevated: false },
  content_creator:      { label: 'Content Creator',       icon: '🎬',  desc: 'Video and content assets',          isElevated: false },
  art_director:     { label: 'Art Director',      icon: '🖌️',  desc: 'Visual assets and design',          isElevated: false },
  community_manager:    { label: 'Community Manager',     icon: '💬',  desc: 'Community engagement',              isElevated: false },
  contributor:          { label: 'Contributor',           icon: '👤',  desc: 'General contributor',               isElevated: false },
};

// ── Pure role check helpers ───────────────────────────────────

/** True if the user has a global admin system role */
export function isGlobalAdmin(systemRole?: string): boolean {
  return GLOBAL_ADMIN_ROLES.includes(systemRole as GlobalAdminRole);
}

/** True if the user is the Super Admin specifically */
export function isSuperAdmin(systemRole?: string): boolean {
  return systemRole === SUPER_ADMIN_ROLE;
}

/**
 * True if the user can perform admin actions on a specific brand.
 * Passes if they are a global admin OR a brand_admin for this brand.
 */
export function canManageBrand(systemRole?: string, roleOnBrand?: string): boolean {
  return isGlobalAdmin(systemRole) || roleOnBrand === 'brand_admin';
}

/**
 * True if the user can assign staff to a brand.
 * Global admins can always. Brand admins can assign contributors/staff (not brand_admin).
 */
export function canAssignStaff(systemRole?: string, roleOnBrand?: string): boolean {
  return canManageBrand(systemRole, roleOnBrand);
}

/**
 * True if the user can promote someone to brand_admin.
 * Only global admins can create brand admins.
 */
export function canCreateBrandAdmin(systemRole?: string): boolean {
  return isGlobalAdmin(systemRole);
}

/** True if the user can approve deliverables for a brand */
export function canApproveDeliverables(systemRole?: string, roleOnBrand?: string): boolean {
  return canManageBrand(systemRole, roleOnBrand);
}

/** True if the user can publish reports for a brand */
export function canPublishReports(systemRole?: string, roleOnBrand?: string): boolean {
  return canManageBrand(systemRole, roleOnBrand);
}

// ── Link type detection for proof links ──────────────────────
export type ProofLinkType =
  | 'google_meet'
  | 'google_sheets'
  | 'google_docs'
  | 'google_drive'
  | 'google_slides'
  | 'canva'
  | 'notion'
  | 'figma'
  | 'meta_ads'
  | 'google_analytics'
  | 'youtube'
  | 'loom'
  | 'whatsapp'
  | 'link';

export interface ProofLink {
  url:   string;
  label: string;
  type:  ProofLinkType;
}

const LINK_PATTERNS: [RegExp, ProofLinkType][] = [
  [/meet\.google\.com/i,                  'google_meet'      ],
  [/docs\.google\.com\/spreadsheets/i,    'google_sheets'    ],
  [/docs\.google\.com\/document/i,        'google_docs'      ],
  [/docs\.google\.com\/presentation/i,    'google_slides'    ],
  [/drive\.google\.com/i,                 'google_drive'     ],
  [/canva\.com/i,                         'canva'            ],
  [/notion\.so|notion\.com/i,             'notion'           ],
  [/figma\.com/i,                         'figma'            ],
  [/facebook\.com\/ads|meta\.com\/ads/i,  'meta_ads'         ],
  [/analytics\.google\.com|ga4/i,         'google_analytics' ],
  [/youtube\.com|youtu\.be/i,             'youtube'          ],
  [/loom\.com/i,                          'loom'             ],
  [/wa\.me|web\.whatsapp|api\.whatsapp/i, 'whatsapp'         ],
];

export const LINK_META: Record<ProofLinkType, { label: string; icon: string; color: string }> = {
  google_meet:      { label: 'Google Meet',      icon: '🎥',  color: 'blue'   },
  google_sheets:    { label: 'Google Sheets',    icon: '📗',  color: 'green'  },
  google_docs:      { label: 'Google Docs',      icon: '📄',  color: 'blue'   },
  google_slides:    { label: 'Google Slides',    icon: '📊',  color: 'amber'  },
  google_drive:     { label: 'Google Drive',     icon: '📁',  color: 'amber'  },
  canva:            { label: 'Canva',            icon: '🎨',  color: 'purple' },
  notion:           { label: 'Notion',           icon: '📝',  color: 'gray'   },
  figma:            { label: 'Figma',            icon: '🖌️',  color: 'purple' },
  meta_ads:         { label: 'Meta Ads',         icon: '📣',  color: 'blue'   },
  google_analytics: { label: 'Google Analytics', icon: '📈',  color: 'amber'  },
  youtube:          { label: 'YouTube',          icon: '▶️',  color: 'red'    },
  loom:             { label: 'Loom Recording',   icon: '🎬',  color: 'purple' },
  whatsapp:         { label: 'WhatsApp',         icon: '💬',  color: 'green'  },
  link:             { label: 'Link',             icon: '🔗',  color: 'gray'   },
};

/** Auto-detect link type from URL */
export function detectLinkType(url: string): ProofLinkType {
  for (const [pattern, type] of LINK_PATTERNS) {
    if (pattern.test(url)) return type;
  }
  return 'link';
}

/** Build a ProofLink object from a URL and optional label */
export function buildProofLink(url: string, label?: string): ProofLink {
  const type = detectLinkType(url);
  return {
    url,
    label: label || LINK_META[type].label,
    type,
  };
}

// ── React hooks (use inside components) ──────────────────────

import { useAgencyStore } from './store';

/** Returns the user's role on a specific brand from the store/cache */
export function useBrandPermissions(brandId?: string) {
  const { user } = useAgencyStore();
  const systemRole = user?.role ?? '';

  // Global admins have full access to everything
  if (isGlobalAdmin(systemRole)) {
    return {
      isGlobalAdmin:     true,
      isBrandAdmin:      true,
      canManage:         true,
      canApprove:        true,
      canPublish:        true,
      canAssignStaff:    true,
      canCreateBrandAdmin: canCreateBrandAdmin(systemRole),
      roleOnBrand:       'global_admin' as const,
    };
  }

  // For staff: check the brand assignments stored in the Zustand store
  // The store should have loaded /api/agency/staff/me/brands on login
  const brandAssignments: any[] = (user as any)?.brandAssignments ?? [];
  const assignment = brandAssignments.find(
    (a: any) => a.brand_id === brandId || a.id === brandId
  );
  const roleOnBrand = assignment?.role_on_brand ?? null;

  return {
    isGlobalAdmin:     false,
    isBrandAdmin:      roleOnBrand === 'brand_admin',
    canManage:         roleOnBrand === 'brand_admin',
    canApprove:        roleOnBrand === 'brand_admin',
    canPublish:        roleOnBrand === 'brand_admin',
    canAssignStaff:    roleOnBrand === 'brand_admin',
    canCreateBrandAdmin: false,
    roleOnBrand,
  };
}
