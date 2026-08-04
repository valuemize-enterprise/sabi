'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GoalPulseItem, HEALTH_CONFIG, agencyGoalsApi } from '@/lib/agency-goals-api';

// ── Goal Pulse Strip ──────────────────────────────────────────────
// Sits below the 8 Command Centre dials in Live mode.
// 6 coloured chips — one per goal category.
// Click any → navigate to Agency Goals page.
// Polls alongside the Command Centre's 60-second refresh.

interface GoalPulseStripProps {
  className?: string;
}

export function GoalPulseStrip({ className }: GoalPulseStripProps) {
  const router = useRouter();
  const [pulse,     setPulse]     = useState<GoalPulseItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { pulse: p } = await agencyGoalsApi.getPulse();
      setPulse(p);
    } catch { /* silent fail — strip shows stale data */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Count categories by health for the summary label
  const counts = { green: 0, amber: 0, red: 0 };
  pulse.forEach(p => { if (p.health) counts[p.health]++; });
  const summaryColour = counts.red > 0 ? '#ef4444' : counts.amber > 0 ? '#f59e0b' : '#10b981';

  return (
    <div
      className={className}
      style={{
        marginTop: '16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Strip header */}
      <button
        onClick={() => setCollapsed(p => !p)}
        style={{
          all: 'unset', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '10px 16px',
          cursor: 'pointer', width: '100%', boxSizing: 'border-box',
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: loading ? '#374151' : summaryColour }} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em' }}>
            Goal Pulse
          </span>
          {!loading && pulse.length > 0 && (
            <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
              {counts.green}✓ {counts.amber > 0 ? `${counts.amber}⚠` : ''} {counts.red > 0 ? `${counts.red}✗` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); router.push('/agency-goals'); }}
            style={{
              fontSize: '11px', color: '#6d28d9', background: 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600,
            }}
          >
            View all →
          </button>
          <span style={{ color: '#374151', fontSize: '11px' }}>{collapsed ? '▾' : '▴'}</span>
        </div>
      </button>

      {/* Pulse chips */}
      {!collapsed && (
        <div style={{ padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '36px', width: '140px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))
          ) : (
            pulse.map(item => {
              const hc = HEALTH_CONFIG[item.health];
              return (
                <button
                  key={item.id}
                  onClick={() => router.push('/agency-goals')}
                  style={{
                    all: 'unset',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: hc.bg, border: `1px solid ${hc.border}`,
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  title={item.sub}
                >
                  <span style={{ fontSize: '13px' }}>{item.icon}</span>
                  <div>
                    <p style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1px',
                    }}>
                      {item.label}
                    </p>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: hc.text }}>
                      {item.display || '—'}
                    </p>
                  </div>
                  {/* Mini progress bar */}
                  {item.pct != null && (
                    <div style={{ width: '28px', marginLeft: '4px' }}>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                        <div style={{ height: '100%', borderRadius: '2px', background: hc.strip, width: `${item.pct}%`, transition: 'width .5s' }} />
                      </div>
                      <p style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', marginTop: '2px', textAlign: 'right' }}>
                        {item.pct}%
                      </p>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
    </div>
  );
}
