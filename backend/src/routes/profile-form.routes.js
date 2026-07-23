"use strict";

/**
 * Profile Form Routes — /api/people (merged into the existing people router)
 *
 * Mount in server/index.js BEFORE the people router so /me paths resolve:
 *   const { profileFormRouter } = require('./routes/profile-form.routes');
 *   app.use('/api/people', profileFormRouter);
 *   app.use('/api/people', peopleRouter);  // existing
 *
 * ── Routes ──────────────────────────────────────────────────────────────
 *  GET    /api/people/me/profile                   Staff: own form data
 *  PUT    /api/people/me/profile/save              Staff: draft auto-save
 *  POST   /api/people/me/profile                   Staff: final submit
 *
 *  GET    /api/people/:userId/profile              HR: tiered read + audit
 *  GET    /api/people/:userId/profile/history      HR: change log
 *  PATCH  /api/people/:userId/profile/verify       HR: approve the form
 *  PATCH  /api/people/:userId/profile/reject       HR: reject with reason
 *  PATCH  /api/people/:userId/profile/guarantor-received  HR: physical form received
 *
 *  GET    /api/people/profile-summary              HR: all staff submission states
 */

const express = require("express");
const form = require("../services/profile-form.service");
const { authenticate } = require("../middleware/auth.middleware");

const HR = new Set(["hr", "super_admin"]);
const ALL = new Set([
  "staff",
  "brand_admin",
  "admin",
  "md",
  "hr",
  "super_admin",
]);
const fail = (res, err) =>
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Server error",
    ...(err.errors ? { errors: err.errors } : {}),
  });

const router = express.Router();
router.use(authenticate);

// ── /me routes — ordered before /:userId to avoid param collision ─────────

/**
 * GET /api/people/me/profile
 * Staff reads their own form. No tier restriction (it's your own data).
 */
router.get("/me/profile", async (req, res) => {
  try {
    const data = await form.getOwnForm(req.user.id);
    res.json({ success: true, form: data });
  } catch (e) {
    fail(res, e);
  }
});

/**
 * PUT /api/people/me/profile/save
 * Staff saves a draft. No validation — any partial data is accepted.
 * Returns the saved record so the frontend can hydrate from it.
 */
router.put("/me/profile/save", async (req, res) => {
  try {
    const data = await form.saveDraft(req.user.id, req.body || {});
    res.json({ success: true, form: data });
  } catch (e) {
    fail(res, e);
  }
});

/**
 * POST /api/people/me/profile
 * Staff makes the final submission. All required fields must be present.
 * On success: state → 'submitted', HR gets an email, staff gets an ack.
 */
router.post("/me/profile", async (req, res) => {
  try {
    const data = await form.submitForm(req.user.id, req.body || {});
    res.status(201).json({ success: true, form: data });
  } catch (e) {
    console.error("FULL ERROR:", e.message);
    console.error("STACK:", e.stack); // ← add this — shows exact line
    fail(res, e);
  }
});

// ── HR summary — before /:userId ─────────────────────────────────────────

/**
 * GET /api/people/profile-summary
 * HR gets a list of all staff with their form submission state.
 * No Tier-3 data — uses the v_profile_form_summary view.
 */
router.get("/profile-summary", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const rows = await form.formSummaryForHR(req.user.id);
    res.json({ success: true, summary: rows });
  } catch (e) {
    fail(res, e);
  }
});

// ── Per-user HR routes ────────────────────────────────────────────────────

/**
 * GET /api/people/:userId/profile
 * HR reads someone else's form.
 *   HR / Super Admin   → Tier 2 + 3 (medical audit-logged)
 *   MD                 → Tier 2 + 3 (always audit-logged)
 *   Admin              → Tier 2 only
 *   Staff (self)       → redirected; use /me/profile instead
 */
router.get("/:userId/profile", async (req, res) => {
  try {
    const { userId } = req.params;

    // Self-read → use /me/profile for clarity, but support it here too
    if (userId === req.user.id) {
      const data = await form.getOwnForm(userId);
      return res.json({ success: true, form: data });
    }

    // Others: HR / leadership only
    const allowed = new Set(["hr", "super_admin", "md", "admin"]);
    if (!allowed.has(req.user.role))
      return fail(res, {
        status: 403,
        message: "HR or leadership access only.",
      });

    const data = await form.getFormForHR(req.user.id, userId, req.user.role);
    res.json({ success: true, form: data });
  } catch (e) {
    fail(res, e);
  }
});

/**
 * GET /api/people/:userId/profile/history
 * Returns the immutable change log for a user's form.
 */
router.get("/:userId/profile/history", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const history = await form.formHistory(req.user.id, req.params.userId);
    res.json({ success: true, history });
  } catch (e) {
    fail(res, e);
  }
});

/**
 * PATCH /api/people/:userId/profile/verify
 * HR verifies a submitted form. Staff gets a notification.
 * Body: { hr_notes?: string }
 */
router.patch("/:userId/profile/verify", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const data = await form.verifyForm(
      req.user.id,
      req.params.userId,
      req.body?.hr_notes || null,
    );
    res.json({ success: true, form: data });
  } catch (e) {
    fail(res, e);
  }
});

/**
 * PATCH /api/people/:userId/profile/reject
 * HR rejects a submitted form. A reason is mandatory.
 * Body: { reason: string }
 */
router.patch("/:userId/profile/reject", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const { reason } = req.body || {};
    if (!reason?.trim())
      return fail(res, { status: 400, message: "reason is required." });
    const data = await form.rejectForm(req.user.id, req.params.userId, reason);
    res.json({ success: true, form: data });
  } catch (e) {
    fail(res, e);
  }
});

/**
 * PATCH /api/people/:userId/profile/guarantor-received
 * HR marks the physical Guarantor's Form as received in the office.
 * No body required.
 */
router.patch("/:userId/profile/guarantor-received", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    await form.markGuarantorReceived(req.user.id, req.params.userId);
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = { profileFormRouter: router };
