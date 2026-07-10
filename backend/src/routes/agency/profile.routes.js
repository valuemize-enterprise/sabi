/**
 * Staff Profile Routes
 *
 * PATCH /api/agency/staff/me/profile        — staff updates own profile
 * GET   /api/agency/staff/:id/profile       — get any staff profile (admin)
 * GET   /api/client/team/:staffId/profile   — client views assigned staff profile
 */
'use strict';

const router   = require('express').Router();
const multer   = require('multer');
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ── PATCH /api/agency/staff/me/profile ───────────────────────
router.patch('/me/profile', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    const {
      display_title, bio, skills,
      experience_years, certifications, portfolio_links,
      linkedin_url, is_profile_public,
    } = req.body;

    const parseMaybeJson = (v) => {
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
      return v;
    };

    const updates = {};
    const allowed = {
      display_title, bio,
      skills:            parseMaybeJson(skills),
      certifications:    parseMaybeJson(certifications),
      portfolio_links:   parseMaybeJson(portfolio_links),
      experience_years:  experience_years !== undefined && experience_years !== '' ? Number(experience_years) : undefined,
      linkedin_url,
      is_profile_public: is_profile_public !== undefined ? is_profile_public === 'true' || is_profile_public === true : undefined,
    };
    Object.entries(allowed).forEach(([k, v]) => {
      if (v !== undefined) updates[k] = v;
    });

    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const filePath = `${req.user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      updates.avatar_url = publicUrlData.publicUrl;
    } else if (req.body.avatar_url !== undefined) {
      updates.avatar_url = req.body.avatar_url;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select(`
        id, full_name, email, role, department, display_title,
        avatar_url, bio, skills, experience_years,
        certifications, portfolio_links, linkedin_url,
        is_profile_public, created_at
      `)
      .single();

    if (error) throw error;
    sendSuccess(res, { profile: data }, 'Profile updated');
  } catch (err) { next(err); }
});

// ── GET /api/agency/staff/:id/profile ────────────────────────
router.get('/:id/profile', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, full_name, role, department, display_title,
        avatar_url, bio, skills, experience_years,
        certifications, portfolio_links, linkedin_url,
        is_profile_public, created_at
      `)
      .eq('id', req.user.id)
      .single();

    if (error || !data) return sendError(res, 404, 'Staff member not found');
    sendSuccess(res, { profile: data });
  } catch (err) { next(err); }
});

module.exports = router;
