'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PersonFile }                                   from '@/components/people/PersonFile';
import { SupportStaffTab, AlertsTab, InternshipFields } from '@/components/people/PeopleTabComponents';
import { STATUS_COLOURS, STATUS_LABELS, EmploymentStatus } from '@/lib/people-edit-api';
import { useAgencyStore } from '@/lib/store';

// ── Auth placeholder — replace with your existing hook ────────────
const useUser = () => {
  if (typeof window === 'undefined') return { role: 'hr', name: 'HR', id: '' };
  try {
    const u = JSON.parse(localStorage.getItem('sabi_user') || '{}');
    return { role: u.role || '', name: u.full_name || u.name || '', id: u.id || '' };
  } catch { return { role: '', name: '', id: '' }; }
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined'
    ? localStorage.getItem('sabi_token') || '' : ''}`,
});

// ── Shared fetch helper ───────────────────────────────────────────
async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...opts, headers: { ...getHeaders(), ...(opts.headers || {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || json.message || 'API error');
  return json as T;
}

// ── Types ─────────────────────────────────────────────────────────

type PeopleTab = 'registry' | 'onboarding' | 'leave' | 'support' | 'documents' | 'alerts' | 'insights';

interface OnboardingEntry {
  user_id:              string;
  full_name:            string;
  role_title?:          string;
  employment_category?: string;
  start_date?:          string;
  days_since_start?:    number;
  completed_count:      number;
  total_steps:          number;
  onboarding_steps: Array<{
    key:           string;
    label:         string;
    completed:     boolean;
    completed_at?: string;
  }>;
}

interface LeaveRequest {
  id:              string;
  user_id:         string;
  requester_name?: string;
  full_name?:      string;
  role_title?:     string;
  leave_type:      string;
  start_date:      string;
  end_date:        string;
  days_count:      number;
  reason?:         string;
  status:          'pending' | 'approved' | 'rejected';
  created_at?:     string;
  note?: string;
  user: {id: string, full_name: string};
}

interface PersonDocument {
  id:             string;
  user_id:        string;
  person_name?:   string;
  full_name?:     string;
  document_type:  string;
  document_name?: string;
  file_name?:     string;
  expiry_date?:   string | null;
  file_url?:      string;
  uploaded_at?:   string;
  created_at?:    string;
}

interface HRMetric {
  key:     string;
  label:   string;
  value:   number | string;
  unit?:   string;
  target?: number;
}

// ── Expiry helpers ────────────────────────────────────────────────

const daysUntilExpiry = (expiryDate: string): number =>
  Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);

const ExpiryBadge = ({ expiry }: { expiry?: string | null }) => {
  if (!expiry) return null;
  const days = daysUntilExpiry(expiry);

  if (days < 0) return (
    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
      EXPIRED
    </span>
  );
  if (days <= 30) return (
    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
      Expires in {days}d
    </span>
  );
  if (days <= 60) return (
    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
      Expiring in {days}d
    </span>
  );
  return null;
};

// ── Shared UI primitives ──────────────────────────────────────────

const sectionHeader = (title: string, subtitle?: string) => (
  <div style={{ marginBottom: '20px' }}>
    <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: subtitle ? '4px' : 0 }}>
      {title}
    </h2>
    {subtitle && <p style={{ fontSize: '13px', color: '#64748b' }}>{subtitle}</p>}
  </div>
);

const emptyState = (msg: string) => (
  <p style={{ fontSize: '14px', color: '#475569', textAlign: 'center', padding: '40px 0' }}>{msg}</p>
);

const Skeleton = ({ rows = 4 }: { rows?: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ height: '60px', background: 'rgba(255,255,255,0.025)', borderRadius: '8px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
    ))}
    <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.6}}`}</style>
  </div>
);

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '10px', overflow: 'hidden',
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave', sick: 'Sick Leave', study: 'Study Leave',
  maternity: 'Maternity Leave', paternity: 'Paternity Leave',
  compassionate: 'Compassionate', other: 'Other',
};

// ═══════════════════════════════════════════════════════════════════
// TAB: Onboarding Pipeline
// Wire: GET /api/people/onboarding-pipeline
// ═══════════════════════════════════════════════════════════════════

function OnboardingPipelineTab({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const [list,    setList]    = useState<OnboardingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ people: OnboardingEntry[] } | OnboardingEntry[]>('/api/people/onboarding-pipeline');
        const arr = Array.isArray(data) ? data : (data as { people: OnboardingEntry[] }).people || [];
        setList(arr);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load onboarding pipeline');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getProgress = (e: OnboardingEntry) => e.total_steps > 0
    ? Math.round((e.completed_count / e.total_steps) * 100) : 0;

  const progressColour = (pct: number) =>
    pct === 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div>
      {sectionHeader(
        'Onboarding Pipeline',
        'Staff with incomplete onboarding checklists. Click any row to open their PersonFile and tick off steps or set internship details.',
      )}

      {loading ? <Skeleton /> : error ? (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>
          {error}
        </div>
      ) : list.length === 0 ? (
        emptyState('All staff have completed their onboarding checklists. 🎉')
      ) : (
        <div style={card}>
          {list.map((entry, i) => {
            const pct   = getProgress(entry);
            const colour = progressColour(pct);
            const isIntern = entry.employment_category?.startsWith('intern');

            return (
              <div
                key={entry.user_id}
                onClick={() => onOpenPerson(entry.user_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: i < list.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Avatar */}
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: `${colour}20`, border: `1px solid ${colour}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '14px', color: colour }}>
                  {entry.full_name?.charAt(0).toUpperCase() || '?'}
                </div>

                {/* Name + role */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                      {entry.full_name}
                    </p>
                    {isIntern && (
                      <span style={{ padding: '1px 7px', borderRadius: '4px', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, background: 'rgba(109,40,217,0.15)', color: '#c4b5fd', border: '1px solid rgba(109,40,217,0.25)' }}>
                        {entry.employment_category === 'intern_nysc' ? 'NYSC' : 'SIWES'}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>
                    {entry.role_title || '—'}
                    {entry.days_since_start != null ? ` · Day ${entry.days_since_start}` : ''}
                  </p>
                </div>

                {/* Progress bar */}
                <div style={{ width: '120px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b' }}>
                      {entry.completed_count}/{entry.total_steps} steps
                    </span>
                    <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: colour, fontWeight: 700 }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colour, borderRadius: '99px', transition: 'width .3s' }} />
                  </div>
                </div>

                {/* Incomplete step pills */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '200px', flexShrink: 0 }}>
                  {entry.onboarding_steps?.filter(s => !s.completed).slice(0, 3).map(s => (
                    <span key={s.key} style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {s.label}
                    </span>
                  ))}
                  {(entry.onboarding_steps?.filter(s => !s.completed).length || 0) > 3 && (
                    <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>
                      +{(entry.onboarding_steps?.filter(s => !s.completed).length || 0) - 3} more
                    </span>
                  )}
                </div>

                <span style={{ color: '#374151', flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && list.length > 0 && (
        <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '12px' }}>
          {list.length} staff with incomplete onboarding · InternshipFields render inside PersonFile for NYSC/SIWES
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Leave Management
// Wire: GET /api/leave  ·  PATCH /api/people/:id/field
// ═══════════════════════════════════════════════════════════════════

function LeaveTab({
  viewerRole, onOpenPerson,
}: {
  viewerRole: string;
  onOpenPerson: (id: string) => void;
}) {
  const [requests,    setRequests]    = useState<LeaveRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'declined' | ''>('pending');
  const [actioningId,  setActioningId]  = useState<string | null>(null);

  const isHR = ['hr', 'super_admin', 'md', 'admin'].includes(viewerRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const data = await apiFetch<{ requests: LeaveRequest[] } | LeaveRequest[]>(`/api/leave?${params}`);
      const arr = Array.isArray(data) ? data : (data as { requests: LeaveRequest[] }).requests || [];
      setRequests(arr);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Approve: set employment_status → on_leave via PATCH /people/:id/field
  const approveLeave = async (request: LeaveRequest) => {
    if (!window.confirm(`Approve leave for ${request.requester_name || request.full_name}? This will update their status to On Leave.`)) return;
    setActioningId(request.id);
    try {
      await apiFetch(`/api/people/${request.user_id}/field`, {
        method: 'PATCH',
        body: JSON.stringify({ field_name: 'employment_status', new_value: 'on_leave',   reason: `Leave approved — ${request.leave_type} from ${request.start_date} to ${request.end_date}`, }),
      });
      // Also update the leave request status itself
      await apiFetch(`/api/leave/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }).catch(() => {}); // non-fatal if route doesn't exist yet
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setActioningId(null);
    }
  };

  const rejectLeave = async (request: LeaveRequest) => {
    if (!window.confirm(`Reject leave request from ${request.requester_name || request.full_name}?`)) return;
    setActioningId(request.id);
    try {
      await apiFetch(`/api/leave/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected' }),
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Rejection failed');
    } finally {
      setActioningId(null);
    }
  };

  const STATUS_BADGE: Record<string, React.CSSProperties> = {
    pending:  { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' },
    approved: { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' },
    declined: { background: 'rgba(239,68,68,0.1)',   color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' },
  };

  return (
    <div>
      {sectionHeader(
        'Leave Requests',
        isHR
          ? "Review pending leave requests. Approving sets the staff member's status to On Leave."
          : 'Your own leave request history.',
      )}

      {/* Filter strip */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
        {(['pending', 'approved', 'declined', ''] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', border: 'none',
              background: statusFilter === s ? 'rgba(109,40,217,0.25)' : 'transparent',
              color: statusFilter === s ? '#c4b5fd' : '#64748b',
            }}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <Skeleton rows={3} /> : error ? (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>{error}</div>
      ) : requests.length === 0 ? (
        emptyState(statusFilter === 'pending' ? 'No pending leave requests.' : 'No leave requests found.')
      ) : (
        <div style={card}>
          {requests.map((req, i) => {
            const name      = req.user?.full_name || req.requester_name || 'Unknown';
            const isPending = req.status === 'pending';
            const actioning = actioningId === req.id;

            return (
              <div
                key={req.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: i < requests.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    {/* Name + badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onOpenPerson(req.user_id)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9', textAlign: 'left' }}
                      >
                        {name}
                      </button>
                      {req.role_title && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{req.role_title}</span>
                      )}
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, ...STATUS_BADGE[req.status] }}>
                        {req.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Leave details */}
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#c4b5fd', fontWeight: 600 }}>
                        {LEAVE_TYPE_LABELS[req.leave_type] || req.leave_type}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                        {new Date(req.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(req.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                        {req.days_count} day{req.days_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {req.note && (
                      <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
                        "{req.note}"
                      </p>
                    )}

                    <p style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>
                      Requested {new Date(req.created_at || req.created_at || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Actions — HR only, pending requests only */}
                  {isHR && isPending && (
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                      <button
                        onClick={() => approveLeave(req)}
                        disabled={!!actioning}
                        style={{
                          padding: '7px 14px', borderRadius: '7px', cursor: actioning ? 'wait' : 'pointer',
                          fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                          background: actioning ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.15)',
                          border: '1px solid rgba(16,185,129,0.3)', color: '#34d399',
                          opacity: actioning ? 0.6 : 1,
                        }}
                      >
                        {actioning ? '…' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => rejectLeave(req)}
                        disabled={!!actioning}
                        style={{
                          padding: '7px 14px', borderRadius: '7px', cursor: actioning ? 'wait' : 'pointer',
                          fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171',
                          opacity: actioning ? 0.6 : 1,
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

      {!loading && requests.length > 0 && (
        <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '12px' }}>
          {requests.filter(r => r.status === 'pending').length} pending · Approving calls PATCH /api/people/:id/field → employment_status: on_leave
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Documents
// Wire: GET /api/people/documents
// Badges: amber ≤ 60 days, red ≤ 30 days
// ═══════════════════════════════════════════════════════════════════

function DocumentsTab({ onOpenPerson }: { onOpenPerson: (id: string) => void }) {
  const [docs,    setDocs]    = useState<PersonDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<'' | 'expiring' | 'expired'>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ documents: PersonDocument[] } | PersonDocument[]>('/api/people/documents');
        const arr = Array.isArray(data) ? data : (data as { documents: PersonDocument[] }).documents || [];
        setDocs(arr);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const docTypes = [...new Set(docs.map(d => d.document_type).filter(Boolean))].sort();

  const filtered = docs.filter(doc => {
    const name = (doc.person_name || doc.full_name || '').toLowerCase();
    const docName = (doc.document_name || doc.file_name || '').toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !docName.includes(search.toLowerCase())) return false;
    if (typeFilter && doc.document_type !== typeFilter) return false;
    if (expiryFilter === 'expired') {
      if (!doc.expiry_date) return false;
      return daysUntilExpiry(doc.expiry_date) < 0;
    }
    if (expiryFilter === 'expiring') {
      if (!doc.expiry_date) return false;
      const d = daysUntilExpiry(doc.expiry_date);
      return d >= 0 && d <= 60;
    }
    return true;
  });

  // Count alerts for the filter button labels
  const expiredCount  = docs.filter(d => d.expiry_date && daysUntilExpiry(d.expiry_date) < 0).length;
  const expiringCount = docs.filter(d => d.expiry_date && daysUntilExpiry(d.expiry_date) >= 0 && daysUntilExpiry(d.expiry_date) <= 60).length;

  const iS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
    color: '#f1f5f9', fontFamily: 'Inter, sans-serif', outline: 'none',
  };

  return (
    <div>
      {sectionHeader(
        'Document Vault',
        'Staff documents pulled from the people_documents table (Migration 009). Expiry alert badges highlight documents needing attention.',
      )}

      {/* Alert summary strip */}
      {!loading && (expiredCount > 0 || expiringCount > 0) && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {expiredCount > 0 && (
            <button
              onClick={() => setExpiryFilter(expiryFilter === 'expired' ? '' : 'expired')}
              style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', border: '1px solid rgba(239,68,68,0.35)', background: expiryFilter === 'expired' ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.08)', color: '#f87171' }}
            >
              🔴 {expiredCount} expired document{expiredCount !== 1 ? 's' : ''}
            </button>
          )}
          {expiringCount > 0 && (
            <button
              onClick={() => setExpiryFilter(expiryFilter === 'expiring' ? '' : 'expiring')}
              style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', border: '1px solid rgba(245,158,11,0.3)', background: expiryFilter === 'expiring' ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.07)', color: '#fbbf24' }}
            >
              🟡 {expiringCount} expiring within 60 days
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input style={{ ...iS, flex: 1, minWidth: '180px' }} placeholder="Search by name or document…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...iS, cursor: 'pointer' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="" style={{ background: '#1e1e35' }}>All types</option>
          {docTypes.map(t => <option key={t} value={t} style={{ background: '#1e1e35' }}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading ? <Skeleton rows={5} /> : error ? (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>{error}</div>
      ) : filtered.length === 0 ? (
        emptyState(docs.length === 0 ? 'No documents uploaded yet.' : 'No documents match the current filter.')
      ) : (
        <div style={card}>
          {filtered.map((doc, i) => {
            const name    = doc.person_name || doc.full_name || '—';
            const docName = doc.document_name || doc.file_name || doc.document_type || '—';
            const hasAlert = doc.expiry_date && daysUntilExpiry(doc.expiry_date) <= 60;

            return (
              <div
                key={doc.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: hasAlert ? 'rgba(245,158,11,0.02)' : 'transparent',
                }}
              >
                {/* Doc type icon */}
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(109,40,217,0.1)', border: '1px solid rgba(109,40,217,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  📄
                </div>

                {/* Doc info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                      {docName}
                    </p>
                    <ExpiryBadge expiry={doc.expiry_date} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={() => onOpenPerson(doc.user_id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', color: '#c4b5fd', fontFamily: 'Inter, sans-serif' }}
                    >
                      {name}
                    </button>
                    <span style={{ fontSize: '11px', color: '#475569' }}>
                      {doc.document_type?.replace(/_/g, ' ')}
                    </span>
                    {doc.expiry_date && (
                      <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                        Expires {new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Uploaded date */}
                <span style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                  {new Date(doc.uploaded_at || doc.created_at || '').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                </span>

                {/* Open link */}
                {doc.file_url && (
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: '12px', color: '#6d28d9', fontFamily: 'Inter, sans-serif', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}
                  >
                    View ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '12px' }}>
          {filtered.length} document{filtered.length !== 1 ? 's' : ''} shown
          {expiredCount > 0 ? ` · ${expiredCount} expired` : ''}
          {expiringCount > 0 ? ` · ${expiringCount} expiring within 60d` : ''}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Insights (HR Goals + ARIA Digest)
// Wire: GET /api/agency-goals/pulse → hr_workforce category
//       POST /api/agency-goals/hr-digest
// ═══════════════════════════════════════════════════════════════════

function InsightsTab() {
  const [metrics,      setMetrics]      = useState<HRMetric[]>([]);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [digest,       setDigest]       = useState<string | null>(null);
  const [generating,   setGenerating]   = useState(false);
  const [digestError,  setDigestError]  = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setMetricsLoading(true);
      try {
        // GET /api/agency-goals/pulse — returns all category pulses
        const data = await apiFetch<{
          categories?: Array<{ id: string; metrics?: HRMetric[] }>;
          hr_workforce?: { metrics?: HRMetric[] };
          metrics?: HRMetric[];
        }>('/api/agency-goals/pulse');

        // Handle multiple possible response shapes
        let hrMetrics: HRMetric[] = [];
        if (Array.isArray(data.categories)) {
          const hrCat = data.categories.find(c => c.id === 'hr_workforce');
          hrMetrics = hrCat?.metrics || [];
        } else if (data.hr_workforce?.metrics) {
          hrMetrics = data.hr_workforce.metrics;
        } else if (Array.isArray(data.metrics)) {
          hrMetrics = data.metrics;
        }

        setMetrics(hrMetrics);
      } catch (e: unknown) {
        setMetricsError(e instanceof Error ? e.message : 'Failed to load HR metrics');
      } finally {
        setMetricsLoading(false);
      }
    })();
  }, []);

  const generateDigest = async () => {
    setGenerating(true);
    setDigestError(null);
    try {
      const data = await apiFetch<{ digest?: string; content?: string; text?: string }>('/agency-goals/hr-digest', {
        method: 'POST',
      });
      setDigest(data.digest || data.content || data.text || null);
    } catch (e: unknown) {
      setDigestError(e instanceof Error ? e.message : 'Digest generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const metricColour = (m: HRMetric): string => {
    if (m.target == null) return '#6d28d9';
    const val = Number(m.value);
    if (isNaN(val)) return '#6d28d9';
    const pct = (val / m.target) * 100;
    if (pct >= 90) return '#10b981';
    if (pct >= 70) return '#f59e0b';
    return '#f43f5e';
  };

  return (
    <div>
      {sectionHeader(
        'Workforce Insights',
        'HR & Workforce metrics from the Agency Goals framework. ARIA synthesises your people data into a leadership digest.',
      )}

      {/* HR Metrics grid */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
          HR & Workforce Goals
        </p>

        {metricsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: '90px', background: 'rgba(255,255,255,0.025)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : metricsError ? (
          <div style={{ padding: '14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>
            {metricsError}
          </div>
        ) : metrics.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }}>
            <p style={{ fontSize: '13px', color: '#475569' }}>
              No HR & Workforce metrics configured yet. Set targets in Agency Goals → HR & Workforce category.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
            {metrics.map(m => {
              const colour = metricColour(m);
              const val = Number(m.value);
              const pct = m.target ? Math.min(100, Math.round((val / m.target) * 100)) : null;

              return (
                <div key={m.key} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.025)', border: `1px solid ${colour}25`, borderRadius: '10px' }}>
                  <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 800, color: colour, marginBottom: '2px' }}>
                    {isNaN(val) ? String(m.value) : val.toLocaleString('en-NG')}{m.unit || ''}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: pct != null ? '6px' : 0 }}>{m.label}</p>
                  {pct != null && (
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colour, borderRadius: '99px' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ARIA HR Digest */}
      <div style={{ padding: '20px', background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.18)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '4px' }}>
              ARIA HR Digest
            </p>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              ARIA analyses your people data and generates a leadership-ready workforce summary — headcount trends, leave patterns, onboarding status, and retention signals.
            </p>
          </div>
          <button
            onClick={generateDigest}
            disabled={generating}
            style={{
              padding: '9px 18px', borderRadius: '8px',
              background: generating ? 'rgba(109,40,217,0.2)' : '#6d28d9',
              border: 'none', color: 'white', fontSize: '13px', fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif', cursor: generating ? 'wait' : 'pointer',
              opacity: generating ? 0.7 : 1, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '7px',
            }}
          >
            {generating ? (
              <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> ARIA thinking…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>
            ) : '✨ Generate HR Digest'}
          </button>
        </div>

        {digestError && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '13px', color: '#fca5a5', marginBottom: '12px' }}>
            {digestError}
          </div>
        )}

        {digest && (
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px' }}>
            <pre style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#e2e8f0', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {digest}
            </pre>
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => navigator.clipboard.writeText(digest).catch(() => {})}
                style={{ padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif', background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd' }}
              >
                📋 Copy Digest
              </button>
            </div>
            <p style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '8px', textAlign: 'right' }}>
              Generated by ARIA · POST /api/agency-goals/hr-digest
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function PeoplePage() {
   const { user } = useAgencyStore();
  const router = useRouter();

  const isHR   = ['hr', 'super_admin'].includes(user?.role ?? '');
  const isMD   = user?.role === 'md';
  const canView = isHR || isMD;

  useEffect(() => {
    if (!canView) router.replace('/dashboard');
  }, [canView, router]);

  const [tab,          setTab]         = useState<PeopleTab>('registry');
  const [people,       setPeople]      = useState<Record<string, unknown>[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [search,       setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openId,       setOpenId]      = useState<string | null>(null);

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.set('q',      search);
      if (statusFilter) params.set('status', statusFilter);
      const res  = await fetch(`${API}/api/people/registry?${params}`, { headers: getHeaders() });
      const data = await res.json();
      setPeople(Array.isArray(data.people) ? data.people : Array.isArray(data) ? data : []);
    } catch { setPeople([]); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { if (tab === 'registry') loadRegistry(); }, [tab, loadRegistry]);
  useEffect(() => {
    const t = setTimeout(loadRegistry, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter, loadRegistry]);

  if (!canView) return null;

  const TABS: { id: PeopleTab; label: string; hidden?: boolean; badge?: number }[] = [
    { id: 'registry',   label: 'Registry' },
    { id: 'onboarding', label: 'Onboarding', hidden: isMD },
    { id: 'leave',      label: 'Leave' },
    { id: 'support',    label: 'Support Staff', hidden: isMD },
    { id: 'documents',  label: 'Documents',     hidden: isMD },
    { id: 'alerts',     label: 'Alerts',        hidden: isMD },
    { id: 'insights',   label: 'Insights' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ padding: '24px 36px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>
              People OS · {isHR ? 'HR Admin View' : 'MD View — Read Only'}
            </p>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              People
            </h1>
          </div>
          {isHR && (
            <button style={{
              padding: '8px 16px', borderRadius: '8px', background: '#6d28d9',
              border: 'none', color: 'white', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
            }}>
              + Add Staff Member
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.filter(t => !t.hidden).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: 'Inter, sans-serif', border: 'none', whiteSpace: 'nowrap',
                background: tab === t.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: tab === t.id ? '#f1f5f9' : '#64748b',
                borderBottom: tab === t.id ? '2px solid #6d28d9' : '2px solid transparent',
                transition: 'all .15s', position: 'relative',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '24px 36px' }}>

        {/* ── REGISTRY ─────────────────────────────────────────── */}
        {tab === 'registry' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                style={{ flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', outline: 'none' }}
                placeholder="Search by name, role, or department…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="" style={{ background: '#1e1e35' }}>All statuses</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v} style={{ background: '#1e1e35' }}>{l}</option>
                ))}
              </select>
            </div>

            {loading ? <Skeleton rows={6} /> : people.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#475569', textAlign: 'center', padding: '32px 0' }}>
                {search ? `No results for "${search}"` : 'No staff records found'}
              </p>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
                {people.map((person, i) => {
                  const status = (person.employment_status as EmploymentStatus) || 'active';
                  const sc     = STATUS_COLOURS[status];
                  return (
                    <div
                      key={person.id as string || i}
                      onClick={() => setOpenId(person.user_id as string || person.id as string)}
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 20px', cursor: 'pointer', borderBottom: i < people.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(109,40,217,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '14px', color: '#c4b5fd' }}>
                        {String(person.display_name || person.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>
                          {(person.display_name as string) || (person.full_name as string) || '—'}
                        </p>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>
                          {(person.role_title as string) || (person.role_key as string) || '—'}
                          {person.department ? ` · ${person.department}` : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', flexShrink: 0 }}>
                        {person.start_date ? new Date(person.start_date as string).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
                      </span>
                      <span style={{ padding: '3px 10px', borderRadius: '5px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, flexShrink: 0, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span style={{ color: '#374151', fontSize: '13px', flexShrink: 0 }}>›</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '14px' }}>
              {people.length} staff member{people.length !== 1 ? 's' : ''} shown
              {isMD ? ' · Read-only view — contact HR to make changes' : ' · Click any row to open PersonFile'}
            </p>
          </div>
        )}

        {/* ── ONBOARDING (wired) ────────────────────────────────── */}
        {tab === 'onboarding' && isHR && (
          <OnboardingPipelineTab onOpenPerson={id => setOpenId(id)} />
        )}

        {/* ── LEAVE (wired) ─────────────────────────────────────── */}
        {tab === 'leave' && (
          <LeaveTab
            viewerRole={user?.role ? user.role : 'hr'}
            onOpenPerson={id => setOpenId(id)}
          />
        )}

        {/* ── SUPPORT STAFF ─────────────────────────────────────── */}
        {tab === 'support' && isHR && <SupportStaffTab />}

        {/* ── DOCUMENTS (wired) ─────────────────────────────────── */}
        {tab === 'documents' && isHR && (
          <DocumentsTab onOpenPerson={id => setOpenId(id)} />
        )}

        {/* ── ALERTS ───────────────────────────────────────────── */}
        {tab === 'alerts' && isHR && <AlertsTab />}

        {/* ── INSIGHTS (wired) ─────────────────────────────────── */}
        {tab === 'insights' && <InsightsTab />}

      </div>

      {/* PersonFile drawer — InternshipFields renders inside here for interns */}
      {openId && (
        <PersonFile
          userId={openId}
          viewerRole={user?.role ? user.role : 'hr'}
          onClose={() => { setOpenId(null); loadRegistry(); }}
        />
      )}
    </div>
  );
}
