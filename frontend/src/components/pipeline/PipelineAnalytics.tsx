'use client';

import React from 'react';
import { PipelineAnalytics as PipelineAnalyticsType, formatNaira } from '@/lib/pipeline-api';

interface PipelineAnalyticsProps {
  analytics: PipelineAnalyticsType;
  loading?: boolean;
}

const StatCard = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '16px 20px',
    }}
  >
    <p
      style={{
        fontSize: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        marginBottom: '8px',
      }}
    >
      {label}
    </p>
    <p
      style={{
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '22px',
        fontWeight: 700,
        color: accent || '#f1f5f9',
        marginBottom: sub ? '4px' : 0,
      }}
    >
      {value}
    </p>
    {sub && (
      <p style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
        {sub}
      </p>
    )}
  </div>
);

export function PipelineAnalytics({ analytics, loading }: PipelineAnalyticsProps) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              height: '88px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  const stale = analytics.staleness;
  const stalenessLabel =
    stale.red > 0
      ? `${stale.red} critical`
      : stale.amber > 0
      ? `${stale.amber} need attention`
      : 'All up to date';
  const stalenessColour = stale.red > 0 ? '#ef4444' : stale.amber > 0 ? '#f59e0b' : '#10b981';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '28px' }}>
      <StatCard
        label="Pipeline Value"
        value={formatNaira(analytics.total_pipeline_value)}
        sub={`${analytics.active_count} active deal${analytics.active_count !== 1 ? 's' : ''}`}
        accent="#6d28d9"
      />
      <StatCard
        label="Weighted Forecast"
        value={formatNaira(analytics.weighted_forecast)}
        sub="Probability-adjusted"
        accent="#8b5cf6"
      />
      <StatCard
        label="Avg Deal Size"
        value={analytics.avg_deal_size ? formatNaira(analytics.avg_deal_size) : '—'}
        sub="Estimated values only"
      />
      <StatCard
        label="Win Rate (Quarter)"
        value={`${analytics.win_rate_pct}%`}
        sub={`${analytics.won_count} won of ${analytics.closed_count} closed`}
        accent="#10b981"
      />
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '16px 20px',
        }}
      >
        <p
          style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            marginBottom: '8px',
          }}
        >
          Staleness
        </p>
        <p
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '16px',
            fontWeight: 700,
            color: stalenessColour,
            marginBottom: '8px',
          }}
        >
          {stalenessLabel}
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(16,185,129,0.1)',
              color: '#10b981',
            }}
          >
            ● {stale.green}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(245,158,11,0.1)',
              color: '#f59e0b',
            }}
          >
            ● {stale.amber}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
            }}
          >
            ● {stale.red}
          </span>
        </div>
      </div>
    </div>
  );
}
