'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Dial, HEALTH_COLOURS, DIAL_ICONS } from '@/lib/command-centre-api';

interface ExpandedDialPanelProps {
  dial: Dial;
  onClose: () => void;
}

const BarRow = ({ label, value, maxValue, unit, sub, colour }: {
  label: string;
  value: number;
  maxValue: number;
  unit: string;
  sub?: string;
  colour: string;
}) => {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  const formatted = unit === '₦'
    ? `₦${Number(value).toLocaleString('en-NG')}`
    : unit === '%'
    ? `${Math.round(value)}%`
    : `${value} ${unit}`;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: colour, fontWeight: 700 }}>
            {formatted}
          </span>
          {sub && (
            <span style={{ fontSize: '11px', color: '#64748b' }}>{sub}</span>
          )}
        </div>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
        <div
          style={{
            height: '100%',
            borderRadius: '3px',
            background: colour,
            width: `${pct}%`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
};

export function ExpandedDialPanel({ dial, onClose }: ExpandedDialPanelProps) {
  const router = useRouter();
  const hc = HEALTH_COLOURS[dial.health];
  const icon = DIAL_ICONS[dial.id];

  const maxValue = dial.expanded_data.length
    ? Math.max(...dial.expanded_data.map(r => r.value), 1)
    : 1;

  const barColour = hc.text;

  return (
    <div
      style={{
        background: hc.bg,
        border: `1px solid ${hc.border}`,
        borderRadius: '14px',
        padding: '20px 24px',
        marginTop: '0',
        animation: 'slideDown 0.18s ease',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <p
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '14px',
              fontWeight: 700,
              color: hc.text,
              marginBottom: '2px',
            }}
          >
            {icon} {dial.label} — Breakdown
          </p>
          <p style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            Click any bar to navigate · {dial.delta_label || 'This week vs last week'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {dial.link_to && (
            <button
              onClick={() => router.push(dial.link_to!)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: 'rgba(109,40,217,0.15)',
                border: '1px solid rgba(109,40,217,0.25)',
                color: '#c4b5fd',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              View full →
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer', padding: '2px' }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Bar chart */}
      {dial.expanded_data.length > 0 ? (
        <div>
          {dial.expanded_data.map((row, i) => (
            <BarRow
              key={i}
              label={row.label}
              value={row.value}
              maxValue={maxValue}
              unit={row.unit}
              sub={row.sub}
              colour={barColour}
            />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          No breakdown data available
        </p>
      )}

      {/* Pipeline-specific: stale warning */}
      {dial.id === 'pipeline' && dial.raw?.staleCount > 0 && (
        <div
          style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#fbbf24',
          }}
        >
          ⚠ {dial.raw.staleCount} deal{dial.raw.staleCount !== 1 ? 's' : ''} in "Awaiting Response" for 14+ days — follow-up recommended before Friday's report.
        </div>
      )}

      {/* Creative review: overdue warning */}
      {dial.id === 'creative_review' && dial.raw?.overdue > 0 && (
        <div
          style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#fca5a5',
          }}
        >
          🚨 {dial.raw.overdue} item{dial.raw.overdue !== 1 ? 's' : ''} overdue in the Creative Review Queue (&gt;48h). The Creative Director needs to action these today.
        </div>
      )}
    </div>
  );
}
