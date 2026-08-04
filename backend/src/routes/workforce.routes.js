// ═══════════════════════════════════════════════════════════════════
// workforce.routes.js
// Sabi Intelligence Suite — Phase D: MD Dashboard
//
// Mount in server.js:
//   const workforceRouter = require('./src/routes/workforce.routes');
//   app.use('/api/workforce', requireAuth, workforceRouter);
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express  = require('express');
const router   = express.Router();
const svc      = require('../services/workforce.service');

const LEADERSHIP = ['super_admin', 'md', 'admin', 'hr'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// GET /api/workforce/snapshot
// Returns all 4 widget data objects in a single call.
// Polled every 60 seconds by the Command Centre WorkforceSnapshot component.
router.get('/snapshot', requireRoles(...LEADERSHIP), async (req, res) => {
  try {
    const data = await svc.getWorkforceSnapshot();
    res.json(data);
  } catch (err) {
    console.error('[workforce] snapshot error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// ═══════════════════════════════════════════════════════════════════
// LEAVE NOTIFICATION PATCH
// ─────────────────────────────────────────────────────────────────
// Find your existing leave route — likely:
//   backend/src/routes/leave.routes.js
//
// Locate the POST route that creates a leave request (likely
//   POST /api/leave  or  POST /api/leave/request).
//
// Add this block AFTER the leave request is successfully inserted:
// ═══════════════════════════════════════════════════════════════════

/*

// ── Add this import at the top of leave.routes.js ─────────────────
const { send } = require('../services/email-dispatch.service');

// ── Inside your existing POST /api/leave (or similar) handler ─────
// After the supabase insert succeeds, add:

// Notify HR + MD of the new leave request
const { data: leaders } = await supabase
  .from('users')
  .select('id, email, full_name')
  .in('role', ['hr', 'super_admin', 'md'])
  .eq('is_active', true);

// Format dates for human-readable display
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Africa/Lagos',
  });

const startLabel  = fmtDate(req.body.start_date);
const endLabel    = fmtDate(req.body.end_date);
const daysCount   = req.body.days_count || req.body.days || '—';
const leaveType   = req.body.leave_type || 'Annual';

for (const leader of (leaders || [])) {
  // In-app notification
  await supabase.from('notifications').insert({
    user_id:  leader.id,
    type:     'leave_request_submitted',
    title:    `Leave Request — ${req.user.full_name}`,
    body:     `${req.user.full_name} has submitted a ${leaveType} leave request for ${daysCount} day(s) (${startLabel} – ${endLabel}).`,
    metadata: {
      staff_id:   req.user.id,
      leave_type: leaveType,
      start_date: req.body.start_date,
      end_date:   req.body.end_date,
      days_count: daysCount,
    },
  }).catch(e => console.error('[leave] notification failed:', e.message));

  // Email notification
  await send('leave_request_submitted', {
    to:   { id: leader.id, email: leader.email },
    data: {
      recipientName: leader.full_name,
      staffName:     req.user.full_name,
      staffRole:     req.user.role,
      leaveType,
      startDate:     startLabel,
      endDate:       endLabel,
      daysCount,
      reason:        req.body.reason || '',
      reviewUrl:     `${process.env.APP_URL}/people?tab=leave`,
    },
    entityId: `leave:${newLeave.id}:${leader.id}`,
    dedupe:   'once',
  }).catch(e => console.error('[leave] email failed:', e.message));
}

// Also send confirmation to the staff member themselves
await send('leave_request_confirmed', {
  to:   { id: req.user.id, email: req.user.email },
  data: {
    recipientName: req.user.full_name,
    leaveType,
    startDate:  startLabel,
    endDate:    endLabel,
    daysCount,
    reviewUrl:  `${process.env.APP_URL}/leave/my-requests`,
  },
  entityId: `leave:${newLeave.id}:self`,
  dedupe:   'once',
}).catch(e => console.error('[leave] staff confirmation email failed:', e.message));

*/
