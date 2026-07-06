/**
 * Client Moments Routes — MomentMap™
 * Returns upcoming Nigerian cultural, religious and commercial moments
 * relevant to the client's brand industry.
 *
 * GET /api/client/moments   — upcoming moments for the next 90 days
 */

'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { days = 90 } = req.query;
    const from = new Date().toISOString().split('T')[0];
    const to   = new Date(Date.now() + Number(days) * 86400000).toISOString().split('T')[0];

    // Fetch brand industry for relevance filtering
    const { data: brand } = await supabase
      .from('brands')
      .select('industry')
      .eq('id', req.client.brand_id)
      .single();

    let query = supabase
      .from('moments')
      .select('id, title, description, date, category, type, relevance_tags, action_tips, created_at')
      .gte('date', from)
      .lte('date', to)
      .eq('is_active', true)
      .order('date', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Score relevance — moments with brand's industry in relevance_tags rank first
    const industry = brand?.industry?.toLowerCase() || '';
    const scored = (data || []).map(m => ({
      ...m,
      is_relevant: (m.relevance_tags || []).some((t) =>
        t.toLowerCase().includes(industry) || industry.includes(t.toLowerCase())
      ),
    })).sort((a, b) => (b.is_relevant ? 1 : 0) - (a.is_relevant ? 1 : 0));

    sendSuccess(res, { moments: scored });
  } catch (err) { next(err); }
});

module.exports = router;
