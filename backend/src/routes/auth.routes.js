/**
 * Agency Auth Routes
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 * POST /api/auth/set-password
 * POST /api/auth/refresh
 */

'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const supabase = require('../config/supabase');
const SUPER_ADMIN = require('../config/super-admin.config');
const { generateAgencyToken, generateSuperAdminToken } = require('../utils/jwt.utils');
const { authenticate }        = require('../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../utils/response.utils');
const { auditLog }            = require('../middleware/logger.middleware');

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password required');

    // Check hardcoded Super Admin first (not in users table)
    if (email.toLowerCase().trim() === SUPER_ADMIN.email) {
      const valid = await bcrypt.compare(password, SUPER_ADMIN.passwordHash);
      if (!valid) return sendError(res, 401, 'Invalid credentials');

      const token = generateSuperAdminToken(SUPER_ADMIN);
      sendSuccess(res, {
        token,
        user: {
          id:               SUPER_ADMIN.id,
          email:            SUPER_ADMIN.email,
          full_name:        SUPER_ADMIN.full_name,
          role:             'super_admin',
          department:       'admin',
          must_reset_password: false,
        },
      });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) return sendError(res, 401, 'Invalid credentials');
    if (!user.is_active) return sendError(res, 403, 'Account deactivated. Contact your administrator.');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return sendError(res, 401, 'Invalid credentials');

    // Update last login
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const token = generateAgencyToken(user);
    await auditLog({ actorId: user.id, actorEmail: user.email, actorRole: user.role, action: 'LOGIN', req });

    sendSuccess(res, {
      token,
      user: {
        id:               user.id,
        email:            user.email,
        full_name:        user.full_name,
        role:             user.role,
        department:       user.department,
        avatar_url:       user.avatar_url,
        must_reset_password: user.must_reset_password,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, full_name, role, department, phone, avatar_url, last_login, created_at')
      .eq('id', req.user.id)
      .single();

    sendSuccess(res, { user });
  } catch (err) { next(err); }
});

// POST /api/auth/set-password
router.post('/set-password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return sendError(res, 400, 'New password must be at least 8 characters');
    }

    const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.user.id).single();
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return sendError(res, 401, 'Current password is incorrect');

    const hash = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password_hash: hash, must_reset_password: false }).eq('id', req.user.id);
    await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role, action: 'PASSWORD_CHANGED', req });

    sendSuccess(res, null, 'Password updated successfully');
  } catch (err) { next(err); }
});

// POST /api/auth/logout (client-side clears token; server logs it)
router.post('/logout', authenticate, async (req, res) => {
  await auditLog({ actorId: req.user.id, actorEmail: req.user.email, actorRole: req.user.role, action: 'LOGOUT', req });
  sendSuccess(res, null, 'Logged out');
});

module.exports = router;
