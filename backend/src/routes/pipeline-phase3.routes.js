// ═══════════════════════════════════════════════════════════════════
// pipeline-phase3.routes.js
// Sabi Intelligence Suite — Phase 3: Conversion + Intelligence Routes
//
// ADD these routes to your existing pipeline router in server.js:
//   const phase3Router = require('./routes/pipeline-phase3.routes');
//   app.use('/api/pipeline', requireAuth, phase3Router);
//
// (The existing pipeline.routes.js from Phase 0 and this file both
//  mount under /api/pipeline — Express merges them.)
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router();
const conversionService  = require('../services/pipeline-conversion.service');
const intelligenceService = require('../services/pipeline-intelligence.service');

const LEADERSHIP   = ['admin', 'md', 'super_admin'];
const ALL_PIPELINE = ['brand_admin', 'admin', 'md', 'super_admin'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ── Won → Brand Conversion ────────────────────────────────────────

// GET /api/pipeline/opportunities/:id/conversion-status
// Check whether an opportunity has already been converted to a brand.
router.get(
  '/opportunities/:id/conversion-status',
  requireRoles(...ALL_PIPELINE),
  async (req, res) => {
    try {
      const status = await conversionService.getConversionStatus(req.params.id);
      res.json({ converted: status != null, conversion: status });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/pipeline/opportunities/:id/convert
// Convert a Won opportunity to a Brand workspace.
// Body: { brand_name, brand_description, retainer_billing_day, onboarding_date, create_invoice }
router.post(
  '/opportunities/:id/convert',
  requireRoles(...ALL_PIPELINE),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        brand_name,
        brand_description,
        retainer_billing_day,
        onboarding_date,
        create_invoice = true,
      } = req.body;

      if (!brand_name?.trim()) {
        return res.status(400).json({ error: 'brand_name is required' });
      }

      const result = await conversionService.createBrandFromOpportunity(
        id,
        { brand_name: brand_name.trim(), brand_description, retainer_amount, onboarding_date, create_invoice },
        req.user.id
      );

      res.status(201).json({
        message: `Brand workspace created for ${result.brand.name}`,
        brand:       result.brand,
        brief:       result.brief,
        invoice:     result.invoice,
        opportunity: result.opportunity,
        team_assigned: result.team_assigned,
      });
    } catch (err) {
      console.error('[Conversion] error:', err);
      const status = err.message.includes('already been converted') ? 409
                   : err.message.includes('must be in Won stage')   ? 400
                   : 500;
      res.status(status).json({ error: err.message });
    }
  }
);

// GET /api/pipeline/converted
// List all won + converted opportunities (for history panel).
router.get(
  '/converted',
  requireRoles(...LEADERSHIP),
  async (req, res) => {
    try {
      const list = await conversionService.listConvertedOpportunities();
      res.json({ conversions: list });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Intelligence Endpoints ────────────────────────────────────────

// GET /api/pipeline/intelligence
// Full ARIA intelligence report: win patterns + loss analysis + forecast.
// Includes ARIA-generated narrative for each section.
// Computation time: ~5-8s (3 parallel DB queries + 3 parallel ARIA calls).
router.get(
  '/intelligence',
  requireRoles(...LEADERSHIP),
  async (req, res) => {
    try {
      const report = await intelligenceService.generateFullIntelligenceReport();
      res.json(report);
    } catch (err) {
      console.error('[Intelligence] error:', err);
      res.status(500).json({ error: 'Intelligence report failed', message: err.message });
    }
  }
);

// GET /api/pipeline/intelligence/win-patterns
// Win patterns only (faster — for the Pipeline dial expanded view).
router.get(
  '/intelligence/win-patterns',
  requireRoles(...LEADERSHIP),
  async (req, res) => {
    try {
      const data = await intelligenceService.getWinPatterns();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/pipeline/intelligence/loss-patterns
// Loss patterns only.
router.get(
  '/intelligence/loss-patterns',
  requireRoles(...LEADERSHIP),
  async (req, res) => {
    try {
      const data = await intelligenceService.getLossPatterns();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/pipeline/intelligence/forecast
// Conversion forecast only.
router.get(
  '/intelligence/forecast',
  requireRoles(...LEADERSHIP),
  async (req, res) => {
    try {
      const data = await intelligenceService.getConversionForecast();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/pipeline/intelligence/quarter-summary
// Quarter-over-quarter win/loss table.
router.get(
  '/intelligence/quarter-summary',
  requireRoles(...LEADERSHIP),
  async (req, res) => {
    try {
      const data = await intelligenceService.getQuarterSummary();
      res.json({ quarters: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
