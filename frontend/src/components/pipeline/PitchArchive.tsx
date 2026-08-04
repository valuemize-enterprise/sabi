'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  debriefApi, PitchArchiveEntry, QuarterlyInsightsResult,
} from '@/lib/deal-debrief-api';
import { INDUSTRY_LABELS, SERVICE_SCOPE_LABELS } from '@/lib/pipeline-api';

// ═══════════════════════════════════════════════════════════════════
// PitchArchive — searchable reference library of past pitch decks
// ═══════════════════════════════════════════════════════════════════

interface PitchArchiveProps {
  compact?: boolean;
}

const OUTCOME_COLOURS = {
  won:         { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', badge: '✓ Won'         },
  lost:        { bg: 'rgba(239,68,68,0.08)',   text: '#f87171', badge: '✗ Lost'        },
  in_progress: { bg: 'rgba(109,40,217,0.08)', text: '#c4b5fd', badge: '⟳ In Progress' },
};

const ArchiveCard = ({ entry }: { entry: PitchArchiveEntry }) => {
  const oc = OUTCOME_COLOURS[entry.outcome];
  const industryLabel = entry.industry
    ? INDUSTRY_LABELS[entry.industry as keyof typeof INDUSTRY_LABELS] || entry.industry
    : null;

  return (
    <div style={{
      padding: '14px 16px', borderRadius: '10px', marginBottom: '8px',
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
              {entry.company_name}
            </p>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
              background: oc.bg, color: oc.text,
            }}>
              {oc.badge}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {industryLabel && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>{industryLabel}</span>
            )}
            {entry.deal_type && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>· {entry.deal_type}</span>
            )}
            {entry.business_bringer && (
              <span style={{ fontSize: '11px', color: '#64748b' }}>· {entry.business_bringer.full_name}</span>
            )}
          </div>

          {entry.service_scope?.length ? (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {entry.service_scope.slice(0, 4).map(s => (
                <span key={s} style={{
                  padding: '1px 6px', borderRadius: '3px', fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'rgba(109,40,217,0.1)', color: '#c4b5fd',
                }}>
                  {SERVICE_SCOPE_LABELS[s as keyof typeof SERVICE_SCOPE_LABELS] || s}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <a
          href={entry.deck_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            padding: '6px 14px', borderRadius: '7px', flexShrink: 0,
            background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)',
            color: '#c4b5fd', fontSize: '12px', fontWeight: 700,
            fontFamily: 'Inter, sans-serif', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}
        >
          📎 Open Deck ↗
        </a>
      </div>
    </div>
  );
};

export function PitchArchive({ compact = false }: PitchArchiveProps) {
  const [entries,  setEntries]  = useState<PitchArchiveEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [outcome,  setOutcome]  = useState('');
  const [industry, setIndustry] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { entries: data } = await debriefApi.getPitchArchive({
        outcome:  outcome  || undefined,
        industry: industry || undefined,
        search:   search   || undefined,
      });
      setEntries(data);
    } catch {} finally { setLoading(false); }
  }, [search, outcome, industry]);

  useEffect(() => { load(); }, [load]);

  const iS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '8px 13px', fontSize: '13px',
    color: '#f1f5f9', fontFamily: 'Inter, sans-serif', outline: 'none',
  };

  const industries = Object.entries(INDUSTRY_LABELS);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '4px' }}>
          Pitch Archive
        </p>
        <p style={{ fontSize: '13px', color: '#94a3b8' }}>
          Every past pitch deck tagged by company, industry, and outcome. Reference when building your next pitch.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <input
          style={{ ...iS, flex: 1, minWidth: '180px' }}
          placeholder="Search by company name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={{ ...iS, cursor: 'pointer' }} value={outcome} onChange={e => setOutcome(e.target.value)}>
          <option value="" style={{ background: '#1e1e35' }}>All outcomes</option>
          <option value="won"  style={{ background: '#1e1e35' }}>Won</option>
          <option value="lost" style={{ background: '#1e1e35' }}>Lost</option>
        </select>
        <select style={{ ...iS, cursor: 'pointer' }} value={industry} onChange={e => setIndustry(e.target.value)}>
          <option value="" style={{ background: '#1e1e35' }}>All industries</option>
          {industries.map(([k, v]) => <option key={k} value={k} style={{ background: '#1e1e35' }}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: '80px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p style={{ fontSize: '14px', color: '#475569' }}>
            {search || outcome || industry
              ? 'No matching decks found. Try different filters.'
              : 'No pitch decks in the archive yet. Add a deck URL when logging or managing a deal.'}
          </p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginBottom: '10px' }}>
            {entries.length} deck{entries.length !== 1 ? 's' : ''} found
          </p>
          {entries.slice(0, compact ? 5 : 100).map(e => <ArchiveCard key={e.id} entry={e} />)}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// DebriefInsightsPanel — ARIA quarterly pattern analysis
// ═══════════════════════════════════════════════════════════════════

export function DebriefInsightsPanel() {
  const [result,     setResult]     = useState<QuarterlyInsightsResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await debriefApi.generateInsights();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setGenerating(false);
    }
  };

  const ins = result?.insights;
  const now = new Date();
  const qLabel = ['Q1','Q2','Q3','Q4'][Math.floor(now.getMonth() / 3)];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '4px' }}>
            Debrief Intelligence · {qLabel} {now.getFullYear()}
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            ARIA analyses all win/loss debriefs this quarter and surfaces patterns for leadership.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          style={{
            padding: '8px 18px', borderRadius: '8px', cursor: generating ? 'wait' : 'pointer',
            background: generating ? 'rgba(109,40,217,0.2)' : '#6d28d9',
            border: 'none', color: 'white', fontSize: '13px', fontWeight: 700,
            fontFamily: 'Space Grotesk, sans-serif', opacity: generating ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          {generating ? (
            <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> ARIA thinking…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>
          ) : '✨ Run Quarterly Analysis'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '13px', color: '#fca5a5', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      {result?.message && !ins && (
        <div style={{ padding: '16px', background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.18)', borderRadius: '10px', fontSize: '13px', color: '#c4b5fd' }}>
          {result.message}
        </div>
      )}

      {ins && (
        <div>
          {/* Summary card */}
          <div style={{ padding: '16px 18px', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', marginBottom: '2px' }}>WIN RATE</p>
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{ins.win_rate_pct ?? '—'}%</p>
                <p style={{ fontSize: '11px', color: '#64748b' }}>{ins.win_rate}</p>
              </div>
              <div style={{ flex: 1, paddingLeft: '20px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>ARIA SUMMARY</p>
                <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.65 }}>{ins.aria_summary}</p>
              </div>
            </div>
          </div>

          {/* Two-column insights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

            {/* Top win factors */}
            {ins.top_win_factors?.length ? (
              <div style={{ padding: '14px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                  Top Win Factors
                </p>
                {ins.top_win_factors.slice(0, 3).map((f, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600 }}>{f.factor}</p>
                    {f.insight && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{f.insight}</p>}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Top objections */}
            {ins.top_objections?.length ? (
              <div style={{ padding: '14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px' }}>
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#f87171', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                  Top Objections
                </p>
                {ins.top_objections.slice(0, 3).map((o, i) => (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <p style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600 }}>{o.objection}</p>
                    {o.insight && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{o.insight}</p>}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Competitor patterns */}
          {ins.competitor_patterns?.length ? (
            <div style={{ padding: '14px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '10px', marginBottom: '14px' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                Competitor Patterns
              </p>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {ins.competitor_patterns.map((c, i) => (
                  <div key={i} style={{ minWidth: '140px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{c.competitor}</p>
                    <p style={{ fontSize: '11px', color: '#f59e0b' }}>{c.appearances} appearance{c.appearances !== 1 ? 's' : ''}</p>
                    {c.note && <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{c.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Recommendations */}
          {ins.top_recommendations?.length ? (
            <div style={{ padding: '14px', background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.18)', borderRadius: '10px' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>
                ARIA Recommendations for Next Quarter
              </p>
              {ins.top_recommendations.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: i < ins.top_recommendations!.length - 1 ? '8px' : 0 }}>
                  <span style={{ color: '#6d28d9', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0 }}>{i + 1}.</span>
                  <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6 }}>{r}</p>
                </div>
              ))}
            </div>
          ) : null}

          {result.generated_at && (
            <p style={{ fontSize: '10px', color: '#374151', textAlign: 'right', marginTop: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
              Analysis generated by ARIA · {new Date(result.generated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
