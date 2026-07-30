'use client';

import React, { useState, useCallback } from 'react';
import {
  IntelligenceReport, WinPatterns, LossPatterns,
  ConversionForecast, QuarterRow,
  SOURCE_DISPLAY, SERVICE_DISPLAY, STAGE_DISPLAY,
  LOSS_REASON_COLOURS, formatNaira,
  pipelinePhase3Api,
} from '@/lib/pipeline-phase3-api';

interface ARIAIntelligencePanelProps {
  isLeadership: boolean;
}

// ── Mini bar component ────────────────────────────────────────────

const MiniBar = ({ value, max, colour, label, sub }: {
  value: number; max: number; colour: string; label: string; sub?: string;
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{label}</span>
        {sub && <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{sub}</span>}
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
        <div style={{ height: '100%', borderRadius: '2px', background: colour, width: `${pct}%`, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
};

// ── Tab types ─────────────────────────────────────────────────────
type Tab = 'forecast' | 'wins' | 'losses' | 'quarters';

// ── Main component ────────────────────────────────────────────────
export function ARIAIntelligencePanel({ isLeadership }: ARIAIntelligencePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('forecast');
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (report) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const data = await pipelinePhase3Api.getFullReport();
      setReport(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load intelligence');
    } finally {
      setLoading(false);
    }
  }, [report]);

  const handleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next && !report) load();
  };

  if (!isLeadership) return null;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'Inter, sans-serif',
    background: activeTab === t ? 'rgba(109,40,217,0.2)' : 'transparent',
    color: activeTab === t ? '#c4b5fd' : '#64748b',
    transition: 'all .15s',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Toggle button */}
      <button
        onClick={handleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          borderRadius: '10px',
          background: isExpanded ? 'rgba(109,40,217,0.1)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isExpanded ? 'rgba(109,40,217,0.25)' : 'rgba(255,255,255,0.07)'}`,
          cursor: 'pointer',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          color: isExpanded ? '#c4b5fd' : '#64748b',
          transition: 'all .2s',
          width: 'auto',
        }}
      >
        <span style={{ fontSize: '14px' }}>✦</span>
        ARIA Intelligence
        {report && (
          <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', padding: '1px 6px', borderRadius: '4px', background: 'rgba(109,40,217,0.15)', color: '#a78bfa', marginLeft: '4px' }}>
            {new Date(report.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#475569', fontSize: '12px' }}>
          {isExpanded ? '▴ Collapse' : '▾ Expand'}
        </span>
      </button>

      {/* Panel body */}
      {isExpanded && (
        <div
          style={{
            marginTop: '8px',
            background: 'rgba(109,40,217,0.05)',
            border: '1px solid rgba(109,40,217,0.18)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {/* Tabs */}
          <div style={{ padding: '14px 20px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '4px', overflowX: 'auto' }}>
            <button style={tabStyle('forecast')} onClick={() => setActiveTab('forecast')}>📡 Forecast</button>
            <button style={tabStyle('wins')}     onClick={() => setActiveTab('wins')}>🏆 Win Patterns</button>
            <button style={tabStyle('losses')}   onClick={() => setActiveTab('losses')}>📉 Loss Analysis</button>
            <button style={tabStyle('quarters')} onClick={() => setActiveTab('quarters')}>📊 QoQ</button>
            <button
              onClick={load}
              disabled={loading}
              style={{ marginLeft: 'auto', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#6d28d9', background: 'none', border: 'none', cursor: 'pointer', paddingBottom: '14px' }}
            >
              {loading ? '↺ Loading…' : '↺ Refresh'}
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {loading && !report && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', marginBottom: '6px' }}>
                  ✦ ARIA is analysing your pipeline…
                </p>
                <p style={{ fontSize: '11px', color: '#374151' }}>
                  Querying patterns across {new Date().getFullYear()} · Generating insights · ~5 seconds
                </p>
              </div>
            )}

            {error && (
              <p style={{ fontSize: '13px', color: '#f87171', fontFamily: 'JetBrains Mono, monospace' }}>
                {error}
              </p>
            )}

            {report && (
              <>
                {/* ── FORECAST TAB ─────────────────────────────── */}
                {activeTab === 'forecast' && <ForecastTab forecast={report.forecast} />}

                {/* ── WINS TAB ─────────────────────────────────── */}
                {activeTab === 'wins' && <WinsTab patterns={report.win_patterns} />}

                {/* ── LOSSES TAB ───────────────────────────────── */}
                {activeTab === 'losses' && <LossesTab patterns={report.loss_patterns} />}

                {/* ── QoQ TAB ──────────────────────────────────── */}
                {activeTab === 'quarters' && <QuartersTab quarters={report.quarter_summary} />}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Forecast Tab ──────────────────────────────────────────────────

function ForecastTab({ forecast }: { forecast: ConversionForecast }) {
  const maxWeighted = Math.max(...forecast.stages.map(s => s.weighted_value), 1);

  return (
    <div>
      {/* ARIA narrative */}
      {forecast.aria_narrative && (
        <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: '9px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', marginBottom: '6px' }}>✦ ARIA</p>
          <p style={{ fontSize: '13px', color: '#a78bfa', lineHeight: 1.65 }}>{forecast.aria_narrative}</p>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Pipeline', value: formatNaira(forecast.total_raw_pipeline), sub: `${forecast.total_active_deals} active deals` },
          { label: 'Weighted Forecast', value: formatNaira(forecast.total_weighted_forecast), sub: 'Probability-adjusted', accent: '#6d28d9' },
          { label: 'High Confidence', value: formatNaira(forecast.high_confidence_value), sub: 'Negotiating stage (70%)', accent: '#10b981' },
        ].map(card => (
          <div key={card.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px' }}>
            <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '7px' }}>{card.label}</p>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: card.accent || '#f1f5f9', marginBottom: '3px' }}>{card.value}</p>
            <p style={{ fontSize: '11px', color: '#64748b' }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
        Weighted Value by Stage
      </p>
      {forecast.stages.map(s => (
        <MiniBar
          key={s.stage}
          label={`${STAGE_DISPLAY[s.stage] || s.stage} (${s.weight_pct}%)`}
          value={s.weighted_value}
          max={maxWeighted}
          colour="#6d28d9"
          sub={`${s.deal_count}d · ${formatNaira(s.weighted_value)}`}
        />
      ))}
      <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '10px' }}>
        {forecast.note}
      </p>
    </div>
  );
}

// ── Wins Tab ──────────────────────────────────────────────────────

function WinsTab({ patterns }: { patterns: WinPatterns }) {
  if (!patterns.total_wins) {
    return <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>No won deals in the last 90 days yet.</p>;
  }

  const maxWins = Math.max(...patterns.by_source.map(s => s.win_count), 1);

  return (
    <div>
      {patterns.aria_narrative && (
        <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: '9px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', marginBottom: '6px' }}>✦ ARIA</p>
          <p style={{ fontSize: '13px', color: '#a78bfa', lineHeight: 1.65 }}>{patterns.aria_narrative}</p>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px' }}>
          <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '7px' }}>Total Wins</p>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 800, color: '#10b981' }}>{patterns.total_wins}</p>
          <p style={{ fontSize: '11px', color: '#64748b' }}>Last 90 days</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px' }}>
          <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '7px' }}>Avg Days to Close</p>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 800, color: '#f1f5f9' }}>{patterns.overall_avg_days_to_close ?? '—'}</p>
          <p style={{ fontSize: '11px', color: '#64748b' }}>Across all won deals</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px' }}>
          <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '7px' }}>Total Value Won</p>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: '#10b981' }}>{formatNaira(patterns.total_value)}</p>
          <p style={{ fontSize: '11px', color: '#64748b' }}>Estimated deal value</p>
        </div>
      </div>

      {/* By source */}
      {patterns.by_source.length > 0 && (
        <>
          <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
            Wins by Source
          </p>
          {patterns.by_source.map(s => (
            <MiniBar
              key={s.source}
              label={SOURCE_DISPLAY[s.source] || s.source}
              value={s.win_count}
              max={maxWins}
              colour="#10b981"
              sub={`${s.win_count} won · avg ${s.avg_days_to_close}d`}
            />
          ))}
        </>
      )}

      {/* Fastest source callout */}
      {patterns.fastest_source && (
        <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', fontSize: '12px', color: '#6ee7b7' }}>
          ⚡ Fastest source: <strong>{SOURCE_DISPLAY[patterns.fastest_source.source] || patterns.fastest_source.source}</strong> closes in {patterns.fastest_source.avg_days}d on average
          {patterns.slowest_source && ` vs ${patterns.slowest_source.avg_days}d for ${SOURCE_DISPLAY[patterns.slowest_source.source] || patterns.slowest_source.source}`}.
        </div>
      )}
    </div>
  );
}

// ── Losses Tab ────────────────────────────────────────────────────

function LossesTab({ patterns }: { patterns: LossPatterns }) {
  if (!patterns.total_lost_this_quarter) {
    return <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>No lost deals recorded this quarter.</p>;
  }

  const maxLoss = Math.max(...patterns.this_quarter.map(r => r.count), 1);

  return (
    <div>
      {patterns.aria_narrative && (
        <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: '9px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', marginBottom: '6px' }}>✦ ARIA</p>
          <p style={{ fontSize: '13px', color: '#a78bfa', lineHeight: 1.65 }}>{patterns.aria_narrative}</p>
        </div>
      )}

      {/* Dominant reason banner */}
      {patterns.dominant_reason && (
        <div style={{ marginBottom: '20px', padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px' }}>
          <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#f87171', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Top loss reason this quarter
          </p>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
            {patterns.dominant_reason.label}
          </p>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
            {patterns.dominant_reason.count} of {patterns.total_lost_this_quarter} losses ({patterns.dominant_reason.pct_of_losses}%)
          </p>
        </div>
      )}

      {/* Loss breakdown */}
      <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '12px' }}>
        This Quarter vs Last
      </p>
      {patterns.this_quarter.map(r => (
        <div key={r.reason} style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{r.label}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: LOSS_REASON_COLOURS[r.reason] || '#64748b', fontWeight: 700 }}>
                {r.count}
              </span>
              {r.change !== 0 && (
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: r.change > 0 ? '#f87171' : '#6ee7b7' }}>
                  {r.change > 0 ? `+${r.change}` : r.change} vs last Q
                </span>
              )}
            </div>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
            <div style={{ height: '100%', borderRadius: '2px', background: LOSS_REASON_COLOURS[r.reason] || '#64748b', width: `${Math.min(100, (r.count / maxLoss) * 100)}%`, transition: 'width .5s ease' }} />
          </div>
        </div>
      ))}

      <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '14px' }}>
        Total value lost (all time): {formatNaira(patterns.total_value_lost_all_time)}
      </p>
    </div>
  );
}

// ── Quarters Tab ──────────────────────────────────────────────────

function QuartersTab({ quarters }: { quarters: QuarterRow[] }) {
  if (!quarters.length) {
    return <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>No quarterly data yet.</p>;
  }

  const maxWon = Math.max(...quarters.map(q => q.won), 1);

  return (
    <div>
      <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '16px' }}>
        Win / Loss by Quarter
      </p>

      {quarters.map((q, i) => {
        const isCurrentQ = i === quarters.length - 1;
        return (
          <div
            key={q.quarter}
            style={{
              marginBottom: '14px',
              padding: '14px 16px',
              background: isCurrentQ ? 'rgba(109,40,217,0.07)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isCurrentQ ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: isCurrentQ ? '#c4b5fd' : '#94a3b8' }}>
                  {q.quarter}
                </span>
                {isCurrentQ && (
                  <span style={{ marginLeft: '8px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', padding: '1px 6px', borderRadius: '4px', background: 'rgba(109,40,217,0.15)', color: '#a78bfa' }}>
                    Current
                  </span>
                )}
              </div>
              {q.win_rate != null && (
                <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: q.win_rate >= 60 ? '#10b981' : q.win_rate >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {q.win_rate}% win rate
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '10px' }}>
              {[
                { label: 'Won', value: q.won, colour: '#10b981' },
                { label: 'Lost', value: q.lost, colour: '#ef4444' },
                { label: 'Value', value: formatNaira(q.won_value), colour: '#f1f5f9' },
              ].map(c => (
                <div key={c.label}>
                  <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', marginBottom: '3px' }}>{c.label}</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: c.colour, fontFamily: 'Space Grotesk, sans-serif' }}>
                    {typeof c.value === 'number' ? c.value : c.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Won/Lost bar */}
            {q.total > 0 && (
              <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', background: '#10b981', width: `${(q.won / q.total) * 100}%`, transition: 'width .5s' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
