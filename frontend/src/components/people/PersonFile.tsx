'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  peopleEditApi, STATUS_LABELS, STATUS_COLOURS,
  FIELD_LABELS, EmploymentStatus,
} from '@/lib/people-edit-api';
import { InlineFieldEdit } from './InlineFieldEdit';
import { HistoryTab, DisciplinaryTab } from './PeopleTabComponents';
import { PerformanceTab } from '../PerformanceTab';
import { LeaveHistoryTab } from '../LeaveHistoryTab';
import { useAgencyStore } from '@/lib/store';

// ── Status transition map (allowed transitions from each state) ────
const ALLOWED_TRANSITIONS: Record<EmploymentStatus, EmploymentStatus[]> = {
  probation: ['active', 'terminated'],
  active: ['on_leave', 'suspended', 'resigned', 'terminated'],
  on_leave: ['active'],
  suspended: ['active', 'terminated'],
  resigned: [],
  terminated: [],
};

// ── Tier badge ─────────────────────────────────────────────────────
const TierBadge = ({ tier }: { tier: 1 | 2 | 3 }) => {
  const colours = {
    1: { bg: 'rgba(16,185,129,0.1)', text: '#10b981' },
    2: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
    3: { bg: 'rgba(244,63,94,0.1)', text: '#fb7185' },
  };
  return (
    <span style={{
      padding: '1px 6px', borderRadius: '3px', fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
      background: colours[tier].bg, color: colours[tier].text,
    }}>
      TIER {tier}
    </span>
  );
};

// ── Field row in Profile tab ───────────────────────────────────────
const FieldRow = ({ label, tier, children }: {
  label: string; tier: 1 | 2 | 3; children: React.ReactNode;
}) => (
  <div style={{
    display: 'flex', gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    alignItems: 'flex-start',
  }}>
    <div style={{ width: '130px', flexShrink: 0, paddingTop: '2px' }}>
      <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>
        {label}
      </span>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    <TierBadge tier={tier} />
  </div>
);

// ── PersonFile Drawer ──────────────────────────────────────────────
interface PersonFileProps {
  userId: string;
  onClose: () => void;
  viewerRole: string;  // 'hr' | 'super_admin' | 'md' | etc.
}

type Tab = 'profile' | 'performance' | 'leave' | 'history' | 'disciplinary';

const EMPLOYMENT_STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }));

export function PersonFile({ userId, onClose, viewerRole }: PersonFileProps) {
  const { user } = useAgencyStore();
  const isHR = ['hr', 'super_admin'].includes(viewerRole);
  const isMD = viewerRole === 'md';
  const canEdit = isHR;

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [person, setPerson] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Reuse existing people API for person data
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/people/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('sabi_token') || ''}`,
          },
        }
      );
      const data = await res.json();
      setPerson(data.record || data);
    } catch { /* graceful */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleFieldSaved = (field: string, value: string) => {
    setPerson(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'performance', label: 'Performance' },
    { id: 'leave', label: 'Leave' },
    { id: 'history', label: 'History', hidden: !isHR },
    { id: 'disciplinary', label: 'Disciplinary', hidden: !isHR },
  ];

  const rawEmploymentStatus = typeof person?.employment_status === 'string' ? person.employment_status as EmploymentStatus : null;
  const statusValue = rawEmploymentStatus ?? 'active';
  const statusColour = STATUS_COLOURS[statusValue];
  const displayName = (person?.display_name as string) || (person?.full_name as string) || 'Staff Member';
  const recordId = (person?.record_id as string) || (person?.id as string) || '';
  const roleText = String(person?.role_title ?? person?.role_key ?? '—');

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '520px', background: '#0c0c1e',
        border: '1px solid rgba(255,255,255,0.1)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: 'rgba(109,40,217,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {loading ? (
                <div style={{ width: '160px', height: '22px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px' }} />
              ) : (
                <>
                  <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f1f5f9', marginBottom: '4px' }}>
                    {displayName}
                  </h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                      {roleText}
                    </span>
                    {rawEmploymentStatus && (
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                        background: statusColour.bg, color: statusColour.text,
                        border: `1px solid ${statusColour.border}`,
                      }}>
                        {STATUS_LABELS[statusValue]}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px', marginTop: '16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {tabs.filter(t => !t.hidden).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px', borderRadius: '7px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  border: 'none', whiteSpace: 'nowrap',
                  background: activeTab === tab.id ? 'rgba(109,40,217,0.25)' : 'transparent',
                  color: activeTab === tab.id ? '#c4b5fd' : '#64748b',
                  transition: 'all .15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '40px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
              <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
            </div>
          ) : (
            <>
              {/* ── PROFILE TAB ────────────────────────────────── */}
              {activeTab === 'profile' && person && (
                <div>
                  {/* Tier 1 fields */}
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '8px' }}>
                    Tier 1 — Visible to all
                  </p>

                  {[
                    { field: 'display_name', label: 'Display Name', type: 'text' as const },
                    { field: 'role_title', label: 'Title', type: 'text' as const },
                    { field: 'role_key', label: 'Role', type: 'text' as const },
                    { field: 'department', label: 'Department', type: 'text' as const },
                    { field: 'start_date', label: 'Start Date', type: 'date' as const },
                    { field: 'spark_line', label: 'Bio', type: 'text' as const },
                  ].map(f => (
                    <FieldRow key={f.field} label={FIELD_LABELS[f.field] || f.field} tier={1}>
                      <InlineFieldEdit
                        recordId={recordId}
                        fieldName={f.field}
                        currentValue={person[f.field] as string}
                        isEditable={canEdit}
                        inputType={f.type}
                        onSaved={v => handleFieldSaved(f.field, v)}
                      />
                    </FieldRow>
                  ))}

                  {/* Tier 2 fields */}
                  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '.1em', margin: '20px 0 8px' }}>
                    Tier 2 — HR / Super Admin / MD
                  </p>

                  <FieldRow label="Employment Type" tier={2}>
                    <InlineFieldEdit
                      recordId={recordId} fieldName="employment_type"
                      currentValue={person.employment_type as string}
                      isEditable={canEdit}
                      inputType="select"
                      selectOptions={[
                        { value: 'full_time', label: 'Full Time' },
                        { value: 'contract', label: 'Contract' },
                        { value: 'intern', label: 'Intern' },
                      ]}
                      onSaved={v => handleFieldSaved('employment_type', v)}
                    />
                  </FieldRow>

                  <FieldRow label="Employment Status" tier={2}>
                    <InlineFieldEdit
                      recordId={recordId} fieldName="employment_status"
                      currentValue={person.employment_status as string}
                      displayValue={STATUS_LABELS[(person.employment_status as EmploymentStatus) || 'active']}
                      isEditable={canEdit && !['resigned', 'terminated'].includes(person.employment_status as string)}
                      inputType="select"
                      selectOptions={
                        ALLOWED_TRANSITIONS[(person.employment_status as EmploymentStatus) || 'active']
                          .map(s => ({ value: s, label: STATUS_LABELS[s] }))
                      }
                      onSaved={v => handleFieldSaved('employment_status', v)}
                    />
                  </FieldRow>

                  {[
                    { field: 'work_phone', label: 'Work Phone', type: 'text' as const },
                    { field: 'probation_end', label: 'Probation End Date', type: 'date' as const },
                    { field: 'contract_end_date', label: 'Contract End Date', type: 'date' as const },
                    { field: 'tp_cohort', label: "Tomorrow's People Cohort", type: 'text' as const },
                  ].map(f => (
                    <FieldRow key={f.field} label={FIELD_LABELS[f.field] || f.label} tier={2}>
                      <InlineFieldEdit
                        recordId={recordId} fieldName={f.field}
                        currentValue={person[f.field] as string}
                        isEditable={canEdit} inputType={f.type}
                        onSaved={v => handleFieldSaved(f.field, v)}
                      />
                    </FieldRow>
                  ))}

                  {/* Tier 3 fields — HR and SA only (MD sees with audit log via backend) */}
                  {(isHR || isMD) && (
                    <>
                      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#fb7185', textTransform: 'uppercase', letterSpacing: '.1em', margin: '20px 0 8px' }}>
                        Tier 3 — HR / Super Admin only · Audit logged
                      </p>
                      {[
                        { field: 'personal_email', label: 'Personal Email', type: 'text' as const },
                        { field: 'personal_phone', label: 'Personal Phone', type: 'text' as const },
                        { field: 'date_of_birth', label: 'Date of Birth', type: 'date' as const },
                        { field: 'emergency_contact', label: 'Emergency Contact', type: 'text' as const },
                        { field: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text' as const },
                        { field: 'comp_band', label: 'Salary Band', type: 'text' as const },
                        { field: 'hr_notes', label: 'HR Notes', type: 'textarea' as const },
                      ].map(f => (
                        <FieldRow key={f.field} label={FIELD_LABELS[f.field] || f.field} tier={3}>
                          <InlineFieldEdit
                            recordId={recordId} fieldName={f.field}
                            currentValue={person[f.field] as string}
                            isEditable={isHR}  // MD reads but cannot edit Tier 3
                            inputType={f.type as any}
                            onSaved={v => handleFieldSaved(f.field, v)}
                          />
                        </FieldRow>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* ── PERFORMANCE TAB ──────────────────────────── */}
              {activeTab === 'performance' && (
                <div>
                  <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
                    Performance Summary
                  </p>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    Score history, manager ratings, and contribution claims for {displayName} are pulled from the existing scoring system. This tab surfaces the full picture in People OS context.
                  </p>
                  {/* Score chart would be wired to the existing /api/agency/scores/:userId endpoint */}
                  <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      <PerformanceTab userId={userId} displayName={displayName} viewerRole={user?.role || viewerRole}/>
                    </p>
                  </div>
                </div>
              )}

              {/* ── LEAVE TAB ────────────────────────────────── */}
              {activeTab === 'leave' && (
                <div>
                  <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
                    Leave History
                  </p>
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '12px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      <LeaveHistoryTab
                        userId={userId}
                        displayName={displayName}
                        viewerRole={viewerRole}
                      />
                    </p>
                  </div>
                </div>
              )}

              {/* ── HISTORY TAB ──────────────────────────────── */}
              {activeTab === 'history' && isHR && recordId && (
                <HistoryTab recordId={recordId} />
              )}

              {/* ── DISCIPLINARY TAB ─────────────────────────── */}
              {activeTab === 'disciplinary' && isHR && (
                <DisciplinaryTab userId={userId} isHR={isHR} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
