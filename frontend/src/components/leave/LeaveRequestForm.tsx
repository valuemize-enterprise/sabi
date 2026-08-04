'use client';

import React, { useState, useEffect } from 'react';
import {
  workforceApi, LEAVE_TYPES, LEAVE_STATUS_COLOURS,
  countBusinessDays, LeaveType, LeaveRequest,
} from '@/lib/workforce-api';

// ── Leave type descriptions ────────────────────────────────────────
const LEAVE_DESCRIPTIONS: Record<LeaveType, string> = {
  Annual:        'Your annual leave entitlement. Requires HR approval.',
  Sick:          'For illness or medical appointments. No advance notice needed.',
  Compassionate: 'For bereavement or family emergencies.',
  Study:         'For exams, courses, or training sessions.',
  Other:         'For any other approved leave reason.',
};

// ── My leave history card ─────────────────────────────────────────
const MyLeaveHistory = ({ requests }: { requests: LeaveRequest[] }) => {
  if (!requests.length) return (
    <p style={{ fontSize: '13px', color: '#475569', padding: '16px 0' }}>
      No leave requests submitted yet.
    </p>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {requests.map(r => {
        const sc = LEAVE_STATUS_COLOURS[r.status];
        const start = new Date(r.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const end   = new Date(r.end_date).toLocaleDateString('en-GB',   { day: 'numeric', month: 'short', year: 'numeric' });
        return (
          <div
            key={r.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '12px 16px', borderRadius: '9px',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{
                fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
                fontWeight: 700, color: '#f1f5f9', marginBottom: '2px',
              }}>
                {r.leave_type} Leave
              </p>
              <p style={{ fontSize: '12px', color: '#64748b' }}>
                {start} – {end}
                {' · '}{r.days_count} day{r.days_count !== 1 ? 's' : ''}
                {r.reason ? ` · ${r.reason}` : ''}
              </p>
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: '5px', fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
              textTransform: 'uppercase', flexShrink: 0,
            }}>
              {r.status}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ── Main form component ────────────────────────────────────────────

interface LeaveRequestFormProps {
  onSubmitted?: () => void;    // optional callback after successful submit
  compact?:     boolean;       // compact mode for rendering inside a modal
}

export function LeaveRequestForm({ onSubmitted, compact = false }: LeaveRequestFormProps) {
  const [view,        setView]       = useState<'form' | 'history'>('form');
  const [leaveType,   setLeaveType]  = useState<LeaveType>('Annual');
  const [startDate,   setStartDate]  = useState('');
  const [endDate,     setEndDate]    = useState('');
  const [reason,      setReason]     = useState('');
  const [daysCount,   setDaysCount]  = useState(0);
  const [submitting,  setSubmitting] = useState(false);
  const [submitted,   setSubmitted]  = useState(false);
  const [error,       setError]      = useState<string | null>(null);
  const [history,     setHistory]    = useState<LeaveRequest[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // Auto-calculate business days when dates change
  useEffect(() => {
    if (startDate && endDate && endDate >= startDate) {
      setDaysCount(countBusinessDays(startDate, endDate));
    } else {
      setDaysCount(0);
    }
  }, [startDate, endDate]);

  // Load history when switching to history view
  useEffect(() => {
    if (view === 'history') {
      setLoadingHist(true);
      workforceApi.getMyLeave()
        .then(({ requests }) => setHistory(requests))
        .catch(() => {})
        .finally(() => setLoadingHist(false));
    }
  }, [view]);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      setError('Please select your start and end dates');
      return;
    }
    if (endDate < startDate) {
      setError('End date cannot be before start date');
      return;
    }
    if (daysCount === 0) {
      setError('Your selected dates fall on a weekend. Please choose working days.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await workforceApi.submitLeave({
        leave_type: leaveType,
        start_date: startDate,
        end_date:   endDate,
        days_count: daysCount,
        reason:     reason.trim() || undefined,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '10px 14px', fontSize: '14px',
    color: '#f1f5f9', fontFamily: 'Inter, sans-serif', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  const today    = new Date().toISOString().split('T')[0];
  const maxDate  = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

  // ── Success state ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div style={{
        padding: '32px 24px', textAlign: 'center',
        background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)',
        borderRadius: '14px',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '14px' }}>✅</div>
        <p style={{
          fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px',
          fontWeight: 800, color: '#10b981', marginBottom: '8px',
        }}>
          Leave Request Submitted
        </p>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.65, marginBottom: '20px' }}>
          Your <strong style={{ color: '#f1f5f9' }}>{leaveType} Leave</strong> request for{' '}
          <strong style={{ color: '#f1f5f9' }}>{daysCount} day{daysCount !== 1 ? 's' : ''}</strong> has been
          received. HR and your MD will review it and you will be notified of the decision.
        </p>
        <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          Do not make travel arrangements until your request has been formally approved.
        </p>
        <button
          onClick={() => { setSubmitted(false); setStartDate(''); setEndDate(''); setReason(''); setView('history'); }}
          style={{
            marginTop: '20px', padding: '9px 20px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f1f5f9', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          View my requests
        </button>
      </div>
    );
  }

  return (
    <div style={compact ? {} : {
      background: '#0d0d1a', minHeight: '100vh',
      color: '#f1f5f9', fontFamily: 'Inter, sans-serif',
      padding: '24px',
    }}>

      {/* Page header (non-compact only) */}
      {!compact && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>
            My Leave
          </p>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 800, marginBottom: '0' }}>
            Leave Request
          </h1>
        </div>
      )}

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '9px', padding: '4px', width: 'fit-content' }}>
        {(['form', 'history'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 16px', borderRadius: '7px', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              border: 'none',
              background: view === v ? 'rgba(109,40,217,0.25)' : 'transparent',
              color: view === v ? '#c4b5fd' : '#64748b',
              transition: 'all .15s',
            }}
          >
            {v === 'form' ? 'New Request' : 'My History'}
          </button>
        ))}
      </div>

      {/* ── FORM VIEW ─────────────────────────────────────────── */}
      {view === 'form' && (
        <div style={{ maxWidth: '560px' }}>

          {/* Leave type selector */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px' }}>
              Leave Type
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {LEAVE_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setLeaveType(type)}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                    border: '1px solid',
                    background: leaveType === type ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.03)',
                    borderColor: leaveType === type ? 'rgba(109,40,217,0.5)' : 'rgba(255,255,255,0.08)',
                    color: leaveType === type ? '#c4b5fd' : '#64748b',
                    transition: 'all .15s',
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
              {LEAVE_DESCRIPTIONS[leaveType]}
            </p>
          </div>

          {/* Date range */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px' }}>
              Dates
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                  Start date
                </p>
                <input
                  type="date"
                  style={inputStyle}
                  min={today}
                  max={maxDate}
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) setEndDate('');
                  }}
                />
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', fontFamily: 'Inter, sans-serif' }}>
                  End date
                </p>
                <input
                  type="date"
                  style={inputStyle}
                  min={startDate || today}
                  max={maxDate}
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  disabled={!startDate}
                />
              </div>
            </div>

            {/* Day count badge */}
            {daysCount > 0 && (
              <div style={{
                marginTop: '10px', display: 'inline-flex', alignItems: 'baseline',
                gap: '6px', padding: '6px 14px', borderRadius: '8px',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
              }}>
                <span style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px',
                  fontWeight: 800, color: '#10b981',
                }}>
                  {daysCount}
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  business day{daysCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px' }}>
              Reason <span style={{ color: '#374151', fontWeight: 400 }}>— optional</span>
            </p>
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="Add any additional context for HR or your manager (optional)…"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: '16px', padding: '10px 14px',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: '8px', fontSize: '13px', color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !startDate || !endDate || daysCount === 0}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: submitting || !startDate || !endDate || daysCount === 0
                ? 'rgba(109,40,217,0.3)' : '#6d28d9',
              border: 'none', color: 'white',
              fontSize: '15px', fontWeight: 800,
              fontFamily: 'Space Grotesk, sans-serif',
              cursor: submitting || !startDate || !endDate || daysCount === 0
                ? 'not-allowed' : 'pointer',
              transition: 'background .2s',
            }}
          >
            {submitting ? 'Submitting…' : `Submit ${leaveType} Leave Request${daysCount > 0 ? ` (${daysCount} day${daysCount !== 1 ? 's' : ''})` : ''}`}
          </button>

          <p style={{ fontSize: '12px', color: '#374151', textAlign: 'center', marginTop: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
            HR and your MD will be notified immediately.
          </p>
        </div>
      )}

      {/* ── HISTORY VIEW ──────────────────────────────────────── */}
      {view === 'history' && (
        <div style={{ maxWidth: '560px' }}>
          <p style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px',
            fontWeight: 700, color: '#f1f5f9', marginBottom: '14px',
          }}>
            My Leave History
          </p>
          {loadingHist ? (
            <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              Loading…
            </p>
          ) : (
            <MyLeaveHistory requests={history} />
          )}
        </div>
      )}
    </div>
  );
}
