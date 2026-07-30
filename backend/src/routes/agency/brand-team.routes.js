/**
 * Agency Brand Team Routes
 * Manages which staff members are assigned to a brand and their role on it.
 *
 * MOUNT IN server.js as:
 *   app.use('/api/agency/brands/:brandId/team', agencyBrandTeam);
 *
 * GET    /api/agency/brands/:brandId/team              — list team
 * POST   /api/agency/brands/:brandId/team              — assign staff member
 * PATCH  /api/agency/brands/:brandId/team/:staffId     — update role
 * DELETE /api/agency/brands/:brandId/team/:staffId     — remove from brand
 * GET    /api/agency/brands/:brandId/team/available    — staff not yet assigned
 */

"use strict";

const router = require("express").Router({ mergeParams: true });
const supabase = require("../../config/supabase");
const { authenticate } = require("../../middleware/auth.middleware");
const { sendSuccess, sendError } = require("../../utils/response.utils");
const { auditLog } = require("../../middleware/logger.middleware");

const BRAND_ROLES = [
  "account_manager",
  "brand_manager",
  "creative_director",
  "senior_strategist",
  "strategist",
  "copywriter",
  "social_media_manager",
  "analytics_specialist",
  "content_creator",
  "graphic_designer",
  "community_manager",
  "contributor",
  "brand_admin",
  "art_director",
];

const ADMIN_ROLES = [
  "super_admin",
  "ceo",
  "managing_director",
  "creative_director",
  "strategy_director",
  "account_director",
];

// ── GET /api/agency/brands/:brandId/team ─────────────────────
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("staff_brand_assignments")
      .select(
        `
        id, role_on_brand, created_at,
        users!staff_id (
          id, full_name, email, role, department,
          avatar_url, is_active, last_login
        )
      `,
      )
      .eq("brand_id", req.params.brandId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    sendSuccess(res, { team: data || [] });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/agency/brands/:brandId/team/available ───────────
// Must come BEFORE /:staffId to avoid route conflict
router.get("/available", authenticate, async (req, res, next) => {
  try {
    const { data: assigned } = await supabase
      .from("staff_brand_assignments")
      .select("staff_id")
      .eq("brand_id", req.params.brandId);

    const assignedIds = (assigned || []).map((a) => a.staff_id);

    let query = supabase
      .from("users")
      .select("id, full_name, email, role, department, avatar_url, is_active")
      .eq("is_active", true)
      .neq("role", "super_admin");

    if (assignedIds.length > 0) {
      query = query.not("id", "in", `(${assignedIds.join(",")})`);
    }

    const { data, error } = await query.order("full_name");
    if (error) throw error;
    sendSuccess(res, { staff: data || [] });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/agency/brands/:brandId/team ────────────────────
router.post("/", authenticate, async (req, res, next) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, "Only admins can assign staff to brands");
    }

    const { staff_id, role_on_brand } = req.body;

    console.log('role_on_brand', role_on_brand);
    console.log('staff_id', staff_id);
    if (!staff_id) return sendError(res, 400, "staff_id is required");
    if (!BRAND_ROLES.includes(role_on_brand)) {
      return sendError(
        res,
        400,
        `role_on_brand must be one of: ${BRAND_ROLES.join(", ")}`,
      );
    }

    // Upsert — if already assigned, update the role
    const { data, error } = await supabase
      .from("staff_brand_assignments")
      .upsert(
        {
          staff_id,
          brand_id: req.params.brandId,
          role_on_brand,
          roles_on_brand: [role_on_brand],
        },
        { onConflict: "staff_id, brand_id" },
      )
      .select()
      .single();

    if (error) throw error;

    if (role_on_brand === "brand_admin") {
      const { error: brandError } = await supabase
        .from("brands")
        .update({ account_manager_id: staff_id })
        .eq("id", req.params.brandId);

      if (brandError) throw brandError;
    }

    await auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "ASSIGN_STAFF_TO_BRAND",
      resourceType: "brand",
      resourceId: req.params.brandId,
      details: { staff_id, role_on_brand },
      req,
    });

    sendSuccess(res, { assignment: data }, "Staff assigned to brand", 201);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/agency/brands/:brandId/team/:staffId ──────────
router.patch("/:staffId", authenticate, async (req, res, next) => {
  const { role_on_brand } = req.body;
  const { brandId, staffId } = req.params;

  try {
    // 1. Determine if the requester is allowed to manage this brand's team
    const isCompanyAdmin = ADMIN_ROLES.includes(req.user.role);

    let isBrandAdmin = false;
    if (!isCompanyAdmin) {
      const { data: requesterAssignment, error: assignmentError } = await supabase
        .from("staff_brand_assignments")
        .select("role_on_brand")
        .eq("brand_id", brandId)
        .eq("staff_id", req.user.id) // requester's own assignment, not the target's
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      isBrandAdmin = requesterAssignment?.role_on_brand === "brand_admin";
    }

    if (!isCompanyAdmin && !isBrandAdmin) {
      return sendError(res, 403, "Only admins can change brand roles");
    }

    if (!BRAND_ROLES.includes(role_on_brand)) {
      return sendError(
        res,
        400,
        `Invalid role. Must be one of: ${BRAND_ROLES.join(", ")}`,
      );
    }

    // 2. Only company admins should be able to grant/revoke brand_admin itself,
    //    otherwise a brand_admin could promote a peer or themselves further.
    if (role_on_brand === "brand_admin" && !isCompanyAdmin) {
      return sendError(res, 403, "Only company admins can assign brand_admin");
    }

    const { data, error } = await supabase
      .from("staff_brand_assignments")
      .update({ role_on_brand, roles_on_brand: [role_on_brand] })
      .eq("brand_id", brandId)
      .eq("staff_id", staffId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return sendError(res, 404, "Assignment not found");

    if (role_on_brand === "brand_admin") {
      const { error: brandError } = await supabase
        .from("brands")
        .update({ account_manager_id: staffId })
        .eq("id", brandId);

      if (brandError) throw brandError;
    }

    sendSuccess(res, { assignment: data }, "Role updated");
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/agency/brands/:brandId/team/:staffId ─────────
router.delete("/:staffId", authenticate, async (req, res, next) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      return sendError(res, 403, "Only admins can remove staff from brands");
    }

    const { error } = await supabase
      .from("staff_brand_assignments")
      .delete()
      .eq("brand_id", req.params.brandId)
      .eq("staff_id", req.params.staffId);

    if (error) throw error;

    await auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "REMOVE_STAFF_FROM_BRAND",
      resourceType: "brand",
      resourceId: req.params.brandId,
      details: { staffId: req.params.staffId },
      req,
    });

    sendSuccess(res, null, "Staff removed from brand");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
