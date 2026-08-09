// ═══════════════════════════════════════════════════════════════════
// task-groups.routes.js
// Mount: app.use('/api/task-groups', authenticate, taskGroupsRouter);
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router();
const svc     = require('../services/task-groups.service');

const ADMIN_ROLES = ['super_admin', 'admin', 'brand_admin', 'md', 'hr'];

const requireAdmin = (req, res, next) => {
  if (!ADMIN_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Brand Admin or above required' });
  }
  next();
};

// GET /api/task-groups?brand_id=
router.get('/', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const data = await svc.listGroups(brand_id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/task-groups/grouped?brand_id=&month=&year=&status=
router.get('/grouped', async (req, res) => {
  try {
    const { brand_id, month, year, status, date_field } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const data = await svc.getGroupedTasks(brand_id, {
      month:      month ? Number(month) : null,
      year:       year  ? Number(year)  : null,
      date_field: date_field || 'due_date',
      status:     status || null,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/task-groups
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { brand_id, name, color } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const group = await svc.createGroup(brand_id, { name, color }, req.user.id);
    res.status(201).json({ group });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// PATCH /api/task-groups/reorder  — must be before /:id
router.patch('/reorder', requireAdmin, async (req, res) => {
  try {
    const { brand_id, ordered_ids } = req.body;
    if (!brand_id || !Array.isArray(ordered_ids)) {
      return res.status(400).json({ error: 'brand_id and ordered_ids[] are required' });
    }
    const result = await svc.reorderGroups(brand_id, ordered_ids);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/task-groups/:id
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { brand_id, name, color, status } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const group = await svc.updateGroup(req.params.id, brand_id, { name, color, status });
    res.json({ group });
  } catch (err) {
    const s = err.status || 500;
    res.status(s).json({ error: err.message });
  }
});

// DELETE /api/task-groups/:id?brand_id=&moveTo=
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { brand_id, moveTo } = req.query;
    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    const result = await svc.deleteGroup(req.params.id, brand_id, { moveTo: moveTo || null });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
