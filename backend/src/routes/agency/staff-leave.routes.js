/**
 * Staff Leave Routes
 * Small admin control — marks a staff member as on leave for a given week
 * so that week is excluded from their rolling score average (Phase 2).
 *
 * GET    /api/agency/staff-leave?week_start=YYYY-MM-DD
 * POST   /api/agency/staff-leave
 * DELETE /api/agency/staff-leave/:id
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

// Brand Admins can mark leave for their own team; global admins for anyone
async function canMarkLeave(userId, userRole, staffId) {
  if (isGlobalAdmin(userRole)) return true;
  const { data: myBrands } = await supabase.from('staff_brand_assignments').select('brand_id, roles_on_brand').eq('staff_id', userId);
  const adminBrandIds = (myBrands ?? []).filter(b => (b.roles_on_brand ?? []).includes('brand_admin')).map(b => b.brand_id);
  if (adminBrandIds.length === 0) return false;
  const { data: theirBrands } = await supabase.from('staff_brand_assignments').select('brand_id').eq('staff_id', staffId);
  return (theirBrands ?? []).some(b => adminBrandIds.includes(b.brand_id));
}

// Monday of the current or given week, Africa/Lagos-safe (date-only arithmetic)
function mondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ── GET /api/agency/staff-leave ───────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const week = mondayOf(req.query.week_start);
    const { data, error } = await supabase
      .from('staff_leave')
      .select('id, staff_id, week_start, reason, users!staff_id(full_name)')
      .eq('week_start', week);

    if (error) throw error;
    sendSuccess(res, { leave: data ?? [], week_start: week });
  } catch (err) { next(err); }
});

// ── POST /api/agency/staff-leave ──────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { staff_id, week_start, reason } = req.body;
    if (!staff_id) return sendError(res, 400, 'staff_id is required');

    const canMark = await canMarkLeave(req.user.id, req.user.role, staff_id);
    if (!canMark) return sendError(res, 403, 'You can only mark leave for staff on brands you administer');

    const week = mondayOf(week_start);
    const { data, error } = await supabase
      .from('staff_leave')
      .upsert({
        staff_id, week_start: week,
        reason: reason || 'leave',
        marked_by: req.user.role !== 'super_admin' ? req.user.id : null,
      }, { onConflict: 'staff_id,week_start' })
      .select()
      .single();

    if (error) throw error;
    sendSuccess(res, { leave: data }, 'Marked as on leave for that week', 201);
  } catch (err) { next(err); }
});

// ── DELETE /api/agency/staff-leave/:id ────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { data: entry } = await supabase.from('staff_leave').select('staff_id').eq('id', req.params.id).single();
    if (!entry) return sendError(res, 404, 'Leave entry not found');

    const canMark = await canMarkLeave(req.user.id, req.user.role, entry.staff_id);
    if (!canMark) return sendError(res, 403, 'Not permitted');

    await supabase.from('staff_leave').delete().eq('id', req.params.id);
    sendSuccess(res, null, 'Leave marking removed');
  } catch (err) { next(err); }
});

module.exports = router;
