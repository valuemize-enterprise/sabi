'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');

router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = supabase.from('brands').select('*, users!account_manager_id(full_name, email)', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) { next(err); }
});

router.put('/:id/status', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive', 'suspended'].includes(status)) return sendError(res, 400, 'Invalid status');
    const { data, error } = await supabase.from('brands').update({ status }).eq('id', req.params.id).select().single();
    if (error) throw error;
    sendSuccess(res, { brand: data });
  } catch (err) { next(err); }
});

router.delete('/:id', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { error } = await supabase.from('brands').delete().eq('id', req.params.id);
    if (error) throw error;
    sendSuccess(res, null, 'Brand deleted');
  } catch (err) { next(err); }
});

module.exports = router;
