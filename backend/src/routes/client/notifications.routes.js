/**
 * Client Notifications Routes
 *
 * GET /api/client/notifications
 * PUT /api/client/notifications/:id/read
 * PUT /api/client/notifications/read-all
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendPaginated } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, count, error } = await supabase
      .from('client_notifications')
      .select('id, type, title, body, is_read, metadata, created_at', { count: 'exact' })
      .eq('client_id', req.client.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

router.put('/:id/read', authenticateClient, async (req, res, next) => {
  try {
    await supabase
      .from('client_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('client_id', req.client.id);
    sendSuccess(res, null, 'Marked as read');
  } catch (err) { next(err); }
});

router.put('/read-all', authenticateClient, async (req, res, next) => {
  try {
    await supabase
      .from('client_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('client_id', req.client.id)
      .eq('is_read', false);
    sendSuccess(res, null, 'All marked as read');
  } catch (err) { next(err); }
});

module.exports = router;
