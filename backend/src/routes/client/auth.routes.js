/**
 * Client Portal Auth Routes
 * POST /api/client/auth/login
 * GET  /api/client/auth/me
 * POST /api/client/auth/set-password
 */

'use strict';

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../../config/supabase');
const { generateClientToken }  = require('../../utils/jwt.utils');
const { authenticateClient }   = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 400, 'Email and password required');

    const { data: client, error } = await supabase
      .from('clients')
      .select('*, brands(name, logo_url, primary_color, industry)')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !client) return sendError(res, 401, 'Invalid credentials');
    if (!client.is_active)  return sendError(res, 403, 'Account deactivated. Contact Cerebre Media Africa.');

    const valid = await bcrypt.compare(password, client.password_hash);
    if (!valid) return sendError(res, 401, 'Invalid credentials');

    await supabase.from('clients').update({ last_login: new Date().toISOString() }).eq('id', client.id);

    const token = generateClientToken(client);

    sendSuccess(res, {
      token,
      client: {
        id:                 client.id,
        email:              client.email,
        full_name:          client.full_name,
        job_title:          client.job_title,
        brand_id:           client.brand_id,
        avatar_url:         client.avatar_url,
        must_reset_password: client.must_reset_password,
        brand:              client.brands,
      },
    });
  } catch (err) { next(err); }
});

router.get('/me', authenticateClient, async (req, res, next) => {
  try {
    const { data: client } = await supabase
      .from('clients')
      .select('id, email, full_name, job_title, phone, brand_id, avatar_url, last_login, brands(name, logo_url, primary_color, industry, website)')
      .eq('id', req.client.id)
      .single();

    sendSuccess(res, { client });
  } catch (err) { next(err); }
});

router.post('/set-password', authenticateClient, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 8) return sendError(res, 400, 'Password must be at least 8 characters');

    const { data: client } = await supabase.from('clients').select('password_hash').eq('id', req.client.id).single();
    const valid = await bcrypt.compare(current_password, client.password_hash);
    if (!valid) return sendError(res, 401, 'Current password incorrect');

    const hash = await bcrypt.hash(new_password, 12);
    await supabase.from('clients').update({ password_hash: hash, must_reset_password: false }).eq('id', req.client.id);
    sendSuccess(res, null, 'Password updated');
  } catch (err) { next(err); }
});

router.post('/logout', authenticateClient, (req, res) => sendSuccess(res, null, 'Logged out'));

module.exports = router;
