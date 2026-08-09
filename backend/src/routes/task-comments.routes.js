// ═══════════════════════════════════════════════════════════════════
// task-comments.routes.js
// Mount: app.use('/api/tasks', authenticate, taskCommentsRouter);
//
// Endpoints land at:
//   GET    /api/tasks/:taskId/comments
//   POST   /api/tasks/:taskId/comments
//   PATCH  /api/tasks/:taskId/comments/:id
//   DELETE /api/tasks/:taskId/comments/:id
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router({ mergeParams: true });
const svc     = require('../services/task-comments.service');

// GET /api/tasks/:taskId/comments
router.get('/', async (req, res) => {
  try {
    const comments = await svc.listComments(req.params.taskId);
    res.json({ comments, count: comments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:taskId/comments
// Body: { body: string, mentions?: UUID[] }
router.post('/', async (req, res) => {
  try {
    const { body, mentions = [] } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body is required' });
    const comment = await svc.addComment(
      req.params.taskId,
      req.user.id,
      body,
      mentions,
    );
    res.status(201).json({ comment });
  } catch (err) {
    const s = err.status || 500;
    res.status(s).json({ error: err.message });
  }
});

// PATCH /api/tasks/:taskId/comments/:id
// Body: { body: string }
router.patch('/:id', async (req, res) => {
  try {
    const { body } = req.body;
    const comment = await svc.editComment(req.params.id, req.user.id, body);
    res.json({ comment });
  } catch (err) {
    const s = err.status || 500;
    res.status(s).json({ error: err.message });
  }
});

// DELETE /api/tasks/:taskId/comments/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await svc.deleteComment(req.params.id, req.user.id, req.user.role);
    res.json(result);
  } catch (err) {
    const s = err.status || 500;
    res.status(s).json({ error: err.message });
  }
});

module.exports = router;
