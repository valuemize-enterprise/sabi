'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Opportunity,
  WeeklyNote,
  PipelineStage,
  LostReason,
  STAGE_LABELS,
  STAGE_COLOURS,
  STAGE_ORDER,
  STALENESS_COLOURS,
  SERVICE_TYPE_LABELS,
  SOURCE_LABELS,
  LOST_REASON_LABELS,
  formatNaira,
  pipelineApi,
} from '@/lib/pipeline-api';
import { DealDebriefModal } from '@/components/pipeline/DealDebriefModal';
import { SmartFollowUpPanel } from '@/components/pipeline/SmartFollowUpPanel';

interface OpportunityDetailSlideOverProps {
  opportunityId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const ACTIVE_STAGES = STAGE_ORDER.filter(s => s !== 'won' && s !== 'lost_paused');

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  fontFamily: 'JetBrains Mono, monospace',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  marginBottom: '12px',
};

const metaLabel: React.CSSProperties = {
  fontSize: '11px',
  fontFamily: 'JetBrains Mono, monospace',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  marginBottom: '4px',
};

const metaValue: React.CSSProperties = {
  fontSize: '14px',
  color: '#cbd5e1',
};

export function OpportunityDetailSlideOver({ opportunityId, onClose, onUpdated }: OpportunityDetailSlideOverProps) {
  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'detail' | 'notes' | 'history'>('detail');

  // Stage change state
  const [showStageChange, setShowStageChange] = useState(false);
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [newStage, setNewStage] = useState<PipelineStage | ''>('');
  const [debriefOutcome, setDebriefOutcome] = useState<'won' | 'lost'>('won');
  const [stageNote, setStageNote] = useState('');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [lostNotes, setLostNotes] = useState('');
  const [stageLoading, setStageLoading] = useState(false);

  // Weekly note state
  const [noteText, setNoteText] = useState('');
  const [ariaDraftLoading, setAriaDraftLoading] = useState(false);
  const [ariaDraft, setAriaDraft] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { opportunity } = await pipelineApi.getById(opportunityId);
      setOpp(opportunity);
      // Pre-fill this week's note if it exists
      const thisWeek = opportunity.weekly_notes?.[0];
      if (thisWeek?.notes) setNoteText(thisWeek.notes);
      if (thisWeek?.aria_draft) setAriaDraft(thisWeek.aria_draft);
    } catch (e) {
      console.error('Failed to load opportunity', e);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleStageChange = async () => {
    if (!newStage) return;
    if (newStage === 'lost_paused' && !lostReason) return;

    setStageLoading(true);
    try {
      await pipelineApi.changeStage(opportunityId, {
        stage: newStage,
        change_notes: stageNote || undefined,
        lost_reason: lostReason || undefined,
        lost_notes: lostNotes || undefined,
      });
      setShowStageChange(false);
      setNewStage('');
      setStageNote('');
      setLostReason('');
      setLostNotes('');

      if (newStage === 'won' || newStage === 'lost_paused') {
        setDebriefOutcome(newStage === 'won' ? 'won' : 'lost');
        setShowDebriefModal(true);
      }

      await loadDetail();
      onUpdated();
    } catch (e) {
      console.error('Stage change failed', e);
    } finally {
      setStageLoading(false);
    }
  };

  const handleAriaDraft = async () => {
    setAriaDraftLoading(true);
    try {
      const res = await pipelineApi.getAriaDraft(opportunityId);
      setAriaDraft(res.aria_draft);
    } catch (e) {
      console.error('ARIA draft failed', e);
    } finally {
      setAriaDraftLoading(false);
    }
  };

  const useAriaDraft = () => {
    if (ariaDraft) setNoteText(ariaDraft);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    try {
      await pipelineApi.saveNote(opportunityId, { notes: noteText });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
      onUpdated();
    } catch (e) {
      console.error('Save note failed', e);
    } finally {
      setNoteSaving(false);
    }
  };

  if (loading || !opp) {
    return (
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '560px',
          background: '#0c0c1e', borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 40,
        }}
      >
        <p style={{ color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}>
          Loading…
        </p>
      </div>
    );
  }

  const sc = STAGE_COLOURS[opp.stage];
  const staleColour = STALENESS_COLOURS[opp.staleness];

  const tabStyle = (tab: typeof activeTab): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'Inter, sans-serif',
    background: activeTab === tab ? 'rgba(109,40,217,0.2)' : 'transparent',
    color: activeTab === tab ? '#c4b5fd' : '#64748b',
    transition: 'all .15s',
  });

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 39, background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '560px', maxWidth: '95vw',
          background: '#0c0c1e',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          zIndex: 40,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-40px 0 80px rgba(0,0,0,0.5)',
          overflowY: 'auto',
        }}
      >
        {/* Staleness bar */}
        <div style={{ height: '3px', background: staleColour, opacity: opp.staleness === 'green' ? 0.5 : 1 }} />

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: staleColour, marginBottom: '4px' }}>
                {opp.company_name.toUpperCase()}
                {opp.days_in_stage > 0 && (
                  <span style={{ marginLeft: '8px', color: '#475569' }}>· {opp.days_in_stage} days in stage</span>
                )}
              </p>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
                {opp.deal_title}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', padding: '4px', marginTop: '-4px', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>

          {/* Stage badge + change button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                background: sc.bg,
                color: sc.text,
                border: `1px solid ${sc.border}`,
              }}
            >
              {STAGE_LABELS[opp.stage]}
            </span>
            {opp.stage !== 'won' && opp.stage !== 'lost_paused' && (
              <button
                onClick={() => setShowStageChange(v => !v)}
                style={{
                  fontSize: '12px',
                  fontFamily: 'Inter, sans-serif',
                  color: '#6d28d9',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {showStageChange ? 'Cancel' : 'Move stage →'}
              </button>
            )}
          </div>

          {/* Stage change panel */}
          {showStageChange && (
            <div
              style={{
                background: 'rgba(109,40,217,0.08)',
                border: '1px solid rgba(109,40,217,0.2)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '4px',
              }}
            >
              <p style={{ ...sectionLabel, marginBottom: '8px' }}>Move to Stage</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {[...ACTIVE_STAGES, 'won' as PipelineStage, 'lost_paused' as PipelineStage]
                  .filter(s => s !== opp.stage)
                  .map(s => {
                    const c = STAGE_COLOURS[s];
                    const selected = newStage === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setNewStage(s)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontWeight: selected ? 700 : 500,
                          cursor: 'pointer',
                          border: `1px solid ${selected ? c.border : 'rgba(255,255,255,0.08)'}`,
                          background: selected ? c.bg : 'rgba(255,255,255,0.03)',
                          color: selected ? c.text : '#64748b',
                          transition: 'all .15s',
                        }}
                      >
                        {STAGE_LABELS[s]}
                      </button>
                    );
                  })}
              </div>

              {/* Lost reason */}
              {newStage === 'lost_paused' && (
                <div style={{ marginBottom: '10px' }}>
                  <select
                    value={lostReason}
                    onChange={e => setLostReason(e.target.value as LostReason)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#f1f5f9',
                      borderRadius: '7px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                      marginBottom: '8px',
                    }}
                  >
                    <option value="">Select reason for loss *</option>
                    {(Object.keys(LOST_REASON_LABELS) as LostReason[]).map(r => (
                      <option key={r} value={r}>{LOST_REASON_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              )}

              <textarea
                placeholder="Optional: note about this stage move…"
                value={stageNote}
                onChange={e => setStageNote(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f1f5f9',
                  borderRadius: '7px',
                  padding: '8px 10px',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  resize: 'vertical',
                  minHeight: '56px',
                  outline: 'none',
                  marginBottom: '10px',
                }}
              />

              <button
                onClick={handleStageChange}
                disabled={!newStage || stageLoading || (newStage === 'lost_paused' && !lostReason)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '7px',
                  background: newStage ? STAGE_COLOURS[newStage as PipelineStage].bg : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${newStage ? STAGE_COLOURS[newStage as PipelineStage].border : 'rgba(255,255,255,0.08)'}`,
                  color: newStage ? STAGE_COLOURS[newStage as PipelineStage].text : '#475569',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: newStage ? 'pointer' : 'not-allowed',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {stageLoading ? 'Moving…' : `Confirm Move${newStage ? ` → ${STAGE_LABELS[newStage as PipelineStage]}` : ''}`}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['detail', 'notes', 'history'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
                {tab === 'detail' ? 'Details' : tab === 'notes' ? `Notes (${opp.weekly_notes?.length || 0})` : 'History'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* ── DETAILS TAB ── */}
          {activeTab === 'detail' && (
            <div>
              {opp.description && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={sectionLabel}>What They Asked For</p>
                  <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.65 }}>{opp.description}</p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <p style={metaLabel}>Estimated Value</p>
                  <p style={{ ...metaValue, color: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', fontWeight: 700 }}>
                    {formatNaira(opp.estimated_value)}
                  </p>
                </div>
                <div>
                  <p style={metaLabel}>Source</p>
                  <p style={metaValue}>{opp.source ? SOURCE_LABELS[opp.source] : '—'}</p>
                </div>
                <div>
                  <p style={metaLabel}>Date Briefed</p>
                  <p style={metaValue}>{opp.date_briefed ? new Date(opp.date_briefed).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
                <div>
                  <p style={metaLabel}>Client Deadline</p>
                  <p style={metaValue}>{opp.client_deadline ? new Date(opp.client_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
                </div>
                <div>
                  <p style={metaLabel}>Brand Admin</p>
                  <p style={metaValue}>{opp.lead_ba_name || '—'}</p>
                </div>
                <div>
                  <p style={metaLabel}>Team</p>
                  <p style={metaValue}>{opp.accountable_team_text || '—'}</p>
                </div>
              </div>

              {opp.service_types.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={metaLabel}>Services</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {opp.service_types.map(st => (
                      <span
                        key={st}
                        style={{
                          fontSize: '11px',
                          fontFamily: 'JetBrains Mono, monospace',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(109,40,217,0.12)',
                          color: '#c4b5fd',
                          border: '1px solid rgba(109,40,217,0.2)',
                        }}
                      >
                        {SERVICE_TYPE_LABELS[st]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {opp.notes && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                  }}
                >
                  <p style={sectionLabel}>Latest Notes</p>
                  <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.65 }}>{opp.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── NOTES TAB ── */}
          {activeTab === 'notes' && (
            <div>
              <SmartFollowUpPanel
                opportunityId={opp.id}
                companyName={opp.company_name}
                daysInStage={opp.days_in_stage}
                stage={opp.stage}
              />

              {/* ARIA draft section */}
              <div
                style={{
                  background: 'rgba(109,40,217,0.07)',
                  border: '1px solid rgba(109,40,217,0.18)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '20px',
                  marginTop: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#c4b5fd' }}>
                    ✦ ARIA Draft
                  </p>
                  <button
                    onClick={handleAriaDraft}
                    disabled={ariaDraftLoading}
                    style={{
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#7c3aed',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {ariaDraftLoading ? 'Generating…' : 'Generate Draft'}
                  </button>
                </div>
                {ariaDraft ? (
                  <>
                    <p style={{ fontSize: '13px', color: '#a78bfa', lineHeight: 1.65, marginBottom: '10px' }}>
                      {ariaDraft}
                    </p>
                    <button
                      onClick={useAriaDraft}
                      style={{
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#6d28d9',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      ↓ Use this draft
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                    Click "Generate Draft" — ARIA will write this week's update from deal context.
                  </p>
                )}
              </div>

              {/* Note editor */}
              <div style={{ marginBottom: '16px' }}>
                <p style={sectionLabel}>This Week's Note</p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="What happened with this deal this week? Any stage moves, conversations, or next steps?"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f1f5f9',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    resize: 'vertical',
                    minHeight: '100px',
                    outline: 'none',
                    lineHeight: 1.65,
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    onClick={handleSaveNote}
                    disabled={noteSaving || !noteText.trim()}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '7px',
                      background: noteSaved ? '#10b981' : '#6d28d9',
                      border: 'none',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Space Grotesk, sans-serif',
                      transition: 'all .2s',
                    }}
                  >
                    {noteSaving ? 'Saving…' : noteSaved ? '✓ Saved' : 'Save Note'}
                  </button>
                </div>
              </div>

              {/* Previous notes */}
              {(opp.weekly_notes?.length ?? 0) > 0 && (
                <div>
                  <p style={sectionLabel}>Previous Notes</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {opp.weekly_notes!.map((note: WeeklyNote) => (
                      <div
                        key={note.id}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '8px',
                          padding: '12px 14px',
                        }}
                      >
                        <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', marginBottom: '6px' }}>
                          Week of {new Date(note.week_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {note.added_by_name && ` · ${note.added_by_name}`}
                        </p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>
                          {note.notes || <em style={{ color: '#374151' }}>No note recorded</em>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div>
              <p style={sectionLabel}>Stage History</p>
              {(opp.stage_history?.length ?? 0) === 0 ? (
                <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  No stage changes recorded yet
                </p>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '20px' }}>
                  {/* Timeline line */}
                  <div style={{ position: 'absolute', left: '6px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(109,40,217,0.2)' }} />

                  {opp.stage_history!.map((entry, i) => {
                    const toColour = STAGE_COLOURS[entry.to_stage as PipelineStage];
                    return (
                      <div key={entry.id} style={{ marginBottom: '16px', position: 'relative' }}>
                        {/* Dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-17px',
                            top: '4px',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: i === 0 ? toColour.text : 'rgba(109,40,217,0.4)',
                            border: '2px solid #0c0c1e',
                          }}
                        />

                        <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', marginBottom: '4px' }}>
                          {new Date(entry.changed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}{entry.changed_by_name || 'System'}
                        </p>

                        <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                          {entry.from_stage
                            ? (
                              <>
                                <span style={{ color: '#64748b' }}>{STAGE_LABELS[entry.from_stage as PipelineStage]}</span>
                                {' → '}
                                <span style={{ color: toColour.text, fontWeight: 600 }}>{STAGE_LABELS[entry.to_stage as PipelineStage]}</span>
                              </>
                            )
                            : <span style={{ color: toColour.text, fontWeight: 600 }}>Added to pipeline ({STAGE_LABELS[entry.to_stage as PipelineStage]})</span>
                          }
                        </p>

                        {entry.change_notes && (
                          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', fontStyle: 'italic' }}>
                            "{entry.change_notes}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDebriefModal && (
        <DealDebriefModal
          opportunityId={opportunityId}
          companyName={opp.company_name}
          outcome={debriefOutcome}
          onSubmitted={() => {
            setShowDebriefModal(false);
            onUpdated();
          }}
          onSkip={() => setShowDebriefModal(false)}
        />
      )}
    </>
  );
}
