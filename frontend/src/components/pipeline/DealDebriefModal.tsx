'use client';

import React, { useState } from 'react';
import {
  debriefApi, DebriefPayload,
  WIN_DECIDING_FACTORS, LOSS_OBJECTIONS,
} from '@/lib/deal-debrief-api';

interface DealDebriefModalProps {
  opportunityId: string;
  companyName:   string;
  outcome:       'won' | 'lost';
  onSubmitted:   () => void;
  onSkip?:       () => void;   // optional — allow skipping the debrief
}

// ── Shared input style ─────────────────────────────────────────────
const iS: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
  padding: '9px 13px', fontSize: '13px', color: '#f1f5f9',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const mono10: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px',
};

export function DealDebriefModal({
  opportunityId, companyName, outcome, onSubmitted, onSkip,
}: DealDebriefModalProps) {
  const isWon = outcome === 'won';

  // Won fields
  const [decidingFactor, setDecidingFactor] = useState('');
  const [whatWorked,     setWhatWorked]     = useState('');
  const [whatDifferent,  setWhatDifferent]  = useState('');
  const [deckPlayed,     setDeckPlayed]     = useState<boolean | null>(null);

  // Lost fields
  const [competitor,     setCompetitor]     = useState('');
  const [objection,      setObjection]      = useState('');
  const [objectionDetail,setObjectionDetail]= useState('');
  const [pitchAgain,     setPitchAgain]     = useState<boolean | null>(null);

  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const canSubmit = decidingFactor.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const payload: DebriefPayload = {
      opportunityId,
      outcome,
      deciding_factor: decidingFactor,
      notes:           notes.trim() || undefined,
    };

    if (isWon) {
      payload.what_worked = whatWorked.trim() || undefined;
      payload.pitch_again = deckPlayed ?? undefined;
    } else {
      payload.competitor_name = competitor.trim() || undefined;
      payload.what_failed     = objectionDetail.trim() || `${objection} — no detail provided`;
      payload.pitch_again     = pitchAgain ?? undefined;
    }

    try {
      await debriefApi.createDebrief(payload);
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save debrief');
      setSubmitting(false);
    }
  };

  const accentColour = isWon ? '#10b981' : '#f43f5e';
  const accentBg     = isWon ? 'rgba(16,185,129,0.08)'  : 'rgba(244,63,94,0.07)';
  const accentBorder = isWon ? 'rgba(16,185,129,0.25)'  : 'rgba(244,63,94,0.22)';

  const ToggleButton = ({ label, active, onClick }: { label: string; active: boolean | null; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
        border: `1px solid ${active ? accentColour + '60' : 'rgba(255,255,255,0.1)'}`,
        background: active ? accentBg : 'rgba(255,255,255,0.03)',
        color: active ? accentColour : '#64748b',
        transition: 'all .15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 80 }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', zIndex: 90,
        width: '540px', maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 64px)',
        background: '#0c0c1e',
        border: `1px solid ${accentBorder}`,
        borderRadius: '16px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: accentBg,
          borderBottom: `1px solid ${accentBorder}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontSize: '20px' }}>{isWon ? '🏆' : '📋'}</span>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>
              {isWon ? 'Deal Won — Close Debrief' : 'Deal Lost — Debrief'}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            {companyName} · What can Cerebre learn from this deal?
          </p>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── WON FORM ─────────────────────────────────────── */}
          {isWon && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>What was the deciding factor? <span style={{ color: '#f43f5e' }}>*</span></p>
                <select style={{ ...iS, cursor: 'pointer' }} value={decidingFactor} onChange={e => setDecidingFactor(e.target.value)}>
                  <option value="" style={{ background: '#1e1e35' }}>Select the main reason we won…</option>
                  {WIN_DECIDING_FACTORS.map(f => (
                    <option key={f.value} value={f.value} style={{ background: '#1e1e35' }}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>What resonated most with the client?</p>
                <textarea
                  style={{ ...iS, minHeight: '72px', resize: 'none' }}
                  placeholder="What made them choose Cerebre? Their own words if possible."
                  value={whatWorked}
                  onChange={e => setWhatWorked(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>Did the pitch deck / brief play a major role?</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ToggleButton label="Yes — deck was key" active={deckPlayed === true}  onClick={() => setDeckPlayed(p => p === true ? null : true)} />
                  <ToggleButton label="No — relationship/other"  active={deckPlayed === false} onClick={() => setDeckPlayed(p => p === false ? null : false)} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>What would you do the same next time?</p>
                <textarea
                  style={{ ...iS, minHeight: '60px', resize: 'none' }}
                  placeholder="What should Cerebre repeat in future pitches?"
                  value={whatDifferent}
                  onChange={e => setWhatDifferent(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── LOST FORM ─────────────────────────────────────── */}
          {!isWon && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>Why didn't we win? <span style={{ color: '#f43f5e' }}>*</span></p>
                <select style={{ ...iS, cursor: 'pointer' }} value={decidingFactor} onChange={e => setDecidingFactor(e.target.value)}>
                  <option value="" style={{ background: '#1e1e35' }}>Select the main objection or reason…</option>
                  {LOSS_OBJECTIONS.map(f => (
                    <option key={f.value} value={f.value} style={{ background: '#1e1e35' }}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>Which competitor did they go with? (optional)</p>
                <input
                  style={iS}
                  placeholder="Name of the agency or provider that won"
                  value={competitor}
                  onChange={e => setCompetitor(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>Tell us more — what went wrong?</p>
                <textarea
                  style={{ ...iS, minHeight: '72px', resize: 'none' }}
                  placeholder="The full story. What did the client say? What would you do differently?"
                  value={objectionDetail}
                  onChange={e => setObjectionDetail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={mono10}>Should Cerebre pitch this company again?</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ToggleButton label="Yes — worth re-approaching" active={pitchAgain === true}  onClick={() => setPitchAgain(p => p === true ? null : true)} />
                  <ToggleButton label="Not worth pursuing again"   active={pitchAgain === false} onClick={() => setPitchAgain(p => p === false ? null : false)} />
                </div>
              </div>
            </div>
          )}

          {/* Notes (both forms) */}
          <div style={{ marginBottom: '16px' }}>
            <p style={mono10}>Any other notes? (optional)</p>
            <textarea
              style={{ ...iS, minHeight: '60px', resize: 'none' }}
              placeholder="Anything else ARIA should know for pattern analysis…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div style={{
            padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.18)',
            fontSize: '12px', color: '#94a3b8', lineHeight: 1.55,
          }}>
            🧠 This debrief feeds ARIA's quarterly analysis — surfacing patterns like which industries convert best, which competitors appear most, and what objections to prepare for.
          </div>

          {error && (
            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', fontSize: '13px', color: '#fca5a5' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          {onSkip && (
            <button
              onClick={onSkip}
              style={{
                padding: '8px 14px', borderRadius: '7px', cursor: 'pointer',
                fontSize: '12px', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)', color: '#475569',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Skip for now
            </button>
          )}
          {!onSkip && <div />}
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            style={{
              padding: '9px 22px', borderRadius: '8px',
              background: submitting || !canSubmit ? `${accentColour}40` : accentColour,
              border: 'none', color: 'white',
              fontSize: '14px', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif',
              cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving…' : `Submit ${isWon ? 'Win' : 'Loss'} Debrief`}
          </button>
        </div>
      </div>
    </>
  );
}
