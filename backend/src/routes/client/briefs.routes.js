/**
 * Client Briefs Routes
 * Clients submit briefs from their portal.
 * Admins are notified immediately.
 *
 * POST /api/client/briefs
 * GET  /api/client/briefs
 * GET  /api/client/briefs/:id
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticateClient } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError, sendPaginated } = require('../../utils/response.utils');
const ariaService = require('../../services/aria/aria-strategy.service');
const notify      = require('../../services/notification-triggers.service');

// ── Helper: create notification for all brand admins ─────────
async function notifyBrandAdmins(brandId, title, body, metadata) {
  // Get all users who are brand_admin or global admins
  const { data: admins } = await supabase
    .from('staff_brand_assignments')
    .select('staff_id')
    .eq('brand_id', brandId)
    .contains('roles_on_brand', ['brand_admin']);

  const { data: globalAdmins } = await supabase
    .from('users')
    .select('id')
    .in('role', ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director']);

  const allIds = [
    ...new Set([
      ...(admins ?? []).map(a => a.staff_id),
      ...(globalAdmins ?? []).map(a => a.id),
    ]),
  ];

  if (allIds.length === 0) return;

  await supabase.from('notifications').insert(
    allIds.map(userId => ({
      user_id:  userId,
      type:     'client_brief_submitted',
      title,
      body,
      metadata,
      is_read:  false,
    }))
  );
}

// ── GET /api/client/briefs ────────────────────────────────────
router.get('/', authenticateClient, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, count, error } = await supabase
      .from('client_briefs')
      .select('id, title, brief_type, status, priority, deadline, created_at, admin_notes, work_type', { count: 'exact' })
      .eq('client_id', req.client.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) { next(err); }
});

// ── GET /api/client/briefs/:id ────────────────────────────────
router.get('/:id', authenticateClient, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('client_briefs')
      .select('*')
      .eq('id', req.params.id)
      .eq('client_id', req.client.id)
      .single();

    if (error || !data) return sendError(res, 404, 'Brief not found');
    sendSuccess(res, { brief: data });
  } catch (err) { next(err); }
});

// ── POST /api/client/briefs ───────────────────────────────────
router.post('/', authenticateClient, async (req, res, next) => {
  try {
    const { title, description, brief_type = 'general', priority = 'normal', deadline, attachments } = req.body;

    if (!title)       return sendError(res, 400, 'Brief title is required');
    if (!description) return sendError(res, 400, 'Brief description is required');

    const { data: brief, error } = await supabase
      .from('client_briefs')
      .insert({
        client_id:   req.client.id,
        brand_id:    req.client.brand_id,
        title:       title.trim(),
        description: description.trim(),
        brief_type,
        priority,
        deadline:    deadline || null,
        attachments: attachments || [],
        status:      'submitted',
      })
      .select()
      .single();

    if (error) throw error;

    // Get client + brand names for notification
    const { data: brand } = await supabase.from('brands').select('name').eq('id', req.client.brand_id).single();

    // Notify all brand admins + global admins
    await notifyBrandAdmins(
      req.client.brand_id,
      `📋 New Brief: ${title}`,
      `${req.client.full_name} from ${brand?.name ?? 'client'} has submitted a new ${brief_type} brief.`,
      { brief_id: brief.id, brand_id: req.client.brand_id, client_name: req.client.full_name }
    );

    // AI: extract insights from the brief in background
    ariaService.extractBriefInsights({ title, description, briefType: brief_type })
      .then(async insights => {
        if (Object.keys(insights).length > 0) {
          await supabase.from('client_briefs')
            .update({ metadata: insights })
            .eq('id', brief.id);
        }
        notify.onBriefSubmitted(brief, insights);
      })
      .catch(() => { notify.onBriefSubmitted(brief, null); });

    sendSuccess(res, { brief }, 'Brief submitted successfully', 201);
  } catch (err) { next(err); }
});

module.exports = router;
