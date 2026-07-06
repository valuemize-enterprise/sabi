/**
 * Client Proof of Value Routes — Proof of Value Engine™
 * Returns completed tasks with ARIA-generated impact scores.
 *
 * GET /api/client/proof-of-value
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id, title, description, status, priority,
        completed_at, proof_of_value_data,
        goals ( id, title, metric_type, unit ),
        users!assigned_to ( id, full_name, role )
      `)
      .eq('brand_id', req.client.brand_id)
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const tasks    = data || [];
    const withPOV  = tasks.filter(t => t.proof_of_value_data?.povScore !== undefined);
    const avgScore = withPOV.length
      ? Math.round(withPOV.reduce((s, t) => s + (t.proof_of_value_data?.povScore ?? 0), 0) / withPOV.length)
      : 0;

    sendSuccess(res, {
      tasks,
      summary: {
        total:      tasks.length,
        withPOV:    withPOV.length,
        avgPOVScore: avgScore,
        highImpact: withPOV.filter(t => (t.proof_of_value_data?.povScore ?? 0) >= 70).length,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
