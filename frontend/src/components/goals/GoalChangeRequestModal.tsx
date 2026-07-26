'use client';

/**
 * GoalChangeRequestModal
 * Sabi Intelligence Suite · Goal Permission System
 *
 * Shown when a Brand Admin tries to edit or delete a locked goal.
 * They explain what they want to change and why. The request goes to
 * the Super Admin's notification queue for approval or denial.
 *
 * Usage:
 *   <GoalChangeRequestModal
 *     goal={selectedGoal}
 *     requestType="edit"          // or "delete"
 *     onClose={() => setModalOpen(false)}
 *     onRequestSent={() => toast('Request sent to Super Admin')}
 *   />
 */

import { useState } from 'react';
import { AlertTriangle, X, Send, Check, Lock } from 'lucide-react';
import { goalGeneratorApi, type BrandGoal } from './types';

interface Props {
  goal:          BrandGoal;
  requestType:   'edit' | 'delete';
  onClose:       () => void;
  onRequestSent: () => void;
}

export default function GoalChangeRequestModal({ goal, requestType, onClose, onRequestSent }: Props) {
  const [reason,          setReason]          = useState('');
  const [proposedObjective, setProposedObjective] = useState(goal.objective || goal.title);
  const [sending,         setSending]         = useState(false);
  const [sent,            setSent]            = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) { setError('Please explain why you need this change.'); return; }
    if (requestType === 'edit' && !proposedObjective.trim()) {
      setError('Please enter the proposed new objective text.');
      return;
    }
    setSending(true); setError(null);
    try {
      await goalGeneratorApi.submitChangeRequest(
        goal.id,
        requestType,
        reason.trim(),
        requestType === 'edit' ? { objective: proposedObjective } : undefined,
      );
      setSent(true);
      setTimeout(() => { onRequestSent(); onClose(); }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const S = {
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
    card:    { background: 'var(--surface-2, #fff)', border: '0.5px solid var(--border, #E5E7EB)', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' },
    input:   { width: '100%', border: '0.5px solid var(--border, #E5E7EB)', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: 'var(--surface-2, #fff)', color: 'var(--text-primary, #111827)', fontFamily: 'inherit', resize: 'vertical' as const },
    label:   { fontSize: 11, fontWeight: 600 as const, color: 'var(--text-muted, #9CA3AF)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 },
    btnPrim: { background: '#5B21B6', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500 as const, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit' },
    btnSec:  { background: 'var(--surface-2, #fff)', color: 'var(--text-primary, #111827)', border: '0.5px solid var(--border-strong, #D1D5DB)', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit' },
  };

  if (sent) {
    return (
      <div style={S.overlay}>
        <div style={{ ...S.card, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, background: '#ECFDF5', border: '0.5px solid #A7F3D0', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={26} color="#059669" strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #111827)', marginBottom: 6 }}>Request sent</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary, #6B7280)' }}>
            The Super Admin will review your request and notify you when a decision is made.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.card} role="dialog" aria-modal="true">

        {/* Header */}
        <div style={{ padding: '16px 18px 14px', borderBottom: '0.5px solid var(--border, #F3F4F6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <Lock size={14} color="#D97706" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #111827)' }}>
                Request {requestType === 'delete' ? 'goal deletion' : 'goal edit'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>
              This goal is locked — a Super Admin must approve changes.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
            <X size={16} />
          </button>
        </div>

        {/* Goal summary */}
        <div style={{ padding: '12px 18px', background: 'var(--surface-1, #F9FAFB)', borderBottom: '0.5px solid var(--border, #F3F4F6)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Goal to {requestType}</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #111827)' }}>{goal.objective || goal.title}</div>
          {goal.quarter && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{goal.quarter} · {goal.key_results?.length || 0} key results</div>}
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Delete warning */}
          {requestType === 'delete' && (
            <div style={{ background: '#FFF5F5', border: '0.5px solid #FECACA', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
                Deleting this goal will remove it from VelocityTracker and the Command Center. The audit trail will be preserved. This action requires Super Admin approval.
              </div>
            </div>
          )}

          {/* Proposed objective (edit only) */}
          {requestType === 'edit' && (
            <div>
              <label style={S.label}>Proposed new objective</label>
              <textarea
                value={proposedObjective}
                onChange={e => setProposedObjective(e.target.value)}
                rows={2}
                style={S.input}
                placeholder="Enter the revised objective text…"
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={S.label}>
              Reason for this {requestType === 'delete' ? 'deletion' : 'change'} <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={S.input}
              placeholder={requestType === 'delete'
                ? 'E.g. Client has pivoted strategy and this goal is no longer relevant…'
                : 'E.g. Client revised the Q3 target in our Monday call — the metric changed from engagement to reach…'}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: 12, color: '#DC2626', background: '#FFF5F5', padding: '8px 12px', borderRadius: 6, border: '0.5px solid #FECACA' }}>
              {error}
            </div>
          )}

          {/* What happens next */}
          <div style={{ background: '#EDE9FE', border: '0.5px solid #C4B5FD', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>What happens next</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
              {requestType === 'delete'
                ? 'Your request is sent to the Super Admin. If approved, the goal is removed from the board and the client portal. You will be notified either way.'
                : 'Your request and proposed objective are sent to the Super Admin. If approved, the change is applied immediately and you are notified.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: '0.5px solid var(--border, #F3F4F6)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btnSec}>Cancel</button>
          <button onClick={submit} disabled={sending}
            style={{ ...S.btnPrim, opacity: sending ? 0.38 : 1, cursor: sending ? 'not-allowed' : 'pointer' }}>
            {sending ? 'Sending…' : <><Send size={13} /> Send request</>}
          </button>
        </div>
      </div>
    </div>
  );
}
