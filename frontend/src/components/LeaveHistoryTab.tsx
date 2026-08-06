'use client';

import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined'
    ? localStorage.getItem('sabi_token') || '' : ''}`,
});

// ── Types ─────────────────────────────────────────────────────────

interface LeaveRequest {
  id:            string;
  user_id:       string;
  leave_type:    string;
  start_date:    string;
  end_date:      string;
  note?:         string | null;
  status:        'pending' | 'approved' | 'rejected';
  created_at:    string;
  decided_at?:   string | null;
  decision_note?: string | null;
  days_count:    number;
}

const LEAVE_LABELS: Record<string, string> = {
  annual: 'Annual Leave', sick: 'Sick Leave', study: 'Study Leave',
  maternity: 'Maternity Leave', paternity: 'Paternity Leave',
  compassionate: 'Compassionate', other: 'Other',
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending:  { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' },
  approved: { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' },
  rejected: { background: 'rgba(239,68,68,0.10)',  color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' },
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ── Main component ─────────────────────────────────────────────────

interface LeaveHistoryTabProps {
  userId:      string;
  displayName: string;
  viewerRole:  string;
}

export function LeaveHistoryTab({ userId, displayName, viewerRole }: LeaveHistoryTabProps) {
  const [requests,   setRequests]   = useState<LeaveRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const isHR = ['hr', 'super_admin', 'admin', 'md'].includes(viewerRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/api/leave/by-user/${userId}`, { headers: getHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load leave history');
      setRequests(json.requests || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Approve — calls POST /leave/:id/decide
  const decide = async (req: LeaveRequest, approve: boolean) => {
    if (!window.confirm(
      `${approve ? 'Approve' : 'Reject'} leave for ${displayName} (${fmtShort(req.start_date)} → ${fmtShort(req.end_date)})?`
    )) return;

    setActioningId(req.id);
    try {
      const res = await fetch(`${API}/leave/${req.id}/decide`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ approve, note: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Action failed');
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  // ── Skeleton
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: '70px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.6}}`}</style>
    </div>
  );

  // ── Error
  if (error) return (
    <div style={{ marginTop: '12px', padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>
      {error}
    </div>
  );

  // ── Summary chips
  const pending  = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const totalDays = requests
    .filter(r => r.status === 'approved')
    .reduce((s, r) => s + (r.days_count || 0), 0);

  return (
    <div>
      <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>
        Leave History
      </p>

      {/* Summary strip */}
      {requests.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Requests', value: requests.length, colour: '#94a3b8' },
            { label: 'Approved',       value: approved,         colour: '#10b981' },
            { label: 'Days Taken',     value: totalDays,        colour: '#6d28d9' },
            ...(pending > 0 ? [{ label: 'Pending', value: pending, colour: '#f59e0b' }] : []),
          ].map(c => (
            <div key={c.label} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.025)', border: `1px solid ${c.colour}25`, borderRadius: '8px', minWidth: '90px' }}>
              <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: c.colour, marginBottom: '2px' }}>
                {c.value}
              </p>
              <p style={{ fontSize: '10px', color: '#64748b' }}>{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Requests list */}
      {requests.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontSize: '13px', color: '#475569' }}>No leave requests on record for {displayName}.</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
          {requests.map((req, i) => {
            const actioning = actioningId === req.id;
            const isPending = req.status === 'pending';

            return (
              <div
                key={req.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: i < requests.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: isPending ? 'rgba(245,158,11,0.02)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>

                    {/* Type + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                        {LEAVE_LABELS[req.leave_type] || req.leave_type}
                      </p>
                      <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, ...STATUS_STYLE[req.status] }}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Dates + duration */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                        {fmtShort(req.start_date)} → {fmtShort(req.end_date)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                        {req.days_count} day{req.days_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Note */}
                    {req.note && (
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                        "{req.note}"
                      </p>
                    )}

                    {/* Decision note */}
                    {req.decision_note && req.status !== 'pending' && (
                      <p style={{ fontSize: '11px', color: req.status === 'approved' ? '#34d399' : '#f87171', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
                        {req.status === 'approved' ? '✓' : '✕'} {req.decision_note}
                      </p>
                    )}

                    {/* Timestamps */}
                    <p style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>
                      Requested {fmt(req.created_at)}
                      {req.decided_at ? ` · Decided ${fmt(req.decided_at)}` : ''}
                    </p>
                  </div>

                  {/* HR actions — pending only */}
                  {isHR && isPending && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignSelf: 'center' }}>
                      <button
                        onClick={() => decide(req, true)}
                        disabled={!!actioning}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', cursor: actioning ? 'wait' : 'pointer',
                          fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                          background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                          color: '#34d399', opacity: actioning ? 0.6 : 1,
                        }}
                      >
                        {actioning ? '…' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => decide(req, false)}
                        disabled={!!actioning}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', cursor: actioning ? 'wait' : 'pointer',
                          fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                          color: '#f87171', opacity: actioning ? 0.6 : 1,
                        }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {requests.length > 0 && (
        <p style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '10px' }}>
          {requests.length} request{requests.length !== 1 ? 's' : ''} · Approve/reject calls POST /api/leave/:id/decide
        </p>
      )}
    </div>
  );
}
