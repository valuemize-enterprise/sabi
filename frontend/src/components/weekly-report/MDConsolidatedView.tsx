'use client';

import React, { useState } from 'react';
import {
  ReportEntry,
  SubmissionSummary,
  WeeklyReport,
  SECTION_LABELS,
  SECTION_ICONS,
  ReportSection,
  weeklyReportApi,
  formatWeekLabel,
  STATUS_COLOURS,
} from '@/lib/weekly-report-api';
import { WeekVsGoalPanel } from '@/components/agency-goals/WeekVsGoalPanel';

interface MDConsolidatedViewProps {
  report: WeeklyReport | null;
  entries: ReportEntry[];
  submissionSummary: SubmissionSummary;
  ariaSummary: string | null;
  ariaSummaryLoading: boolean;
  onGenerateSummary: () => void;
  onCommentAdded: () => void;
}

const SECTIONS: ReportSection[] = ['payment', 'achievements', 'todos', 'goals', 'pipeline'];

export function MDConsolidatedView({
  report,
  entries,
  submissionSummary,
  ariaSummary,
  ariaSummaryLoading,
  onGenerateSummary,
  onCommentAdded,
}: MDConsolidatedViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'pending'>('all');
  const [commentState, setCommentState] = useState<Record<string, { section: ReportSection; text: string; flagged: boolean }>>({});
  const [commentSaving, setCommentSaving] = useState<string | null>(null);

  const toggleEntry = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredEntries = entries.filter(e => {
    if (filterStatus === 'submitted') return e.is_submitted;
    if (filterStatus === 'pending') return !e.is_submitted;
    return true;
  });

  const handleAddComment = async (entryId: string, section: ReportSection, comment: string, flagged: boolean) => {
    setCommentSaving(entryId + section);
    try {
      await weeklyReportApi.addComment(entryId, section, comment, flagged);
      setCommentState(prev => {
        const next = { ...prev };
        delete next[entryId + section];
        return next;
      });
      onCommentAdded();
    } catch (e) {
      console.error('Comment failed', e);
    } finally {
      setCommentSaving(null);
    }
  };

  if (!report) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: '#64748b' }}>
          No report for this week yet
        </p>
        <p style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
          Brand Admins haven't opened their weekly report page this week.
        </p>
      </div>
    );
  }

  const weekLabel = formatWeekLabel(report.week_start, report.week_end);
  const { submitted, total, not_started } = submissionSummary;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>

      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(13,13,26,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', marginBottom: '3px' }}>
            WEEKLY INTELLIGENCE REPORT
          </p>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
            {weekLabel}
          </p>
        </div>

        {/* Submission count */}
        <div
          style={{
            padding: '8px 14px',
            background: submitted === total ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${submitted === total ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
            borderRadius: '8px',
          }}
        >
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              fontWeight: 700,
              color: submitted === total ? '#10b981' : '#f59e0b',
            }}
          >
            {submitted}/{total} submitted
          </span>
          {not_started > 0 && (
            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
              · {not_started} not started
            </span>
          )}
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          {(['all', 'submitted', 'pending'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer',
                border: '1px solid',
                background: filterStatus === f ? 'rgba(109,40,217,0.2)' : 'transparent',
                color: filterStatus === f ? '#c4b5fd' : '#64748b',
                borderColor: filterStatus === f ? 'rgba(109,40,217,0.35)' : 'rgba(255,255,255,0.07)',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>

        {/* ARIA opening paragraph */}
        <div
          style={{
            marginBottom: '28px',
            padding: '20px 24px',
            background: 'rgba(109,40,217,0.07)',
            border: '1px solid rgba(109,40,217,0.2)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>✦</span>
              <div>
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#c4b5fd' }}>
                  ARIA Weekly Intelligence Briefing
                </p>
                <p style={{ fontSize: '11px', color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace' }}>
                  Auto-generated from this week's submitted data
                </p>
              </div>
            </div>
            <button
              onClick={onGenerateSummary}
              disabled={ariaSummaryLoading}
              style={{
                padding: '6px 14px',
                borderRadius: '7px',
                background: 'rgba(109,40,217,0.2)',
                border: '1px solid rgba(109,40,217,0.35)',
                color: '#c4b5fd',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {ariaSummaryLoading ? 'Generating…' : ariaSummary ? '↺ Regenerate' : 'Generate Briefing'}
            </button>
          </div>
          {ariaSummary ? (
            <p style={{ fontSize: '14px', color: '#a78bfa', lineHeight: 1.75 }}>{ariaSummary}</p>
          ) : (
            <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              Click "Generate Briefing" to get ARIA's cross-brand intelligence summary for this week.
            </p>
          )}
        </div>

        {/* Week vs Goal panel */}
        <div style={{ marginBottom: '28px' }}>
          <WeekVsGoalPanel weekLabel={weekLabel} />
        </div>

        {/* Entries */}
        {filteredEntries.map(entry => {
          const isExpanded = expandedIds.has(entry.id);
          const sc = STATUS_COLOURS[entry.is_submitted ? 'submitted' : entry.aria_generated_at ? 'draft' : 'not_started'];
          const flagCount = Number(entry.flagged_count || 0);
          const commentCount = Number(entry.unresolved_comment_count || 0);

          return (
            <div
              key={entry.id}
              style={{
                marginBottom: '12px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${flagCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Entry header (always visible) */}
              <button
                onClick={() => toggleEntry(entry.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  gap: '12px',
                }}
              >
                <span style={{ color: '#64748b', fontSize: '14px', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>

                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>
                    {entry.brand_name}
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                    {entry.brand_admin_name}
                    {entry.submitted_at && ` · Submitted ${new Date(entry.submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {flagCount > 0 && (
                    <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      🚩 {flagCount}
                    </span>
                  )}
                  {commentCount > 0 && (
                    <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', padding: '2px 7px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)' }}>
                      💬 {commentCount}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', padding: '2px 8px', borderRadius: '10px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                    {sc.label}
                  </span>
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: '20px 24px' }}>
                  {SECTIONS.map(section => {
                    const draftKey = `aria_draft_${section}` as keyof ReportEntry;
                    const editedKey = `edited_${section}` as keyof ReportEntry;
                    const content = (entry[editedKey] || entry[draftKey]) as string | undefined;
                    const commentKey = entry.id + section;
                    const sectionComments = (entry.comments || []).filter(c => c.section === section && !c.resolved);

                    if (!content && section !== 'pipeline') return null;

                    return (
                      <div key={section} style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                            {SECTION_ICONS[section]} {SECTION_LABELS[section]}
                          </p>
                          <button
                            onClick={() => setCommentState(prev => ({ ...prev, [commentKey]: { section, text: '', flagged: false } }))}
                            style={{ fontSize: '11px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            + Comment
                          </button>
                        </div>

                        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                          {content || <em style={{ color: '#374151' }}>Not submitted</em>}
                        </p>

                        {/* Existing comments */}
                        {sectionComments.map(c => (
                          <div key={c.id} style={{ marginTop: '8px', padding: '8px 12px', background: c.flagged ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)', border: `1px solid ${c.flagged ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`, borderRadius: '6px' }}>
                            <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                              {c.flagged ? '🚩 ' : '💬 '}{c.author_name}
                            </span>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{c.comment}</p>
                          </div>
                        ))}

                        {/* Inline comment box */}
                        {commentState[commentKey] && (
                          <div style={{ marginTop: '10px' }}>
                            <textarea
                              value={commentState[commentKey].text}
                              onChange={e => setCommentState(prev => ({ ...prev, [commentKey]: { ...prev[commentKey], text: e.target.value } }))}
                              placeholder="Add your comment…"
                              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', color: '#f1f5f9', borderRadius: '7px', padding: '8px 10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical', minHeight: '64px', outline: 'none', marginBottom: '8px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px', color: '#64748b' }}>
                                <input type="checkbox" checked={commentState[commentKey].flagged} onChange={e => setCommentState(prev => ({ ...prev, [commentKey]: { ...prev[commentKey], flagged: e.target.checked } }))} />
                                🚩 Flag for meeting
                              </label>
                              <button onClick={() => setCommentState(prev => { const n = { ...prev }; delete n[commentKey]; return n; })} style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                              <button
                                onClick={() => handleAddComment(entry.id, section, commentState[commentKey].text, commentState[commentKey].flagged)}
                                disabled={commentSaving === entry.id + section || !commentState[commentKey].text.trim()}
                                style={{ padding: '5px 12px', borderRadius: '6px', background: '#6d28d9', border: 'none', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
                              >
                                {commentSaving === entry.id + section ? 'Posting…' : 'Post'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredEntries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
              No entries match the current filter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}