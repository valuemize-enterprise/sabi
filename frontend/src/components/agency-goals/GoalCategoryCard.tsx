'use client';

import React, { useState } from 'react';
import {
  GoalCategory, GoalTarget, HEALTH_CONFIG,
  CATEGORY_DESCRIPTIONS, agencyGoalsApi,
} from '@/lib/agency-goals-api';
import { RevenueWaterfall } from '@/components/pipeline/RevenueWaterfall';

interface GoalCategoryCardProps {
  category:       GoalCategory;
  isSuperAdmin:   boolean;
  onTargetSaved?: () => void;
}

// ── Progress bar ──────────────────────────────────────────────────
const ProgressBar = ({ pct, colour }: { pct: number | null; colour: string }) => {
  if (pct == null) return null;
  return (
    <div style={{
      height: '5px', background: 'rgba(255,255,255,0.06)',
      borderRadius: '3px', marginTop: '8px', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: '3px', background: colour,
        width: `${Math.min(100, pct)}%`, transition: 'width .6s ease',
      }} />
    </div>
  );
};

// ── Inline target editor ──────────────────────────────────────────
const TargetEditor = ({
  categoryId, currentTargets, onSaved,
}: {
  categoryId: string;
  currentTargets: GoalTarget[];
  onSaved: () => void;
}) => {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [rows, setRows]     = useState<GoalTarget[]>(
    currentTargets.length > 0 ? currentTargets : [
      { category: categoryId as any, title: '', target_value: 0, unit: '', period_label: String(new Date().getFullYear()) },
    ]
  );

  const update = (i: number, field: keyof GoalTarget, value: string | number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(rows.filter(r => r.title).map(r => agencyGoalsApi.upsertTarget(r)));
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '6px 10px', fontSize: '12px',
    color: '#f1f5f9', fontFamily: 'Inter, sans-serif', outline: 'none',
  };

  return (
    <div style={{ marginTop: '14px', padding: '14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
      <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        Set Targets for {new Date().getFullYear()}
      </p>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px', gap: '8px', marginBottom: '8px' }}>
          <input style={inputStyle} placeholder="Target label (e.g. New clients this year)" value={row.title} onChange={e => update(i, 'title', e.target.value)} />
          <input style={inputStyle} type="number" placeholder="Target value" value={row.target_value || ''} onChange={e => update(i, 'target_value', Number(e.target.value))} />
          <input style={inputStyle} placeholder="Unit" value={row.unit} onChange={e => update(i, 'unit', e.target.value)} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
        <button
          onClick={() => setRows(prev => [...prev, { category: categoryId as any, title: '', target_value: 0, unit: '', period_label: String(new Date().getFullYear()) }])}
          style={{ fontSize: '11px', color: '#6d28d9', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          + Add target
        </button>
        <button
          onClick={handleSave} disabled={saving}
          style={{
            padding: '5px 14px', borderRadius: '6px', background: '#6d28d9',
            border: 'none', color: 'white', fontSize: '12px', fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif', marginLeft: 'auto',
          }}
        >
          {saving ? 'Saving…' : 'Save Targets'}
        </button>
      </div>
      {error && <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>{error}</p>}
    </div>
  );
};

// ── Main card ─────────────────────────────────────────────────────
export function GoalCategoryCard({ category: cat, isSuperAdmin, onTargetSaved }: GoalCategoryCardProps) {
  const [expanded,      setExpanded]      = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  const hc = HEALTH_CONFIG[cat.health];

  return (
    <div
      style={{
        background:    expanded ? hc.bg : 'rgba(255,255,255,0.025)',
        border:        `1px solid ${expanded ? hc.border : 'rgba(255,255,255,0.07)'}`,
        borderRadius:  '14px',
        overflow:      'hidden',
        transition:    'all .2s ease',
      }}
    >
      {/* Colour strip */}
      <div style={{ height: '3px', background: hc.strip }} />

      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded(p => !p)}
        style={{
          all: 'unset', display: 'block', padding: '20px 22px 14px',
          cursor: 'pointer', width: '100%', boxSizing: 'border-box', textAlign: 'left',
        }}
      >
        {/* Icon + label + health badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>{cat.icon}</span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
              color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em',
            }}>
              {cat.label}
            </span>
          </div>
          <span style={{
            fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
            background: `${hc.text}15`, color: hc.text,
          }}>
            {hc.label}
          </span>
        </div>

        {/* Primary metric */}
        {cat.error ? (
          <p style={{ fontSize: '13px', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
            Data unavailable
          </p>
        ) : (
          <>
            <p style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px',
              fontWeight: 800, color: hc.text, lineHeight: 1.15, marginBottom: '4px',
            }}>
              {cat.primary.display || '—'}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
              {cat.primary.label}
            </p>
            {cat.primary.sub && (
              <p style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                {cat.primary.sub}
              </p>
            )}
            <ProgressBar pct={cat.primary.pct} colour={hc.strip} />
          </>
        )}
      </button>

      {/* Expanded content */}
      {expanded && !cat.error && (
        <div style={{ padding: '0 22px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.65, marginTop: '14px', marginBottom: '16px' }}>
            {CATEGORY_DESCRIPTIONS[cat.id]}
          </p>

          {/* Secondary metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
            {cat.secondaries.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  background: s.alert ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${s.alert ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: s.pct != null ? '6px' : '0' }}>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{s.label}</span>
                  <span style={{
                    fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 700,
                    color: s.alert ? '#f87171' : '#f1f5f9',
                  }}>
                    {s.display}
                  </span>
                </div>
                {s.sub && <p style={{ fontSize: '11px', color: '#64748b', marginBottom: s.pct != null ? '4px' : '0' }}>{s.sub}</p>}
                {s.pct != null && (
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '2px', background: s.alert ? '#ef4444' : hc.strip, width: `${Math.min(100, s.pct)}%`, transition: 'width .6s ease' }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {cat.id === 'new_business' && (
            <div style={{ marginTop: '20px' }}>
              <RevenueWaterfall months={6} compact />
            </div>
          )}

          {/* Set targets (Super Admin only) */}
          {isSuperAdmin && (
            <button
              onClick={() => setEditingTarget(p => !p)}
              style={{
                padding: '7px 14px', borderRadius: '7px',
                background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(109,40,217,0.2)',
                color: '#c4b5fd', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {editingTarget ? '▴ Hide targets' : '✏ Edit targets'}
            </button>
          )}

          {editingTarget && isSuperAdmin && (
            <TargetEditor
              categoryId={cat.id}
              currentTargets={[]}
              onSaved={() => { setEditingTarget(false); onTargetSaved?.(); }}
            />
          )}
        </div>
      )}
    </div>
  );
}
