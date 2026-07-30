'use client';

import React from 'react';
import { Dial, HEALTH_COLOURS, DIAL_ICONS } from '@/lib/command-centre-api';
import { SparkLine } from './SparkLine';

interface DialCardProps {
  dial: Dial;
  isExpanded: boolean;
  onClick: () => void;
  isPipeline?: boolean;
}

const DeltaBadge = ({ delta, deltaType, label }: { delta: number | null; deltaType?: string; label?: string }) => {
  if (delta == null) return null;
  const isUp = delta >= 0;
  const colour = isUp ? '#10b981' : '#ef4444';
  const arrow = isUp ? '↑' : '↓';
  const absVal = Math.abs(delta);
  const formatted = deltaType === 'absolute' ? absVal.toFixed(1) : `${absVal}%`;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        color: colour,
        border: `1px solid ${isUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
      }}
      title={label}
    >
      {arrow} {formatted}
    </span>
  );
};

export function DialCard({ dial, isExpanded, onClick }: DialCardProps) {
  if (dial.error) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '130px',
        }}
      >
        <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {dial.label}
        </p>
        <p style={{ fontSize: '12px', color: '#ef4444', marginTop: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
          Load error
        </p>
      </div>
    );
  }

  const hc = HEALTH_COLOURS[dial.health];
  const icon = DIAL_ICONS[dial.id];
  const sparkColour = dial.health === 'green' ? '#10b981' : dial.health === 'amber' ? '#f59e0b' : '#6d28d9';

  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset',
        display: 'flex',
        flexDirection: 'column',
        background: isExpanded ? hc.bg : 'rgba(255,255,255,0.025)',
        border: `1px solid ${isExpanded ? hc.border : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '14px',
        padding: '18px 20px 16px',
        cursor: 'pointer',
        transition: 'all .2s ease',
        minHeight: '130px',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'left',
        width: '100%',
        boxSizing: 'border-box',
      }}
      onMouseEnter={e => {
        if (!isExpanded) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={e => {
        if (!isExpanded) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Health colour strip — top edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: hc.strip,
          opacity: dial.health === 'green' ? 0.6 : 1,
          borderRadius: '14px 14px 0 0',
        }}
      />

      {/* Header row: label + delta */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p
          style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '.1em',
            lineHeight: 1.4,
          }}
        >
          {icon} {dial.label}
        </p>
        <DeltaBadge delta={dial.delta} deltaType={dial.delta_type} label={dial.delta_label} />
      </div>

      {/* Main value */}
      <p
        style={{
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: dial.display.length > 8 ? '20px' : '26px',
          fontWeight: 800,
          color: hc.text,
          lineHeight: 1.15,
          marginBottom: '4px',
          letterSpacing: '-0.02em',
        }}
      >
        {dial.display || '—'}
      </p>

      {/* Sub label */}
      <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4, fontFamily: 'Inter, sans-serif' }}>
        {dial.sub}
      </p>
      {dial.sub2 && (
        <p style={{ fontSize: '11px', color: '#475569', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
          {dial.sub2}
        </p>
      )}

      {/* Sparkline */}
      {dial.sparkline && dial.sparkline.length >= 2 && (
        <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <SparkLine data={dial.sparkline} colour={sparkColour} width={72} height={24} />
        </div>
      )}

      {/* Expand indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '14px',
          fontSize: '10px',
          color: '#374151',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {isExpanded ? '▴' : '▾'}
      </div>
    </button>
  );
}
