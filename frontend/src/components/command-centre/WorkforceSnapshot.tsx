'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WorkforceWidget, workforceApi } from '@/lib/workforce-api';

// ── Widget colours ─────────────────────────────────────────────────
const WIDGET_COLOURS: Record<WorkforceWidget['id'], {
  bg: string; border: string; accent: string; iconBg: string;
}> = {
  headcount: {
    bg:     'rgba(109,40,217,0.06)',
    border: 'rgba(109,40,217,0.18)',
    accent: '#c4b5fd',
    iconBg: 'rgba(109,40,217,0.15)',
  },
  birthdays: {
    bg:     'rgba(244,63,94,0.06)',
    border: 'rgba(244,63,94,0.18)',
    accent: '#fda4af',
    iconBg: 'rgba(244,63,94,0.12)',
  },
  leave: {
    bg:     'rgba(2,132,199,0.06)',
    border: 'rgba(2,132,199,0.18)',
    accent: '#38bdf8',
    iconBg: 'rgba(2,132,199,0.12)',
  },
  vacancies: {
    bg:     'rgba(217,119,6,0.06)',
    border: 'rgba(217,119,6,0.18)',
    accent: '#fde68a',
    iconBg: 'rgba(217,119,6,0.12)',
  },
};

// ── Tooltip ────────────────────────────────────────────────────────
const Tooltip = ({ widget }: { widget: WorkforceWidget }) => {
  if (!widget.detail?.length) return null;
  const c = WIDGET_COLOURS[widget.id];

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
      transform: 'translateX(-50%)', zIndex: 100,
      background: '#0c0c1e', border: `1px solid ${c.border}`,
      borderRadius: '10px', padding: '12px 14px',
      minWidth: '180px', maxWidth: '240px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      pointerEvents: 'none',
    }}>
      {widget.detail.slice(0, 6).map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            gap: '10px',
            paddingBottom: i < widget.detail.length - 1 ? '8px' : 0,
            marginBottom:  i < widget.detail.length - 1 ? '8px' : 0,
            borderBottom:  i < widget.detail.length - 1
              ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '12px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
              {item.label}
            </p>
            {item.sub && (
              <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                {item.sub}
              </p>
            )}
          </div>
          {item.count != null && (
            <span style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
              fontWeight: 800, color: c.accent, flexShrink: 0,
            }}>
              {item.count}
            </span>
          )}
        </div>
      ))}
      {widget.detail.length > 6 && (
        <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' }}>
          +{widget.detail.length - 6} more
        </p>
      )}
    </div>
  );
};

// ── Single widget card ─────────────────────────────────────────────
const WidgetCard = ({
  widget, onClick,
}: {
  widget: WorkforceWidget;
  onClick: () => void;
}) => {
  const [hovered,  setHovered]  = useState(false);
  const [showTip,  setShowTip]  = useState(false);
  const tipRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const c = WIDGET_COLOURS[widget.id];

  const handleMouseEnter = () => {
    setHovered(true);
    tipRef.current = setTimeout(() => setShowTip(true), 400);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    setShowTip(false);
    if (tipRef.current) clearTimeout(tipRef.current);
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        flex: 1, minWidth: '130px',
        background: hovered ? c.bg : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? c.border : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '11px', padding: '14px 16px',
        cursor: 'pointer', transition: 'all .2s ease',
        position: 'relative',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Icon */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: c.iconBg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: '10px', fontSize: '16px',
      }}>
        {widget.icon}
      </div>

      {/* Primary number */}
      <p style={{
        fontFamily: 'Space Grotesk, sans-serif', fontSize: '26px',
        fontWeight: 800, color: widget.error ? '#64748b' : c.accent,
        lineHeight: 1, margin: '0 0 4px',
      }}>
        {widget.error ? '—' : widget.primary}
      </p>

      {/* Label */}
      <p style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
        color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em',
        margin: 0, lineHeight: 1.3,
      }}>
        {widget.label}
      </p>

      {/* Sub-indicators */}
      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {/* Headcount breakdown */}
        {widget.id === 'headcount' && widget.detail?.slice(0, 3).map((d, i) => (
          <span key={i} style={{
            fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
            color: '#94a3b8', background: 'rgba(255,255,255,0.04)',
            padding: '1px 6px', borderRadius: '3px',
          }}>
            {d.count} {d.label}
          </span>
        ))}

        {/* Upcoming birthdays count */}
        {widget.id === 'birthdays' && widget.upcoming != null && widget.upcoming > 0 && (
          <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#fda4af' }}>
            {widget.upcoming} upcoming
          </span>
        )}

        {/* Pending leave count */}
        {widget.id === 'leave' && widget.pending != null && (
          <span style={{
            fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
            color: widget.pending > 0 ? '#f59e0b' : '#64748b',
          }}>
            {widget.pending > 0 ? `${widget.pending} pending` : 'None pending'}
          </span>
        )}

        {/* Filled this year */}
        {widget.id === 'vacancies' && widget.filledThisYear != null && (
          <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>
            {widget.filledThisYear} filled this year
          </span>
        )}
      </div>

      {/* Tooltip */}
      {showTip && widget.detail?.length > 0 && !widget.error && (
        <Tooltip widget={widget} />
      )}
    </div>
  );
};

// ── WorkforceSnapshot strip ────────────────────────────────────────

interface WorkforceSnapshotProps {
  className?: string;
}

export function WorkforceSnapshot({ className }: WorkforceSnapshotProps) {
  const router    = useRouter();
  const [widgets,    setWidgets]    = useState<WorkforceWidget[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [collapsed,  setCollapsed]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { widgets: w, fetched_at } = await workforceApi.getSnapshot();
      setWidgets(w);
      setLastUpdate(
        new Date(fetched_at).toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos',
        })
      );
    } catch (e) {
      console.error('[WorkforceSnapshot]', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), 60_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  return (
    <div
      className={className}
      style={{
        marginTop: '16px',
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '13px',
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
          <span style={{ fontSize: '13px' }}>🏢</span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em',
          }}>
            Workforce
          </span>
          {!loading && lastUpdate && (
            <span style={{
              fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
              color: '#374151',
            }}>
              · {lastUpdate}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); router.push('/people'); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', color: '#6d28d9', fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
            }}
          >
            People OS →
          </button>
          <span style={{ color: '#374151', fontSize: '11px' }}>
            {collapsed ? '▾' : '▴'}
          </span>
        </div>
      </button>

      {/* Widget grid */}
      {!collapsed && (
        <div style={{ padding: '14px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1, height: '110px', borderRadius: '11px',
                    background: 'rgba(255,255,255,0.02)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
              <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {widgets.map(widget => (
                <WidgetCard
                  key={widget.id}
                  widget={widget}
                  onClick={() => router.push(widget.href)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
