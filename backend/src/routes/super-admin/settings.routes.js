'use strict';
const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const { auditLog } = require('../../middleware/logger.middleware');

router.get('/', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('platform_settings').select('*').order('key');
    if (error) throw error;
    sendSuccess(res, { settings: data });
  } catch (err) { next(err); }
});

router.put('/:key', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { value } = req.body;
    if (value === undefined) return sendError(res, 400, 'value required');
    const { data, error } = await supabase.from('platform_settings')
      .upsert({ key: req.params.key, value: JSON.stringify(value), updated_by: 'super_admin', updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select().single();
    if (error) throw error;
    await auditLog({ actorId: 'super_admin', actorEmail: 'cerebreplus@gmail.com', actorRole: 'super_admin', action: 'UPDATE_SETTING', details: { key: req.params.key, value }, req });
    sendSuccess(res, { setting: data });
  } catch (err) { next(err); }
});

module.exports = router;
