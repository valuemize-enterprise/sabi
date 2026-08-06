// ═══════════════════════════════════════════════════════════════════
// pipeline.routes.js
// Sabi Intelligence Suite — New Business Pipeline
//
// Mount in server.js:
//   const pipelineRouter = require('./routes/pipeline.routes');
//   app.use('/api/pipeline', requireAuth, pipelineRouter);
//
// Role access:
//   All endpoints: requireAuth (any logged-in user)
//   Kanban/List view: brand_admin, admin, md, super_admin
//   Create/Edit: brand_admin (their own), admin, md, super_admin
//   Delete: admin, md, super_admin only
//   Analytics: admin, md, super_admin
// ═══════════════════════════════════════════════════════════════════

"use strict";

const express = require("express");
const router = express.Router();
const pipelineService = require("../services/pipeline.service");
const ariaService = require("../services/pipeline-aria.service");

// ── Middleware helpers ────────────────────────────────────────────

/**
 * Checks if the current user has at least one of the specified roles.
 * Assumes requireAuth middleware has already populated req.user.
 */
const requireRoles =
  (...roles) =>
  (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        error: "Access denied",
        message: `This action requires one of: ${roles.join(", ")}`,
      });
    }
    next();
  };

// Roles that can see the pipeline at all
const PIPELINE_READERS = ["brand_admin", "admin", "md", "super_admin"];

// Roles that can delete opportunities
const PIPELINE_ADMINS = ["admin", "md", "super_admin"];

// ── Opportunities ─────────────────────────────────────────────────

// GET /api/pipeline/opportunities
// List with optional filters: ?stage=in_progress&lead_ba_id=uuid&service_type=digital&sort_by=updated_at&sort_dir=desc
router.get(
  "/opportunities",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const { stage, lead_ba_id, service_type, sort_by, sort_dir } = req.query;

      // Brand Admins only see their own opportunities unless override provided by admin
      let effectiveLeadBaId = lead_ba_id;
      if (req.user.role === "brand_admin" && !lead_ba_id) {
        effectiveLeadBaId = req.user.id;
      }

      const opportunities = await pipelineService.listOpportunities({
        stage,
        lead_ba_id: effectiveLeadBaId,
        service_type,
        sort_by,
        sort_dir,
      });

      res.json({ opportunities, count: opportunities.length });
    } catch (err) {
      console.error("[Pipeline] listOpportunities error:", err);
      res
        .status(500)
        .json({ error: "Failed to load pipeline", message: err.message });
    }
  },
);

// POST /api/pipeline/opportunities
// Create a new opportunity
router.post(
  "/opportunities",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const {
        company_name,
        deal_title,
        description,
        service_types,
        source,
        stage,
        estimated_value,
        date_briefed,
        client_deadline,
        agency_deadline,
        lead_ba_id,
        accountable_team_text,
        notes,
      } = req.body;

      console.log("request body", req.body);

      if (!company_name?.trim()) {
        return res.status(400).json({ error: "company_name is required" });
      }
      if (!deal_title?.trim()) {
        return res.status(400).json({ error: "deal_title is required" });
      }

      const opp = await pipelineService.createOpportunity(
        {
          company_name: company_name.trim(),
          deal_title: deal_title.trim(),
          description,
          service_types,
          source,
          stage,
          estimated_value,
          date_briefed,
          client_deadline,
          agency_deadline,
          lead_ba_id: lead_ba_id || req.user.id, // default to self for Brand Admins
          accountable_team_text,
          notes,
        },
        req.user.id,
      );

      res.status(201).json({ opportunity: opp });
    } catch (err) {
      console.error("[Pipeline] createOpportunity error:", err);
      res
        .status(500)
        .json({ error: "Failed to create opportunity", message: err.message });
    }
  },
);

// GET /api/pipeline/opportunities/:id
// Get one opportunity with full detail (stage history + weekly notes)
router.get(
  "/opportunities/:id",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const opp = await pipelineService.getOpportunityById(req.params.id);
      if (!opp) return res.status(404).json({ error: "Opportunity not found" });

      // Brand Admins can only see their own
      if (req.user.role === "brand_admin" && opp.lead_ba_id !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({ opportunity: opp });
    } catch (err) {
      console.error("[Pipeline] getOpportunityById error:", err);
      res
        .status(500)
        .json({ error: "Failed to load opportunity", message: err.message });
    }
  },
);

// PATCH /api/pipeline/opportunities/:id
// Update fields (not stage — use /stage endpoint for that)
router.patch(
  "/opportunities/:id",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const existing = await pipelineService.getOpportunityById(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Opportunity not found" });

      if (
        req.user.role === "brand_admin" &&
        existing.lead_ba_id !== req.user.id
      ) {
        return res
          .status(403)
          .json({ error: "You can only edit your own opportunities" });
      }

      const updated = await pipelineService.updateOpportunity(
        req.params.id,
        req.body,
      );
      res.json({ opportunity: updated });
    } catch (err) {
      console.error("[Pipeline] updateOpportunity error:", err);
      res
        .status(500)
        .json({ error: "Failed to update opportunity", message: err.message });
    }
  },
);

// PATCH /api/pipeline/opportunities/:id/stage
// Change stage — logs to history, resets staleness timer
router.patch(
  "/opportunities/:id/stage",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const {
        stage,
        change_notes,
        lost_reason,
        lost_notes,
        converted_brand_id,
      } = req.body;

      const validStages = [
        "introduction",
        "proposal",
        "pitch",
        "second_pitch",
        "decision",
        "agreement",
        "onboarded",
        "lost_paused",
      ];
      if (!validStages.includes(stage)) {
        return res
          .status(400)
          .json({
            error: `Invalid stage. Must be one of: ${validStages.join(", ")}`,
          });
      }
      if (stage === "lost_paused" && !lost_reason) {
        return res
          .status(400)
          .json({
            error: "lost_reason is required when marking a deal as Lost/Paused",
          });
      }

      const existing = await pipelineService.getOpportunityById(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Opportunity not found" });

      if (
        req.user.role === "brand_admin" &&
        existing.lead_ba_id !== req.user.id
      ) {
        return res
          .status(403)
          .json({
            error: "You can only change stage on your own opportunities",
          });
      }

      const updated = await pipelineService.changeStage(
        req.params.id,
        stage,
        req.user.id,
        { change_notes, lost_reason, lost_notes, converted_brand_id },
      );

      res.json({
        opportunity: updated,
        message: `Stage updated to "${stage}"`,
      });
    } catch (err) {
      console.error("[Pipeline] changeStage error:", err);
      res
        .status(500)
        .json({ error: "Failed to change stage", message: err.message });
    }
  },
);

// DELETE /api/pipeline/opportunities/:id
// Admin/MD/Super Admin only
router.delete(
  "/opportunities/:id",
  requireRoles(...PIPELINE_ADMINS),
  async (req, res) => {
    try {
      const existing = await pipelineService.getOpportunityById(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Opportunity not found" });

      await pipelineService.deleteOpportunity(req.params.id);
      res.json({ message: "Opportunity deleted" });
    } catch (err) {
      console.error("[Pipeline] deleteOpportunity error:", err);
      res
        .status(500)
        .json({ error: "Failed to delete opportunity", message: err.message });
    }
  },
);

// ── Weekly Notes ──────────────────────────────────────────────────

// GET /api/pipeline/opportunities/:id/notes
router.get(
  "/opportunities/:id/notes",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const notes = await pipelineService.getWeeklyNotes(req.params.id);
      res.json({ notes });
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to load notes", message: err.message });
    }
  },
);

// POST /api/pipeline/opportunities/:id/notes
// Upsert this week's note (creates or updates for current week)
router.post(
  "/opportunities/:id/notes",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const { notes, week_start } = req.body;

      const existing = await pipelineService.getOpportunityById(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Opportunity not found" });

      if (
        req.user.role === "brand_admin" &&
        existing.lead_ba_id !== req.user.id
      ) {
        return res
          .status(403)
          .json({ error: "You can only add notes to your own opportunities" });
      }

      const note = await pipelineService.upsertWeeklyNote(
        req.params.id,
        { notes, week_start },
        req.user.id,
      );

      res.json({ note });
    } catch (err) {
      console.error("[Pipeline] upsertWeeklyNote error:", err);
      res
        .status(500)
        .json({ error: "Failed to save note", message: err.message });
    }
  },
);

// POST /api/pipeline/opportunities/:id/notes/aria-draft
// Generate ARIA draft for this week's note — saves it as aria_draft field
router.post(
  "/opportunities/:id/notes/aria-draft",
  requireRoles(...PIPELINE_READERS),
  async (req, res) => {
    try {
      const { week_start } = req.body;
      const week = week_start || pipelineService.getCurrentWeekStart();

      const ariaDraft = await ariaService.draftWeeklyNote(req.params.id, week);

      // Save the aria_draft without overwriting any user-written notes
      const note = await pipelineService.upsertWeeklyNote(
        req.params.id,
        { aria_draft: ariaDraft, week_start: week },
        req.user.id,
      );

      res.json({ note, aria_draft: ariaDraft });
    } catch (err) {
      console.error("[Pipeline] ariaDraft error:", err);
      res
        .status(500)
        .json({ error: "Failed to generate ARIA draft", message: err.message });
    }
  },
);

// ── Analytics ─────────────────────────────────────────────────────

// GET /api/pipeline/analytics
// Pipeline analytics overview — admin/MD/super_admin only
router.get("/analytics", requireRoles(...PIPELINE_ADMINS), async (req, res) => {
  try {
    const analytics = await pipelineService.getAnalytics();
    res.json({ analytics });
  } catch (err) {
    console.error("[Pipeline] getAnalytics error:", err);
    res
      .status(500)
      .json({ error: "Failed to load analytics", message: err.message });
  }
});

// GET /api/pipeline/alerts
// Staleness alerts — for weekly report injection and MD pulse
router.get("/alerts", requireRoles(...PIPELINE_ADMINS), async (req, res) => {
  try {
    const alerts = await pipelineService.getStalenessAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (err) {
    console.error("[Pipeline] getStalenessAlerts error:", err);
    res
      .status(500)
      .json({ error: "Failed to load alerts", message: err.message });
  }
});

// GET /api/pipeline/momentum
// ARIA-generated momentum commentary for MD view
router.get("/momentum", requireRoles(...PIPELINE_ADMINS), async (req, res) => {
  try {
    const [analytics, alerts] = await Promise.all([
      pipelineService.getAnalytics(),
      pipelineService.getStalenessAlerts(),
    ]);

    const commentary = await ariaService.draftMomentumPara(analytics, alerts);
    const forecast_note = await ariaService.buildForecastNote(
      analytics.weighted_forecast,
    );

    res.json({ commentary, forecast_note, analytics });
  } catch (err) {
    console.error("[Pipeline] momentum error:", err);
    res
      .status(500)
      .json({
        error: "Failed to generate momentum commentary",
        message: err.message,
      });
  }
});

module.exports = router;
