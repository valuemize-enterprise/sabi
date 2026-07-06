/**
 * Agency Notifications Routes
 *
 * GET  /api/agency/notifications          — list unread + recent
 * PUT  /api/agency/notifications/:id/read — mark single as read
 * PUT  /api/agency/notifications/read-all — mark all as read
 * DELETE /api/agency/notifications/:id    — delete one
 */

'use strict';

const router          = require('express').Router();
const supabase        = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendPaginated } = require('../../utils/response.utils');

// ── GET /api/agency/notifications ────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, count, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, is_read, metadata, created_at', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;

    const unreadCount = (data || []).filter(n => !n.is_read).length;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── PUT /api/agency/notifications/:id/read ───────────────────
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    sendSuccess(res, null, 'Marked as read');
  } catch (err) { next(err); }
});

// ── PUT /api/agency/notifications/read-all ───────────────────
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/notifications/:id ─────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await supabase
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    sendSuccess(res, null, 'Notification deleted');
  } catch (err) { next(err); }
});

module.exports = router;
