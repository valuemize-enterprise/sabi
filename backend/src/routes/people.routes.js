/**
 * People OS routes.
 *
 * /api/people            (HR portal — role-guarded per the permissions matrix)
 *   GET    /registry               hr, super_admin, md, admin(T2)
 *   GET    /insights               hr, super_admin, md
 *   GET    /:userId/file           tiered by caller role (T3 reads audit-logged)
 *   POST   /                       hr, super_admin — create record (fires generator + invite)
 *   PATCH  /:userId                hr, super_admin — update (role sync propagates)
 *   POST   /:userId/offboard       hr, super_admin — the kill switch
 *   POST   /:userId/regenerate     hr, super_admin, or self — re-run ARIA draft
 *   POST   /me/publish             self — publish own reviewed draft (D5)
 *   GET/POST /:userId/documents    hr, super_admin — vault metadata
 *
 * /api/leave             (D4 chain)
 *   POST   /request                any staff — own request
 *   GET    /pending                approvers — scoped queue
 *   POST   /:id/decide             BA (own team) | hr | md | super_admin
 */

'use strict';

const express = require('express');
const people = require('../services/people.service');
const { generateProfile, publishProfile } = require('../services/profile-generator.service');
const leave = require('../services/leave.service');
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth.middleware');

const HR = new Set(['hr', 'super_admin']);
const LEADERSHIP = new Set(['hr', 'super_admin', 'md']);
const REGISTRY_ROLES = new Set(['hr', 'super_admin', 'md', 'admin']);
const fail = (res, err) =>
  res.status(err.status || 500).json({ success: false, error: err.message });

// ═══════════════════════ /api/people ══════════════════════════
const peopleRouter = express.Router();
peopleRouter.use(authenticate);

peopleRouter.get('/registry', async (req, res) => {
  try {
    if (!REGISTRY_ROLES.has(req.user.role)) return fail(res, { status: 403, message: 'People OS is HR + leadership only.' });
    res.json({ success: true, ...(await people.registry(req.user)) });
  } catch (e) { fail(res, e); }
});

peopleRouter.get('/insights', async (req, res) => {
  try { res.json({ success: true, insights: await people.insights(req.user) }); }
  catch (e) { fail(res, e); }
});

peopleRouter.get('/:userId/file', async (req, res) => {
  try {
    const file = await people.personFile(req.params.userId, req.user);
    if (!file) return fail(res, { status: 404, message: 'No people record.' });
    res.json({ success: true, ...file });
  } catch (e) { fail(res, e); }
});

peopleRouter.post('/', async (req, res) => {
  try {
    if (!HR.has(req.user.role)) return fail(res, { status: 403, message: 'HR only.' });
    const out = await people.createRecord(req.body, req.user);
    res.status(201).json({ success: true, user_id: out.user.id });
  } catch (e) { fail(res, e); }
});

peopleRouter.patch('/:userId', async (req, res) => {
  try {
    const record = await people.updateRecord(req.params.userId, req.body, req.user);
    res.json({ success: true, record });
  } catch (e) { fail(res, e); }
});

peopleRouter.post('/:userId/offboard', async (req, res) => {
  try {
    const out = await people.beginOffboarding(req.params.userId, req.user, req.body?.exit_date);
    res.json({ success: true, ...out });
  } catch (e) { fail(res, e); }
});

peopleRouter.post('/:userId/regenerate', async (req, res) => {
  try {
    const self = req.user.id === req.params.userId;
    if (!self && !HR.has(req.user.role)) return fail(res, { status: 403, message: 'HR or the profile owner only.' });
    const out = await generateProfile(req.params.userId, { regenerate: true });
    res.json({ success: true, ...out });
  } catch (e) { fail(res, e); }
});

peopleRouter.post('/me/publish', async (req, res) => {
  try { res.json({ success: true, ...(await publishProfile(req.user.id)) }); }
  catch (e) { fail(res, e); }
});

// ── documents vault (metadata; files live in the private bucket) ─
peopleRouter.get('/:userId/documents', async (req, res) => {
  try {
    if (!HR.has(req.user.role)) return fail(res, { status: 403, message: 'HR only.' });
    const { data, error } = await supabase.from('people_documents')
      .select('*').eq('user_id', req.params.userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    await people.logTier3Read(req.user.id, req.params.userId, 'documents');
    res.json({ success: true, documents: data });
  } catch (e) { fail(res, e); }
});

peopleRouter.post('/:userId/documents', async (req, res) => {
  try {
    if (!HR.has(req.user.role)) return fail(res, { status: 403, message: 'HR only.' });
    const { doc_type, label, file_path, expiry_date = null } = req.body || {};
    if (!doc_type || !label || !file_path) return fail(res, { status: 400, message: 'doc_type, label, file_path required.' });
    const { data, error } = await supabase.from('people_documents')
      .insert({ user_id: req.params.userId, doc_type, label, file_path,
                expiry_date, uploaded_by: req.user.id })
      .select('*').single();
    if (error) throw new Error(error.message);
    res.status(201).json({ success: true, document: data });
  } catch (e) { fail(res, e); }
});

// ═══════════════════════ /api/leave ═══════════════════════════
const leaveRouter = express.Router();
leaveRouter.use(authenticate);

leaveRouter.post('/request', async (req, res) => {
  try { res.status(201).json({ success: true, request: await leave.requestLeave(req.user, req.body || {}) }); }
  catch (e) { fail(res, e); }
});

leaveRouter.get('/pending', async (req, res) => {
  try { res.json({ success: true, requests: await leave.pendingForApprover(req.user) }); }
  catch (e) { fail(res, e); }
});

leaveRouter.post('/:id/decide', async (req, res) => {
  try {
    const { approve, note = null } = req.body || {};
    if (typeof approve !== 'boolean') return fail(res, { status: 400, message: 'approve: true|false required.' });
    res.json({ success: true, ...(await leave.decideLeave(req.params.id, req.user, approve, note)) });
  } catch (e) { fail(res, e); }
});

module.exports = { peopleRouter, leaveRouter };
