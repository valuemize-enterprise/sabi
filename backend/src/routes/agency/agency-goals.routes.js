// ═══════════════════════════════════════════════════════════════════
// agency-goals.routes.js
// Sabi Intelligence Suite — Phase B: Agency Goals
//
// Mount in server.js:
//   const agencyGoalsRouter = require('./src/routes/agency-goals.routes');
//   app.use('/api/agency-goals', requireAuth, agencyGoalsRouter);
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router();
const svc     = require('../../services/agency-goals.service');

const LEADERSHIP  = ['super_admin', 'md', 'admin'];
const SUPER_ADMIN = ['super_admin'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// GET /api/agency-goals
// Full 6-category report — used by the Agency Goals page.
// Returns all categories with targets, current values, health colours.
router.get('/', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const categories = await svc.getAllCategories();
    res.json({
      categories,
      year:       new Date().getFullYear(),
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[agency-goals] getAllCategories error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agency-goals/pulse
// Lightweight — just health colour + display value per category.
// Used by the Command Centre Goal Pulse Strip (polled every 60s).
router.get('/pulse', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const pulse = await svc.getPulse();
    res.json({ pulse, fetched_at: new Date().toISOString() });
  } catch (err) {
    console.error('[agency-goals] getPulse error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agency-goals/week-vs-goal
// Weekly delta view for the MD consolidated report.
// Shows how this week moved each category's needle.
router.get('/week-vs-goal', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const deltas = await svc.getWeekVsGoal();
    res.json({ deltas, fetched_at: new Date().toISOString() });
  } catch (err) {
    console.error('[agency-goals] getWeekVsGoal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agency-goals/targets
// Fetch all configured targets for the current year.
router.get('/targets', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const targets = await svc.getTargets();
    res.json({ targets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agency-goals/targets
// Create or update a target. Super Admin only.
// Body: { id?, category, title, target_value, unit }
router.post('/targets', requireRoles(...SUPER_ADMIN), async (req, res) => {
  try {
    const { id, category, title, target_value, unit } = req.body;

    if (!category || !title || target_value == null) {
      return res.status(400).json({
        error: 'category, title, and target_value are required',
      });
    }

    const VALID_CATEGORIES = [
      'new_business', 'revenue', 'client_health',
      'delivery', 'people_perf', 'hr_workforce',
    ];
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category: ${category}` });
    }

    const result = await svc.upsertTarget({ id, category, title, target_value, unit });
    res.status(id ? 200 : 201).json({ target: result });
  } catch (err) {
    console.error('[agency-goals] upsertTarget error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agency-goals/:categoryId
// Single category detail — used when a card is expanded on the page.
router.get('/:categoryId', requireRoles(...LEADERSHIP), async (req, res) => {
  const fnMap = {
    new_business:  svc.getNewBusiness,
    revenue:       svc.getRevenue,
    client_health: svc.getClientHealth,
    delivery:      svc.getDelivery,
    people_perf:   svc.getPeoplePerformance,
    hr_workforce:  svc.getHRWorkforce,
  };

  const fn = fnMap[req.params.categoryId];
  if (!fn) {
    return res.status(404).json({ error: `Unknown category: ${req.params.categoryId}` });
  }

  try {
    const targets = await svc.getTargets().catch(() => ({}));
    const category = await fn(targets);
    res.json({ category, fetched_at: new Date().toISOString() });
  } catch (err) {
    console.error(`[agency-goals] ${req.params.categoryId} error:`, err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
