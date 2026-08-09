'use strict';

const supabase = require('../config/supabase');

// ── List groups for a brand ───────────────────────────────────────

const listGroups = async (brandId) => {
  const { data: groups, error } = await supabase
    .from('task_groups')
    .select('id, name, color, position, status, created_at')
    .eq('brand_id', brandId)
    .eq('status', 'active')
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);

  // Task counts per group
  const groupIds = (groups || []).map(g => g.id);
  let countMap = {};

  if (groupIds.length) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('group_id')
      .eq('brand_id', brandId)
      .in('group_id', groupIds);

    for (const t of (tasks || [])) {
      countMap[t.group_id] = (countMap[t.group_id] || 0) + 1;
    }
  }

  // Ungrouped count
  const { count: ungroupedCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .is('group_id', null);

  return {
    groups: (groups || []).map(g => ({
      ...g,
      task_count: countMap[g.id] || 0,
    })),
    ungrouped_count: ungroupedCount || 0,
  };
};

// ── Create ────────────────────────────────────────────────────────

const createGroup = async (brandId, { name, color = '#6d28d9' }, createdBy) => {
  if (!name?.trim()) throw Object.assign(new Error('Group name is required'), { status: 400 });

  // Position = current max + 1
  const { data: existing } = await supabase
    .from('task_groups')
    .select('position')
    .eq('brand_id', brandId)
    .order('position', { ascending: false })
    .limit(1);

  const position = existing?.[0]?.position != null ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from('task_groups')
    .insert({ brand_id: brandId, name: name.trim(), color, position, created_by: createdBy })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// ── Update (rename / recolor / archive) ──────────────────────────

const updateGroup = async (groupId, brandId, { name, color, status }) => {
  const update = {};
  if (name   !== undefined) update.name   = name.trim();
  if (color  !== undefined) update.color  = color;
  if (status !== undefined) {
    if (!['active', 'archived'].includes(status)) {
      throw Object.assign(new Error('status must be active or archived'), { status: 400 });
    }
    update.status = status;
  }

  if (!Object.keys(update).length) throw Object.assign(new Error('Nothing to update'), { status: 400 });

  const { data, error } = await supabase
    .from('task_groups')
    .update(update)
    .eq('id', groupId)
    .eq('brand_id', brandId) // safety: scope to brand
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// ── Reorder ───────────────────────────────────────────────────────

const reorderGroups = async (brandId, orderedIds) => {
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    throw Object.assign(new Error('orderedIds must be a non-empty array'), { status: 400 });
  }

  // Bulk update positions
  const updates = orderedIds.map((id, i) =>
    supabase
      .from('task_groups')
      .update({ position: i })
      .eq('id', id)
      .eq('brand_id', brandId) // safety
  );

  const results = await Promise.allSettled(updates);
  const failed  = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    console.error('[task-groups] reorder partial failure:', failed.length, 'failed');
  }

  return { reordered: orderedIds.length - failed.length };
};

// ── Delete ────────────────────────────────────────────────────────

const deleteGroup = async (groupId, brandId, { moveTo = null } = {}) => {
  if (moveTo) {
    // Reassign orphaned tasks to another group
    const { error: moveErr } = await supabase
      .from('tasks')
      .update({ group_id: moveTo })
      .eq('group_id', groupId)
      .eq('brand_id', brandId);

    if (moveErr) throw new Error(`Failed to move tasks: ${moveErr.message}`);
  } else {
    // Ungroup — set group_id = NULL
    const { error: ungroupErr } = await supabase
      .from('tasks')
      .update({ group_id: null })
      .eq('group_id', groupId)
      .eq('brand_id', brandId);

    if (ungroupErr) throw new Error(`Failed to ungroup tasks: ${ungroupErr.message}`);
  }

  const { error } = await supabase
    .from('task_groups')
    .delete()
    .eq('id', groupId)
    .eq('brand_id', brandId);

  if (error) throw new Error(error.message);
  return { deleted: true };
};

// ── Get tasks grouped ─────────────────────────────────────────────
// Used by TaskGroupedView — returns all groups with their tasks embedded.

const getGroupedTasks = async (brandId, filters = {}) => {
  const { month, year, date_field = 'due_date', status } = filters;

  let taskQuery = supabase
    .from('tasks')
    .select('id, title, description, status, due_date, group_id, assigned_to, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true });

  if (status)     taskQuery = taskQuery.eq('status', status);
  if (year)       taskQuery = taskQuery.gte(date_field, `${year}-01-01`).lte(date_field, `${year}-12-31`);
  if (month && year) {
    const pad = String(month).padStart(2, '0');
    const last = new Date(year, month, 0).getDate();
    taskQuery = taskQuery.gte(date_field, `${year}-${pad}-01`).lte(date_field, `${year}-${pad}-${last}`);
  }

  const [groupsResult, tasksResult] = await Promise.all([
    supabase
      .from('task_groups')
      .select('id, name, color, position')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .order('position', { ascending: true }),
    taskQuery,
  ]);

  if (groupsResult.error) throw new Error(groupsResult.error.message);
  if (tasksResult.error)  throw new Error(tasksResult.error.message);

  const tasks  = tasksResult.data  || [];
  const groups = groupsResult.data || [];

  // Build group → tasks map
  const grouped = groups.map(g => ({
    ...g,
    tasks: tasks.filter(t => t.group_id === g.id),
  }));

  const ungrouped = tasks.filter(t => !t.group_id);

  return { groups: grouped, ungrouped };
};

module.exports = {
  listGroups,
  createGroup,
  updateGroup,
  reorderGroups,
  deleteGroup,
  getGroupedTasks,
};
