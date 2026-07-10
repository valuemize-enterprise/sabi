/**
 * Invitation Routes
 * Proper invite-based onboarding — users get a link, set their own password.
 *
 * POST /api/auth/invite/staff   — create staff invitation
 * POST /api/auth/invite/client  — create client invitation
 * GET  /api/auth/invite/:token  — validate token (public, no auth)
 * POST /api/auth/invite/accept  — accept invitation, set password, create account
 */
'use strict';

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const supabase = require('../../config/supabase');
const { authenticate, authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const emailService = require('../../services/email.service');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ── POST /api/auth/invite/staff ───────────────────────────────
router.post('/staff', authenticate, async (req, res, next) => {
  try {
    const { email, role, department, full_name } = req.body;
    if (!email || !role) return sendError(res, 400, 'email and role are required');

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email:       email.toLowerCase().trim(),
        invite_type: 'staff',
        role,
        token,
        expires_at:  expiresAt.toISOString(),
        created_by:  req.user.id,
        metadata:    { department, full_name, suggested_name: full_name },
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return sendError(res, 409, 'An active invitation already exists for this email');
      throw error;
    }

    const inviteUrl = `${APP_URL}/accept-invite?token=${token}`;

    // Send invitation email
    await emailService.sendInvitation({
      name:       full_name || email.split('@')[0],
      email,
      inviteUrl,
      role:       role.replace(/_/g, ' '),
      portalType: 'Internal Portal',
      expiryDays: 7,
    });

    sendSuccess(res, {
      invitation: { id: data.id, email, token, expires_at: data.expires_at },
      invite_url: inviteUrl,
    }, 'Invitation sent', 201);
  } catch (err) { next(err); }
});

// ── POST /api/auth/invite/client ──────────────────────────────
router.post('/client', authenticate, async (req, res, next) => {
  try {
    const { email, brand_id, full_name, job_title } = req.body;
    if (!email || !brand_id) return sendError(res, 400, 'email and brand_id are required');

    const { data: brand } = await supabase.from('brands').select('name').eq('id', brand_id).single();
    if (!brand) return sendError(res, 404, 'Brand not found');

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        email:       email.toLowerCase().trim(),
        invite_type: 'client',
        brand_id,
        token,
        expires_at:  expiresAt.toISOString(),
        created_by:  req.user.id,
        metadata:    { full_name, job_title, brand_name: brand.name },
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return sendError(res, 409, 'An active invitation already exists for this email');
      throw error;
    }

    const inviteUrl = `${APP_URL}/accept-invite?token=${token}`;

    await emailService.sendInvitation({
      name:       full_name || email.split('@')[0],
      email,
      inviteUrl,
      role:       `Client Portal — ${brand.name}`,
      portalType: 'Client Portal',
      expiryDays: 7,
      brandName:  brand.name,
    });

    sendSuccess(res, {
      invitation: { id: data.id, email, token, expires_at: data.expires_at },
      invite_url: inviteUrl,
    }, 'Client invitation sent', 201);
  } catch (err) { next(err); }
});

// ── GET /api/auth/invite/:token ───────────────────────────────
// Public — validates token and returns invite info for the accept page
router.get('/:token', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, email, invite_type, role, brand_id, expires_at, accepted_at, metadata, brands(name)')
      .eq('token', req.params.token)
      .single();

    if (error || !data) return sendError(res, 404, 'Invitation not found or already used');
    if (data.accepted_at) return sendError(res, 410, 'This invitation has already been accepted');
    if (new Date(data.expires_at) < new Date()) return sendError(res, 410, 'This invitation has expired. Please ask your administrator to resend it.');

    sendSuccess(res, {
      email:      data.email,
      invite_type:data.invite_type,
      role:       data.role,
      brand_name: data.brands?.name || data.metadata?.brand_name,
      full_name:  data.metadata?.full_name || data.metadata?.suggested_name,
      expires_at: data.expires_at,
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/invite/accept ──────────────────────────────
// Accept invitation, create account, set password
router.post('/accept', async (req, res, next) => {
  try {
    const { token, password, full_name, phone } = req.body;

    if (!token)    return sendError(res, 400, 'token is required');
    if (!password) return sendError(res, 400, 'password is required');
    if (password.length < 8) return sendError(res, 400, 'Password must be at least 8 characters');

    const { data: invite, error: inviteErr } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteErr || !invite) return sendError(res, 404, 'Invalid invitation');
    if (invite.accepted_at)   return sendError(res, 410, 'Invitation already used');
    if (new Date(invite.expires_at) < new Date()) return sendError(res, 410, 'Invitation has expired');

    const hash = await bcrypt.hash(password, 12);
    let userId = null;
    let clientId = null;

    if (invite.invite_type === 'staff') {
      // Create staff account
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email:         invite.email,
          full_name:     full_name || invite.metadata?.full_name || invite.email.split('@')[0],
          role:          invite.role || 'contributor',
          department:    invite.metadata?.department || null,
          phone:         phone || null,
          password_hash: hash,
          must_reset_password: false,
          is_active:     true,
        })
        .select('id, email, full_name, role')
        .single();
      if (error) {
        if (error.code === '23505') return sendError(res, 409, 'An account with this email already exists');
        throw error;
      }
      userId = user.id;
    } else {
      // Create client account
      const { data: clientUser, error } = await supabase
        .from('clients')
        .insert({
          email:         invite.email,
          full_name:     full_name || invite.metadata?.full_name || invite.email.split('@')[0],
          brand_id:      invite.brand_id,
          job_title:     invite.metadata?.job_title || null,
          phone:         phone || null,
          password_hash: hash,
          must_reset_password: false,
          is_active:     true,
        })
        .select('id, email, full_name')
        .single();
      if (error) {
        if (error.code === '23505') return sendError(res, 409, 'An account with this email already exists');
        throw error;
      }
      clientId = clientUser.id;
    }

    // Mark invitation as accepted
    await supabase.from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    sendSuccess(res, {
      invite_type: invite.invite_type,
      message:     'Account created successfully. You can now log in.',
      login_url:   invite.invite_type === 'client' ? '/client/login' : '/login',
    }, 'Account created');
  } catch (err) { next(err); }
});

module.exports = router;
