'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PersonFile } from '@/components/people/PersonFile';
import { SupportStaffTab, AlertsTab, InternshipFields } from '@/components/people/PeopleTabComponents';
import { STATUS_COLOURS, STATUS_LABELS, EmploymentStatus } from '@/lib/people-edit-api';

// ── Auth placeholder — replace with your existing hook ────────────
const useUser = () => {
  if (typeof window === 'undefined') return { role: 'hr', name: 'HR', id: '' };
  try {
    const u = JSON.parse(localStorage.getItem('sabi_user') || '{}');
    return { role: u.role || '', name: u.full_name || u.name || '', id: u.id || '' };
  } catch { return { role: '', name: '', id: '' }; }
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined'
    ? localStorage.getItem('sabi_token') || '' : ''}`,
});

type PeopleTab = 'registry' | 'onboarding' | 'leave' | 'support' | 'documents' | 'alerts' | 'insights';

export default function PeoplePage() {
  const user    = useUser();
  const router  = useRouter();

  const isHR   = ['hr', 'super_admin'].includes(user.role);
  const isMD   = user.role === 'md';
  const canView = isHR || isMD;

  useEffect(() => {
    if (!canView) router.replace('/dashboard');
  }, [canView, router]);

  const [tab,        setTab]       = useState<PeopleTab>('registry');
  const [people,     setPeople]    = useState<Record<string, unknown>[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [search,     setSearch]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openId,     setOpenId]    = useState<string | null>(null);

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)       params.set('q',      search);
      if (statusFilter) params.set('status', statusFilter);
      const res  = await fetch(`${API}/people/registry?${params}`, { headers: getHeaders() });
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

  const TABS: { id: PeopleTab; label: string; hidden?: boolean }[] = [
    { id: 'registry',  label: 'Registry' },
    { id: 'onboarding', label: 'Onboarding', hidden: isMD },
    { id: 'leave',     label: 'Leave' },
    { id: 'support',   label: 'Support Staff', hidden: isMD },
    { id: 'documents', label: 'Documents',     hidden: isMD },
    { id: 'alerts',    label: 'Alerts',        hidden: isMD },
    { id: 'insights',  label: 'Insights' },
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
                background: tab === t.id
                  ? 'rgba(255,255,255,0.06)'
                  : 'transparent',
                color: tab === t.id ? '#f1f5f9' : '#64748b',
                borderBottom: tab === t.id ? '2px solid #6d28d9' : '2px solid transparent',
                transition: 'all .15s',
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
            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                style={{
                  flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  padding: '9px 14px', fontSize: '13px', color: '#f1f5f9',
                  fontFamily: 'Inter, sans-serif', outline: 'none',
                }}
                placeholder="Search by name, role, or department…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', padding: '9px 14px', fontSize: '13px',
                  color: '#f1f5f9', fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="" style={{ background: '#1e1e35' }}>All statuses</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v} style={{ background: '#1e1e35' }}>{l}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ height: '56px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                ))}
                <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
              </div>
            ) : people.length === 0 ? (
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
                      style={{
                        display: 'flex', alignItems: 'center', gap: '16px',
                        padding: '14px 20px', cursor: 'pointer',
                        borderBottom: i < people.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(109,40,217,0.2)', border: '1px solid rgba(109,40,217,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '14px', color: '#c4b5fd',
                      }}>
                        {String(person.display_name || person.full_name || '?').charAt(0).toUpperCase()}
                      </div>

                      {/* Name + role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>
                          {(person.display_name as string) || (person.full_name as string) || '—'}
                        </p>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>
                          {(person.role_title as string) || (person.role_key as string) || '—'}
                          {person.department ? ` · ${person.department}` : ''}
                        </p>
                      </div>

                      {/* Department */}
                      <span style={{ fontSize: '12px', color: '#475569', display: 'none' }}>{person.department as string}</span>

                      {/* Start date */}
                      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#475569', flexShrink: 0 }}>
                        {person.start_date
                          ? new Date(person.start_date as string).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                          : '—'}
                      </span>

                      {/* Status badge */}
                      <span style={{
                        padding: '3px 10px', borderRadius: '5px', fontSize: '10px',
                        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, flexShrink: 0,
                        background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                      }}>
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

        {/* ── SUPPORT STAFF ─────────────────────────────────────── */}
        {tab === 'support' && isHR && <SupportStaffTab />}

        {/* ── ALERTS ───────────────────────────────────────────── */}
        {tab === 'alerts' && isHR && <AlertsTab />}

        {/* ── ONBOARDING ───────────────────────────────────────── */}
        {tab === 'onboarding' && isHR && (
          <div>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
              Onboarding Pipeline
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Staff currently in their onboarding period (first 90 days) or with incomplete onboarding checklists. Click any row to open their PersonFile and update their checklist or set internship details.
            </p>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                Wire to: GET /api/people/onboarding-pipeline to show staff with incomplete onboarding.{'\n'}
                The InternshipFields component (exported from PeopleTabComponents.tsx) renders inside PersonFile for any intern.
              </p>
            </div>
          </div>
        )}

        {/* ── LEAVE ────────────────────────────────────────────── */}
        {tab === 'leave' && (
          <div>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
              Leave Requests
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Pending leave requests appear here for HR and MD to review and approve. Approved requests update the staff member's employment_status to 'on_leave' via the status machine.
            </p>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                Wire to: GET /api/leave (existing leave routes from Phase A). Approve action calls PATCH /api/people/:id/field with employment_status → on_leave.
              </p>
            </div>
          </div>
        )}

        {/* ── DOCUMENTS ────────────────────────────────────────── */}
        {tab === 'documents' && isHR && (
          <div>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
              Document Vault
            </p>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                Wire to: GET /api/people/documents (existing people_documents table from Migration 009). Add expiry alert badges: amber = expiring within 60 days, red = within 30 days.
              </p>
            </div>
          </div>
        )}

        {/* ── INSIGHTS ─────────────────────────────────────────── */}
        {tab === 'insights' && (
          <div>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
              Workforce Insights
            </p>
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
              <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                Wire to: Agency Goals HR &amp; Workforce category (Phase B) for headcount, retention, vacancy metrics. ARIA HR digest button calls POST /api/agency-goals/hr-digest.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* PersonFile drawer */}
      {openId && (
        <PersonFile
          userId={openId}
          viewerRole={user.role}
          onClose={() => { setOpenId(null); loadRegistry(); }}
        />
      )}
    </div>
  );
}
