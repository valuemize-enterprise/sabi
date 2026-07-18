/**
 * Weekly Ratings Routes
 *
 * GET  /api/agency/weekly-ratings/to-rate         — team members not yet rated this week
 * POST /api/agency/weekly-ratings                  — submit a rating
 * GET  /api/agency/weekly-ratings/mine              — staff's own rating history
 * GET  /api/agency/creative-review                  — CD view: creative work from last 7 days
 * PUT  /api/agency/creative-review/creative-of-week — mark someone Creative of the Week
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const notify = require('../../services/notification-triggers.service');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);
const CREATIVE_ROLES = ['graphic_designer','content_creator','creative_lead'];

function mondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function canRate(userId, userRole, brandId) {
  if (isGlobalAdmin(userRole)) return true;
  const { data } = await supabase
    .from('staff_brand_assignments').select('roles_on_brand')
    .eq('staff_id', userId).eq('brand_id', brandId).single();
  return (data?.roles_on_brand ?? []).includes('brand_admin');
}

// ── GET /api/agency/weekly-ratings/to-rate ────────────────────
router.get('/to-rate', authenticate, async (req, res, next) => {
  try {
    const week = mondayOf();
    let brandIds = [];
    if (isGlobalAdmin(req.user.role)) {
      const { data: allBrands } = await supabase.from('brands').select('id').eq('status', 'active');
      brandIds = (allBrands ?? []).map(b => b.id);
    } else {
      const { data: assignments } = await supabase
        .from('staff_brand_assignments').select('brand_id, roles_on_brand').eq('staff_id', req.user.id);
      brandIds = (assignments ?? []).filter(a => (a.roles_on_brand??[]).includes('brand_admin')).map(a => a.brand_id);
    }

    if (brandIds.length === 0) return sendSuccess(res, { toRate: [] });

    const { data: team } = await supabase
      .from('staff_brand_assignments')
      .select('staff_id, brand_id, brands(name), users!staff_id(id, full_name, role)')
      .in('brand_id', brandIds);

    const { data: alreadyRated } = await supabase
      .from('weekly_ratings').select('staff_id, brand_id')
      .eq('rater_id', req.user.id).eq('week_start', week);

    const ratedSet = new Set((alreadyRated ?? []).map(r => `${r.staff_id}_${r.brand_id}`));
    const toRate = (team ?? []).filter(t => !ratedSet.has(`${t.staff_id}_${t.brand_id}`) && t.staff_id !== req.user.id);

    sendSuccess(res, { toRate, week_start: week });
  } catch (err) { next(err); }
});

// ── POST /api/agency/weekly-ratings ───────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { staff_id, brand_id, score, note, is_creative_of_week } = req.body;
    if (!staff_id || !brand_id) return sendError(res, 400, 'staff_id and brand_id are required');
    if (!score || score < 1 || score > 5) return sendError(res, 400, 'score must be between 1 and 5');
    if (score <= 2 && !note?.trim()) return sendError(res, 400, 'A note is required when rating 2 or below — this protects the staff member with context');

    const allowed = await canRate(req.user.id, req.user.role, brand_id);
    if (!allowed) return sendError(res, 403, 'Only the Brand Admin or a global admin can rate this brand\'s team');

    const week = mondayOf();

    const { data, error } = await supabase
      .from('weekly_ratings')
      .upsert({
        rater_id: req.user.role !== 'super_admin' ? req.user.id : null, staff_id, brand_id, week_start: week,
        score, note: note || null, is_creative_of_week: !!is_creative_of_week,
      }, { onConflict: 'rater_id,staff_id,brand_id,week_start' })
      .select()
      .single();

    if (error) throw error;
    if (is_creative_of_week) notify.onCreativeOfWeek(staff_id, note || 'Creative work');
    sendSuccess(res, { rating: data }, 'Rating submitted');
  } catch (err) { next(err); }
});

// ── GET /api/agency/weekly-ratings/mine ───────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('weekly_ratings')
      .select('score, note, week_start, is_creative_of_week, brands(name), rater:users!rater_id(full_name)')
      .eq('staff_id', req.user.id)
      .order('week_start', { ascending: false })
      .limit(20);

    if (error) throw error;
    sendSuccess(res, { ratings: data ?? [] });
  } catch (err) { next(err); }
});

// ── GET /api/agency/creative-review ───────────────────────────
// Creative Director, MD, and global admins: last 7 days of creative work
router.get('/creative-review-data', authenticate, async (req, res, next) => {
  try {
    const CREATIVE_REVIEW_ROLES = ['creative_director', 'managing_director'];
    if (!CREATIVE_REVIEW_ROLES.includes(req.user.role) && !isGlobalAdmin(req.user.role)) {
      return sendError(res, 403, 'Only the Creative Director, MD, and global admins can access creative review');
    }

    const CREATIVE_STAFF_ROLES = ['graphic_designer', 'content_creator', 'creative_lead'];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Get all users with creative roles
    const { data: creativeStaff } = await supabase
      .from('users').select('id, full_name, role').in('role', CREATIVE_STAFF_ROLES);
    const creativeIds = (creativeStaff ?? []).map(s => s.id);
    if (creativeIds.length === 0) return sendSuccess(res, { byStaff: [], week_start: mondayOf(), existingRatings: [] });

    const { data: workLogs, error } = await supabase
      .from('work_logs')
      .select('id, title, description, category, proof_links, created_at, user_id, brand_id, brands(name)')
      .in('user_id', creativeIds)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const staffMap = Object.fromEntries((creativeStaff ?? []).map(s => [s.id, s]));

    // Group by staff member
    const byStaff = {};
    (workLogs ?? []).forEach(log => {
      const sid = log.user_id;
      if (!sid) return;
      if (!byStaff[sid]) byStaff[sid] = { staff: staffMap[sid] ?? { id: sid, full_name: 'Unknown' }, entries: [] };
      byStaff[sid].entries.push(log);
    });

    const week = mondayOf();
    const { data: existingRatings } = await supabase
      .from('weekly_ratings').select('*')
      .eq('rater_id', req.user.id).eq('week_start', week);

    sendSuccess(res, {
      byStaff: Object.values(byStaff),
      week_start: week,
      existingRatings: existingRatings ?? [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
