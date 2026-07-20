/**
 * Brand Command Center routes.
 *
 * GET /api/agency/command
 *   super_admin | admin | md  → all active brands
 *   brand_admin               → scoped to their assigned brands (D3)
 *   others                    → 403
 *
 * GET /api/agency/command/:brandId/details
 *   The drawer payload — offending records behind the reason chips.
 *   Brand Admins may only open brands they administer.
 *
 * GET /api/agency/command/thresholds
 *   Read-only threshold config (for a future settings display).
 */

'use strict';

const express = require('express');
const router = express.Router();
const { computeCommand, computeBrandDetails, THRESHOLDS } = require('../services/command.service');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth.middleware');

const FULL_ACCESS = new Set(['super_admin', 'admin', 'md']);

async function isBrandAdmin(userId, brandId = null) {
  let q = supabase.from('staff_brand_assignments').select('brand_id').eq('staff_id', userId).contains('roles_on_brand', ['brand_admin']);
  if (brandId) q = q.eq('brand_id', brandId);
  const { data } = await q;
  return (data || []).length > 0;
}

// ── GET / ─────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    if (FULL_ACCESS.has(role)) {
      return res.json({ success: true, scope: 'full', ...(await computeCommand()) });
    }
    // Brand Admin scoped view (D3)
    if (await isBrandAdmin(req.user.id)) {
      const payload = await computeCommand({ brandAdminUserId: req.user.id });
      return res.json({ success: true, scope: 'my_brands', ...payload });
    }
    return res.status(403).json({ success: false, error: 'Command Center is available to leadership and Brand Admins.' });
  } catch (err) {
    console.error('[command] GET / failed:', err.message, err.stack);
    res.status(500).json({ success: false, error: 'Failed to compute Command Center', details: err.message });
  }
});

// ── GET /:brandId/details ─────────────────────────────────────
router.get('/:brandId/details', authenticate, async (req, res) => {
  try {
    const { brandId } = req.params;
    const role = req.user.role;
    if (!FULL_ACCESS.has(role)) {
      const ok = await isBrandAdmin(req.user.id, brandId);
      if (!ok) return res.status(403).json({ success: false, error: 'Not your brand.' });
    }
    const details = await computeBrandDetails(brandId);
    res.json({ success: true, brand_id: brandId, details });
  } catch (err) {
    console.error('[command] GET details failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load brand details' });
  }
});

// ── GET /thresholds ───────────────────────────────────────────
router.get('/thresholds', authenticate, (req, res) => {
  if (!FULL_ACCESS.has(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Leadership only.' });
  }
  res.json({ success: true, thresholds: THRESHOLDS });
});

module.exports = router;
