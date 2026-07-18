/**
 * Contribution Claims Routes
 * Staff claim extra-mile contributions with proof. Verified claims earn
 * points toward their weekly score. Capped at 2 counted claims/week.
 *
 * POST /api/agency/contribution-claims             — staff submits a claim
 * GET  /api/agency/contribution-claims/mine         — staff's own claim history
 * GET  /api/agency/contribution-claims/pending      — verifier's review queue
 * PUT  /api/agency/contribution-claims/:id/verify   — award points (5/10/15)
 * PUT  /api/agency/contribution-claims/:id/reject   — reject with required note
 */
'use strict';

const router   = require('express').Router();
const supabase = require('../../config/supabase');
const { authenticate } = require('../../middleware/auth.middleware');
const { sendSuccess, sendError } = require('../../utils/response.utils');
const notify = require('../../services/notification-triggers.service');

const GLOBAL_ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];
const isGlobalAdmin = (role) => GLOBAL_ADMIN_ROLES.includes(role);

async function canVerify(userId, userRole, brandId) {
  if (isGlobalAdmin(userRole)) return true;
  const { data } = await supabase
    .from('staff_brand_assignments')
    .select('roles_on_brand')
    .eq('staff_id', userId)
    .eq('brand_id', brandId)
    .single();
  return (data?.roles_on_brand ?? []).includes('brand_admin');
}

function mondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ── POST /api/agency/contribution-claims ──────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { brand_id, title, description, proof_links } = req.body;
    if (!brand_id)     return sendError(res, 400, 'brand_id is required');
    if (!title)        return sendError(res, 400, 'title is required');
    if (!description)  return sendError(res, 400, 'description is required — explain why this goes beyond your core function');
    if (!proof_links?.length) return sendError(res, 400, 'At least one proof link is required — claims without evidence cannot be reviewed');

    const staffId = req.user.role !== 'super_admin' ? req.user.id : null;
    const thisWeek = mondayOf();

    // Enforce 2/week cap: count existing pending+verified claims for this week
    const { count: thisWeekCount } = await supabase
      .from('contribution_claims')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('week_start', thisWeek)
      .in('status', ['pending', 'verified']);

    // Excess claims roll to next week's scoring window
    const weekStart = (thisWeekCount ?? 0) >= 2
      ? (() => { const d = new Date(thisWeek + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10); })()
      : thisWeek;

    const { data, error } = await supabase
      .from('contribution_claims')
      .insert({
        staff_id: staffId, brand_id, title: title.trim(), description: description.trim(),
        proof_links, week_start: weekStart, status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify brand admins + global admins
    const { data: brandAdmins } = await supabase
      .from('staff_brand_assignments').select('staff_id')
      .eq('brand_id', brand_id).contains('roles_on_brand', ['brand_admin']);
    const { data: globalAdmins } = await supabase.from('users').select('id').in('role', GLOBAL_ADMIN_ROLES);
    const toNotify = [...new Set([...(brandAdmins??[]).map(a=>a.staff_id), ...(globalAdmins??[]).map(a=>a.id)])];

    if (toNotify.length) {
      await supabase.from('notifications').insert(toNotify.map(userId => ({
        user_id: userId, type: 'contribution_claim_submitted',
        title: `🌟 Contribution Claim: ${title}`,
        body: `${req.user.full_name} submitted a contribution claim for review.`,
        metadata: { claim_id: data.id, brand_id }, is_read: false,
      })));
    }

    sendSuccess(res, { claim: data }, 'Claim submitted for review', 201);
  } catch (err) { next(err); }
});

// ── GET /api/agency/contribution-claims/mine ──────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contribution_claims')
      .select('*, brands(name), reviewer:users!reviewed_by(full_name)')
      .eq('staff_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Count this week's claims (pending + verified) for the cap indicator
    const thisWeek = mondayOf();
    const { count: thisWeekCount } = await supabase
      .from('contribution_claims')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', req.user.id)
      .eq('week_start', thisWeek)
      .in('status', ['pending', 'verified']);

    sendSuccess(res, { claims: data ?? [], thisWeekCount: thisWeekCount ?? 0, maxPerWeek: 2 });
  } catch (err) { next(err); }
});

// ── GET /api/agency/contribution-claims/pending ────────────────
router.get('/pending', authenticate, async (req, res, next) => {
  try {
    let brandIds = [];
    if (isGlobalAdmin(req.user.role)) {
      const { data: allBrands } = await supabase.from('brands').select('id').eq('status', 'active');
      brandIds = (allBrands ?? []).map(b => b.id);
    } else {
      const { data: assignments } = await supabase
        .from('staff_brand_assignments').select('brand_id, roles_on_brand').eq('staff_id', req.user.id);
      brandIds = (assignments ?? []).filter(a => (a.roles_on_brand??[]).includes('brand_admin')).map(a => a.brand_id);
    }

    if (brandIds.length === 0) return sendSuccess(res, { claims: [] });

    const { data, error } = await supabase
      .from('contribution_claims')
      .select('*, brands(name), staff:users!staff_id(id, full_name, role)')
      .in('brand_id', brandIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Attach each claimant's core functions so the verifier can judge "is this actually extra?"
    const staffRoles = [...new Set((data ?? []).map(c => c.staff?.role).filter(Boolean))];
    const { data: coreFns } = staffRoles.length
      ? await supabase.from('role_core_functions').select('role, function_text').in('role', staffRoles)
      : { data: [] };

    const enriched = (data ?? []).map(c => ({
      ...c,
      staffCoreFunctions: (coreFns ?? []).filter(f => f.role === c.staff?.role).map(f => f.function_text),
    }));

    sendSuccess(res, { claims: enriched });
  } catch (err) { next(err); }
});

// ── PUT /api/agency/contribution-claims/:id/verify ─────────────
router.put('/:id/verify', authenticate, async (req, res, next) => {
  try {
    const { points_awarded, review_note } = req.body;
    if (![5, 10, 15].includes(points_awarded)) return sendError(res, 400, 'points_awarded must be 5, 10, or 15');

    const { data: claim } = await supabase.from('contribution_claims').select('*').eq('id', req.params.id).single();
    if (!claim) return sendError(res, 404, 'Claim not found');
    if (claim.status !== 'pending') return sendError(res, 400, 'This claim has already been reviewed');

    const allowed = await canVerify(req.user.id, req.user.role, claim.brand_id);
    if (!allowed) return sendError(res, 403, 'Only the Brand Admin or a global admin can verify this claim');

    const { data, error } = await supabase
      .from('contribution_claims')
      .update({
        status: 'verified', points_awarded,
        review_note: review_note || null,
        reviewed_by: req.user.role !== 'super_admin' ? req.user.id : null, reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: claim.staff_id, type: 'contribution_verified',
      title: `✅ Contribution Verified: +${points_awarded} points`,
      body: `Your claim "${claim.title}" was verified by ${req.user.full_name}.`,
      metadata: { claim_id: claim.id }, is_read: false,
    });

    notify.onClaimResolved({ id: data.id, title: data.title, user_id: data.staff_id, brand_id: data.brand_id }, true, points_awarded, review_note);

    sendSuccess(res, { claim: data }, 'Claim verified');
  } catch (err) { next(err); }
});

// ── PUT /api/agency/contribution-claims/:id/reject ─────────────
router.put('/:id/reject', authenticate, async (req, res, next) => {
  try {
    const { review_note } = req.body;
    if (!review_note?.trim()) return sendError(res, 400, 'A reason is required when rejecting a claim');

    const { data: claim } = await supabase.from('contribution_claims').select('*').eq('id', req.params.id).single();
    if (!claim) return sendError(res, 404, 'Claim not found');
    if (claim.status !== 'pending') return sendError(res, 400, 'This claim has already been reviewed');

    const allowed = await canVerify(req.user.id, req.user.role, claim.brand_id);
    if (!allowed) return sendError(res, 403, 'Only the Brand Admin or a global admin can review this claim');

    const { data, error } = await supabase
      .from('contribution_claims')
      .update({ status: 'rejected', review_note: review_note.trim(), reviewed_by: req.user.role !== 'super_admin' ? req.user.id : null, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id: claim.staff_id, type: 'contribution_rejected',
      title: `Contribution Not Verified: ${claim.title}`,
      body: `${req.user.full_name}: "${review_note.trim()}"`,
      metadata: { claim_id: claim.id }, is_read: false,
    });

    notify.onClaimResolved({ id: data.id, title: data.title, user_id: data.staff_id, brand_id: data.brand_id }, false, 0, review_note.trim());

    sendSuccess(res, { claim: data }, 'Claim rejected with feedback');
  } catch (err) { next(err); }
});

module.exports = router;
