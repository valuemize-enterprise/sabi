/**
 * Agency Brands Routes
 * GET    /api/agency/brands
 * POST   /api/agency/brands
 * GET    /api/agency/brands/:id
 * PUT    /api/agency/brands/:id
 * DELETE /api/agency/brands/:id
 * GET    /api/agency/brands/:id/summary (ARIA-powered)
 */

"use strict";

const router = require("express").Router();
const supabase = require("../../config/supabase");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/auth.middleware");
const {
  sendSuccess,
  sendError,
  sendPaginated,
} = require("../../utils/response.utils");
const { auditLog } = require("../../middleware/logger.middleware");
const clarityService = require("../../services/aria/clarity-score.service");
const notify = require("../../services/notification-triggers.service");

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

// GET /api/agency/brands
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("brands")
      .select(
        "id, name, industry, logo_url, status, clarity_score, primary_color, account_manager_id, created_at, users!account_manager_id(full_name)",
        { count: "exact" },
      );

    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);

    // Non-directors only see their assigned brands
    const limitedRoles = [
      "account_manager",
      "senior_strategist",
      "strategist",
      "copywriter",
      "social_media_manager",
      "analytics_specialist",
      "client_success",
      "creative_lead",
    ];
    if (limitedRoles.includes(req.user.role)) {
      const { data: assignments } = await supabase
        .from("staff_brand_assignments")
        .select("brand_id")
        .eq("staff_id", req.user.id);
      const brandIds = assignments?.map((a) => a.brand_id) || [];
      if (brandIds.length === 0) return sendPaginated(res, [], 0, page, limit);
      query = query.in("id", brandIds);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    sendPaginated(res, data, count, page, limit);
  } catch (err) {
    next(err);
  }
});

// POST /api/agency/brands
router.post(
  "/",
  authenticate,
  requirePermission("CREATE_BRAND"),
  async (req, res, next) => {
    try {
      const {
        name,
        industry,
        description,
        logo_url,
        website,
        social_handles,
        primary_color,
        account_manager_id,
      } = req.body;
      if (!name || !industry)
        return sendError(res, 400, "Name and industry are required");

      const payload = {
        name,
        industry,
        description: description || null,
        website: website || null,
        social_handles: social_handles || {},
        primary_color: primary_color || "#6d28d9",
        account_manager_id:
          account_manager_id ||
          (req.user.role !== "super_admin" ? req.user.id : null),
      };
      if (logo_url) payload.logo_url = logo_url;

      const { data, error } = await supabase
        .from("brands")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "CREATE_BRAND",
        resourceType: "brand",
        resourceId: data.id,
        details: { name },
        req,
      });

      sendSuccess(res, { brand: data }, "Brand created", 201);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/brandlist", authenticate, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: brands,
      count,
      error,
    } = await supabase
      .from("brands")
      .select("*", { count: "exact" })
      .range(from, to);

    if (error) throw error;

    const brandIds = brands.map((b) => b.id);

    const { data: assignments, error: assignError } = await supabase
      .from("staff_brand_assignments")
      .select("brand_id, staff_id, role_on_brand, users:staff_id(full_name)")
      .in("brand_id", brandIds);

    if (assignError) throw assignError;

    const brandsWithTeam = brands.map((brand) => ({
      ...brand,
      team: assignments.filter((a) => a.brand_id === brand.id),
    }));

    sendPaginated(res, brandsWithTeam, count, page, limit);
  } catch (err) {
    next(err);
  }
});

// GET /api/agency/brands/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const { data: brand, error } = await supabase
      .from("brands")
      .select(
        `
        *,
        users!account_manager_id(id, full_name, email, avatar_url),
        clients(id, full_name, email, job_title, is_active),
        goals(id, title, status, target_value, current_value, velocity_score),
        competitors(id, name, website),
        reports(id, title, type, status, published_at)
      `,
      )
      .eq("id", req.params.id)
      .single();

    if (error || !brand) return sendError(res, 404, "Brand not found");
    sendSuccess(res, { brand });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/agency/brands/:brandId/team ────────────────────
router.post("/:brandId/team", authenticate, async (req, res, next) => {
  try {
    const { brandId } = req.params;
    const { staff_id, role_on_brand } = req.body;

    // ── Validate input first ──────────────────────────────────
    if (!staff_id) {
      return sendError(res, 400, "staff_id is required");
    }
    if (!BRAND_ROLES.includes(role_on_brand)) {
      return sendError(
        res,
        400,
        `role_on_brand must be one of: ${BRAND_ROLES.join(", ")}`,
      );
    }

    // ── Permission check: company admin OR brand_admin on this brand ──
    const isCompanyAdmin = ADMIN_ROLES.includes(req.user.role);
    let isBrandAdmin = false;

    if (!isCompanyAdmin) {
      const { data: requesterAssignment, error: assignmentError } =
        await supabase
          .from("staff_brand_assignments")
          .select("role_on_brand")
          .eq("brand_id", brandId)
          .eq("staff_id", req.user.id)
          .maybeSingle();

      if (assignmentError) throw assignmentError;

      isBrandAdmin = requesterAssignment?.role_on_brand === "brand_admin";
    }

    if (!isCompanyAdmin && !isBrandAdmin) {
      return sendError(res, 403, "Only admins can assign staff to brands");
    }

    // ── Only company admins can grant brand_admin itself ──────
    // Prevents a brand_admin from promoting a peer (or reassigning
    // account_manager_id) without company-level authorization.
    if (role_on_brand === "brand_admin" && !isCompanyAdmin) {
      return sendError(
        res,
        403,
        "Only company admins can assign the brand_admin role",
      );
    }

    // ── Upsert — if already assigned, update the role ─────────
    const { data, error } = await supabase
      .from("staff_brand_assignments")
      .upsert(
        {
          staff_id,
          brand_id: brandId,
          role_on_brand,
          roles_on_brand: [role_on_brand],
        },
        { onConflict: "staff_id, brand_id" },
      )
      .select()
      .single();

    if (error) throw error;

    // ── Keep brands.account_manager_id in sync with brand_admin ──
    if (role_on_brand === "brand_admin") {
      const { error: brandError } = await supabase
        .from("brands")
        .update({ account_manager_id: staff_id })
        .eq("id", brandId);

      if (brandError) throw brandError;
    }

    await auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "ASSIGN_STAFF_TO_BRAND",
      resourceType: "brand",
      resourceId: brandId,
      details: { staff_id, role_on_brand },
      req,
    });

    sendSuccess(res, { assignment: data }, "Staff assigned to brand", 201);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/agency/brands/:brandId/team/:staffId ─────────
router.delete("/:brandId/:staffId", authenticate, async (req, res, next) => {
  try {
    const { brandId, staffId } = req.params;

    // ── Permission check: company admin OR brand_admin on this brand ──
    const isCompanyAdmin = ADMIN_ROLES.includes(req.user.role);
    let isBrandAdmin = false;

    if (!isCompanyAdmin) {
      const { data: requesterAssignment, error: assignmentError } = await supabase
        .from("staff_brand_assignments")
        .select("role_on_brand")
        .eq("brand_id", brandId)
        .eq("staff_id", req.user.id)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      isBrandAdmin = requesterAssignment?.role_on_brand === "brand_admin";
    }

    if (!isCompanyAdmin && !isBrandAdmin) {
      return sendError(res, 403, "Only admins can remove staff from brands");
    }

    // ── Prevent removing yourself, and prevent a brand_admin from ──
    // removing another brand_admin (only company admins can do that) ──
    if (staffId === req.user.id) {
      return sendError(res, 400, "You cannot remove yourself from a brand");
    }

    if (!isCompanyAdmin) {
      const { data: targetAssignment, error: targetError } = await supabase
        .from("staff_brand_assignments")
        .select("role_on_brand")
        .eq("brand_id", brandId)
        .eq("staff_id", staffId)
        .maybeSingle();

      if (targetError) throw targetError;

      if (targetAssignment?.role_on_brand === "brand_admin") {
        return sendError(res, 403, "Only company admins can remove a brand_admin");
      }
    }

    const { error } = await supabase
      .from("staff_brand_assignments")
      .delete()
      .eq("brand_id", brandId)
      .eq("staff_id", staffId);

    if (error) throw error;

    // ── Clear account_manager_id if the removed staff was the brand's manager ──
    const { data: brand, error: brandFetchError } = await supabase
      .from("brands")
      .select("account_manager_id")
      .eq("id", brandId)
      .single();

    if (brandFetchError) throw brandFetchError;

    if (brand?.account_manager_id === staffId) {
      const { error: brandUpdateError } = await supabase
        .from("brands")
        .update({ account_manager_id: null })
        .eq("id", brandId);

      if (brandUpdateError) throw brandUpdateError;
    }

    await auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "REMOVE_STAFF_FROM_BRAND",
      resourceType: "brand",
      resourceId: brandId,
      details: { staffId },
      req,
    });

    sendSuccess(res, null, "Staff removed from brand");
  } catch (err) {
    next(err);
  }
});

// PUT /api/agency/brands/:id
router.put(
  "/:id",
  authenticate,
  requirePermission("EDIT_BRAND"),
  async (req, res, next) => {
    try {
      const allowed = [
        "name",
        "industry",
        "description",
        "logo_url",
        "website",
        "social_handles",
        "primary_color",
        "account_manager_id",
        "status",
      ];
      const updates = {};
      allowed.forEach((k) => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      });

      const { data, error } = await supabase
        .from("brands")
        .update(updates)
        .eq("id", req.params.id)
        .select()
        .single();
      if (error) throw error;

      await auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "UPDATE_BRAND",
        resourceType: "brand",
        resourceId: req.params.id,
        details: updates,
        req,
      });

      sendSuccess(res, { brand: data });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/agency/brands/:id
router.delete(
  "/:id",
  authenticate,
  requirePermission("DELETE_BRAND"),
  async (req, res, next) => {
    try {
      const { data: brand } = await supabase
        .from("brands")
        .select("name")
        .eq("id", req.params.id)
        .single();
      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", req.params.id);
      if (error) throw error;

      await auditLog({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: "DELETE_BRAND",
        resourceType: "brand",
        resourceId: req.params.id,
        req,
      });

      notify.onSensitiveAction({
        actionLabel: "Brand deleted",
        actorName: req.user.full_name,
        details: `Brand: ${brand?.name || req.params.id}`,
      });

      sendSuccess(res, null, "Brand deleted");
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/agency/brands/:id/refresh-clarity
router.post("/:id/refresh-clarity", authenticate, async (req, res, next) => {
  try {
    const { data: brand } = await supabase
      .from("brands")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (!brand) return sendError(res, 404, "Brand not found");

    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("brand_id", req.params.id);
    const { data: reports } = await supabase
      .from("reports")
      .select("*")
      .eq("brand_id", req.params.id)
      .limit(5);
    const { data: competitors } = await supabase
      .from("competitors")
      .select("*")
      .eq("brand_id", req.params.id);

    const result = await clarityService.compute({
      brand,
      goals,
      reports,
      competitors,
    });

    await supabase
      .from("brands")
      .update({
        clarity_score: result.score,
        clarity_score_breakdown: result.breakdown,
        clarity_score_updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id);

    await supabase.from("clarity_score_history").insert({
      brand_id: req.params.id,
      score: result.score,
      breakdown: result.breakdown,
      ai_analysis: result.analysis,
    });

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
