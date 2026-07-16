/**
 * Sabi Auth Middleware
 * Verifies JWTs for Agency staff, Clients, and Super Admin
 */

'use strict';

const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const supabase   = require('../config/supabase');
const SUPER_ADMIN = require('../config/super-admin.config');
const { hasPermission } = require('../config/roles.config');
const { sendError } = require('../utils/response.utils');

const JWT_SECRET        = process.env.JWT_SECRET;
const JWT_CLIENT_SECRET = process.env.JWT_CLIENT_SECRET || process.env.JWT_SECRET;
const JWT_SA_SECRET     = process.env.JWT_SA_SECRET || process.env.JWT_SECRET;

// ── Agency Staff Authentication ───────────────────────────────
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return sendError(res, 401, 'No token provided');

    const token = header.split(' ')[1];
    let decoded;

    // Try agency JWT_SECRET first, fall back to SA secret for super admins
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      // If the token was signed with the same secret but is a super admin token,
      // use the hardcoded SA identity instead of querying the users table
      if (decoded.role === 'super_admin' && decoded.email === SUPER_ADMIN.email) {
        req.user = { id: SUPER_ADMIN.id, email: decoded.email, full_name: 'Super Admin', role: 'super_admin', department: 'admin', is_active: true };
        return next();
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired');
      try {
        decoded = jwt.verify(token, JWT_SA_SECRET);
        if (decoded.role !== 'super_admin') return sendError(res, 401, 'Invalid token');
        req.user = { id: SUPER_ADMIN.id, email: decoded.email, full_name: 'Super Admin', role: 'super_admin', department: 'admin', is_active: true };
        return next();
      } catch {
        return sendError(res, 401, 'Invalid token');
      }
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, department, is_active')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return sendError(res, 401, 'Invalid token — user not found');
    if (!user.is_active) return sendError(res, 403, 'Account deactivated');

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired');
    if (err.name === 'JsonWebTokenError')  return sendError(res, 401, 'Invalid token');
    next(err);
  }
}

// ── Client Authentication ─────────────────────────────────────
async function authenticateClient(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return sendError(res, 401, 'No token provided');

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_CLIENT_SECRET);

    const { data: client, error } = await supabase
      .from('clients')
      .select('id, email, full_name, brand_id, is_active')
      .eq('id', decoded.clientId)
      .single();

    if (error || !client) return sendError(res, 401, 'Invalid token');
    if (!client.is_active) return sendError(res, 403, 'Account deactivated');

    req.client = client;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired');
    return sendError(res, 401, 'Invalid token');
  }
}

// ── Super Admin Authentication ────────────────────────────────
async function authenticateSuperAdmin(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return sendError(res, 401, 'No token provided');

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SA_SECRET);

    if (decoded.role !== 'super_admin' || decoded.email !== SUPER_ADMIN.email) {
      return sendError(res, 403, 'Super admin access required');
    }

    req.superAdmin = {
      id:        SUPER_ADMIN.id,
      email:     SUPER_ADMIN.email,
      full_name: SUPER_ADMIN.full_name,
      role:      'super_admin',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 401, 'Token expired');
    return sendError(res, 401, 'Invalid super admin token');
  }
}

// ── Permission Guard ──────────────────────────────────────────
function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.user?.role || req.superAdmin?.role;
    if (!role) return sendError(res, 401, 'Not authenticated');
    if (!hasPermission(role, permission)) {
      return sendError(res, 403, `Permission denied: ${permission} required`);
    }
    next();
  };
}

// ── Role Guard ────────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.user?.role || req.superAdmin?.role;
    if (!userRole) return sendError(res, 401, 'Not authenticated');
    if (!roles.includes(userRole)) {
      return sendError(res, 403, `Role not permitted. Required: ${roles.join(' or ')}`);
    }
    next();
  };
}

module.exports = {
  authenticate,
  authenticateClient,
  authenticateSuperAdmin,
  requirePermission,
  requireRole,
};
