// ═══════════════════════════════════════════════════════════════════
// pipeline-analytics.routes.js
// Sabi Intelligence Suite — Phase G
//
// Mount in server.js:
//   const analyticsRouter = require('./src/routes/pipeline-analytics.routes');
//   app.use('/api/pipeline-analytics', requireAuth, analyticsRouter);
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express      = require('express');
const router       = express.Router();
const waterfallSvc = require('../services/revenue-waterfall.service');
const followUpSvc  = require('../services/smart-followup.service');

const LEADERSHIP = ['super_admin', 'md', 'admin'];
const ALL_STAFF  = () => true;

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────
// WATERFALL ENDPOINTS
// ─────────────────────────────────────────────────────────────────

// GET /api/pipeline-analytics/waterfall?months=6
// Revenue waterfall for the next N months (default 6, max 12).
// Leadership and above only — contains revenue figures.
router.get('/waterfall', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const months = Math.min(12, Math.max(3, Number(req.query.months || 6)));
    const data   = await waterfallSvc.getRevenueWaterfall(months);
    res.json(data);
  } catch (err) {
    console.error('[waterfall]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline-analytics/stale
// Returns active deals that have exceeded their stage staleness threshold.
// All authenticated staff — people only see their own stale deals;
// leadership sees everyone's.
router.get('/stale', async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const isLeadership = LEADERSHIP.includes(role);
    const deals = await waterfallSvc.getStaleDeals(20);

    // Staff only see their own stale deals
    const filtered = isLeadership
      ? deals
      : deals.filter(d => d.business_bringer?.id === userId);

    res.json({ stale_deals: filtered });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// SMART FOLLOW-UP ENDPOINTS
// ─────────────────────────────────────────────────────────────────

// POST /api/pipeline-analytics/follow-up-draft
// Generates 3 personalized follow-up message drafts for a deal.
// Available to:
//   - The business_bringer of the deal
//   - Any leadership role
//
// Body: { opportunityId: string }
//
// Note: This calls the Anthropic API — it takes 2-4 seconds.
// The frontend should show a loading state while waiting.
router.post('/follow-up-draft', async (req, res) => {
  try {
    const { opportunityId } = req.body;
    if (!opportunityId) {
      return res.status(400).json({ error: 'opportunityId is required' });
    }

    const { role, id: userId } = req.user;
    const isLeadership = LEADERSHIP.includes(role);

    // Permission check: staff can only generate drafts for their own deals
    if (!isLeadership) {
      const staleness = await followUpSvc.checkStaleness(opportunityId);
      // We don't have business_bringer_id in checkStaleness — use a separate check
      const { data: opp } = await require('../config/supabase')
        .from('opportunities')
        .select('business_bringer_id')
        .eq('id', opportunityId)
        .single()
        .catch(() => ({ data: null }));

      if (!opp || opp.business_bringer_id !== userId) {
        return res.status(403).json({ error: 'You can only generate follow-ups for your own deals' });
      }
    }

    const result = await followUpSvc.generateFollowUpDraft(opportunityId);
    res.json(result);
  } catch (err) {
    console.error('[follow-up-draft]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline-analytics/follow-up-check/:id
// Lightweight staleness check — no ARIA call.
// Returns whether a deal qualifies as stale + how many days over threshold.
router.get('/follow-up-check/:id', async (req, res) => {
  try {
    const result = await followUpSvc.checkStaleness(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
