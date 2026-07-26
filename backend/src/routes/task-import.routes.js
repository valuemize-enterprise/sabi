/**
 * Task Import Routes — Sabi Intelligence Suite
 *
 * Mount in server.js (BEFORE any existing /api/tasks route):
 *   const taskImportRouter = require('./routes/task-import.routes');
 *   app.use('/api/task-import', taskImportRouter);
 *
 * Endpoints:
 *   GET  /api/task-import/brands   → brands this user can import into
 *   POST /api/task-import          → bulk insert up to 500 tasks
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { bulkImportTasks, isBrandAdminForBrand, getImportableBrands } =
  require('../services/task-import.service'); // ← adjust to your middleware path
const { authenticate } = require('../middleware/auth.middleware');

const fail = (res, err) =>
  res.status(err.status || 500).json({ success: false, error: err.message || String(err) });

// ─────────────────────────────────────────────────────────────────
// GET /api/task-import/brands
// Returns the brands this caller is allowed to import tasks into.
// Leadership sees all active brands; Brand Admins see their own.
// ─────────────────────────────────────────────────────────────────
router.get('/brands', authenticate, async (req, res) => {
  try {
    const brands = await getImportableBrands(req.user);
    res.json({ success: true, brands });
  } catch (err) {
    console.error('[task-import] GET /brands failed:', err.message);
    fail(res, err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/task-import
// Body: { brand_id: string, tasks: TaskInput[] }
// TaskInput: { title, description?, assignee_name?, due_date?, priority?, tags? }
// ─────────────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    const { brand_id, tasks } = req.body || {};

    // ── Validation ──────────────────────────────────────────────
    if (!brand_id) {
      return res.status(400).json({ success: false, error: 'brand_id is required.' });
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ success: false, error: 'tasks array must not be empty.' });
    }
    if (tasks.length > 500) {
      return res.status(400).json({ success: false, error: 'Maximum 500 tasks per import. Split your sheet into batches.' });
    }

    // ── Permission guard ─────────────────────────────────────────
    const role = req.user.role;
    const isLeadership = ['super_admin', 'admin', 'md'].includes(role);

    if (!isLeadership) {
      const ok = await isBrandAdminForBrand(req.user.id, brand_id);
      if (!ok) {
        return res.status(403).json({
          success: false,
          error: 'You can only import tasks into brands you administer.',
        });
      }
    }

    // ── Import ────────────────────────────────────────────────────
    const result = await bulkImportTasks({
      brandId:  brand_id,
      tasks,
      callerId: req.user.role !== 'super_admin' ? req.user.id : null,
      callerName: req.user.full_name
    });

    res.status(201).json({ success: true, ...result });

  } catch (err) {
    console.error('[task-import] POST / failed:', err.message);
    fail(res, err);
  }
});

module.exports = router;
