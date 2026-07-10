/**
 * Client Team Routes
 * Shows the client which Cerebre staff members work on their brand
 * and what role each person plays.
 *
 * GET /api/client/team          — team members assigned to the client's brand
 * GET /api/client/team/:staffId — full profile of a specific team member
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

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
          avatar_url,
          email
        )
      `)
      .eq('brand_id', req.client.brand_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const team = (data || [])
      .filter(a => a.users?.full_name)
      .map(a => ({
        id:            a.id,
        user_id:       a.users.id,
        role_on_brand: a.role_on_brand,
        full_name:     a.users.full_name,
        system_role:   a.users.role,
        department:    a.users.department,
        avatar_url:    a.users.avatar_url,
        email:         a.users.email,
      }));

    sendSuccess(res, { team });
  } catch (err) { next(err); }
});

// GET /api/client/team/:staffId — full staff profile
router.get('/:staffId', authenticateClient, async (req, res, next) => {
  try {
    const { staffId } = req.params;

    // Verify this staff member is assigned to the client's brand
    const { data: assignment, error: assignErr } = await supabase
      .from('staff_brand_assignments')
      .select('id')
      .eq('staff_id', staffId)
      .eq('brand_id', req.client.brand_id)
      .single();

    if (assignErr || !assignment) return sendError(res, 404, 'Team member not found');

    // Fetch the full staff profile
    const { data: staff, error: staffErr } = await supabase
      .from('users')
      .select(`
        id, full_name, role, department, avatar_url, email,
        display_title, bio, skills, experience_years,
        certifications, portfolio_links, linkedin_url, is_profile_public
      `)
      .eq('id', staffId)
      .single();

    if (staffErr || !staff) return sendError(res, 404, 'Team member not found');
    if (staff.is_profile_public === false) return sendError(res, 404, 'Profile not available');

    // Get their role on this brand
    const { data: brandRole } = await supabase
      .from('staff_brand_assignments')
      .select('role_on_brand')
      .eq('staff_id', staffId)
      .eq('brand_id', req.client.brand_id)
      .single();

    sendSuccess(res, {
      staff: {
        id:               staff.id,
        full_name:        staff.full_name,
        display_title:    staff.display_title,
        role_on_brand:    brandRole?.role_on_brand || null,
        system_role:      staff.role,
        department:       staff.department,
        avatar_url:       staff.avatar_url,
        bio:              staff.bio,
        skills:           staff.skills || [],
        experience_years: staff.experience_years,
        certifications:   staff.certifications || [],
        portfolio_links:  staff.portfolio_links || [],
        linkedin_url:     staff.linkedin_url,
      }
    });
  } catch (err) { next(err); }
});

// ── GET /api/client/team/:staffId/profile ────────────────────
// Add this BEFORE any /:staffId route to avoid route conflicts
router.get('/:staffId/profile', authenticateClient, async (req, res, next) => {
  try {
    // 1. Confirm this staff member is assigned to the client's brand
    const { data: assignment, error: aErr } = await supabase
      .from('staff_brand_assignments')
      .select('staff_id')
      .eq('brand_id', req.client.brand_id)
      .eq('staff_id', req.params.staffId)
      .single();

    if (aErr || !assignment) {
      return res.status(404).json({ success: false, error: 'Team member not found' });
    }

    // 2. Fetch the staff profile
    const { data: profile, error: pErr } = await supabase
      .from('users')
      .select(`
        id, full_name, role, department, display_title,
        avatar_url, bio, skills, experience_years,
        certifications, portfolio_links, linkedin_url,
        is_profile_public
      `)
      .eq('id', req.params.staffId)
      .eq('is_active', true)
      .single();

    if (pErr || !profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    // 3. If staff set profile to private, return minimal info only
    if (profile.is_profile_public === false) {
      return res.json({
        success: true,
        data: {
          profile: {
            id:            profile.id,
            full_name:     profile.full_name,
            role:          profile.role,
            display_title: profile.display_title,
            avatar_url:    profile.avatar_url,
          }
        }
      });
    }

    res.json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
