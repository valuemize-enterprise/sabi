'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WeekVsGoalItem, HEALTH_CONFIG, agencyGoalsApi } from '@/lib/agency-goals-api';

// ── Week vs Goal Panel ────────────────────────────────────────────
// Used in the MD Consolidated Weekly Report view (MDConsolidatedView).
// Shows how the current week's data sits against each annual goal.
// Add this component below the agency summary in the weekly report.

interface WeekVsGoalPanelProps {
  weekLabel?: string;  // e.g. "28 Jul – 3 Aug"
}

export function WeekVsGoalPanel({ weekLabel }: WeekVsGoalPanelProps) {
  const router = useRouter();
  const [deltas,  setDeltas]  = useState<WeekVsGoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    agencyGoalsApi.getWeekVsGoal()
      .then(({ deltas: d }) => setDeltas(d))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        overflow: 'hidden',
        marginBottom: '20px',
      }}
    >
      {/* Panel header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '3px',
          }}>
            Week vs Annual Goals
          </p>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
            Where the agency stands{weekLabel ? ` — ${weekLabel}` : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/agency-goals')}
          style={{
            padding: '6px 14px', borderRadius: '7px',
            background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(109,40,217,0.22)',
            color: '#c4b5fd', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          Full Goals →
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '4px 0' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              Loading goal status…
            </p>
          </div>
        ) : error ? (
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: '12px', color: '#f87171' }}>{error}</p>
          </div>
        ) : (
          deltas.map((item, i) => {
            const hc  = HEALTH_CONFIG[item.health];
            const isLast = i === deltas.length - 1;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 20px',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {/* Health dot */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: hc.strip, flexShrink: 0 }} />

                {/* Icon + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '14px' }}>{item.icon}</span>
                  <div>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '1px' }}>
                      {item.label}
                    </p>
                    {item.note && (
                      <p style={{ fontSize: '11px', color: '#64748b' }}>{item.note}</p>
                    )}
                  </div>
                </div>

                {/* Current value */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: hc.text }}>
                    {item.current || '—'}
                  </p>
                  {item.target && (
                    <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      of {item.target}
                    </p>
                  )}
                </div>

                {/* Progress bar (narrow) */}
                {item.pct != null && (
                  <div style={{ width: '60px', flexShrink: 0 }}>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                      <div style={{
                        height: '100%', borderRadius: '2px', background: hc.strip,
                        width: `${Math.min(100, item.pct)}%`, transition: 'width .5s',
                      }} />
                    </div>
                    <p style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', marginTop: '2px', textAlign: 'right' }}>
                      {item.pct}%
                    </p>
                  </div>
                )}

                {/* Health badge */}
                <div style={{
                  padding: '2px 8px', borderRadius: '4px',
                  background: hc.bg, border: `1px solid ${hc.border}`,
                  fontSize: '10px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                  color: hc.text, flexShrink: 0,
                }}>
                  {hc.label}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
