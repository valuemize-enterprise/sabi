'use strict';

// ═══════════════════════════════════════════════════════════════════
// notifications.routes.js
//
// Mount in server.js:
//   const notifRouter = require('./src/routes/notifications.routes');
//   app.use('/api/notifications', authenticate, notifRouter);
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router  = express.Router();
const svc     = require('../services/notification.service');

// GET /api/notifications/mine
// Returns the caller's notifications, newest first.
// Query params:
//   limit       — max results (default 30)
//   unread_only — 'true' to return only unread
router.get('/mine', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const limit       = Math.min(100, Number(req.query.limit || 30));
    const unread_only = req.query.unread_only === 'true';

    const [notifications, unread_count] = await Promise.all([
      svc.getForUser(userId, { limit, unread_only }),
      svc.getUnreadCount(userId),
    ]);

    res.json({ notifications, unread_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read-all
// Mark every unread notification as read.
// Must come BEFORE /:id route.
router.patch('/read-all', async (req, res) => {
  try {
    await svc.markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/:id/read
// Mark a single notification as read.
router.patch('/:id/read', async (req, res) => {
  try {
    await svc.markRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id
// Delete a single notification (user dismisses it).
router.delete('/:id', async (req, res) => {
  try {
    await svc.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
