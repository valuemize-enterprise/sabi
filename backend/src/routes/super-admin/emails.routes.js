'use strict';
const router = require('express').Router();
const { authenticateSuperAdmin } = require('../../middleware/auth.middleware');
const { sendSuccess } = require('../../utils/response.utils');

// Email templates are stored as static HTML files in the codebase
// This route returns the list of available templates
const EMAIL_TEMPLATES = [
  { id: 'welcome-staff',         name: 'Welcome — New Staff Member',         trigger: 'User creation' },
  { id: 'welcome-client',        name: 'Welcome — New Client',               trigger: 'Client creation' },
  { id: 'password-reset',        name: 'Password Reset',                     trigger: 'Password reset' },
  { id: 'weekly-digest',         name: 'Weekly Brand Digest',                trigger: 'Scheduled weekly' },
  { id: 'report-published',      name: 'New Report Published',               trigger: 'Report published' },
  { id: 'goal-achieved',         name: 'Goal Achieved',                      trigger: 'Goal status = achieved' },
  { id: 'goal-at-risk',          name: 'Goal At Risk Alert',                 trigger: 'Velocity score < 30' },
  { id: 'clarity-score-update',  name: 'ClarityScore™ Updated',             trigger: 'Score recalculation' },
  { id: 'task-assigned',         name: 'Task Assigned',                      trigger: 'Task created with assignee' },
  { id: 'competitor-pulse',      name: 'IntelliPulse™ Alert',               trigger: 'Competitor pulse scan' },
  { id: 'moment-map-reminder',   name: 'MomentMap™ Event Reminder',         trigger: '7 days before event' },
  { id: 'platform-alert',        name: 'Platform System Alert',              trigger: 'System event' },
  { id: 'onboarding-day1',       name: 'Onboarding — Day 1',                trigger: 'Day 1 after creation' },
  { id: 'onboarding-day3',       name: 'Onboarding — Day 3',                trigger: 'Day 3 after creation' },
  { id: 'audience-iq-ready',     name: 'AudienceIQ™ Profile Ready',         trigger: 'Profile generation complete' },
  { id: 'narrative-ready',       name: 'NarrativeAI™ Report Ready',         trigger: 'Narrative generated' },
  { id: 'monthly-summary',       name: 'Monthly Summary',                   trigger: 'Scheduled monthly' },
];

router.get('/', authenticateSuperAdmin, (req, res) => {
  sendSuccess(res, { templates: EMAIL_TEMPLATES });
});

module.exports = router;
