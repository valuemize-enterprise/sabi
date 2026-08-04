// ═══════════════════════════════════════════════════════════════════
// book-of-deals.routes.js
// Sabi Intelligence Suite — Phase F
//
// Mount in server.js:
//   const bodRouter = require('./src/routes/book-of-deals.routes');
//   app.use('/api/book-of-deals', requireAuth, bodRouter);
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router();
const svc     = require('../services/book-of-deals.service');

// ── Middleware ────────────────────────────────────────────────────

// All authenticated users can access My Deals endpoints
const ALL_STAFF = (req, res, next) => next();

// Full Book requires Super Admin or explicit deal_book_full_access grant
const requireFullAccess = (req, res, next) => {
  const { role, deal_book_full_access } = req.user || {};
  if (role === 'super_admin' || deal_book_full_access === true) {
    return next();
  }
  return res.status(403).json({
    error: 'Full Book access requires Super Admin or assigned Book of Deals access.',
  });
};

// Super Admin only — for access grants
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
};

// ── My Deals — all authenticated users ───────────────────────────

// GET /api/book-of-deals/my-deals
// All opportunities where the caller is the business_bringer.
router.get('/my-deals', ALL_STAFF, async (req, res) => {
  try {
    const deals = await svc.getMyDeals(req.user.id);
    res.json({ deals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/book-of-deals/my-stats
// Personal conversion stats for the calling user.
router.get('/my-stats', ALL_STAFF, async (req, res) => {
  try {
    const stats = await svc.getMyStats(req.user.id);
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/book-of-deals/log
// Log a new deal — auto-creates a Pipeline opportunity.
// business_bringer_id = calling user, always.
// Body: { company_name, contact_name, contact_position, contact_email,
//         contact_phone, deal_type, service_scope[], industry, stage,
//         estimated_value, retainer_monthly_amount, retainer_start_date,
//         retainer_duration_months, campaign_name, campaign_goals,
//         campaign_start_date, campaign_end_date, campaign_total_amount,
//         deck_url, notes, account_manager_id? }
router.post('/log', ALL_STAFF, async (req, res) => {
  try {
    const { company_name } = req.body;
    if (!company_name?.trim()) {
      return res.status(400).json({ error: 'company_name is required' });
    }
    const opportunity = await svc.logDeal(req.user.id, req.body);
    res.status(201).json({
      opportunity,
      message: 'Deal logged and Pipeline opportunity created.',
    });
  } catch (err) {
    const status = err.status || 500;
    console.error('[book-of-deals] logDeal error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

// ── Pursuit Board — all authenticated users ───────────────────────

// GET /api/book-of-deals/pursuit-board?period=quarter|year
// Three rankings with NO financial details. Public to all staff.
router.get('/pursuit-board', ALL_STAFF, async (req, res) => {
  try {
    const period = req.query.period === 'year' ? 'year' : 'quarter';
    const board  = await svc.getPursuitBoard(period);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/book-of-deals/widget
// Lightweight homepage widget — top 3 chasers + total active count.
router.get('/widget', ALL_STAFF, async (req, res) => {
  try {
    const data = await svc.getPursuitBoardWidget();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/book-of-deals/agency-progress
// Agency-level new business progress bar (feeds top of Book of Deals page).
// All authenticated staff can see the overall target progress.
router.get('/agency-progress', ALL_STAFF, async (req, res) => {
  try {
    const progress = await svc.getAgencyProgress();
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Full Book — Super Admin + assigned users ──────────────────────

// GET /api/book-of-deals/full?stage=&deal_type=&bringer_id=&search=
// All deals from all staff with full details including amounts and contacts.
router.get('/full', requireFullAccess, async (req, res) => {
  try {
    const deals = await svc.getFullBook({
      stage:      req.query.stage      || null,
      deal_type:  req.query.deal_type  || null,
      bringer_id: req.query.bringer_id || null,
      search:     req.query.search     || null,
    });
    res.json({ deals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Access management — Super Admin only ──────────────────────────

// PATCH /api/book-of-deals/access/:userId
// Grant or revoke full Book of Deals access for a specific user.
// Body: { grant: true | false }
router.patch('/access/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const grant   = req.body.grant === true;
    const updated = await svc.toggleFullAccess(req.params.userId, grant);
    res.json({
      user:    updated,
      message: `Full Book of Deals access ${grant ? 'granted to' : 'revoked from'} ${updated.full_name}.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
