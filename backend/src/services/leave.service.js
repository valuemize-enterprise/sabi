/**
 * Leave Service — D4 approval chain.
 * Staff request → Brand Admin approves own team → HR records & oversees;
 * HR / MD / Super Admin can approve anyone. Approval writes the existing
 * staff_leave table, so the scoring engine's leave exclusion and the
 * Command Center team cell keep working with ZERO changes.
 */

'use strict';

const supabase = require('../config/supabase');
const dispatch = require('./email-dispatch.service');

const DIRECT_APPROVERS = new Set(['hr', 'md', 'super_admin']);

async function isTeamBrandAdmin(approverId, staffUserId) {
  const { data: myBrands } = await supabase.from('staff_brand_assignments')
    .select('brand_id').contains('roles_on_brand', ['brand_admin']).eq('staff_id', approverId);
  if (!myBrands?.length) return false;
  const { data: shared } = await supabase.from('staff_brand_assignments')
    .select('brand_id').eq('staff_id', staffUserId)
    .in('brand_id', myBrands.map(b => b.brand_id)).limit(1);
  return (shared || []).length > 0;
}

async function requestLeave(user, { leave_type = 'annual', start_date, end_date, note = null }) {
  if (!start_date || !end_date || new Date(end_date) < new Date(start_date)) {
    throw Object.assign(new Error('Invalid date range'), { status: 400 });
  }
  const { data: req, error } = await supabase.from('leave_requests')
    .insert({ user_id: user.id, leave_type, start_date, end_date, note })
    .select('*').single();
  if (error) throw new Error(error.message);

  // notify approvers: this person's Brand Admins + HR
  const { data: myBrands } = await supabase.from('staff_brand_assignments')
    .select('brand_id').eq('staff_id', user.id);
  const brandIds = (myBrands || []).map(b => b.brand_id);
  const [{ data: bas }, { data: hr }] = await Promise.all([
    brandIds.length
      ? supabase.from('staff_brand_assignments').select('users!staff_id(id, email, full_name)')
          .contains('roles_on_brand', ['brand_admin']).in('brand_id', brandIds)
      : Promise.resolve({ data: [] }),
    supabase.from('users').select('id, email, full_name').eq('role', 'hr').eq('is_active', true),
  ]);
  const seen = new Set(); const approvers = [];
  for (const u of [...(bas || []).map(r => r.users).filter(Boolean), ...(hr || [])]) {
    if (u.id !== user.id && !seen.has(u.id)) { seen.add(u.id); approvers.push(u); }
  }
  await dispatch.sendToMany('leave_request', approvers, {
    entityId: req.id, dedupe: 'once',
    data: { staffName: user.full_name, leaveType: leave_type,
            startDate: start_date, endDate: end_date, note },
  });
  return req;
}

async function decideLeave(requestId, approver, approve, decisionNote = null) {
  const { data: req, error } = await supabase.from('leave_requests')
    .select('*').eq('id', requestId).single();
  if (error || !req) throw Object.assign(new Error('Request not found'), { status: 404 });
  if (req.status !== 'pending') throw Object.assign(new Error('Already decided'), { status: 409 });

  const allowed = DIRECT_APPROVERS.has(approver.role)
    || await isTeamBrandAdmin(approver.id, req.user_id);
  if (!allowed) throw Object.assign(new Error('Not authorised to approve this request'), { status: 403 });

  const status = approve ? 'approved' : 'declined';
  await supabase.from('leave_requests').update({
    status, approver_id: approver.id, decision_note: decisionNote,
    decided_at: new Date().toISOString(),
  }).eq('id', requestId);

  if (approve) {
    // Bridge: scoring exclusion + Command Center read staff_leave.
    // staff_leave uses one row per week (week_start = Monday), so we
    // expand the request's date range into per-week upserts.
    const start = new Date(req.start_date);
    const end   = new Date(req.end_date);
    // snap start back to Monday
    const dayOfWeek = start.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(start);
    monday.setUTCDate(start.getUTCDate() + mondayOffset);
    const rows = [];
    for (const d = new Date(monday); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
      rows.push({
        staff_id: req.user_id,
        week_start: d.toISOString().slice(0, 10),
        reason: req.leave_type || 'leave',
      });
    }
    if (rows.length) {
      await supabase.from('staff_leave').upsert(rows, { onConflict: 'staff_id,week_start' });
    }
  }

  const { data: staff } = await supabase.from('users')
    .select('id, email, full_name').eq('id', req.user_id).single();
  if (staff) await dispatch.send('leave_decision', {
    to: staff, entityId: requestId, dedupe: 'once',
    data: { name: staff.full_name, approved: approve, leaveType: req.leave_type,
            startDate: req.start_date, endDate: req.end_date,
            approverName: approver.full_name, decisionNote },
  });
  return { status };
}

async function pendingForApprover(approver) {
  if (DIRECT_APPROVERS.has(approver.role)) {
    const { data } = await supabase.from('leave_requests')
      .select('*, user:users!leave_requests_user_id_fkey(full_name)')
      .eq('status', 'pending').order('created_at');
    return data || [];
  }
  const { data: myBrands } = await supabase.from('staff_brand_assignments')
    .select('brand_id').contains('roles_on_brand', ['brand_admin']).eq('staff_id', approver.id);
  if (!myBrands?.length) return [];
  const { data: team } = await supabase.from('staff_brand_assignments')
    .select('staff_id').in('brand_id', myBrands.map(b => b.brand_id));
  const ids = [...new Set((team || []).map(t => t.staff_id))];
  if (!ids.length) return [];
  const { data } = await supabase.from('leave_requests')
    .select('*, user:users!leave_requests_user_id_fkey(full_name)')
    .eq('status', 'pending').in('user_id', ids).order('created_at');
  return data || [];
}

module.exports = { requestLeave, decideLeave, pendingForApprover };
