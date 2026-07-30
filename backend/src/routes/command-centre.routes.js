// ═══════════════════════════════════════════════════════════════════
// command-centre.routes.js
// Sabi Intelligence Suite — Command Centre Phase 2
//
// Mount in server.js (replaces or extends existing command-centre routes):
//   const commandCentreRouter = require('./routes/command-centre.routes');
//   app.use('/api/command-centre', requireAuth, commandCentreRouter);
//
// All endpoints: Admin, MD, Super Admin only.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router();
const cc      = require('../services/command-centre.service');

const LEADERSHIP = ['admin', 'md', 'super_admin'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Leadership access only' });
  }
  next();
};

// GET /api/command-centre/dials
// Returns all 8 dials in one call — the primary endpoint for Live mode.
// Fetched on mount and can be polled every 60s for near-real-time updates.
router.get('/dials', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const dials = await cc.getAllDials();
    res.json({ dials, fetched_at: new Date().toISOString() });
  } catch (err) {
    console.error('[CommandCentre] getAllDials error:', err);
    res.status(500).json({ error: 'Failed to load dials', message: err.message });
  }
});

// GET /api/command-centre/dials/:id
// Refresh a single dial — called when a specific dial is clicked/expanded.
// Supports: task_velocity | revenue_health | client_satisfaction |
//           creative_review | staff_performance | goal_progress |
//           clarity_score | pipeline
router.get('/dials/:id', requireRoles(...LEADERSHIP), async (req, res) => {
  const dialFns = {
    task_velocity:      cc.getTaskVelocity,
    revenue_health:     cc.getRevenueHealth,
    client_satisfaction:cc.getClientSatisfaction,
    creative_review:    cc.getCreativeReviewQueue,
    staff_performance:  cc.getStaffPerformance,
    goal_progress:      cc.getGoalProgress,
    clarity_score:      cc.getClarityScore,
    pipeline:           cc.getPipelineDial,
  };

  const fn = dialFns[req.params.id];
  if (!fn) return res.status(404).json({ error: `Unknown dial: ${req.params.id}` });

  try {
    const dial = await fn();
    res.json({ dial, fetched_at: new Date().toISOString() });
  } catch (err) {
    console.error(`[CommandCentre] dial ${req.params.id} error:`, err);
    res.status(500).json({ error: 'Failed to load dial', message: err.message });
  }
});

// GET /api/command-centre/pipeline
// Pipeline dial data only — used by Command Centre's 8th tile
// and can also be called by the pipeline page header.
router.get('/pipeline', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const dial = await cc.getPipelineDial();
    res.json(dial);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load pipeline dial', message: err.message });
  }
});

// GET /api/command-centre/weekly-intelligence-header
// Header data for Weekly Intelligence mode:
// week dates, submission count, total collected, total outstanding.
// The full consolidated view comes from /api/weekly-report/consolidated.
router.get('/weekly-intelligence-header', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const header = await cc.getWeeklyIntelligenceHeader();
    res.json(header);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load header', message: err.message });
  }
});

module.exports = router;
