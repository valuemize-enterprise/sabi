'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { bookOfDealsApi, PursuitBoard as PursuitBoardData, PursuitEntry, RANK_MEDALS } from '@/lib/book-of-deals-api';
import { STAGE_LABELS, STAGE_COLOURS, type PipelineStage } from '@/lib/pipeline-api';

// ── Entry card ────────────────────────────────────────────────────
const EntryCard = ({
  entry, metric, metricLabel, accentColour,
}: {
  entry:         PursuitEntry;
  metric:        string | number;
  metricLabel:   string;
  accentColour:  string;
}) => {
  const medal = entry.rank <= 3 ? RANK_MEDALS[entry.rank - 1] : null;

  return (
    <div style={{
      display: 'flex', gap: '12px', alignItems: 'flex-start',
      padding: '12px 14px',
      background: entry.rank === 1 ? `${accentColour}10` : 'rgba(255,255,255,0.02)',
      border: `1px solid ${entry.rank === 1 ? `${accentColour}30` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '10px',
      marginBottom: '8px',
      transition: 'background .15s',
    }}>
      {/* Rank */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: entry.rank <= 3 ? `${accentColour}20` : 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: entry.rank <= 3 ? '14px' : '11px',
        color: entry.rank <= 3 ? accentColour : '#475569',
        fontFamily: 'Space Grotesk, sans-serif', fontWeight: 800,
      }}>
        {medal || `#${entry.rank}`}
      </div>

      {/* Name + companies */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
          fontWeight: 700, color: '#f1f5f9', marginBottom: '3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.full_name}
        </p>
        {entry.companies?.length > 0 && (
          <p style={{
            fontSize: '11px', color: '#64748b', lineHeight: 1.4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.companies.slice(0, 3).join(' · ')}
            {entry.companies.length > 3 ? ` +${entry.companies.length - 3} more` : ''}
          </p>
        )}

        {/* Stage chips for active pipeline */}
        {(entry.stages ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
            {[...new Set(entry.stages ?? [])].slice(0, 3).map(s => {
              const sc = STAGE_COLOURS[s as PipelineStage] || STAGE_COLOURS.introduction;
              return (
                <span key={s} style={{
                  padding: '1px 7px', borderRadius: '4px', fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                  background: sc.bg, color: sc.text,
                }}>
                  {STAGE_LABELS[s as keyof typeof STAGE_LABELS] || s}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Primary metric */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px',
          fontWeight: 800, color: accentColour, lineHeight: 1,
        }}>
          {metric}
        </p>
        <p style={{
          fontSize: '10px', color: '#64748b',
          fontFamily: 'JetBrains Mono, monospace', marginTop: '2px',
        }}>
          {metricLabel}
        </p>
      </div>
    </div>
  );
};

// ── Ranking panel ─────────────────────────────────────────────────
const RankingPanel = ({
  title, icon, accentColour, borderColour, entries, emptyMessage,
  renderEntry,
}: {
  title:        string;
  icon:         string;
  accentColour: string;
  borderColour: string;
  entries:      PursuitEntry[];
  emptyMessage: string;
  renderEntry:  (e: PursuitEntry) => React.ReactNode;
}) => (
  <div style={{
    flex: 1, minWidth: '280px',
    background: 'rgba(255,255,255,0.02)',
    border: `1px solid ${borderColour}`,
    borderRadius: '14px', overflow: 'hidden',
  }}>
    {/* Panel header */}
    <div style={{
      padding: '14px 16px',
      background: `${accentColour}0a`,
      borderBottom: `1px solid ${borderColour}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{
          fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
          fontWeight: 700, color: '#f1f5f9',
        }}>
          {title}
        </span>
      </div>
    </div>

    {/* Entries */}
    <div style={{ padding: '12px' }}>
      {entries.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#475569', textAlign: 'center', padding: '24px 0' }}>
          {emptyMessage}
        </p>
      ) : (
        entries.map(e => <div key={e.id}>{renderEntry(e)}</div>)
      )}
    </div>
  </div>
);

// ── Main Pursuit Board ────────────────────────────────────────────
export function PursuitBoard() {
  const [period,  setPeriod]  = useState<'quarter' | 'year'>('quarter');
  const [board,   setBoard]   = useState<PursuitBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookOfDealsApi.getPursuitBoard(period);
      setBoard(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Pursuit Board');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const now          = new Date();
  const quarterLabel = ['Q1', 'Q2', 'Q3', 'Q4'][Math.floor(now.getMonth() / 3)];
  const periodLabel  = period === 'quarter'
    ? `${quarterLabel} ${now.getFullYear()}`
    : `Full Year ${now.getFullYear()}`;

  return (
    <div>
      {/* Board header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '20px', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <p style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
            color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '4px',
          }}>
            The Pursuit Board · {periodLabel}
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Who is chasing what. No amounts shown. Public to all Cerebre staff.
          </p>
        </div>

        {/* Period toggle */}
        <div style={{
          display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)',
          borderRadius: '8px', padding: '4px',
        }}>
          {(['quarter', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                border: 'none',
                background: period === p ? 'rgba(109,40,217,0.25)' : 'transparent',
                color: period === p ? '#c4b5fd' : '#64748b',
                transition: 'all .15s',
              }}
            >
              {p === 'quarter' ? 'This Quarter' : 'All Year'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: '280px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>
          {error}
        </div>
      ) : board && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>

          {/* Most Deals Converted */}
          <RankingPanel
            title="Most Deals Converted"
            icon="🏆"
            accentColour="#f59e0b"
            borderColour="rgba(217,119,6,0.22)"
            entries={board.converted}
            emptyMessage="No converted deals this period yet."
            renderEntry={e => (
              <EntryCard
                entry={e}
                metric={e.converted_count ?? 0}
                metricLabel={e.converted_count === 1 ? 'deal' : 'deals'}
                accentColour="#f59e0b"
              />
            )}
          />

          {/* Most Active Pipeline */}
          <RankingPanel
            title="Most Active Pipeline"
            icon="📡"
            accentColour="#6d28d9"
            borderColour="rgba(109,40,217,0.22)"
            entries={board.active}
            emptyMessage="No active deals in pipeline."
            renderEntry={e => (
              <EntryCard
                entry={e}
                metric={e.active_count ?? 0}
                metricLabel={e.active_count === 1 ? 'deal' : 'deals'}
                accentColour="#c4b5fd"
              />
            )}
          />

          {/* Fastest Close */}
          <RankingPanel
            title="Fastest Close"
            icon="⚡"
            accentColour="#10b981"
            borderColour="rgba(16,185,129,0.22)"
            entries={board.fastest}
            emptyMessage="Need at least 2 closed deals to rank here."
            renderEntry={e => (
              <EntryCard
                entry={e}
                metric={`${e.avg_close_days}d`}
                metricLabel={`avg · ${e.closed_count} closed`}
                accentColour="#10b981"
              />
            )}
          />
        </div>
      )}

      {board && (
        <p style={{
          fontSize: '11px', color: '#374151', textAlign: 'center',
          marginTop: '16px', fontFamily: 'JetBrains Mono, monospace',
        }}>
          Names and companies shown · No financial details · Amounts visible to Super Admin + assigned access only
        </p>
      )}
    </div>
  );
}
