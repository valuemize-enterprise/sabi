'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess, sendPaginated } = require('../../utils/response.utils');

router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { actor_role, action, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('audit_logs').select('*', { count: 'exact' });
    if (actor_role) query = query.eq('actor_role', actor_role);
    if (action)     query = query.eq('action', action);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

module.exports = router;
