/**
 * Sabi RBAC Role Configuration
 * 15 roles from Super Admin → Client
 */

'use strict';

const ROLES = {
  CEO:                          'ceo',
  MANAGING_DIRECTOR:            'managing_director',
  ACCOUNT_DIRECTOR:             'account_director',
  ACCOUNT_MANAGER:              'account_manager',
  SENIOR_STRATEGIST:            'senior_strategist',
  STRATEGIST:                   'strategist',
  COPYWRITER:                   'copywriter',
  SOCIAL_MEDIA_MANAGER:         'social_media_manager',
  ANALYTICS_SPECIALIST:         'analytics_specialist',
  CREATIVE_LEAD:                'creative_lead',
  ART_DIRECTOR:                 'art_director',
  SENIOR_ART_DIRECTOR:          'senior_art_director',
  BUSINESS_DIRECTOR:            'business_director',
  BRAND_MANAGER:                'brand_manager',
  SENIOR_BRAND_MANAGER:         'senior_brand_manager',
  ECONOMIST:                    'economist',
  WEBSITE_DEVELOPER:            'website_developer',
  VIDEO_EDITOR:                 'video_editor',
  CINEMATOGRAPHER:              'cinematographer',
  INTERN:                       'intern',
  RESEARCHER:                   'researcher',
  WEBMASTER:                    'webmaster',
  INFLUENCER_MARKETING_EXPERT:  'influencer_marketing_expert',
  OTHER:                        'other',
  SUPER_ADMIN:                  'super_admin',
  CLIENT:                       'client',
}

const ROLE_HIERARCHY = [
  ROLES.CEO,
  ROLES.MANAGING_DIRECTOR,
  ROLES.ACCOUNT_DIRECTOR,
  ROLES.ACCOUNT_MANAGER,
  ROLES.SENIOR_STRATEGIST,
  ROLES.STRATEGIST,
  ROLES.COPYWRITER,
  ROLES.SOCIAL_MEDIA_MANAGER,
  ROLES.ANALYTICS_SPECIALIST,
  ROLES.CREATIVE_LEAD,
  ROLES.ART_DIRECTOR,
  ROLES.SENIOR_ART_DIRECTOR,
  ROLES.BUSINESS_DIRECTOR,
  ROLES.BRAND_MANAGER,
  ROLES.SENIOR_BRAND_MANAGER,
  ROLES.ECONOMIST,
  ROLES.WEBSITE_DEVELOPER,
  ROLES.VIDEO_EDITOR,
  ROLES.CINEMATOGRAPHER,
  ROLES.INTERN,
  ROLES.RESEARCHER,
  ROLES.WEBMASTER,
  ROLES.INFLUENCER_MARKETING_EXPERT,
  ROLES.OTHER,
];

const AGENCY_ROLES = ROLE_HIERARCHY.filter(r => r !== ROLES.CLIENT && r !== ROLES.SUPER_ADMIN);

const PERMISSIONS = {
  // User management
  MANAGE_USERS:         [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR],
  CREATE_STAFF:         [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR],
  VIEW_ALL_STAFF:       [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR, ROLES.CREATIVE_DIRECTOR, ROLES.STRATEGY_DIRECTOR],

  // Brand management
  CREATE_BRAND:         [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR, ROLES.ACCOUNT_MANAGER],
  EDIT_BRAND:           [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR, ROLES.ACCOUNT_MANAGER],
  DELETE_BRAND:         [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR],
  VIEW_ALL_BRANDS:      [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR],

  // Reports
  CREATE_REPORT:        [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SENIOR_STRATEGIST, ROLES.STRATEGIST, ROLES.ANALYTICS_SPECIALIST],
  PUBLISH_REPORT:       [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR, ROLES.ACCOUNT_MANAGER],
  DELETE_REPORT:        [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR],

  // Goals
  CREATE_GOAL:          [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SENIOR_STRATEGIST, ROLES.STRATEGIST],
  EDIT_GOAL:            [ROLES.SUPER_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SENIOR_STRATEGIST, ROLES.STRATEGIST],

  // ARIA
  USE_ARIA:             AGENCY_ROLES.concat([ROLES.SUPER_ADMIN]),
  MANAGE_ARIA_CONFIG:   [ROLES.SUPER_ADMIN, ROLES.CEO],

  // Analytics
  VIEW_ANALYTICS:       [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR, ROLES.ACCOUNT_DIRECTOR, ROLES.ACCOUNT_MANAGER, ROLES.ANALYTICS_SPECIALIST],

  // Platform
  MANAGE_PLATFORM:      [ROLES.SUPER_ADMIN],
  VIEW_AUDIT_LOGS:      [ROLES.SUPER_ADMIN, ROLES.CEO, ROLES.MANAGING_DIRECTOR],
};

function hasPermission(role, permission) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

function isAgencyRole(role) {
  return AGENCY_ROLES.includes(role);
}

function getRoleLevel(role) {
  return ROLE_HIERARCHY.indexOf(role);
}

function canManage(actorRole, targetRole) {
  const actorLevel  = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetRole);
  return actorLevel < targetLevel;
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  AGENCY_ROLES,
  PERMISSIONS,
  hasPermission,
  isAgencyRole,
  getRoleLevel,
  canManage,
};
