'use client';

import React, { useState } from 'react';

// ── Shared colour palette ──────────────────────────────────────────

export const GROUP_COLORS = [
  { hex: '#6d28d9', label: 'Violet'  },
  { hex: '#10b981', label: 'Green'   },
  { hex: '#f59e0b', label: 'Amber'   },
  { hex: '#f43f5e', label: 'Red'     },
  { hex: '#3b82f6', label: 'Blue'    },
  { hex: '#ec4899', label: 'Pink'    },
  { hex: '#14b8a6', label: 'Teal'    },
  { hex: '#f97316', label: 'Orange'  },
];

// ═══════════════════════════════════════════════════════════════════
// CreateGroupModal
// ═══════════════════════════════════════════════════════════════════

interface CreateGroupModalProps {
  brandId:    string;
  onCreated:  (group: { id: string; name: string; color: string }) => void;
  onClose:    () => void;
  // Pass pre-loaded group for editing (rename/recolor)
  editGroup?: { id: string; name: string; color: string } | null;
}

export function CreateGroupModal({ brandId, onCreated, onClose, editGroup }: CreateGroupModalProps) {
  const [name,       setName]       = useState(editGroup?.name  || '');
  const [color,      setColor]      = useState(editGroup?.color || '#6d28d9');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
  });

  const save = async () => {
    if (!name.trim()) return setError('Group name is required');
    setSaving(true);
    setError(null);

    try {
      const url    = editGroup
        ? `${API}/api/task-groups/${editGroup.id}`
        : `${API}/api/task-groups`;
      const method = editGroup ? 'PATCH' : 'POST';
      const body   = editGroup
        ? JSON.stringify({ brand_id: brandId, name: name.trim(), color })
        : JSON.stringify({ brand_id: brandId, name: name.trim(), color });

      const res  = await fetch(url, { method, headers: headers(), body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');

      onCreated(editGroup ? { ...editGroup, name: name.trim(), color } : json.group);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 80 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 90, width: '360px', maxWidth: 'calc(100vw - 32px)',
        background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', padding: '24px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '20px' }}>
          {editGroup ? 'Edit Group' : 'New Group'}
        </h3>

        {/* Name input */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>
            Group name
          </p>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="e.g. Q3 Campaign, Always On, Brand Refresh"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
              padding: '9px 12px', fontSize: '13px', color: '#f1f5f9',
              fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Colour picker */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '8px' }}>
            Colour
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {GROUP_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={() => setColor(c.hex)}
                title={c.label}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: c.hex, cursor: 'pointer',
                  border: color === c.hex ? `3px solid white` : '2px solid transparent',
                  outline: color === c.hex ? `2px solid ${c.hex}` : 'none',
                  transition: 'all .15s',
                }}
              />
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            style={{ padding: '8px 20px', borderRadius: '7px', background: saving ? 'rgba(109,40,217,0.4)' : '#6d28d9', border: 'none', color: 'white', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {saving ? 'Saving…' : editGroup ? 'Save Changes' : 'Create Group'}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MoveTaskMenu
// ═══════════════════════════════════════════════════════════════════

interface Group { id: string; name: string; color: string; }

interface MoveTaskMenuProps {
  taskId:         string;
  currentGroupId: string | null;
  groups:         Group[];
  onMoved:        () => void;
  onClose:        () => void;
}

export function MoveTaskMenu({ taskId, currentGroupId, groups, onMoved, onClose }: MoveTaskMenuProps) {
  const [moving, setMoving] = useState<string | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
  });

  const moveTo = async (groupId: string | null) => {
    setMoving(groupId ?? 'ungrouped');
    try {
      const res  = await fetch(`${API}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ group_id: groupId }),
      });
      if (!res.ok) throw new Error('Move failed');
      onMoved();
      onClose();
    } catch {
      setMoving(null);
    }
  };

  const options = [
    ...groups.filter(g => g.id !== currentGroupId),
    ...(currentGroupId ? [{ id: null, name: 'Remove from group', color: '#475569' }] : []),
  ] as Array<{ id: string | null; name: string; color: string }>;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 70 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: '4px',
        zIndex: 80, minWidth: '180px',
        background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <p style={{ padding: '8px 12px', fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          Move to group
        </p>
        {options.length === 0 ? (
          <p style={{ padding: '10px 12px', fontSize: '12px', color: '#475569' }}>No other groups</p>
        ) : (
          options.map(g => (
            <button
              key={g.id ?? 'ungrouped'}
              onClick={() => moveTo(g.id)}
              disabled={moving !== null}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', color: g.id ? '#f1f5f9' : '#64748b',
                fontFamily: 'Inter, sans-serif',
                opacity: moving !== null ? 0.6 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
              {g.name}
              {moving === (g.id ?? 'ungrouped') && ' …'}
            </button>
          ))
        )}
      </div>
    </>
  );
}
