'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BrandStatus,
  ReportEntry,
  WeeklyReport,
  ReportSection,
  ConsolidatedView,
  weeklyReportApi,
  formatWeekLabel,
  STATUS_COLOURS,
} from '@/lib/weekly-report-api';
import { BrandSelectorPanel } from '@/components/weekly-report/BrandSelectorPanel';
import { ReportSectionEditor } from '@/components/weekly-report/ReportSectionEditor';
import { MDConsolidatedView } from '@/components/weekly-report/MDConsolidatedView';

// Get user role from your existing auth context/store
// Replace this import with whatever your app uses
// e.g. import { useAuth } from '@/contexts/auth';
const useUserRole = () => {
  // Placeholder — replace with your auth hook
  if (typeof window !== 'undefined') {
    try {
      const user = JSON.parse(localStorage.getItem('sabi_user') || '{}');
      return { role: user.role || 'brand_admin', name: user.name || '', id: user.id || '' };
    } catch { return { role: 'brand_admin', name: '', id: '' }; }
  }
  return { role: 'brand_admin', name: '', id: '' };
};

const LEADERSHIP_ROLES = ['admin', 'md', 'super_admin'];
const REPORT_SECTIONS: ReportSection[] = ['payment', 'achievements', 'todos', 'goals', 'pipeline'];

export default function WeeklyReportPage() {
  const user = useUserRole();
  const isLeadership = LEADERSHIP_ROLES.includes(user.role);

  // Shared state
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [loading, setLoading] = useState(true);

  // Brand Admin state
  const [brands, setBrands] = useState<BrandStatus[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<BrandStatus | null>(null);
  const [currentEntry, setCurrentEntry] = useState<ReportEntry | null>(null);
  const [currentReport, setCurrentReport] = useState<WeeklyReport | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // MD/Leadership state
  const [consolidated, setConsolidated] = useState<ConsolidatedView | null>(null);
  const [ariaSummary, setAriaSummary] = useState<string | null>(null);
  const [ariaSummaryLoading, setAriaSummaryLoading] = useState(false);

  // ── Initialise ───────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const week = await weeklyReportApi.getCurrentWeek();
        setWeekStart(week.week_start);
        setWeekEnd(week.week_end);

        if (isLeadership) {
          const cv = await weeklyReportApi.getConsolidated(week.week_start);
          setConsolidated(cv);
        } else {
          const { brands: bs } = await weeklyReportApi.getBrands(week.week_start);
          setBrands(bs);
          if (bs.length) loadEntry(bs[0], week.week_start);
        }
      } catch (e) {
        console.error('Init error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadEntry = useCallback(async (brand: BrandStatus, ws?: string) => {
    setSelectedBrand(brand);
    setEntryLoading(true);
    setCurrentEntry(null);
    try {
      const { entry, report } = await weeklyReportApi.getEntry(brand.id, ws || weekStart);
      setCurrentEntry(entry);
      setCurrentReport(report);
      setSubmitted(entry.is_submitted);
    } catch (e) {
      console.error('loadEntry error', e);
    } finally {
      setEntryLoading(false);
    }
  }, [weekStart]);

  const handleBrandSelect = (brand: BrandStatus) => loadEntry(brand);

  // ── ARIA generation ──────────────────────────────────────────

  const handleGenerateAll = async () => {
    if (!currentEntry) return;
    setGeneratingAll(true);
    try {
      const { entry } = await weeklyReportApi.generateDrafts(currentEntry.id);
      setCurrentEntry(entry);
      // Refresh brand status list
      const { brands: bs } = await weeklyReportApi.getBrands(weekStart);
      setBrands(bs);
    } catch (e) {
      console.error('Generate all failed', e);
    } finally {
      setGeneratingAll(false);
    }
  };

  // ── Section save ─────────────────────────────────────────────

  const handleSectionSaved = (section: ReportSection, value: string) => {
    if (!currentEntry) return;
    const fieldKey = `edited_${section}` as keyof ReportEntry;
    setCurrentEntry(prev => prev ? { ...prev, [fieldKey]: value } : prev);
  };

  // ── Submit ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!currentEntry) return;
    setSubmitting(true);
    try {
      const { entry } = await weeklyReportApi.submitEntry(currentEntry.id);
      setCurrentEntry(entry);
      setSubmitted(true);
      const { brands: bs } = await weeklyReportApi.getBrands(weekStart);
      setBrands(bs);
    } catch (e) {
      console.error('Submit failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Comment refresh ──────────────────────────────────────────

  const handleCommentAdded = async () => {
    if (currentEntry) {
      try {
        const { entry } = await weeklyReportApi.getEntry(
          currentEntry.brand_id,
          weekStart,
          currentEntry.brand_admin_id
        );
        setCurrentEntry(entry);
      } catch (e) { /* */ }
    }
    if (isLeadership) {
      const cv = await weeklyReportApi.getConsolidated(weekStart).catch(() => null);
      if (cv) setConsolidated(cv);
    }
  };

  // ── MD summary ───────────────────────────────────────────────

  const handleGenerateMDSummary = async () => {
    setAriaSummaryLoading(true);
    try {
      const { summary } = await weeklyReportApi.generateMDSummary(weekStart);
      setAriaSummary(summary);
    } catch (e) {
      console.error('MD summary failed', e);
    } finally {
      setAriaSummaryLoading(false);
    }
  };

  const weekLabel = weekStart && weekEnd ? formatWeekLabel(weekStart, weekEnd) : '…';

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
          Loading weekly report…
        </p>
      </div>
    );
  }

  // ── MD / Leadership view ─────────────────────────────────────

  if (isLeadership) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
        {/* Page header */}
        <div style={{ padding: '24px 32px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 800, color: '#f1f5f9', marginBottom: '4px' }}>
            Weekly Intelligence Report
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            MD / Leadership view · {weekLabel}
          </p>
        </div>

        {consolidated && (
          <MDConsolidatedView
            report={consolidated.report}
            entries={consolidated.entries}
            submissionSummary={consolidated.submission_summary}
            ariaSummary={ariaSummary}
            ariaSummaryLoading={ariaSummaryLoading}
            onGenerateSummary={handleGenerateMDSummary}
            onCommentAdded={handleCommentAdded}
          />
        )}
      </div>
    );
  }

  // ── Brand Admin view — 2-panel editor ────────────────────────

  const hasAriaDraft = currentEntry?.aria_generated_at != null;
  const sc = submitted ? STATUS_COLOURS['submitted'] : hasAriaDraft ? STATUS_COLOURS['draft'] : STATUS_COLOURS['not_started'];

  return (
    <div style={{ height: '100vh', background: '#0d0d1a', color: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

      {/* Top bar */}
      <div
        style={{
          height: '56px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.2)',
          flexShrink: 0,
        }}
      >
        <div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
            Weekly Report
          </span>
          <span style={{ marginLeft: '12px', fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {weekLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', padding: '3px 10px', borderRadius: '10px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
            {sc.label}
          </span>
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — brand selector */}
        <BrandSelectorPanel
          brands={brands}
          selectedBrandId={selectedBrand?.id || null}
          onSelect={handleBrandSelect}
          weekLabel={weekLabel}
          loading={false}
        />

        {/* RIGHT — report editor */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!selectedBrand ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
                Select a brand to start your report
              </p>
            </div>
          ) : entryLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>Loading…</p>
            </div>
          ) : currentEntry ? (
            <>
              {/* Editor header */}
              <div
                style={{
                  padding: '20px 32px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: '28px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f1f5f9', marginBottom: '4px' }}>
                      {selectedBrand.name}
                    </h2>
                    <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                      {weekLabel} · Weekly Report
                    </p>
                  </div>

                  {/* Actions */}
                  {!submitted && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={handleGenerateAll}
                        disabled={generatingAll}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'rgba(109,40,217,0.15)',
                          border: '1px solid rgba(109,40,217,0.3)',
                          color: '#c4b5fd',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: generatingAll ? 'wait' : 'pointer',
                          fontFamily: 'Space Grotesk, sans-serif',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {generatingAll ? (
                          <>✦ Generating…</>
                        ) : hasAriaDraft ? (
                          <>↺ Regenerate with ARIA</>
                        ) : (
                          <>✦ Generate with ARIA</>
                        )}
                      </button>

                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !hasAriaDraft}
                        title={!hasAriaDraft ? 'Generate with ARIA first' : ''}
                        style={{
                          padding: '8px 20px',
                          borderRadius: '8px',
                          background: submitting || !hasAriaDraft ? 'rgba(16,185,129,0.2)' : '#10b981',
                          border: 'none',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: submitting || !hasAriaDraft ? 'not-allowed' : 'pointer',
                          fontFamily: 'Space Grotesk, sans-serif',
                          opacity: !hasAriaDraft ? 0.5 : 1,
                        }}
                      >
                        {submitting ? 'Submitting…' : 'Submit Report ✓'}
                      </button>
                    </div>
                  )}
                  {submitted && (
                    <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', color: '#10b981', fontSize: '13px', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                      ✓ Submitted for this week
                    </div>
                  )}
                </div>

                {/* ARIA generation tip */}
                {!hasAriaDraft && !submitted && (
                  <div style={{ padding: '10px 14px', background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: '8px', fontSize: '12px', color: '#a78bfa', marginBottom: '16px' }}>
                    ✦ Click <strong>"Generate with ARIA"</strong> to auto-draft all sections from this week's tasks, payments, briefs, goals, and pipeline. Review and edit before submitting.
                  </div>
                )}
              </div>

              {/* Six sections */}
              <div style={{ padding: '0 32px 40px' }}>
                {REPORT_SECTIONS.map(section => {
                  const draftKey = `aria_draft_${section}` as keyof ReportEntry;
                  const editedKey = `edited_${section}` as keyof ReportEntry;
                  return (
                    <ReportSectionEditor
                      key={section}
                      entryId={currentEntry.id}
                      section={section}
                      ariaDraft={currentEntry[draftKey] as string | undefined}
                      editedValue={currentEntry[editedKey] as string | undefined}
                      comments={(currentEntry.comments || []).filter(c => c.section === section)}
                      isSubmitted={submitted}
                      isLeadership={isLeadership}
                      onSaved={handleSectionSaved}
                      onCommentAdded={handleCommentAdded}
                      showPipelineNote={!hasAriaDraft}
                    />
                  );
                })}

                {/* Submit button at bottom */}
                {!submitted && hasAriaDraft && (
                  <div style={{ paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      style={{
                        padding: '12px 28px',
                        borderRadius: '10px',
                        background: '#10b981',
                        border: 'none',
                        color: 'white',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: submitting ? 'wait' : 'pointer',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      {submitting ? 'Submitting…' : `Submit ${selectedBrand.name} Report ✓`}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
