/**
 * Brand Identity Vault Routes
 *
 * GET    /api/agency/brands/:id/identity   — get brand identity (agency)
 * PATCH  /api/agency/brands/:id/identity   — update brand identity
 * GET    /api/client/brand/identity        — client reads own brand identity
 */
'use strict';

const router   = require('express').Router({ mergeParams: true });
const supabase = require('../../config/supabase');
const { authenticate, authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

const VALID_ARCHETYPES = [
  'ruler','creator','sage','innocent','explorer','rebel',
  'magician','hero','lover','jester','everyman','caregiver',
];

// ── GET /api/agency/brands/:id/identity ──────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select(`
        id, name, logo_url, tagline, mission_statement, brand_story,
        brand_archetype, brand_voice, target_audience,
        brand_colors, brand_fonts, dos_and_donts,
        brand_guidelines_url, brand_assets, social_handles,
        industry, website, primary_color, created_at
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return sendError(res, 404, 'Brand not found');
    sendSuccess(res, { identity: data });
  } catch (err) { next(err); }
});

// ── PATCH /api/agency/brands/:id/identity ────────────────────
router.patch('/', authenticate, async (req, res, next) => {
  try {
    const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

    // Brand admins can also update identity
    let canEdit = ADMIN_ROLES.includes(req.user.role);
    if (!canEdit) {
      const { data: assignment } = await supabase
        .from('staff_brand_assignments')
        .select('roles_on_brand')
        .eq('staff_id', req.user.id)
        .eq('brand_id', req.params.id)
        .single();
      canEdit = (assignment?.roles_on_brand ?? []).includes('brand_admin');
    }
    if (!canEdit) return sendError(res, 403, 'Only admins and brand admins can update brand identity');

    const allowed = [
      'logo_url','tagline','mission_statement','brand_story',
      'brand_archetype','brand_voice','target_audience',
      'brand_colors','brand_fonts','dos_and_donts',
      'brand_guidelines_url','brand_assets','social_handles',
      'primary_color','website',
    ];

    const updates = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (updates.brand_archetype && !VALID_ARCHETYPES.includes(updates.brand_archetype)) {
      return sendError(res, 400, `brand_archetype must be one of: ${VALID_ARCHETYPES.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('brands')
      .update(updates)
      .eq('id', req.params.id)
      .select('id, name, logo_url, brand_archetype, brand_colors, updated_at')
      .single();

    if (error) throw error;
    sendSuccess(res, { identity: data }, 'Brand identity updated');
  } catch (err) { next(err); }
});

module.exports = router;
