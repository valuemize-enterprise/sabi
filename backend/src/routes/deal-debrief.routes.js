// ═══════════════════════════════════════════════════════════════════
// deal-debrief.routes.js
// Sabi Intelligence Suite — Phase H
//
// Mount in server.js:
//   const debriefRouter = require('./src/routes/deal-debrief.routes');
//   app.use('/api/debriefs', requireAuth, debriefRouter);
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express  = require('express');
const router   = express.Router();
const svc      = require('../services/deal-debrief.service');

const LEADERSHIP = ['super_admin', 'md', 'admin'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────
// DEBRIEF ENDPOINTS
// ─────────────────────────────────────────────────────────────────

// POST /api/debriefs
// Create a win or loss debrief for an opportunity.
// Available to: the business_bringer on the deal + leadership.
// Body: { opportunityId, outcome, deciding_factor, competitor_name?,
//         pitch_again?, what_worked?, what_failed?, notes? }
router.post('/', async (req, res) => {
  try {
    const { opportunityId, outcome, deciding_factor } = req.body;
    if (!opportunityId || !outcome || !deciding_factor) {
      return res.status(400).json({ error: 'opportunityId, outcome, and deciding_factor are required' });
    }
    const result = await svc.createDebrief(req.user.id, opportunityId, req.body);
    res.status(201).json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('[debrief] create error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

// GET /api/debriefs/opportunity/:id
// Get the debrief (if any) for a specific opportunity.
router.get('/opportunity/:id', async (req, res) => {
  try {
    const debrief = await svc.getDebriefByOpportunity(req.params.id);
    res.json({ debrief });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/debriefs?outcome=won|lost&industry=&quarter=Q3 2026
// Full debrief archive. Leadership only.
router.get('/', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const debriefs = await svc.getDebriefArchive({
      outcome:  req.query.outcome  || null,
      industry: req.query.industry || null,
      quarter:  req.query.quarter  || null,
    });
    res.json({ debriefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debriefs/quarterly-insights
// Triggers ARIA quarterly analysis on all debriefs this quarter.
// Leadership only. Takes 3-6 seconds.
router.post('/quarterly-insights', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const result = await svc.generateQuarterlyInsights();
    res.json(result);
  } catch (err) {
    console.error('[debrief] insights error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PITCH ARCHIVE ENDPOINTS
// ─────────────────────────────────────────────────────────────────

// GET /api/debriefs/pitch-archive?outcome=won|lost|any&industry=&service_scope=&search=
// Returns all opportunities with deck_url attached.
// Searchable reference library of past pitches.
// All authenticated staff can access (reading company names and deck links).
router.get('/pitch-archive', async (req, res) => {
  try {
    const results = await svc.getPitchArchive({
      outcome:       req.query.outcome       || null,
      industry:      req.query.industry      || null,
      service_scope: req.query.service_scope || null,
      search:        req.query.search        || null,
    });
    res.json({ entries: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/debriefs/deck/:opportunityId
// Returns the deck_url for a specific opportunity.
// Used by the Phase 3 conversion modal to seed the brand Brief.
router.get('/deck/:opportunityId', async (req, res) => {
  try {
    const deckUrl = await svc.getDeckUrlForConversion(req.params.opportunityId);
    res.json({ deck_url: deckUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
