/**
 * Agency Tasks Routes — Proof of Value Engine
 * GET  /api/agency/tasks
 * POST /api/agency/tasks
 * PUT  /api/agency/tasks/:id
 * POST /api/agency/tasks/:id/complete  (triggers Proof of Value Engine)
 * DELETE /api/agency/tasks/:id
 */

"use strict";

const router = require("express").Router();
const supabase = require("../../config/supabase");
const { authenticate } = require("../../middleware/auth.middleware");
const {
  sendSuccess,
  sendError,
  sendPaginated,
} = require("../../utils/response.utils");
const { auditLog } = require("../../middleware/logger.middleware");
const povService = require("../../services/aria/proof-of-value.service");
const notify = require("../../services/notification-triggers.service");

async function notifyAssignee(taskId, taskTitle, assigneeId, assignerName) {
  if (!assigneeId) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: assigneeId,
    type: "task_assigned",
    title: `📋 New Task: ${taskTitle}`,
    body: `${assignerName} assigned you a task. Tap to view.`,
    metadata: { task_id: taskId },
    is_read: false,
  });

  if (error) console.error("notifyAssignee error:", error.message);
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const {
      brand_id,
      assignee_id,
      status,
      priority,
      strategy_id,
      page = 1,
      limit = 50,
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase.from("tasks").select(
      `
        id, title, description, status, priority, due_date,
        estimated_hours, actual_hours, tags, created_at, updated_at,
        brand_id, assignee_id, strategy_id, brief_id, created_by,
        brands     ( id, name, primary_color ),
        assignee:users!assignee_id ( id, full_name, role, avatar_url ),
        creator:users!created_by   ( id, full_name ),
        strategies ( id, title, type ),
        goals      ( id, title )
      `,
      { count: "exact" },
    );

    if (brand_id) query = query.eq("brand_id", brand_id);
    if (assignee_id) query = query.eq("assignee_id", assignee_id);
    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);
    if (strategy_id) query = query.eq("strategy_id", strategy_id);

    const ADMIN_ROLES = ['super_admin','ceo', 'brand_admin','managing_director','creative_director','strategy_director','account_director'];

    // Staff only see tasks for their brands
    if (!ADMIN_ROLES.includes(req.user.role)) {
      const { data: myBrands } = await supabase
        .from("staff_brand_assignments")
        .select("brand_id")
        .eq("staff_id", req.user.id);
      const ids = (myBrands ?? []).map((b) => b.brand_id);
      if (ids.length === 0) return sendPaginated(res, [], 0, page, limit);
      query = query.in("brand_id", ids);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    sendPaginated(res, data || [], count, page, limit);
  } catch (err) {
    next(err);
  }
});

router.post("/", authenticate, async (req, res, next) => {
  try {
    const {
      brand_id,
      title,
      description,
      status = "todo",
      priority = "medium",
      due_date,
      assigned_to,
      strategy_id,
      goal_id,
      brief_id,
      estimated_hours,
      tags,
    } = req.body;

    if (!brand_id) return sendError(res, 400, "brand_id is required");
    if (!title) return sendError(res, 400, "title is required");

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        brand_id,
        title: title.trim(),
        description: description || null,
        status,
        priority,
        due_date: due_date || null,
        assignee_id: assigned_to,
        strategy_id: strategy_id || null,
        goal_id: goal_id || null,
        brief_id: brief_id || null,
        estimated_hours: estimated_hours ? parseFloat(estimated_hours) : null,
        tags: tags || [],
        created_by: req.user.role !== "super_admin" ? req.user.id : null,
      })
      .select(
        `
        id, title, status, priority, due_date, assignee_id, created_at,
        assignee:users!assignee_id ( id, full_name, role )
      `,
      )
      .single();

    if (error) throw error;

    // Notify assignee
    if (assigned_to && assigned_to !== req.user.id) {
      await notifyAssignee(
        task.id,
        task.title,
        assigned_to,
        req.user.full_name,
      );
    }

    await auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "CREATE_TASK",
      resourceType: "task",
      resourceId: task.id,
      details: { brand_id, title, assigned_to },
      req,
    });

    sendSuccess(res, { task }, "Task created", 201);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        `
        *,
        brands      ( id, name, primary_color ),
        assignee:users!assignee_id ( id, full_name, role, avatar_url ),
        creator:users!created_by   ( id, full_name, role ),
        strategies  ( id, title, type ),
        goals       ( id, title, metric_type, unit ),
        client_briefs ( id, title, brief_type )
      `,
      )
      .eq("id", req.params.id)
      .single();

    if (error || !data) return sendError(res, 404, "Task not found");
    sendSuccess(res, { task: data });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", authenticate, async (req, res, next) => {
  console.log("req.body", req.body);
  console.log("hello from here ", req.body);
  try {
    const allowed = [
      "title",
      "description",
      "status",
      "priority",
      "due_date",
      "assignee_id",
      "strategy_id",
      "goal_id",
      "actual_hours",
      "estimated_hours",
      "tags",
      "proof_links",
    ];
    const updates = { updated_at: new Date().toISOString() };
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    // Guard: 'verified' status must go through the dedicated verify endpoint
    if (updates.status === "verified") {
      return sendError(
        res,
        400,
        'Cannot set status to "verified" directly — use PUT /api/agency/tasks/:id/verify',
      );
    }

    const { data: old } = await supabase
      .from("tasks")
      .select("assignee_id, title")
      .eq("id", req.params.id)
      .single();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", req.params.id)
      .select("id, title, status, priority, assignee_id, updated_at")
      .single();

    if (error) throw error;

    // Notify new assignee if changed
    if (updates.assignee_id && updates.assignee_id !== old?.assignee_id) {
      await notifyAssignee(
        req.params.id,
        data.title,
        updates.assignee_id,
        req.user.full_name,
      );
    }

    sendSuccess(res, { task: data }, "Task updated");
  } catch (err) {
    next(err);
  }
});

// POST /api/agency/tasks/:id/complete  ← ARIA Proof of Value Engine
router.post("/:id/complete", authenticate, async (req, res, next) => {
  try {
    const { metric_before, metric_after, metric_notes } = req.body;
    const { data: task, error } = await supabase
      .from("tasks")
      .select("*, goals(*, brands(name, industry))")
      .eq("id", req.params.id)
      .single();

    if (error || !task) return sendError(res, 404, "Task not found");

    const povResult = await povService.analyze({
      task,
      goal: task.goals,
      brand: task.goals?.brands,
      metricBefore: metric_before,
      metricAfter: metric_after,
      metricNotes: metric_notes,
    });

    const { data: updated } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        proof_of_value_data: povResult,
        metric_impact: {
          before: metric_before,
          after: metric_after,
          notes: metric_notes,
        },
      })
      .eq("id", req.params.id)
      .select()
      .single();

    // Update goal current_value if linked
    if (task.goal_id && metric_after !== undefined) {
      await supabase
        .from("goals")
        .update({ current_value: parseFloat(metric_after) })
        .eq("id", task.goal_id);
    }

    await auditLog({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: "COMPLETE_TASK",
      resourceType: "task",
      resourceId: req.params.id,
      req,
    });

    sendSuccess(res, { task: updated, proof_of_value: povResult });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/agency/tasks/:id/status ─────────────────────────
router.put("/:id/status", authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ["todo", "in_progress", "in_review", "done", "blocked"];
    if (!valid.includes(status))
      return sendError(res, 400, `status must be one of: ${valid.join(", ")}`);

    const updates = { status, updated_at: new Date().toISOString() };
    if (status === "done") updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", req.params.id)
      .select("id, title, status, assignee_id, brand_id")
      .single();

    if (error) throw error;

    // If moved to in_review, notify the task creator / brand admin
    if (status === "in_review" && data.brand_id) {
      const { data: brandAdmins } = await supabase
        .from("staff_brand_assignments")
        .select("staff_id")
        .eq("brand_id", data.brand_id)
        .contains("roles_on_brand", ["brand_admin"]);

      if (brandAdmins?.length) {
        await supabase.from("notifications").insert(
          brandAdmins.map((a) => ({
            user_id: a.staff_id,
            type: "task_ready_for_review",
            title: `👀 Ready for Review: ${data.title}`,
            body: "A task has been moved to In Review. Please check and approve.",
            metadata: { task_id: data.id },
            is_read: false,
          })),
        );
      }
    }

    // If moved to done, notify brand admins that verification is needed
    if (status === "done" && data.brand_id) {
      const { data: brandAdmins } = await supabase
        .from("staff_brand_assignments")
        .select("staff_id")
        .eq("brand_id", data.brand_id)
        .contains("roles_on_brand", ["brand_admin"]);

      if (brandAdmins?.length) {
        await supabase.from("notifications").insert(
          brandAdmins.map((a) => ({
            user_id: a.staff_id,
            type: "task_needs_verification",
            title: `✅ Task Done: ${data.title}`,
            body: "A task has been marked done and needs verification.",
            metadata: { task_id: data.id },
            is_read: false,
          })),
        );
      }
    }

    sendSuccess(res, { task: data }, "Task status updated");
  } catch (err) {
    next(err);
  }
});

// ── GET /api/agency/tasks/:id/comments ───────────────────────
router.get("/:id/comments", authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("task_comments")
      .select(
        "id, content, created_at, users ( id, full_name, role, avatar_url )",
      )
      .eq("task_id", req.params.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    sendSuccess(res, { comments: data || [] });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/agency/tasks/:id/comments ──────────────────────
router.post("/:id/comments", authenticate, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim())
      return sendError(res, 400, "Comment content is required");

    const { data, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: req.params.id,
        user_id: req.user.role !== "super_admin" ? req.user.id : null,
        content: content.trim(),
      })
      .select("id, content, created_at, users ( id, full_name, role )")
      .single();

    if (error) throw error;

    // Notify the task assignee about the comment
    const { data: task } = await supabase
      .from("tasks")
      .select("assignee_id, title, created_by")
      .eq("id", req.params.id)
      .single();

    const toNotify = [
      ...new Set(
        [task?.assignee_id, task?.created_by]
          .filter(Boolean)
          .filter((id) => id !== req.user.id),
      ),
    ];
    if (toNotify.length) {
      await supabase.from("notifications").insert(
        toNotify.map((userId) => ({
          user_id: userId,
          type: "task_comment",
          title: `💬 New comment on: ${task.title}`,
          body: `${req.user.full_name}: ${content.substring(0, 80)}${content.length > 80 ? "…" : ""}`,
          metadata: { task_id: req.params.id },
          is_read: false,
        })),
      );
    }

    sendSuccess(res, { comment: data }, "Comment added", 201);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/agency/tasks/:id ─────────────────────────────
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    await supabase.from("tasks").delete().eq("id", req.params.id);
    sendSuccess(res, null, "Task deleted");
  } catch (err) {
    next(err);
  }
});

// ── POST /api/agency/tasks/bulk-create ───────────────────────
// AI generates tasks from a strategy
router.post("/bulk-create", authenticate, async (req, res, next) => {
  try {
    const { strategy_id, brand_id } = req.body;

    const [{ data: strategy }, { data: staffRes }] = await Promise.all([
      supabase.from("strategies").select("*").eq("id", strategy_id).single(),
      supabase
        .from("staff_brand_assignments")
        .select(
          "users!staff_id ( id, full_name, role ), roles_on_brand, primary_role",
        )
        .eq("brand_id", brand_id),
    ]);

    if (!strategy) return sendError(res, 404, "Strategy not found");

    const staffList = (staffRes ?? []).map((s) => ({
      ...s.users,
      role_on_brand: s.primary_role,
    }));

    const tasks = await ariaService.generateTasksFromStrategy({
      strategy: strategy.content || strategy,
      brandName: strategy.brand_id,
      staffList,
    });

    if (!tasks.length)
      return sendError(res, 500, "AI could not generate tasks. Try again.");

    // Auto-assign tasks to staff based on suggested_role
    const taskRows = tasks.map((t) => {
      const matchedStaff = staffList.find(
        (s) =>
          s.role?.includes(t.suggested_role?.replace(/ /g, "_")) ||
          s.role_on_brand?.includes(t.suggested_role?.replace(/ /g, "_")),
      );
      return {
        brand_id,
        title: t.title,
        description: t.description,
        status: "todo",
        priority: t.priority || "medium",
        strategy_id,
        estimated_hours: t.estimated_hours || null,
        tags: t.tags || [],
        assignee_id: matchedStaff?.id || null,
        created_by: req.user.role !== "super_admin" ? req.user.id : null,
      };
    });

    const { data: created, error } = await supabase
      .from("tasks")
      .insert(taskRows)
      .select("id, title, assignee_id");
    if (error) throw error;
    console.log("bulk task error ", error);

    // Notify each assigned staff member
    const assignedTasks = (created ?? []).filter((t) => t.assignee_id);
    if (assignedTasks.length) {
      await supabase.from("notifications").insert(
        assignedTasks.map((t) => ({
          user_id: t.assignee_id,
          type: "task_assigned",
          title: `📋 New Task: ${t.title}`,
          body: `You've been assigned a task from the strategy "${strategy.title}".`,
          metadata: { task_id: t.id, strategy_id },
          is_read: false,
        })),
      );
    }

    sendSuccess(
      res,
      { tasks: created, count: created?.length },
      `${created?.length} tasks created from strategy`,
      201,
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
