'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CreateGroupModal, MoveTaskMenu } from './GroupModals';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
});

interface Task {
  id:         string;
  title:      string;
  status:     string;
  due_date?:  string | null;
  group_id?:  string | null;
  assigned_to?: string | null;
}

interface TaskGroup {
  id:         string;
  name:       string;
  color:      string;
  position:   number;
  tasks:      Task[];
}

interface GroupedData {
  groups:    TaskGroup[];
  ungrouped: Task[];
}

// ── Status colours ────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  todo:            '#475569',
  to_do:           '#475569',
  in_progress:     '#f59e0b',
  in_verification: '#3b82f6',
  done:            '#10b981',
  verified:        '#10b981',
};

// ── Minimal task card ─────────────────────────────────────────────

function TaskItem({
  task, groups, onMoved, onOpenTask,
}: {
  task:       Task;
  groups:     TaskGroup[];
  onMoved:    () => void;
  onOpenTask: (id: string) => void;
}) {
  const [showMove, setShowMove] = useState(false);
  const dotColor = STATUS_DOT[task.status] || '#475569';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '8px',
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer', position: 'relative',
        marginBottom: '6px', transition: 'border-color .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
    >
      {/* Status dot */}
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

      {/* Title */}
      <p
        onClick={() => onOpenTask(task.id)}
        style={{ flex: 1, fontSize: '13px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {task.title}
      </p>

      {/* Due date */}
      {task.due_date && (
        <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
          {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      )}

      {/* Move button */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); setShowMove(m => !m); }}
          style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}
          title="Move to group"
        >
          ⋮
        </button>
        {showMove && (
          <MoveTaskMenu
            taskId={task.id}
            currentGroupId={task.group_id || null}
            groups={groups}
            onMoved={onMoved}
            onClose={() => setShowMove(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── TaskGroupColumn ───────────────────────────────────────────────

interface TaskGroupColumnProps {
  group:      TaskGroup | null;  // null = Ungrouped
  tasks:      Task[];
  allGroups:  TaskGroup[];
  userRole:   string;
  onRefresh:  () => void;
  onOpenTask: (id: string) => void;
  onEdit?:    (group: TaskGroup) => void;
  onArchive?: (group: TaskGroup) => void;
  onDelete?:  (group: TaskGroup) => void;
}

export function TaskGroupColumn({
  group, tasks, allGroups, userRole, onRefresh, onOpenTask, onEdit, onArchive, onDelete,
}: TaskGroupColumnProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [showMenu,  setShowMenu]    = useState(false);
  const isAdmin = ['super_admin', 'admin', 'brand_admin', 'md'].includes(userRole);

  const name  = group?.name  || 'Ungrouped';
  const color = group?.color || '#475569';

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '6px 4px' }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '12px', padding: 0, lineHeight: 1 }}
        >
          {collapsed ? '▶' : '▼'}
        </button>

        {/* Color dot */}
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />

        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9', flex: 1 }}>
          {name}
        </p>

        <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginRight: '4px' }}>
          {tasks.length}
        </span>

        {/* Group actions — admin only, named groups only */}
        {isAdmin && group && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(m => !m); }}
              style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
            >
              ···
            </button>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowMenu(false)} />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                  background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', overflow: 'hidden', minWidth: '140px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 60,
                }}>
                  {[
                    { label: 'Rename / Recolor', action: () => { onEdit?.(group); setShowMenu(false); } },
                    { label: 'Archive',           action: () => { onArchive?.(group); setShowMenu(false); } },
                    { label: 'Delete',            action: () => { onDelete?.(group); setShowMenu(false); }, danger: true },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: item.danger ? '#f87171' : '#f1f5f9', fontFamily: 'Inter, sans-serif' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div>
          {tasks.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#374151', padding: '8px 14px', fontStyle: 'italic' }}>
              No tasks in this group.
            </p>
          ) : (
            tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                groups={allGroups}
                onMoved={onRefresh}
                onOpenTask={onOpenTask}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TaskGroupedView — the full grouped layout
// ═══════════════════════════════════════════════════════════════════

interface TaskGroupedViewProps {
  brandId:    string;
  userRole:   string;
  filters:    { month?: number | null; year?: number | null; date_field?: string; status?: string };
  onOpenTask: (id: string) => void;
}

export function TaskGroupedView({ brandId, userRole, filters, onOpenTask }: TaskGroupedViewProps) {
  const [data,        setData]        = useState<GroupedData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editGroup,   setEditGroup]   = useState<TaskGroup | null>(null);

  const isAdmin = ['super_admin', 'admin', 'brand_admin', 'md'].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ brand_id: brandId });
      if (filters.month)      params.set('month',      String(filters.month));
      if (filters.year)       params.set('year',       String(filters.year));
      if (filters.date_field) params.set('date_field', filters.date_field);
      if (filters.status)     params.set('status',     filters.status);

      const res  = await fetch(`${API}/api/task-groups/grouped?${params}`, { headers: getHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [brandId, filters.month, filters.year, filters.date_field, filters.status]);

  useEffect(() => { load(); }, [load]);

  const archiveGroup = async (group: TaskGroup) => {
    if (!window.confirm(`Archive "${group.name}"? Its tasks will remain but the group will be hidden.`)) return;
    await fetch(`${API}/api/task-groups/${group.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ brand_id: brandId, status: 'archived' }),
    });
    load();
  };

  const deleteGroup = async (group: TaskGroup) => {
    if (!window.confirm(`Delete "${group.name}"? All tasks in this group will become Ungrouped.`)) return;
    await fetch(`${API}/api/task-groups/${group.id}?brand_id=${brandId}`, {
      method: 'DELETE', headers: getHeaders(),
    });
    load();
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: '120px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.6}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>
      {error}
    </div>
  );

  const allGroups = data?.groups || [];

  return (
    <div>
      {/* Header + New Group button */}
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '7px 14px', borderRadius: '7px', background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            + New Group
          </button>
        </div>
      )}

      {/* No groups at all */}
      {allGroups.length === 0 && (data?.ungrouped || []).length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ fontSize: '14px', color: '#475569' }}>No tasks found for the selected filters.</p>
        </div>
      )}

      {/* Named groups */}
      {allGroups.map(group => (
        <TaskGroupColumn
          key={group.id}
          group={group}
          tasks={group.tasks}
          allGroups={allGroups}
          userRole={userRole}
          onRefresh={load}
          onOpenTask={onOpenTask}
          onEdit={g => setEditGroup(g)}
          onArchive={archiveGroup}
          onDelete={deleteGroup}
        />
      ))}

      {/* Ungrouped */}
      {(data?.ungrouped?.length ?? 0) > 0 && (
        <TaskGroupColumn
          group={null}
          tasks={data?.ungrouped || []}
          allGroups={allGroups}
          userRole={userRole}
          onRefresh={load}
          onOpenTask={onOpenTask}
        />
      )}

      {/* Modals */}
      {showCreate && (
        <CreateGroupModal
          brandId={brandId}
          onCreated={load}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editGroup && (
        <CreateGroupModal
          brandId={brandId}
          editGroup={editGroup}
          onCreated={load}
          onClose={() => setEditGroup(null)}
        />
      )}
    </div>
  );
}
