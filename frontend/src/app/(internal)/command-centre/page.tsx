'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Dial, DialId, WeeklyIntelligenceHeader, commandCentreApi } from '@/lib/command-centre-api';
import { DialCard } from '@/components/command-centre/DialCard';
import { ExpandedDialPanel } from '@/components/command-centre/ExpandedDialPanel';

// ── Import the MDConsolidatedView from Phase 1 ────────────────────
// This reuses the already-built component from the Weekly Report phase.
// Adjust the import path if your component lives elsewhere.
// import { MDConsolidatedView } from '@/components/weekly-report/MDConsolidatedView';
import { weeklyReportApi, ConsolidatedView } from '@/lib/weekly-report-api';
import { MDConsolidatedView } from '@/components/weekly-report/MDConsolidatedView';

// ── Auth placeholder — replace with your auth hook ────────────────
const useUser = () => {
  if (typeof window !== 'undefined') {
    try { return JSON.parse(localStorage.getItem('sabi_user') || '{}'); }
    catch { return { name: 'MD', role: 'md' }; }
  }
  return { name: 'MD', role: 'md' };
};

// ── Mode toggle ───────────────────────────────────────────────────
type ViewMode = 'live' | 'weekly';

const POLL_INTERVAL_MS = 60_000; // refresh live dials every 60s

// ── Component ─────────────────────────────────────────────────────
export default function CommandCentrePage() {
  const router = useRouter();
  const user = useUser();

  const [mode, setMode] = useState<ViewMode>('live');
  const [dials, setDials] = useState<Dial[]>([]);
  const [dialsLoading, setDialsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<DialId | null>(null);
  const [lastFetched, setLastFetched] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Weekly Intelligence state
  const [consolidated, setConsolidated] = useState<ConsolidatedView | null>(null);
  const [wiHeader, setWiHeader] = useState<WeeklyIntelligenceHeader | null>(null);
  const [wiLoading, setWiLoading] = useState(false);
  const [ariaSummary, setAriaSummary] = useState<string | null>(null);
  const [ariaSummaryLoading, setAriaSummaryLoading] = useState(false);

  // ── Data loading ───────────────────────────────────────────────

  const loadDials = useCallback(async (silent = false) => {
    if (!silent) setDialsLoading(true);
    else setRefreshing(true);
    try {
      const { dials: d, fetched_at } = await commandCentreApi.getAllDials();
      setDials(d);
      setLastFetched(new Date(fetched_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error('Failed to load dials', e);
    } finally {
      setDialsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadWeeklyIntelligence = useCallback(async () => {
    setWiLoading(true);
    try {
      const [cv, header] = await Promise.all([
        weeklyReportApi.getConsolidated(),
        commandCentreApi.getWeeklyIntelligenceHeader(),
      ]);
      setConsolidated(cv);
      setWiHeader(header);
    } catch (e) {
      console.error('Failed to load weekly intelligence', e);
    } finally {
      setWiLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDials();
  }, [loadDials]);

  // Set up polling for live mode
  useEffect(() => {
    if (mode === 'live') {
      pollRef.current = setInterval(() => loadDials(true), POLL_INTERVAL_MS);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [mode, loadDials]);

  // Load weekly data when switching to Weekly mode
  useEffect(() => {
    if (mode === 'weekly' && !consolidated) {
      loadWeeklyIntelligence();
    }
  }, [mode, consolidated, loadWeeklyIntelligence]);

  // ── Handlers ───────────────────────────────────────────────────

  const handleDialClick = (id: DialId) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleRefreshDial = async (id: DialId) => {
    try {
      const { dial } = await commandCentreApi.getDial(id);
      setDials(prev => prev.map(d => d.id === id ? dial : d));
    } catch (e) {
      console.error('Refresh dial failed', e);
    }
  };

  const handleGenerateAriaSummary = async () => {
    setAriaSummaryLoading(true);
    try {
      const { summary } = await weeklyReportApi.generateMDSummary();
      setAriaSummary(summary);
    } catch (e) {
      console.error('ARIA summary failed', e);
    } finally {
      setAriaSummaryLoading(false);
    }
  };

  const handleCommentAdded = async () => {
    const cv = await weeklyReportApi.getConsolidated().catch(() => null);
    if (cv) setConsolidated(cv);
  };

  // ── Derived ────────────────────────────────────────────────────

  const submittedCount = wiHeader?.submission_count ?? 0;
  const totalBrands = wiHeader?.total_brands ?? 0;
  const currentWeekLabel = wiHeader
    ? `${new Date(wiHeader.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(wiHeader.week_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : '';

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d1a',
        color: '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: '20px 36px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px',
          flexWrap: 'wrap',
          background: 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <div>
          <h1
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '20px',
              fontWeight: 800,
              color: '#f1f5f9',
              marginBottom: '2px',
              letterSpacing: '-0.01em',
            }}
          >
            Command Centre
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {mode === 'live'
              ? `Live · Last updated ${lastFetched || '…'}`
              : `Weekly Intelligence · ${currentWeekLabel || '…'}`
            }
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          {/* Live mode: refresh button */}
          {mode === 'live' && (
            <button
              onClick={() => loadDials(true)}
              disabled={refreshing}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: '#64748b',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {refreshing ? '↺ Refreshing…' : '↺ Refresh'}
            </button>
          )}

          {/* Weekly mode: submission status chip */}
          {mode === 'weekly' && wiHeader && (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                background: submittedCount === totalBrands ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${submittedCount === totalBrands ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                fontSize: '12px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                color: submittedCount === totalBrands ? '#10b981' : '#f59e0b',
              }}
            >
              {submittedCount}/{totalBrands} reports submitted
            </div>
          )}

          {/* Mode toggle */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '9px',
              padding: '3px',
            }}
          >
            {([['live', '⚡ Live'], ['weekly', '📋 Weekly Intelligence']] as [ViewMode, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'Inter, sans-serif',
                  background: mode === m ? 'rgba(109,40,217,0.22)' : 'transparent',
                  color: mode === m ? '#c4b5fd' : '#64748b',
                  transition: 'all .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── LIVE MODE ───────────────────────────────────────────── */}
      {mode === 'live' && (
        <div style={{ padding: '28px 36px', flex: 1 }}>
          {dialsLoading ? (
            /* Skeleton */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '14px',
                    height: '130px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
            </div>
          ) : (
            <>
              {/* Dial grid — 4 × 2 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '14px',
                  marginBottom: '14px',
                }}
              >
                {dials.map(dial => (
                  <DialCard
                    key={dial.id}
                    dial={dial}
                    isExpanded={expandedId === dial.id}
                    onClick={() => handleDialClick(dial.id)}
                  />
                ))}
              </div>

              {/* Expanded panel — renders below the row containing the clicked dial */}
              {expandedId && (() => {
                const expanded = dials.find(d => d.id === expandedId);
                if (!expanded) return null;
                return (
                  <ExpandedDialPanel
                    dial={expanded}
                    onClose={() => setExpandedId(null)}
                  />
                );
              })()}

              {/* Footer note */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                  Click any dial to expand · Auto-refreshes every 60s · Colour = health status
                </p>
                <button
                  onClick={() => setMode('weekly')}
                  style={{
                    fontSize: '12px',
                    color: '#6d28d9',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                  }}
                >
                  📋 Switch to Weekly Intelligence →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── WEEKLY INTELLIGENCE MODE ─────────────────────────────── */}
      {mode === 'weekly' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {wiLoading || !consolidated ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                Loading weekly intelligence…
              </p>
            </div>
          ) : (
            /* Reuse MDConsolidatedView from Phase 1 — full Friday view */
            <MDConsolidatedView
              report={consolidated.report}
              entries={consolidated.entries}
              submissionSummary={consolidated.submission_summary}
              ariaSummary={ariaSummary}
              ariaSummaryLoading={ariaSummaryLoading}
              onGenerateSummary={handleGenerateAriaSummary}
              onCommentAdded={handleCommentAdded}
            />
          )}
        </div>
      )}
    </div>
  );
}
