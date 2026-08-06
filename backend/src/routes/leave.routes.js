// ═══════════════════════════════════════════════════════════════
// leave.routes.js
// Sabi Intelligence Suite
//
// Mount in server.js:
//   const leaveRouter = require('./src/routes/leave.routes');
//   app.use('/api/leave', requireAuth, leaveRouter);
//
// Endpoints:
//   GET  /api/leave                  → list requests (HR/MD = all, staff = own)
//   POST /api/leave                  → submit a request (any staff)
//   GET  /api/leave/:id              → single request
//   PATCH /api/leave/:id             → update status (HR/MD only)
// ═══════════════════════════════════════════════════════════════

'use strict';

const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');

// Email templates from Phase D (optional — remove if send() not wired yet)
let T, send;
try {
  const templates = require('../services/leave-email-templates');
  T    = templates.T;
  send = require('../services/email.service').send;
} catch {
  // Email not wired yet — continue without it
  send = null;
}

const HR_ROLES   = ['hr', 'super_admin', 'admin'];
const LEAD_ROLES = ['hr', 'super_admin', 'admin', 'md'];

const canManage = (role) => LEAD_ROLES.includes(role);

// ── Helpers ─────────────────────────────────────────────────────

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' })
  : null;

const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave', sick: 'Sick Leave', study: 'Study Leave',
  maternity: 'Maternity Leave', paternity: 'Paternity Leave',
  compassionate: 'Compassionate Leave', other: 'Other',
};

// ── GET /api/leave ───────────────────────────────────────────────
// HR/MD/Admin see all requests; regular staff see only their own.
// Query params: status (pending|approved|rejected), user_id, limit
router.get('/', async (req, res) => {
  try {
    const { role, id: callerId } = req.user;
    const { status, user_id, limit = 50 } = req.query;
    const isLead = canManage(role);

    let q = supabase
      .from('leave_requests')
      .select(`
        id, user_id, leave_type, start_date, end_date,
        days_count, reason, status, created_at,
        approved_by, approved_at, rejected_reason,
        requester:users!user_id ( id, full_name, role_title, role )
      `)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    // Staff can only see their own requests
    if (!isLead) {
      q = q.eq('user_id', callerId);
    } else if (user_id) {
      q = q.eq('user_id', user_id);
    }

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // Flatten requester info onto each record
    const requests = (data || []).map(r => ({
      ...r,
      requester_name: r.requester?.full_name || null,
      role_title:     r.requester?.role_title || r.requester?.role || null,
      leave_type_label: LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type,
      start_date_formatted: fmtDate(r.start_date),
      end_date_formatted:   fmtDate(r.end_date),
    }));

    res.json({ requests, count: requests.length });
  } catch (err) {
    console.error('[GET /leave]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/leave/:id ───────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { role, id: callerId } = req.user;

    const { data, error } = await supabase
      .from('leave_requests')
      .select(`
        *,
        requester:users!user_id ( id, full_name, role_title )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Leave request not found' });

    // Staff can only view their own
    if (!canManage(role) && data.user_id !== callerId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ request: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/leave ──────────────────────────────────────────────
// Any authenticated staff can submit a leave request.
// Body: { leave_type, start_date, end_date, days_count, reason? }
router.post('/', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { leave_type, start_date, end_date, days_count, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'leave_type, start_date, and end_date are required' });
    }

    const { data: newLeave, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id:    userId,
        leave_type,
        start_date,
        end_date,
        days_count: days_count || null,
        reason:     reason?.trim() || null,
        status:     'pending',
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Fire Phase D email notifications (optional — skipped if email not wired)
    if (send && T) {
      const { data: user } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', userId)
        .single()
        .catch(() => ({ data: null }));

      const { data: hr } = await supabase
        .from('users')
        .select('email')
        .in('role', HR_ROLES)
        .eq('status', 'active')
        .catch(() => ({ data: [] }));

      const hrEmails = (hr || []).map(h => h.email).filter(Boolean);

      const context = {
        leave_type:    LEAVE_TYPE_LABELS[leave_type] || leave_type,
        start_date:    fmtDate(start_date),
        end_date:      fmtDate(end_date),
        days_count:    days_count || '—',
        requester:     user?.full_name || 'A team member',
        reason:        reason || 'No reason provided',
      };

      await Promise.allSettled([
        // HR / MD notification
        hrEmails.length > 0 && send({ to: hrEmails, ...T.leave_request_submitted(context) }),
        // Staff confirmation
        user?.email && send({ to: [user.email], ...T.leave_request_confirmed(context) }),
      ]);
    }

    res.status(201).json({ request: newLeave });
  } catch (err) {
    console.error('[POST /leave]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/leave/:id ─────────────────────────────────────────
// HR/MD can update status (approved | rejected) and add a reason.
// Body: { status, rejected_reason? }
router.patch('/:id', async (req, res) => {
  try {
    const { role, id: approverId } = req.user;

    if (!canManage(role)) {
      return res.status(403).json({ error: 'HR or MD access required' });
    }

    const { status, rejected_reason } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }

    const update = {
      status,
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    };
    if (status === 'rejected' && rejected_reason) {
      update.rejected_reason = rejected_reason.trim();
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update(update)
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    res.json({ request: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
