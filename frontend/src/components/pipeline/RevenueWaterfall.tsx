'use client';

import React, { useState, useEffect } from 'react';
import {
  pipelineAnalyticsApi, WaterfallData, WaterfallMonth,
  fmtNaira, fmtNairaCompact, LAYER_COLOURS,
} from '@/lib/pipeline-analytics-api';

// ── Bar component ──────────────────────────────────────────────────
const WaterfallBar = ({
  month, maxValue, monthlyTarget, barWidth,
}: {
  month:         WaterfallMonth;
  maxValue:      number;
  monthlyTarget: number | null;
  barWidth:      number;
}) => {
  const [hovered, setHovered] = useState(false);
  const total     = month.confirmed + month.probable + month.possible;
  const toHeight  = (v: number) => maxValue > 0 ? (v / maxValue) * 100 : 0;
  const onTarget  = monthlyTarget != null && (month.confirmed + month.probable) >= monthlyTarget;
  const atRisk    = monthlyTarget != null && !onTarget && total > 0;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: `${barWidth}%`, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && total > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)', marginBottom: '8px',
          background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px', padding: '10px 14px', zIndex: 30,
          minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>
            {month.label}
          </p>
          {month.confirmed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: LAYER_COLOURS.confirmed.fill }}>Confirmed</span>
              <span style={{ fontSize: '11px', color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNairaCompact(month.confirmed)}</span>
            </div>
          )}
          {month.probable > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: LAYER_COLOURS.probable.fill }}>Probable</span>
              <span style={{ fontSize: '11px', color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNairaCompact(month.probable)}</span>
            </div>
          )}
          {month.possible > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Possible</span>
              <span style={{ fontSize: '11px', color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace' }}>{fmtNairaCompact(month.possible)}</span>
            </div>
          )}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: '11px', color: '#f1f5f9', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{fmtNairaCompact(total)}</span>
          </div>
          {monthlyTarget != null && (
            <div style={{ marginTop: '4px', fontSize: '10px', color: onTarget ? '#10b981' : '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
              {onTarget ? '✓ On target' : `${fmtNairaCompact(monthlyTarget - month.confirmed - month.probable)} below target`}
            </div>
          )}
        </div>
      )}

      {/* Stacked bar — positioned at the bottom of the chart area */}
      <div style={{ width: '70%', position: 'relative', marginBottom: '6px' }}>
        {/* Possible layer */}
        {month.possible > 0 && (
          <div style={{
            height: `${toHeight(month.possible)}px`,
            background: LAYER_COLOURS.possible.fill,
            opacity: 0.5,
            borderRadius: '3px 3px 0 0',
          }} />
        )}
        {/* Probable layer */}
        {month.probable > 0 && (
          <div style={{
            height: `${toHeight(month.probable)}px`,
            background: LAYER_COLOURS.probable.fill,
          }} />
        )}
        {/* Confirmed layer */}
        {month.confirmed > 0 && (
          <div style={{
            height: `${toHeight(month.confirmed)}px`,
            background: LAYER_COLOURS.confirmed.fill,
            borderRadius: total === month.confirmed ? '3px 3px 0 0' : '0',
          }} />
        )}
        {/* At-risk indicator */}
        {atRisk && (
          <div style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#f59e0b', border: '2px solid #0d0d1a',
          }} />
        )}
      </div>

      {/* Month label */}
      <p style={{
        fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
        color: hovered ? '#f1f5f9' : '#64748b',
        textAlign: 'center', marginBottom: 0, lineHeight: 1.3,
      }}>
        {month.label.split(' ')[0]}<br />
        <span style={{ color: '#374151' }}>{month.label.split(' ')[1]}</span>
      </p>
    </div>
  );
};

// ── Legend ─────────────────────────────────────────────────────────
const Legend = () => (
  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
    {Object.entries(LAYER_COLOURS).map(([key, { fill, label }]) => (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: fill, opacity: key === 'possible' ? 0.5 : 1 }} />
        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
      </div>
    ))}
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '20px', height: '1px', background: '#6d28d9', borderTop: '1px dashed #6d28d9' }} />
      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>Target</span>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────
interface RevenueWaterfallProps {
  months?: 3 | 6 | 12;
  compact?: boolean;
}

export function RevenueWaterfall({ months = 6, compact = false }: RevenueWaterfallProps) {
  const [data,    setData]    = useState<WaterfallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [mCount,  setMCount]  = useState<3 | 6 | 12>(months);

  const CHART_HEIGHT = compact ? 160 : 220;

  const load = async (m: number) => {
    setLoading(true);
    setError(null);
    try {
      const d = await pipelineAnalyticsApi.getWaterfall(m);
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load waterfall');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(mCount); }, [mCount]);

  const maxBarValue = data
    ? Math.max(...data.months.map(m => m.confirmed + m.probable + m.possible), data.monthly_target || 0) * 1.1
    : 0;

  // Target line position as % of chart height
  const targetPct = data?.monthly_target && maxBarValue > 0
    ? (data.monthly_target / maxBarValue) * 100
    : null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px',
      }}>
        <div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '4px' }}>
            Revenue Waterfall Forecast
          </p>
          {data && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Weighted total: <strong style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk, sans-serif' }}>{fmtNairaCompact(data.summary.total_weighted)}</strong>
              </span>
              {data.monthly_target && (
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Monthly target: <strong style={{ color: '#6d28d9', fontFamily: 'Space Grotesk, sans-serif' }}>{fmtNairaCompact(data.monthly_target)}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Month range toggle */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', padding: '3px' }}>
          {([3, 6, 12] as const).map(m => (
            <button
              key={m}
              onClick={() => setMCount(m)}
              style={{
                padding: '4px 10px', borderRadius: '5px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                border: 'none',
                background: mCount === m ? 'rgba(109,40,217,0.25)' : 'transparent',
                color: mCount === m ? '#c4b5fd' : '#64748b',
              }}
            >
              {m}M
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <div style={{ height: `${CHART_HEIGHT}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '80px' }}>
              {Array.from({ length: mCount }).map((_, i) => (
                <div key={i} style={{
                  width: '28px', borderRadius: '3px 3px 0 0',
                  height: `${20 + Math.random() * 60}%`,
                  background: 'rgba(255,255,255,0.04)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }} />
              ))}
              <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.6}}`}</style>
            </div>
          </div>
        ) : error ? (
          <div style={{ height: `${CHART_HEIGHT}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '13px', color: '#475569' }}>{error}</p>
          </div>
        ) : data && (
          <div>
            {/* Chart */}
            <div style={{
              position: 'relative', height: `${CHART_HEIGHT}px`,
              display: 'flex', alignItems: 'flex-end',
            }}>
              {/* Y-axis labels */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, width: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                {[maxBarValue, maxBarValue * 0.75, maxBarValue * 0.5, maxBarValue * 0.25, 0].map((v, i) => (
                  <p key={i} style={{ fontSize: '9px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', paddingRight: '4px' }}>
                    {v > 0 ? fmtNairaCompact(Math.round(v)) : '₦0'}
                  </p>
                ))}
              </div>

              {/* Gridlines */}
              <div style={{ position: 'absolute', left: '52px', right: 0, top: 0, bottom: 20, pointerEvents: 'none' }}>
                {[0, 25, 50, 75, 100].map(pct => (
                  <div key={pct} style={{
                    position: 'absolute', left: 0, right: 0,
                    bottom: `${pct}%`, height: '1px',
                    background: 'rgba(255,255,255,0.04)',
                  }} />
                ))}
                {/* Target line */}
                {targetPct != null && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0,
                    bottom: `${targetPct}%`,
                    borderTop: '1px dashed rgba(109,40,217,0.6)',
                    display: 'flex', justifyContent: 'flex-end',
                  }}>
                    <span style={{ fontSize: '9px', color: '#6d28d9', fontFamily: 'JetBrains Mono, monospace', background: '#0d0d1a', paddingLeft: '4px', transform: 'translateY(-50%)' }}>
                      Target
                    </span>
                  </div>
                )}
              </div>

              {/* Bars */}
              <div style={{ marginLeft: '52px', display: 'flex', alignItems: 'flex-end', flex: 1, gap: 0, height: `${CHART_HEIGHT - 24}px` }}>
                {data.months.map(month => (
                  <WaterfallBar
                    key={month.key}
                    month={month}
                    maxValue={maxBarValue}
                    monthlyTarget={data.monthly_target}
                    barWidth={100 / data.months.length}
                  />
                ))}
              </div>
            </div>

            {/* Legend + summary */}
            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <Legend />
              <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                Peak: <strong style={{ color: '#f1f5f9' }}>{data.summary.peak_month}</strong> at {fmtNairaCompact(data.summary.peak_value)}
              </p>
            </div>

            {/* Summary strip */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[
                { label: 'Confirmed', value: data.summary.total_confirmed, colour: LAYER_COLOURS.confirmed.fill },
                { label: 'Probable',  value: data.summary.total_probable,  colour: LAYER_COLOURS.probable.fill  },
                { label: 'Possible',  value: data.summary.total_possible,  colour: '#64748b'                    },
              ].map(({ label, value, colour }) => (
                <div key={label} style={{
                  flex: 1, minWidth: '100px', padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}>
                  <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: colour, marginBottom: '2px' }}>
                    {fmtNairaCompact(value)}
                  </p>
                  <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
