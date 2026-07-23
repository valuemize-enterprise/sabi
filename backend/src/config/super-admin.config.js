/**
 * Sabi Super Admin Configuration
 * ─────────────────────────────────────────────────────────────
 * CRITICAL SECURITY NOTICE:
 * Credentials are HARDCODED. Cannot be changed via UI or API.
 * To change: edit this file directly on the server and restart.
 *
 * Credentials:
 *   Email:    cerebreplus@gmail.com
 *   Password: Cerebre234$M
 *
 * Regenerate hash: node -e "const b=require('bcryptjs'); console.log(b.hashSync('Cerebre234\$M',12))"
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const SUPER_ADMIN = {
  email:      'cerebreplus@gmail.com',
  passwordHash: '$2a$12$OvJHcfIM5HHOzH2fSn9p..gb1k2zrix6m6ydbOg8ka11RZof3wVw2',
  full_name:  'Super Administrator',
  role:       'super_admin',
  id:         '00000000-0000-0000-0000-000000000000',
};

module.exports = SUPER_ADMIN;


