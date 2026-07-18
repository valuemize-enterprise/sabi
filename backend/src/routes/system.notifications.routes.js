/**
 * System routes for the email notification engine.
 *
 * POST /api/system/notifications/sweep
 *   → runs the full sweeper. Protect with x-sweep-secret header.
 *     Point a Render Cron Job / UptimeRobot / GitHub Action here hourly.
 *
 * POST /api/system/notifications/test
 *   → Super Admin only. Sends any template to your own email with
 *     sample data — perfect for previewing copy in a real inbox.
 *     Body: { "template": "task_overdue", "level": 2 }
 */

'use strict';

const express = require('express');
const router = express.Router();
const { runSweep } = require('../services/notification-sweeper.service');
const dispatch = require('../services/email-dispatch.service');
const { T } = require('../services/email-templates');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

// Sample data used by the test endpoint for every template
const SAMPLE = {
  name: 'Kalu', brandName: 'First Bank', taskTitle: 'Design IG carousel — MREIF campaign',
  assignedBy: 'Adaeze (Brand Admin)', dueDate: '2026-07-20', strategyTitle: 'H2 Home Loan Push',
  daysOverdue: 3, reviewerName: 'Adaeze', reason: 'Logo placement violates the brand guide — see Visual tab.',
  verifierName: 'Adaeze', claimTitle: 'Rescued the client call while AM was offline', points: 10,
  approved: true, total: 76, rollingAvg: 74, workTitle: 'MREIF launch reel',
  count: 4, oldestDays: 3, staffName: 'Chioma', daysWaiting: 4, unratedCount: 3,
  briefTitle: 'Detty December activation', ariaInsights: 'Client wants youth reach; budget flexible; deadline hard.',
  deadline: '2026-11-01', hoursOld: 26, strategyTitle2: 'Detty December GTM',
  weekLabel: 'Week of Jul 6', verifiedTasks: 42, newRevenue: '₦4.2M', satisfactionAvg: '4.3 / 5',
  redFlags: 'WinIt satisfaction dipped to 3.1', rating: 2, comment: 'Reports came late twice this month.',
  weeksSilent: 3, itemCount: 17, activeUsers: 28, tasksVerified: 42, tasksRejected: 3,
  revenueBooked: '₦4.2M', briefsIn: 6, briefsClassified: 5, auditHighlights: '1 brand deletion (approved)',
  actionLabel: 'Scoring weight change', actorName: 'Super Admin', when: 'Jul 17, 09:12 WAT',
  details: 'Client Satisfaction 35 → 40', periodLabel: 'June 2026', statusLabel: 'In Strategy',
  note: 'Strategy draft shared for your review.', goalTitle: '50,000 monthly site visitors',
  momentName: 'International Friendship Day', momentDate: 'Jul 30', invoiceRef: 'INV-2026-041',
  amount: '₦850,000', description: 'Detty December activation — Phase 1', daysUntilDue: 3,
};

// ── POST /sweep ───────────────────────────────────────────────
router.post('/sweep', async (req, res) => {
  const secret = process.env.SWEEP_SECRET;
  if (!secret || req.headers['x-sweep-secret'] !== secret) {
    return res.status(401).json({ success: false, error: 'Invalid sweep secret' });
  }
  const result = await runSweep();
  res.json({ success: true, ...result });
});

// ── POST /test ────────────────────────────────────────────────
router.post('/test', authenticate, requireRole('super_admin'), async (req, res) => {
  const { template, level = 1 } = req.body || {};
  if (!T[template]) {
    return res.status(400).json({
      success: false, error: `Unknown template. Available: ${Object.keys(T).join(', ')}`,
    });
  }
  const result = await dispatch.send(template, {
    to: { id: req.user.id, email: req.user.email },
    data: { ...SAMPLE, name: req.user.full_name || 'there' },
    entityId: null, dedupe: 'always', level,
  });
  res.json({ success: true, result, note: 'Check your inbox.' });
});

module.exports = router;
