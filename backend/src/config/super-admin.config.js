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
  passwordHash: '$2a$12$5p/E10ssoTXs3qjXnB7g2ees7gumbd7DHacsirrpx.VRCvTx9bDDq',
  full_name:  'Super Administrator',
  role:       'super_admin',
  id:         'super-admin-cerebre-0000-000000000000',
};

module.exports = SUPER_ADMIN;
