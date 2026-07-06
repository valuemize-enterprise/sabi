/**
 * Client Team Routes
 * Shows the client which Cerebre staff members work on their brand
 * and what role each person plays.
 *
 * GET /api/client/team   — team members assigned to the client's brand
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('staff_brand_assignments')
      .select(`
        id,
        role_on_brand,
        users!staff_id (
          id,
          full_name,
          role,
          department,
          avatar_url
        )
      `)
      .eq('brand_id', req.client.brand_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Flatten and only expose safe fields (no email/phone to clients)
    const team = (data || [])
      .filter(a => a.users?.full_name)
      .map(a => ({
        id:            a.id,
        role_on_brand: a.role_on_brand,
        full_name:     a.users.full_name,
        system_role:   a.users.role,
        department:    a.users.department,
        avatar_url:    a.users.avatar_url,
      }));

    sendSuccess(res, { team });
  } catch (err) { next(err); }
});

module.exports = router;
