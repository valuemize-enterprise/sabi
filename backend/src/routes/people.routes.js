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

"use strict";

const express = require("express");
const people = require("../services/people.service");
const {
  generateProfile,
  publishProfile,
} = require("../services/profile-generator.service");
const leave = require("../services/leave.service");
const supabase = require("../config/supabase");
const svc = require("../services/people-edit.service");
const { authenticate } = require("../middleware/auth.middleware");

const HR = new Set(["hr", "super_admin"]);
const LEADERSHIP = new Set(["hr", "super_admin", "md"]);
const REGISTRY_ROLES = new Set(["hr", "super_admin", "md", "admin"]);
const HR_ROLES = ["hr", "super_admin", "admin"];
const LEAD_ROLES = ["hr", "super_admin", "md"];

const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Leadership access only" });
    }
    next();
  };

const fail = (res, err) =>
  res.status(err.status || 500).json({ success: false, error: err.message });

// ═══════════════════════ /api/people ══════════════════════════
const peopleRouter = express.Router();
peopleRouter.use(authenticate);

peopleRouter.get("/registry", async (req, res) => {
  try {
    if (!REGISTRY_ROLES.has(req.user.role))
      return fail(res, {
        status: 403,
        message: "People OS is HR + leadership only.",
      });
    res.json({ success: true, ...(await people.registry(req.user)) });
  } catch (e) {
    fail(res, e);
  }
});

// GET /api/people/alerts
// Returns all HR alerts: probations, contracts, internships, disciplinary
peopleRouter.get("/alerts", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const alerts = await svc.getAlertsData();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

peopleRouter.put("/update", async (req, res) => {
  try {
    if (!REGISTRY_ROLES.has(req.user.role)) {
      return fail(res, {
        status: 403,
        message: "People OS is HR + leadership only.",
      });
    }
    res.json({
      success: true,
      ...(await people.updateRoleByHr(req.body, req.user)),
    });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.get("/insights", async (req, res) => {
  try {
    res.json({ success: true, insights: await people.insights(req.user) });
  } catch (e) {
    fail(res, e);
  }
});

// GET /api/people/vacancies
peopleRouter.get("/vacancies", requireRoles(...LEAD_ROLES), async (req, res) => {
  try {
    const vacancies = await svc.getVacancies();
    res.json({ vacancies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

peopleRouter.get(
  "/onboarding-pipeline",
  requireRoles(...HR_ROLES),
  async (req, res) => {
    try {
      // Fetch staff who are within their onboarding window or still on probation.
      // 90-day window: start_date >= NOW() - INTERVAL '90 days'
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: people, error } = await supabase
        .from("people_records")
        .select(
          `
        user_id, department,
        employment_category, employment_status,
        start_date, contract_end_date, probation_completed_at,
        line_manager_id
      `,
        )
        .in("employment_status", ["active", "probation", "on_leave"])
        .gte("start_date", ninetyDaysAgo.toISOString().split("T")[0])
        .order("start_date", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);

      // Fetch display names from users (people_records has no name columns)
      const userIds = (people || []).map((p) => p.user_id).filter(Boolean);
      const { data: usersData } = userIds.length
        ? await supabase
            .from("users")
            .select("id, full_name, email")
            .in("id", userIds)
        : { data: [] };
      const userMap = Object.fromEntries(
        (usersData || []).map((u) => [u.id, u]),
      );

      const now = Date.now();

      const pipeline = (people || []).map((person) => {
        const isIntern = ["intern_nysc", "intern_siwes"].includes(
          person.employment_category,
        );
        const startMs = person.start_date
          ? new Date(person.start_date).getTime()
          : null;
        const daysSinceStart = startMs
          ? Math.floor((now - startMs) / 86400000)
          : null;

        // ── Define onboarding steps ──────────────────────────────
        // Each step has a key, label, and a completed boolean
        // derived from what's in the record.
        const steps = [
          {
            key: "added_to_system",
            label: "Added to Sabi",
            completed: true, // If they appear here, this is done
          },
          {
            key: "start_date_set",
            label: "Start date confirmed",
            completed: !!person.start_date,
          },
          {
            key: "line_manager_assigned",
            label: "Line manager assigned",
            completed: !!person.line_manager_id,
          },
          ...(isIntern
            ? [
                {
                  key: "contract_end_date",
                  label: "Contract end date set",
                  completed: !!person.contract_end_date,
                },
              ]
            : []),
          {
            key: "probation_completed",
            label: "Probation signed off",
            completed: !!person.probation_completed_at,
            // Not required for interns on short placements
            optional: isIntern && person.employment_category === "intern_siwes",
          },
        ];

        const requiredSteps = steps.filter((s) => !s.optional);
        const completedCount = requiredSteps.filter((s) => s.completed).length;
        const totalSteps = requiredSteps.length;

        const u = userMap[person.user_id] || {};
        return {
          user_id: person.user_id,
          full_name: u.full_name || u.email || person.user_id,
          role_title: null,
          employment_category: person.employment_category || "core",
          employment_status: person.employment_status,
          start_date: person.start_date || null,
          days_since_start: daysSinceStart,
          completed_count: completedCount,
          total_steps: totalSteps,
          onboarding_steps: steps,
        };
      });

      // Filter: only return staff who have at least one incomplete required step
      const incomplete = pipeline.filter(
        (p) => p.completed_count < p.total_steps,
      );

      res.json({ people: incomplete, count: incomplete.length });
    } catch (err) {
      console.error("[onboarding-pipeline]", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);


// GET /api/people/support-staff
peopleRouter.get("/support-staff", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const staff = await svc.getSupportStaff();
    res.json({ staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/people/documents ────────────────────────────────────
// All staff documents from the people_documents table (Migration 009).
// HR sees every document; regular staff see only their own.
// Query params:
//   user_id      — filter to one person (HR only)
//   expiring     — 'true' returns only docs expiring within 60 days
//   type         — filter by document_type
peopleRouter.get("/documents", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { user_id, expiring, type } = req.query;

    let q = supabase
      .from("people_documents")
      .select("id, user_id, doc_type, label, file_path, expiry_date")
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (user_id) q = q.eq("user_id", user_id);
    // if (type)    q = q.eq('document_type', type);

    if (expiring === "true") {
      const now = new Date().toISOString().split("T")[0];
      const in60days = new Date(Date.now() + 60 * 86400000)
        .toISOString()
        .split("T")[0];
      q = q.gte("expiry_date", now).lte("expiry_date", in60days);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // Second query — fetch user names (no FK join needed)
    const docUserIds = [
      ...new Set((data || []).map((d) => d.user_id).filter(Boolean)),
    ];
    const { data: docUsers } = docUserIds.length
      ? await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", docUserIds)
      : { data: [] };
    const docUserMap = Object.fromEntries(
      (docUsers || []).map((u) => [u.id, u]),
    );

    const documents = (data || []).map((doc) => {
      const owner = docUserMap[doc.user_id] || {};
      return {
        ...doc,
        person_name: owner.full_name || owner.email || null,
        document_name: doc.label || null,
        file_url: doc.file_path || null,
        doc_type: doc.doc_type || null,
        role_title: null,
      };
    });

    res.json({ documents, count: documents.length });
  } catch (err) {
    console.error("[people/documents]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/people/:id
// Fetch a single person's full record by user_id.
peopleRouter.get("/:id", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("people_records")
      .select("*")
      .eq("user_id", req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Person not found" });
    }

    // Fetch user account info separately
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("id", req.params.id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "Person not found" });
    }

    const {
  data: staffProfileSubmissions,
  error: staffProfileSubmissionsError,
} = await supabase
  .from("staff_profile_submissions")
  .select("personal_email, phone, date_of_birth, emergency_contact_name, emergency_contact_phone")
  .eq("user_id", req.params.id)
  .maybeSingle();


    res.json({
      record: {
        ...data,
        full_name: user?.full_name || null,
        email: user?.email || null,
        personal_email: staffProfileSubmissions?.personal_email || null, 
        personal_phone: staffProfileSubmissions?.phone || null, 
        date_of_birth: staffProfileSubmissions?.date_of_birth || null, 
        emergency_contact: staffProfileSubmissions?.emergency_contact_name || null, 
        emergency_contact_phone: staffProfileSubmissions?.emergency_contact_phone || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

peopleRouter.get("/:userId/file", async (req, res) => {
  try {
    const file = await people.personFile(req.params.userId, req.user);
    if (!file) return fail(res, { status: 404, message: "No people record." });
    res.json({ success: true, ...file });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.post("/", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const out = await people.createRecord(req.body, req.user);
    res.status(201).json({ success: true, user_id: out.user.id });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.patch("/:userId", async (req, res) => {
  try {
    const record = await people.updateRecord(
      req.params.userId,
      req.body,
      req.user,
    );
    res.json({ success: true, record });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.post("/:userId/offboard", async (req, res) => {
  try {
    const out = await people.beginOffboarding(
      req.params.userId,
      req.user,
      req.body?.exit_date,
    );
    res.json({ success: true, ...out });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.post("/:userId/regenerate", async (req, res) => {
  try {
    const self = req.user.id === req.params.userId;
    if (!self && !HR.has(req.user.role))
      return fail(res, {
        status: 403,
        message: "HR or the profile owner only.",
      });
    const out = await generateProfile(req.params.userId, { regenerate: true });
    res.json({ success: true, ...out });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.post("/me/publish", async (req, res) => {
  try {
    res.json({ success: true, ...(await publishProfile(req.user.id)) });
  } catch (e) {
    fail(res, e);
  }
});

// ── documents vault (metadata; files live in the private bucket) ─
peopleRouter.get("/:userId/documents", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const { data, error } = await supabase
      .from("people_documents")
      .select("*")
      .eq("user_id", req.params.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    await people.logTier3Read(req.user.id, req.params.userId, "documents");
    res.json({ success: true, documents: data });
  } catch (e) {
    fail(res, e);
  }
});

peopleRouter.post("/:userId/documents", async (req, res) => {
  try {
    if (!HR.has(req.user.role))
      return fail(res, { status: 403, message: "HR only." });
    const { doc_type, label, file_path, expiry_date = null } = req.body || {};
    if (!doc_type || !label || !file_path)
      return fail(res, {
        status: 400,
        message: "doc_type, label, file_path required.",
      });
    const { data, error } = await supabase
      .from("people_documents")
      .insert({
        user_id: req.params.userId,
        doc_type,
        label,
        file_path,
        expiry_date,
        uploaded_by: req.user.id,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    res.status(201).json({ success: true, document: data });
  } catch (e) {
    fail(res, e);
  }
});

// ═══════════════════════ /api/leave ═══════════════════════════
const leaveRouter = express.Router();
leaveRouter.use(authenticate);

leaveRouter.get("/", async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const { status } = req.query;
    const isHR = ["hr", "super_admin", "admin", "md"].includes(role);

    let q = supabase
      .from("leave_requests")
      .select(
        "id, user_id, leave_type, start_date, end_date, note, status, created_at, decided_at, decision_note, approver_id",
      )
      .order("created_at", { ascending: false });

    if (!isHR) q = q.eq("user_id", userId);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    // Fetch user names separately
    const userIds = [
      ...new Set((data || []).map((r) => r.user_id).filter(Boolean)),
    ];
    const { data: users } = userIds.length
      ? await supabase.from("users").select("id, full_name").in("id", userIds)
      : { data: [] };
    const userMap = Object.fromEntries((users || []).map((u) => [u.id, u]));

    const requests = (data || []).map((r) => ({
      ...r,
      requester_name: userMap[r.user_id]?.full_name || null,
      days_count:
        Math.ceil((new Date(r.end_date) - new Date(r.start_date)) / 86400000) +
        1,
    }));

    res.json({ requests, count: requests.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

leaveRouter.post("/request", async (req, res) => {
  try {
    res.status(201).json({
      success: true,
      request: await leave.requestLeave(req.user, req.body || {}),
    });
  } catch (e) {
    fail(res, e);
  }
});

leaveRouter.get("/my-requests", async (req, res) => {
  try {
    const { id: userId } = req.user;

    const { data, error } = await supabase
      .from("leave_requests")
      .select(
        "id, leave_type, start_date, end_date, note, status, created_at, decided_at, decision_note, approver_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    res.json({ requests: data || [], count: (data || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

leaveRouter.get("/pending", async (req, res) => {
  try {
    res.json({
      success: true,
      requests: await leave.pendingForApprover(req.user),
    });
  } catch (e) {
    fail(res, e);
  }
});

leaveRouter.get('/by-user/:userId', async (req, res) => {
  try {
    const { id: callerId, role } = req.user;
    const { userId } = req.params;
    const isHR = ['hr', 'super_admin', 'admin', 'md'].includes(role);

    if (!isHR && callerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, user_id, leave_type, start_date, end_date, note, status, created_at, decided_at, decision_note, approver_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const requests = (data || []).map(r => ({
      ...r,
      days_count: Math.ceil(
        (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000
      ) + 1,
    }));

    res.json({ requests, count: requests.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

leaveRouter.post("/:id/decide", async (req, res) => {
  try {
    const { approve, note = null } = req.body || {};
    if (typeof approve !== "boolean")
      return fail(res, {
        status: 400,
        message: "approve: true|false required.",
      });

      
    res.json({
      success: true,
      ...(await leave.decideLeave(req.params.id, req.user, approve, note)),
    });
  } catch (e) {
    fail(res, e);
  }
});

leaveRouter.patch("/:id", async (req, res) => {
  try {
    const { status, rejected_reason } = req.body;
    const approve = status === "approved";
    const note = rejected_reason || null;
    res.json({
      success: true,
      ...(await leave.decideLeave(req.params.id, req.user, approve, note)),
    });
  } catch (e) {
    fail(res, e);
  }
});

module.exports = { peopleRouter, leaveRouter };
