// ═══════════════════════════════════════════════════════════════════
// people-edit.routes.js
// Sabi Intelligence Suite — Phase C: People OS
//
// Mount in server.js alongside the existing people router:
//   const peopleEditRouter = require('./src/routes/people-edit.routes');
//   app.use('/api/people', requireAuth, peopleEditRouter);
//
// These routes extend /api/people. The existing people.routes.js
// handles GET /registry, GET /:id etc. This file handles all writes.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const express = require('express');
const router  = express.Router();
const svc     = require('../services/people-edit.service');
const sweep   = require('../services/alert-sweep.service');

const HR_ROLES    = ['hr', 'super_admin'];
const LEAD_ROLES  = ['hr', 'super_admin', 'md'];

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ── Field-level inline edit ───────────────────────────────────────

// PATCH /api/people/:id/field
// Updates a single field on a person's record.
// Body: { field_name, new_value, reason? }
router.patch('/:id/field', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { field_name, new_value, reason } = req.body;
    if (!field_name || new_value === undefined) {
      return res.status(400).json({ error: 'field_name and new_value are required' });
    }
    const updated = await svc.updatePeopleRecord(
      req.params.id, field_name, new_value, reason, req.user
    );
    res.json({ record: updated });
  } catch (err) {
    const status = err.status || 500;
    console.error('[people-edit] field update error:', err.message);
    res.status(status).json({ error: err.message });
  }
});

// PATCH /api/people/:id/internship
// Upserts internship-specific fields (category, type, duration, dates).
// Body: { employment_category, internship_type, internship_duration, internship_start_date, internship_end_date }
router.patch('/:id/internship', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const updated = await svc.upsertInternshipFields(req.params.id, req.body, req.user.id);
    res.json({ record: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Change history ────────────────────────────────────────────────

// GET /api/people/:id/history
// Returns the full audit trail of edits for this person's record.
router.get('/:id/history', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const history = await svc.getChangeHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Disciplinary records ──────────────────────────────────────────

// GET /api/people/:userId/disciplinary
router.get('/:userId/disciplinary', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const log = await svc.getDisciplinaryLog(req.params.userId);
    res.json({ disciplinary: log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/people/:userId/disciplinary
// Body: { type, date_issued, description, outcome? }
router.post('/:userId/disciplinary', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { type, date_issued, description, outcome } = req.body;
    if (!type || !date_issued || !description) {
      return res.status(400).json({ error: 'type, date_issued, and description are required' });
    }
    const VALID_TYPES = ['verbal_warning', 'written_warning', 'pip', 'suspension', 'dismissal'];
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }
    const entry = await svc.createDisciplinaryEntry(
      req.params.userId, { type, date_issued, description, outcome }, req.user.id
    );
    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/people/disciplinary/:entryId/resolve
// Body: { outcome }
router.patch('/disciplinary/:entryId/resolve', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const entry = await svc.resolveDisciplinaryEntry(
      req.params.entryId, req.body.outcome, req.user.id
    );
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Support staff directory ───────────────────────────────────────

// GET /api/people/support-staff
router.get('/support-staff', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const staff = await svc.getSupportStaff();
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/people/support-staff
// Body: { full_name, phone_number, role_type, role_description?, department?, date_of_birth?, start_date?, notes? }
router.post('/support-staff', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { full_name, role_type } = req.body;
    if (!full_name?.trim() || !role_type) {
      return res.status(400).json({ error: 'full_name and role_type are required' });
    }
    const created = await svc.createSupportStaff(req.body, req.user.id);
    res.status(201).json({ staff: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/people/support-staff/:id
router.patch('/support-staff/:id', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const updated = await svc.updateSupportStaff(req.params.id, req.body);
    res.json({ staff: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Vacancies ─────────────────────────────────────────────────────

// GET /api/people/vacancies
router.get('/vacancies', requireRoles(...LEAD_ROLES), async (req, res) => {
  try {
    const vacancies = await svc.getVacancies();
    res.json({ vacancies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/people/vacancies
// Body: { role_name, department?, description? }
router.post('/vacancies', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { role_name } = req.body;
    if (!role_name?.trim()) return res.status(400).json({ error: 'role_name is required' });
    const vacancy = await svc.createVacancy(req.body, req.user.id);
    res.status(201).json({ vacancy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/people/vacancies/:id
// Body: { role_name?, department?, status?, description? }
router.patch('/vacancies/:id', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const vacancy = await svc.updateVacancy(req.params.id, req.body, req.user.id);
    res.json({ vacancy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Alerts dashboard ──────────────────────────────────────────────

// GET /api/people/alerts
// Returns all HR alerts: probations, contracts, internships, disciplinary
router.get('/alerts', requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const alerts = await svc.getAlertsData();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/people/run-sweep
// Manually trigger the alert sweep. Super Admin only.
// Should also be called from a daily cron job.
router.post('/run-sweep', requireRoles('super_admin'), async (req, res) => {
  try {
    const result = await sweep.runFullSweep();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
