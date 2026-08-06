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

"use strict";

const express = require("express");
const router = express.Router();
const svc = require("../services/people-edit.service");
const sweep = require("../services/alert-sweep.service");
const supabase = require("../config/supabase");

const HR_ROLES = ["hr", "super_admin"];
const LEAD_ROLES = ["hr", "super_admin", "md"];

const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };

// ── Field-level inline edit ───────────────────────────────────────

// PATCH /api/people/:id/field
// Updates a single field on a person's record.
// Body: { field_name, new_value, reason? }
router.patch("/:id/field", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { field_name, new_value, reason } = req.body;
    if (!field_name || new_value === undefined) {
      return res
        .status(400)
        .json({ error: "field_name and new_value are required" });
    }
    const updated = await svc.updatePeopleRecord(
      req.params.id,
      field_name,
      new_value,
      reason,
      req.user,
    );
    res.json({ record: updated });
  } catch (err) {
    const status = err.status || 500;
    console.error("[people-edit] field update error:", err.message);
    res.status(status).json({ error: err.message });
  }
});

// PATCH /api/people/:id/internship
// Upserts internship-specific fields (category, type, duration, dates).
// Body: { employment_category, internship_type, internship_duration, internship_start_date, internship_end_date }
router.patch("/:id/internship", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const updated = await svc.upsertInternshipFields(
      req.params.id,
      req.body,
      req.user.id,
    );
    res.json({ record: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Change history ────────────────────────────────────────────────

// GET /api/people/:id/history
// Returns the full audit trail of edits for this person's record.
router.get("/:id/history", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const history = await svc.getChangeHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Disciplinary records ──────────────────────────────────────────

// GET /api/people/:userId/disciplinary
router.get(
  "/:userId/disciplinary",
  requireRoles(...HR_ROLES),
  async (req, res) => {
    try {
      const log = await svc.getDisciplinaryLog(req.params.userId);
      res.json({ disciplinary: log });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/people/:userId/disciplinary
// Body: { type, date_issued, description, outcome? }
router.post(
  "/:userId/disciplinary",
  requireRoles(...HR_ROLES),
  async (req, res) => {
    try {
      const { type, date_issued, description, outcome } = req.body;
      if (!type || !date_issued || !description) {
        return res
          .status(400)
          .json({ error: "type, date_issued, and description are required" });
      }
      const VALID_TYPES = [
        "verbal_warning",
        "written_warning",
        "pip",
        "suspension",
        "dismissal",
      ];
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(", ")}`,
        });
      }
      const entry = await svc.createDisciplinaryEntry(
        req.params.userId,
        { type, date_issued, description, outcome },
        req.user.id,
      );
      res.status(201).json({ entry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// PATCH /api/people/disciplinary/:entryId/resolve
// Body: { outcome }
router.patch(
  "/disciplinary/:entryId/resolve",
  requireRoles(...HR_ROLES),
  async (req, res) => {
    try {
      const entry = await svc.resolveDisciplinaryEntry(
        req.params.entryId,
        req.body.outcome,
        req.user.id,
      );
      res.json({ entry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// ── Support staff directory ───────────────────────────────────────


// POST /api/people/support-staff
// Body: { full_name, phone_number, role_type, role_description?, department?, date_of_birth?, start_date?, notes? }
router.post("/support-staff", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { full_name, role_type } = req.body;
    if (!full_name?.trim() || !role_type) {
      return res
        .status(400)
        .json({ error: "full_name and role_type are required" });
    }
    const created = await svc.createSupportStaff(req.body, req.user.id);
    res.status(201).json({ staff: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/people/support-staff/:id
router.patch(
  "/support-staff/:id",
  requireRoles(...HR_ROLES),
  async (req, res) => {
    try {
      const updated = await svc.updateSupportStaff(req.params.id, req.body);
      res.json({ staff: updated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);
// POST /api/people/vacancies
// Body: { role_name, department?, description? }
router.post("/vacancies", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const { role_name } = req.body;
    if (!role_name?.trim())
      return res.status(400).json({ error: "role_name is required" });
    const vacancy = await svc.createVacancy(req.body, req.user.id);
    res.status(201).json({ vacancy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// PATCH /api/people/vacancies/:id
// Body: { role_name?, department?, status?, description? }
router.patch("/vacancies/:id", requireRoles(...HR_ROLES), async (req, res) => {
  try {
    const vacancy = await svc.updateVacancy(
      req.params.id,
      req.body,
      req.user.id,
    );
    res.json({ vacancy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Alerts dashboard ──────────────────────────────────────────────



// POST /api/people/run-sweep
// Manually trigger the alert sweep. Super Admin only.
// Should also be called from a daily cron job.
router.post("/run-sweep", requireRoles("super_admin"), async (req, res) => {
  try {
    const result = await sweep.runFullSweep();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/people/onboarding-pipeline ─────────────────────────
// Returns staff with incomplete onboarding.
//
// "Incomplete onboarding" = any of:
//   • start_date within the last 90 days (still in onboarding window)
//   • probation_completed_at IS NULL (probation not yet signed off)
//   • employment_category = intern_nysc | intern_siwes AND
//     contract_end_date IS NULL (intern end date not set)
//
// For each person, returns onboarding_steps[] where each step is
// flagged completed or not. HR can click through to PersonFile
// and complete them manually; InternshipFields renders automatically
// inside PersonFile for any intern.
//
// Access: HR_ROLES only
router.get(
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

// ── GET /api/people/documents ────────────────────────────────────
// All staff documents from the people_documents table (Migration 009).
// HR sees every document; regular staff see only their own.
// Query params:
//   user_id      — filter to one person (HR only)
//   expiring     — 'true' returns only docs expiring within 60 days
//   type         — filter by document_type
router.get("/documents", requireRoles(...HR_ROLES), async (req, res) => {
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

module.exports = router;
