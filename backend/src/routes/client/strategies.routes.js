/**
 * Client Strategies Routes
 * Clients review and approve/reject strategies assigned to their brand.
 *
 * GET    /api/client/strategies          — list strategies for client's brand
 * GET    /api/client/strategies/:id      — get single strategy
 * POST   /api/client/strategies/:id/review — approve or reject a strategy
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');

const VALID_DECISIONS = ['approved', 'rejected'];

// ── GET /api/client/strategies ────────────────────────────────
router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('strategies')
      .select(`
        id, title, description, type, status,
        start_date, end_date, budget,
        client_status, pnl_status,
        brand_id, created_at, updated_at,
        brands ( id, name )
      `, { count: 'exact' })
      .eq('brand_id', req.client.brand_id);

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── GET /api/client/strategies/:id ───────────────────────────
router.get('/:id', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('strategies')
      .select(`
        *,
        brands ( id, name, industry )
      `)
      .eq('id', req.params.id)
      .eq('brand_id', req.client.brand_id)
      .single();

    if (error || !data) return sendError(res, 404, 'Strategy not found');
    sendSuccess(res, { strategy: data });
  } catch (err) { next(err); }
});

// ── POST /api/client/strategies/:id/review ───────────────────
router.post('/:id/review', authenticateClient, async (req, res, next) => {
  try {
    const { decision, feedback } = req.body;

    if (!decision || !VALID_DECISIONS.includes(decision)) {
      return sendError(res, 400, `decision must be one of: ${VALID_DECISIONS.join(', ')}`);
    }

    const updates = {
      client_status: decision,
      client_feedback: feedback || null,
      reviewed_by: req.client.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('strategies')
      .update(updates)
      .eq('id', req.params.id)
      .eq('brand_id', req.client.brand_id)
      .select('id, title, client_status, brand_id, brief_id')
      .single();

    if (error) throw error;

    // ── P&L trigger: if approved and linked to a new_project brief, flag P&L pending ──
    if (decision === 'approved' && data.brief_id) {
      const { data: brief } = await supabase
        .from('client_briefs')
        .select('work_type')
        .eq('id', data.brief_id)
        .single();

      if (brief?.work_type === 'new_project') {
        await supabase
          .from('strategies')
          .update({ pnl_status: 'pending' })
          .eq('id', data.id);
      } else {
        // Retainer work never needs a P&L
        await supabase
          .from('strategies')
          .update({ pnl_status: 'not_applicable' })
          .eq('id', data.id);
      }
    }

    // ── Notify agency admins about the decision ──
    const { data: brand } = await supabase.from('brands').select('name').eq('id', req.client.brand_id).single();
    const { data: admins } = await supabase
      .from('staff_brand_assignments')
      .select('staff_id')
      .eq('brand_id', req.client.brand_id)
      .contains('roles_on_brand', ['brand_admin']);

    if (admins?.length) {
      await supabase.from('notifications').insert(
        admins.map(a => ({
          user_id:  a.staff_id,
          type:     'strategy_reviewed',
          title:    `Strategy ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
          body:     `${req.client.full_name} from ${brand?.name ?? 'client'} has ${decision} strategy "${data.title}".`,
          metadata: { strategy_id: data.id, brand_id: req.client.brand_id, decision },
          is_read:  false,
        }))
      );
    }

    sendSuccess(res, { strategy: { id: data.id, client_status: data.client_status } }, `Strategy ${decision}`);
  } catch (err) { next(err); }
});

module.exports = router;
