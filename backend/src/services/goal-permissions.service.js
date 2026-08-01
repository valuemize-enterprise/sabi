/**
 * Goal Permissions Service
 * Sabi Intelligence Suite · AI Goal Generator
 *
 * Enforces the two-tier edit/delete system:
 *
 *   Super Admin → can edit or delete any goal directly.
 *   Brand Admin  → must submit a change request and wait for SA approval.
 *                  On approval, the proposed changes are automatically applied.
 *   Staff        → read-only access to goals.
 */

"use strict";

const supabase = require("../config/supabase");
const APP = process.env.NEXT_PUBLIC_APP_URL || "https://sabi.cerebre.media";

const SUPER_ROLES = new Set(["super_admin", "admin", "md", "brand_admin"]);
const { send } = require("./email-dispatch.service"); // wherever your templates file lives

// ── Helper: audit log ─────────────────────────────────────────────────────────
async function audit({
  goalId,
  brandId,
  actorId,
  action,
  summary,
  before,
  after,
  crId,
}) {
  return supabase.from("goal_audit_log").insert({
    goal_id: goalId,
    brand_id: brandId,
    actor_id: actorId,
    action,
    change_summary: summary,
    before_state: before || null,
    after_state: after || null,
    change_request_id: crId || null,
  });
  if (error) console.error("goal_audit_log error:", error.message);
  // non-blocking
}

// ── Super Admin: direct edit ──────────────────────────────────────────────────
async function editGoalDirect({ goalId, updates, caller }) {
  if (!SUPER_ROLES.has(caller.role)) {
    throw Object.assign(
      new Error("Only Super Admins can edit goals directly."),
      { status: 403 },
    );
  }

  const { data: before } = await supabase
    .from("brand_goals")
    .select("*")
    .eq("id", goalId)
    .single();

  const allowed = [
    "objective",
    "title",
    "key_results",
    "quarter",
    "due_date",
    "status",
  ];
  const patch = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k)),
  );
  patch.last_edited_by = caller.id;

  const { data, error } = await supabase
    .from("brand_goals")
    .update(patch)
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update goal: ${error.message}`);

  // Keep title in sync with objective for backward compat
  if (patch.objective && !patch.title) {
    await supabase
      .from("brand_goals")
      .update({ title: patch.objective })
      .eq("id", goalId);
  }

  await audit({
    goalId,
    brandId: data.brand_id,
    actorId: caller.id,
    action: "edited",
    summary: "Super Admin edited goal directly",
    before: before,
    after: data,
  });

  return data;
}

// ── Super Admin: direct delete ────────────────────────────────────────────────
async function deleteGoalDirect({ goalId, caller }) {
  if (!SUPER_ROLES.has(caller.role)) {
    throw Object.assign(
      new Error("Only Super Admins can delete goals directly."),
      { status: 403 },
    );
  }

  const { data: goal } = await supabase
    .from("brand_goals")
    .select("*")
    .eq("id", goalId)
    .single();
  if (!goal) throw Object.assign(new Error("Goal not found."), { status: 404 });

  await audit({
    goalId,
    brandId: goal.brand_id,
    actorId: caller.id,
    action: "deleted",
    summary: "Super Admin deleted goal",
    before: goal,
  });

  // Soft-delete: mark as paused rather than hard-delete (preserves audit trail)
  const { error } = await supabase
    .from("brand_goals")
    .update({ status: "paused", last_edited_by: caller.id })
    .eq("id", goalId);

  if (error) throw new Error(`Failed to delete goal: ${error.message}`);
  return { deleted: true, goal_id: goalId };
}

// ── Brand Admin: submit change request ────────────────────────────────────────
async function submitChangeRequest({
  goalId,
  requestType,
  reason,
  proposedChanges,
  caller,
}) {
  // Check no pending request already exists for this goal by this person
  const { data: existing } = await supabase
    .from("goal_change_requests")
    .select("id")
    .eq("goal_id", goalId)
    .eq("requester_id", caller.id)
    .eq("status", "pending")
    .single();

  if (existing) {
    throw Object.assign(
      new Error(
        "You already have a pending request for this goal. Wait for a decision before submitting another.",
      ),
      { status: 409 },
    );
  }

  const { data: goal } = await supabase
    .from("brand_goals")
    .select("brand_id")
    .eq("id", goalId)
    .single();
  if (!goal) throw Object.assign(new Error("Goal not found."), { status: 404 });

  // Get brand name for notification
  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", goal.brand_id)
    .single();
  const brandName = brand?.name || "a brand";

  const { data, error } = await supabase
    .from("goal_change_requests")
    .insert({
      goal_id: goalId,
      brand_id: goal.brand_id,
      requester_id: caller.id,
      request_type: requestType,
      reason,
      proposed_objective: proposedChanges?.objective || null,
      proposed_key_results: proposedChanges?.key_results || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to submit request: ${error.message}`);

  await audit({
    goalId,
    brandId: goal.brand_id,
    actorId: caller.id,
    action: "change_requested",
    summary: `${requestType} request submitted: ${reason}`,
    crId: data.id,
  });

  // Notify all Super Admins
  const { data: superAdmins } = await supabase
    .from("users")
    .select("id, email, full_name") // ← add email + full_name to the select
    .in("role", ["super_admin", "admin", "md"])
    .eq("is_active", true);

  if (superAdmins && superAdmins.length > 0) {
    // ── In-app notifications ──────────────────────────────────────
    const notifications = superAdmins.map((admin) => ({
      user_id: admin.id,
      type: "goal_change_request",
      title: "Goal Change Request",
      body: `${caller.full_name} requested to ${requestType} a goal in ${brandName}`,
      metadata: {
        request_id: data.id,
        goal_id: goalId,
        brand_id: goal.brand_id,
        requester_id: caller.id,
        request_type: requestType,
        url: `/brands/${goal.brand_id}?tab=goals`,
      },
    }));

    const { error: err } = await supabase
      .from("notifications")
      .insert(notifications);
    if (err) {
      console.error(
        "[goal-permissions] Failed to send notifications:",
        err.message,
      );
    }

    // ── Email notifications ───────────────────────────────────────
    const emailPromises = superAdmins.map((admin) =>
      send("goal_change_request", {
        to: {
          id: admin.id,
          email: admin.email,
        },
        data: {
          recipientName: admin.full_name,
          requesterName: caller.full_name,
          requestType,
          brandName,
          goalTitle: goal.title,
          reviewLink: `${process.env.APP_URL}/brands/${goal.brand_id}?tab=goals`,
        },
        entityId: data.id, // ← plain UUID only, no colon-compound
        dedupe: "always", // ← 'always' generates a unique key per send
        //        so each admin gets their own email even with the same entityId
      }).catch((err) =>
        console.error(
          `[goal-permissions] Email failed for ${admin.email}:`,
          err.message,
        ),
      ),
    );
    await Promise.allSettled(emailPromises);
  }

  return data;
}

// ── Super Admin: decide on change request ─────────────────────────────────────
async function decideChangeRequest({
  requestId,
  approve,
  denialReason,
  caller,
}) {
  if (!SUPER_ROLES.has(caller.role)) {
    throw Object.assign(
      new Error("Only Super Admins can approve or deny change requests."),
      { status: 403 },
    );
  }

  const { data: cr, error: crErr } = await supabase
    .from("goal_change_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (crErr || !cr)
    throw Object.assign(new Error("Change request not found."), {
      status: 404,
    });
  if (cr.status !== "pending") {
    throw Object.assign(
      new Error(`This request has already been ${cr.status}.`),
      { status: 409 },
    );
  }

  const decision = approve ? "approved" : "denied";

  await supabase
    .from("goal_change_requests")
    .update({
      status: decision,
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      denial_reason: approve ? null : denialReason || "No reason given",
    })
    .eq("id", requestId);

  if (approve) {
    if (cr.request_type === "delete") {
      await deleteGoalDirect({ goalId: cr.goal_id, caller });
    } else if (cr.request_type === "edit") {
      const updates = {};
      if (cr.proposed_objective) updates.objective = cr.proposed_objective;
      if (cr.proposed_key_results)
        updates.key_results = cr.proposed_key_results;
      if (Object.keys(updates).length > 0) {
        await editGoalDirect({ goalId: cr.goal_id, updates, caller });
      }
    }

    await audit({
      goalId: cr.goal_id,
      brandId: cr.brand_id,
      actorId: caller.id,
      action: "change_approved",
      summary: `SA approved ${cr.request_type} request from user ${cr.requester_id}`,
      crId: requestId,
    });
  } else {
    await audit({
      goalId: cr.goal_id,
      brandId: cr.brand_id,
      actorId: caller.id,
      action: "change_denied",
      summary: `SA denied ${cr.request_type} request: ${denialReason || ""}`,
      crId: requestId,
    });
  }

  // Notify the requester of the decision
  const notificationMessage = approve
    ? `Your ${cr.request_type} request for a goal has been approved`
    : `Your ${cr.request_type} request for a goal has been denied${denialReason ? ": " + denialReason : ""}`;

  await supabase
    .from("notifications")
    .insert({
      user_id: cr.requester_id,
      type: approve ? "goal_request_approved" : "goal_request_denied",
      title: approve ? "Request Approved" : "Request Denied",
      message: notificationMessage,
      link: `/brands/${cr.brand_id}?tab=goals`,
      metadata: {
        request_id: requestId,
        goal_id: cr.goal_id,
        brand_id: cr.brand_id,
        decision,
        decided_by: caller.id,
      },
    })
    .catch((err) => {
      console.error(
        "[goal-permissions] Failed to send decision notification:",
        err.message,
      );
    });

  return { decided: true, decision, request_id: requestId };
}

// ── Get pending requests for a brand (SA view) ────────────────────────────────
async function getPendingRequests(brandId, caller) {
  if (!SUPER_ROLES.has(caller.role)) {
    throw Object.assign(
      new Error("Only Super Admins can view all change requests."),
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("goal_change_requests")
    .select(
      `
      *,
      requester:users!requester_id(full_name, email),
      goal:brand_goals(objective, title)
    `,
    )
    .eq("brand_id", brandId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── Get MY requests (Brand Admin view) ────────────────────────────────────────
async function getMyRequests(callerId) {
  const { data, error } = await supabase
    .from("goal_change_requests")
    .select(
      `
      *,
      goal:brand_goals(objective, title, brand_id)
    `,
    )
    .eq("requester_id", callerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  editGoalDirect,
  deleteGoalDirect,
  submitChangeRequest,
  decideChangeRequest,
  getPendingRequests,
  getMyRequests,
  SUPER_ROLES,
};
