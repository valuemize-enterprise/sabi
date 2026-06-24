/**
 * Super Admin Auth Routes
 * POST /api/super-admin/auth/login
 * GET  /api/super-admin/auth/me
 */

'use strict';

const router      = require('express').Router();
const bcrypt      = require('bcryptjs');
const SUPER_ADMIN = require('../../config/super-admin.config');
const { generateSuperAdminToken }  = require('../../utils/jwt.utils');
const { authenticateSuperAdmin }   = require('../../middleware/auth.middleware');
const { sendSuccess, sendError }   = require('../../utils/response.utils');
const { auditLog }                 = require('../../middleware/logger.middleware');

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password required');

    if (email !== SUPER_ADMIN.email) return sendError(res, 401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, SUPER_ADMIN.passwordHash);
    if (!valid) return sendError(res, 401, 'Invalid credentials');

    const token = generateSuperAdminToken(SUPER_ADMIN);

    await auditLog({
      actorId: SUPER_ADMIN.id, actorEmail: SUPER_ADMIN.email, actorRole: 'super_admin',
      action: 'SUPER_ADMIN_LOGIN', req
    });

    sendSuccess(res, {
      token,
      admin: { id: SUPER_ADMIN.id, email: SUPER_ADMIN.email, full_name: SUPER_ADMIN.full_name, role: 'super_admin' },
    });
  } catch (err) { next(err); }
});

router.get('/me', authenticateSuperAdmin, (req, res) => {
  sendSuccess(res, { admin: req.superAdmin });
});

router.post('/logout', authenticateSuperAdmin, async (req, res) => {
  await auditLog({ actorId: SUPER_ADMIN.id, actorEmail: SUPER_ADMIN.email, actorRole: 'super_admin', action: 'SUPER_ADMIN_LOGOUT', req });
  sendSuccess(res, null, 'Logged out');
});

module.exports = router;
