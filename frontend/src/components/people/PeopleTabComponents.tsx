'use client';

// ═══════════════════════════════════════════════════════════════════
// People OS — Tab Components (Phase C)
// Exports: HistoryTab, DisciplinaryTab, AlertsTab, SupportStaffTab, InternshipFields
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  peopleEditApi, ChangeHistoryEntry, DisciplinaryEntry,
  SupportStaff, Vacancy, AlertsData,
  DISC_TYPE_LABELS, DISC_TYPE_COLOURS, FIELD_LABELS,
} from '@/lib/people-edit-api';

// ── Shared styles ────────────────────────────────────────────────
const inputS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '7px', padding: '8px 12px', fontSize: '13px',
  color: '#f1f5f9', fontFamily: 'Inter, sans-serif', outline: 'none',
  width: '100%', boxSizing: 'border-box' as const,
};
const btnPrimary: React.CSSProperties = {
  padding: '7px 16px', borderRadius: '7px', background: '#6d28d9',
  border: 'none', color: 'white', fontSize: '13px', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};
const btnSecondary: React.CSSProperties = {
  padding: '7px 14px', borderRadius: '7px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.09)', color: '#64748b',
  fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px',
  fontWeight: 700, color: '#f1f5f9', marginBottom: '12px',
};
const mono: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
  color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '.08em',
};

// ── HistoryTab ────────────────────────────────────────────────────

interface HistoryTabProps { recordId: string }

export function HistoryTab({ recordId }: HistoryTabProps) {
  const [history, setHistory] = useState<ChangeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    peopleEditApi.getHistory(recordId)
      .then(({ history: h }) => setHistory(h))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [recordId]);

  if (loading) return <p style={{ ...mono, padding: '20px 0' }}>Loading history…</p>;
  if (!history.length) return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <p style={{ fontSize: '14px', color: '#475569' }}>No changes recorded yet.</p>
      <p style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>Changes will appear here when HR edits any field on this record.</p>
    </div>
  );

  const TIER_COLOUR: Record<number, string> = { 1: '#64748b', 2: '#f59e0b', 3: '#f43f5e' };

  return (
    <div>
      {history.map((entry, i) => (
        <div
          key={entry.id}
          style={{
            display: 'flex', gap: '14px', paddingBottom: '14px',
            marginBottom: i < history.length - 1 ? '14px' : 0,
            borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
          }}
        >
          {/* Timeline dot */}
          <div style={{ paddingTop: '4px', flexShrink: 0 }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: TIER_COLOUR[entry.tier] || '#64748b',
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                {FIELD_LABELS[entry.field_name] || entry.field_name}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                changed by {entry.changed_by_user?.full_name || 'HR'}
              </span>
              <span style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>
                {new Date(entry.changed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}&nbsp;
                {new Date(entry.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Old → New */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
              {entry.old_value != null && (
                <>
                  <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'line-through' }}>
                    {entry.old_value}
                  </span>
                  <span style={{ color: '#374151', fontSize: '12px' }}>→</span>
                </>
              )}
              <span style={{ fontSize: '12px', color: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                {entry.new_value}
              </span>
              {entry.tier === 3 && (
                <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', padding: '1px 6px', borderRadius: '3px', background: 'rgba(244,63,94,0.1)', color: '#fb7185', marginLeft: '4px' }}>
                  TIER 3
                </span>
              )}
            </div>

            {entry.reason && (
              <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                Reason: {entry.reason}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DisciplinaryTab ───────────────────────────────────────────────

interface DisciplinaryTabProps { userId: string; isHR: boolean }

export function DisciplinaryTab({ userId, isHR }: DisciplinaryTabProps) {
  const [entries,  setEntries]  = useState<DisciplinaryEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [form,     setForm]     = useState({ type: 'verbal_warning', date_issued: '', description: '', outcome: '' });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(() => {
    peopleEditApi.getDisciplinary(userId)
      .then(({ disciplinary: d }) => setEntries(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!form.date_issued || !form.description.trim()) {
      setError('Date and description are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await peopleEditApi.addDisciplinary(userId, form as any);
      setAdding(false);
      setForm({ type: 'verbal_warning', date_issued: '', description: '', outcome: '' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (entryId: string, outcome: string) => {
    try {
      await peopleEditApi.resolveDisciplinary(entryId, outcome);
      load();
    } catch (e: unknown) {
      console.error('Resolve failed:', e);
    }
  };

  if (loading) return <p style={{ ...mono, padding: '20px 0' }}>Loading…</p>;

  return (
    <div>
      {isHR && (
        <div style={{ marginBottom: '16px' }}>
          {!adding ? (
            <button onClick={() => setAdding(true)} style={{ ...btnPrimary, fontSize: '12px' }}>
              + Add disciplinary entry
            </button>
          ) : (
            <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '16px' }}>
              <p style={{ ...sectionTitle, marginBottom: '12px', fontSize: '13px' }}>New Disciplinary Entry</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <select style={inputS} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {Object.entries(DISC_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v} style={{ background: '#1e1e35' }}>{l}</option>
                  ))}
                </select>
                <input type="date" style={inputS} value={form.date_issued} onChange={e => setForm(p => ({ ...p, date_issued: e.target.value }))} />
              </div>
              <textarea style={{ ...inputS, minHeight: '70px', resize: 'none', marginBottom: '10px' }} placeholder="Description of the incident and action taken…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              <input style={{ ...inputS, marginBottom: '10px' }} placeholder="Outcome / resolution (optional)" value={form.outcome} onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))} />
              {error && <p style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '8px' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleAdd} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Save Entry'}</button>
                <button onClick={() => { setAdding(false); setError(null); }} style={btnSecondary}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!entries.length ? (
        <p style={{ fontSize: '13px', color: '#475569' }}>No disciplinary records for this staff member.</p>
      ) : (
        entries.map(entry => (
          <div key={entry.id} style={{
            marginBottom: '12px', padding: '14px 16px', borderRadius: '10px',
            background: entry.is_resolved ? 'rgba(255,255,255,0.02)' : 'rgba(239,68,68,0.06)',
            border: `1px solid ${entry.is_resolved ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: `${DISC_TYPE_COLOURS[entry.type as keyof typeof DISC_TYPE_COLOURS]}15`,
                  color: DISC_TYPE_COLOURS[entry.type as keyof typeof DISC_TYPE_COLOURS],
                  border: `1px solid ${DISC_TYPE_COLOURS[entry.type as keyof typeof DISC_TYPE_COLOURS]}35`,
                }}>
                  {DISC_TYPE_LABELS[entry.type as keyof typeof DISC_TYPE_LABELS]}
                </span>
                {entry.is_resolved && <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#10b981' }}>RESOLVED</span>}
              </div>
              <span style={{ ...mono, fontSize: '11px' }}>
                {new Date(entry.date_issued).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '6px' }}>{entry.description}</p>
            {entry.outcome && <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Outcome: {entry.outcome}</p>}
            {!entry.is_resolved && isHR && (
              <button
                onClick={() => {
                  const out = prompt('Describe the resolution:');
                  if (out) handleResolve(entry.id, out);
                }}
                style={{ ...btnSecondary, marginTop: '10px', fontSize: '11px', padding: '4px 10px' }}
              >
                Mark Resolved
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── SupportStaffTab ───────────────────────────────────────────────

export function SupportStaffTab() {
  const [staff,   setStaff]   = useState<SupportStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [form,    setForm]    = useState<Partial<SupportStaff>>({ role_type: 'driver', status: 'active' });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    peopleEditApi.getSupportStaff()
      .then(({ staff: s }) => setStaff(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const ROLE_TYPES = ['driver','receptionist','cleaner','security','facility','other'];

  const handleCreate = async () => {
    if (!form.full_name?.trim() || !form.role_type) {
      setError('Name and role type are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await peopleEditApi.createSupportStaff(form as any);
      setAdding(false);
      setForm({ role_type: 'driver', status: 'active' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ ...mono, padding: '20px 0' }}>Loading support staff…</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <p style={{ ...sectionTitle, marginBottom: 0 }}>Support Staff Directory</p>
        <button onClick={() => setAdding(p => !p)} style={{ ...btnPrimary, fontSize: '12px' }}>
          {adding ? '✕ Cancel' : '+ Add Member'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input style={inputS} placeholder="Full Name *" value={form.full_name || ''} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
            <input style={inputS} placeholder="Phone Number" value={form.phone_number || ''} onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} />
            <select style={inputS} value={form.role_type} onChange={e => setForm(p => ({ ...p, role_type: e.target.value as any }))}>
              {ROLE_TYPES.map(r => <option key={r} value={r} style={{ background: '#1e1e35' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <input style={inputS} placeholder="Title / Description (e.g. Head Driver)" value={form.role_description || ''} onChange={e => setForm(p => ({ ...p, role_description: e.target.value }))} />
            <input type="date" style={inputS} placeholder="Start Date" value={form.start_date || ''} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} title="Start Date" />
            <input type="date" style={inputS} placeholder="Date of Birth (optional)" value={form.date_of_birth || ''} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} title="Date of Birth" />
          </div>
          <input style={{ ...inputS, marginBottom: '10px' }} placeholder="Notes (equipment, anything relevant)" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          {error && <p style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '8px' }}>{error}</p>}
          <button onClick={handleCreate} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Add to Directory'}</button>
        </div>
      )}

      {/* Staff list */}
      {!staff.length ? (
        <p style={{ fontSize: '13px', color: '#475569' }}>No support staff added yet. Click "+ Add Member" to start.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {staff.map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px',
            }}>
              <div>
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '2px' }}>{s.full_name}</p>
                <p style={{ fontSize: '12px', color: '#64748b' }}>
                  {s.role_description || s.role_type.charAt(0).toUpperCase() + s.role_type.slice(1)}
                  {s.phone_number ? ` · ${s.phone_number}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: s.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
                  color: s.status === 'active' ? '#10b981' : '#94a3b8',
                }}>
                  {s.status.toUpperCase()}
                </span>
                <button
                  onClick={() => { peopleEditApi.updateSupportStaff(s.id, { status: s.status === 'active' ? 'inactive' : 'active' }).then(load); }}
                  style={{ ...btnSecondary, fontSize: '11px', padding: '3px 10px' }}
                >
                  {s.status === 'active' ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AlertsTab ─────────────────────────────────────────────────────

export function AlertsTab() {
  const [data,    setData]    = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [showVacForm, setShowVacForm] = useState(false);
  const [vacForm, setVacForm] = useState({ role_name: '', department: '', description: '' });
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    const [alertsRes, vacRes] = await Promise.allSettled([
      peopleEditApi.getAlerts(),
      peopleEditApi.getVacancies(),
    ]);
    if (alertsRes.status === 'fulfilled') setData(alertsRes.value);
    if (vacRes.status   === 'fulfilled') setVacancies(vacRes.value.vacancies);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalAlerts = data
    ? (data.internships.length + data.probations.length + data.contracts.length + data.disciplinary.length)
    : 0;

  const handleAddVacancy = async () => {
    if (!vacForm.role_name.trim()) return;
    setSaving(true);
    try {
      await peopleEditApi.createVacancy(vacForm);
      setShowVacForm(false);
      setVacForm({ role_name: '', department: '', description: '' });
      load();
    } catch {} finally { setSaving(false); }
  };

  const handleVacancyStatus = async (id: string, status: 'filled' | 'cancelled') => {
    await peopleEditApi.updateVacancy(id, { status });
    load();
  };

  if (loading) return <p style={{ ...mono, padding: '20px 0' }}>Loading alerts…</p>;

  const AlertSection = ({ title, colour, items, renderItem }: {
    title: string; colour: string; items: unknown[];
    renderItem: (item: any, i: number) => React.ReactNode;
  }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <p style={{ ...sectionTitle, marginBottom: 0 }}>{title}</p>
        {items.length > 0 && (
          <span style={{
            padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace', background: `${colour}20`, color: colour,
          }}>{items.length}</span>
        )}
      </div>
      {items.length === 0
        ? <p style={{ fontSize: '13px', color: '#475569' }}>None this month ✓</p>
        : items.map((item: any, i) => (
            <div key={item.id || i} style={{
              padding: '12px 14px', marginBottom: '8px', borderRadius: '9px',
              background: `${colour}10`, border: `1px solid ${colour}30`,
            }}>
              {renderItem(item, i)}
            </div>
          ))
      }
    </div>
  );

  return (
    <div>
      {totalAlerts === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', marginBottom: '20px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#10b981' }}>
            ✓ All clear — no HR alerts this month
          </p>
        </div>
      )}

      <AlertSection title="Internships Completing Soon" colour="#6d28d9" items={data?.internships || []}
        renderItem={(i) => (
          <>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' }}>{i.full_name}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              {i.internship_type?.toUpperCase()} ends {new Date(i.internship_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              {' · '}<span style={{ color: i.days_remaining <= 7 ? '#f87171' : '#f59e0b', fontWeight: 700 }}>{i.days_remaining} days remaining</span>
            </p>
          </>
        )}
      />

      <AlertSection title="Probation Periods Ending" colour="#f59e0b" items={data?.probations || []}
        renderItem={(p) => (
          <>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' }}>{p.full_name}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              Probation ends {new Date(p.probation_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              {' · '}<span style={{ color: '#f59e0b', fontWeight: 700 }}>{p.days_remaining} days remaining</span>
            </p>
          </>
        )}
      />

      <AlertSection title="Contracts Expiring" colour="#f43f5e" items={data?.contracts || []}
        renderItem={(c) => (
          <>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginBottom: '2px' }}>{c.full_name}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              Contract expires {new Date(c.contract_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              {' · '}<span style={{ color: c.days_remaining <= 7 ? '#f87171' : '#f43f5e', fontWeight: 700 }}>{c.days_remaining} days remaining</span>
            </p>
          </>
        )}
      />

      <AlertSection title="Unresolved Disciplinary Records" colour="#ef4444" items={data?.disciplinary || []}
        renderItem={(d) => (
          <p style={{ fontSize: '13px', color: '#e2e8f0' }}>
            {d.users?.full_name} — <span style={{ color: '#f87171' }}>{DISC_TYPE_LABELS[d.type as keyof typeof DISC_TYPE_LABELS]}</span>
            {' '}issued {new Date(d.date_issued).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        )}
      />

      {/* Vacancies section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ ...sectionTitle, marginBottom: 0 }}>Open Vacancies</p>
          <button onClick={() => setShowVacForm(p => !p)} style={{ ...btnPrimary, fontSize: '12px' }}>
            {showVacForm ? 'Cancel' : '+ Add Vacancy'}
          </button>
        </div>

        {showVacForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input style={inputS} placeholder="Role Name *" value={vacForm.role_name} onChange={e => setVacForm(p => ({ ...p, role_name: e.target.value }))} />
              <input style={inputS} placeholder="Department" value={vacForm.department} onChange={e => setVacForm(p => ({ ...p, department: e.target.value }))} />
            </div>
            <input style={{ ...inputS, marginBottom: '10px' }} placeholder="Description (optional)" value={vacForm.description} onChange={e => setVacForm(p => ({ ...p, description: e.target.value }))} />
            <button onClick={handleAddVacancy} disabled={saving} style={btnPrimary}>{saving ? 'Saving…' : 'Create Vacancy'}</button>
          </div>
        )}

        {vacancies.filter(v => v.status === 'open').length === 0 ? (
          <p style={{ fontSize: '13px', color: '#475569' }}>No open vacancies</p>
        ) : (
          vacancies.filter(v => v.status === 'open').map(v => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginBottom: '8px', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '9px' }}>
              <div>
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '2px' }}>{v.role_name}</p>
                <p style={{ fontSize: '12px', color: '#64748b' }}>{v.department || 'No department'} · Open since {new Date(v.date_opened).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleVacancyStatus(v.id, 'filled')} style={{ ...btnPrimary, fontSize: '11px', padding: '4px 10px', background: '#10b981' }}>Mark Filled</button>
                <button onClick={() => handleVacancyStatus(v.id, 'cancelled')} style={{ ...btnSecondary, fontSize: '11px', padding: '4px 10px' }}>Cancel</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── InternshipFields ──────────────────────────────────────────────
// Used inside the Onboarding tab when employment_category = 'intern'

interface InternshipFieldsProps {
  recordId: string;
  initialData?: {
    employment_category?: string;
    internship_type?: string;
    internship_duration?: number;
    internship_start_date?: string;
    internship_end_date?: string;
  };
  onSaved?: () => void;
}

export function InternshipFields({ recordId, initialData, onSaved }: InternshipFieldsProps) {
  const [form, setForm] = useState({
    employment_category:   initialData?.employment_category   || 'core',
    internship_type:       initialData?.internship_type       || '',
    internship_duration:   initialData?.internship_duration   || 0,
    internship_start_date: initialData?.internship_start_date || '',
    internship_end_date:   '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  const isIntern = form.employment_category === 'intern';

  // Auto-calculate end date when start or duration changes
  useEffect(() => {
    if (!form.internship_start_date || !form.internship_duration) return;
    const start = new Date(form.internship_start_date);
    start.setMonth(start.getMonth() + Number(form.internship_duration));
    setForm(p => ({ ...p, internship_end_date: start.toISOString().split('T')[0] }));
  }, [form.internship_start_date, form.internship_duration]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await peopleEditApi.updateInternship(recordId, {
        employment_category: form.employment_category as any,
        internship_type:     form.internship_type as any || undefined,
        internship_duration: form.internship_duration || undefined,
        internship_start_date: form.internship_start_date || undefined,
        internship_end_date:   form.internship_end_date   || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.18)', borderRadius: '10px', padding: '16px' }}>
      <p style={{ ...sectionTitle, fontSize: '13px', marginBottom: '12px' }}>Employment Category</p>

      <div style={{ marginBottom: '12px' }}>
        <p style={{ ...mono, marginBottom: '6px' }}>Category</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['core', 'intern'].map(cat => (
            <button
              key={cat}
              onClick={() => setForm(p => ({ ...p, employment_category: cat }))}
              style={{
                padding: '6px 16px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                background: form.employment_category === cat ? '#6d28d9' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${form.employment_category === cat ? '#6d28d9' : 'rgba(255,255,255,0.09)'}`,
                color: form.employment_category === cat ? 'white' : '#64748b',
              }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)} Staff
            </button>
          ))}
        </div>
      </div>

      {isIntern && (
        <>
          <div style={{ marginBottom: '10px' }}>
            <p style={{ ...mono, marginBottom: '6px' }}>Internship Programme</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['nysc', 'NYSC (1 Year)'], ['siwes', 'SIWES'], ['other', 'Other']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => {
                    setForm(p => ({
                      ...p,
                      internship_type: val,
                      internship_duration: val === 'nysc' ? 12 : p.internship_duration,
                    }));
                  }}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    background: form.internship_type === val ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${form.internship_type === val ? 'rgba(109,40,217,0.4)' : 'rgba(255,255,255,0.09)'}`,
                    color: form.internship_type === val ? '#c4b5fd' : '#64748b',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {form.internship_type && form.internship_type !== 'nysc' && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ ...mono, marginBottom: '6px' }}>Duration</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[3, 6].map(d => (
                  <button
                    key={d}
                    onClick={() => setForm(p => ({ ...p, internship_duration: d }))}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      background: form.internship_duration === d ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${form.internship_duration === d ? 'rgba(109,40,217,0.4)' : 'rgba(255,255,255,0.09)'}`,
                      color: form.internship_duration === d ? '#c4b5fd' : '#64748b',
                    }}
                  >
                    {d} months
                  </button>
                ))}
                <input
                  type="number" min="1" max="24" placeholder="Custom"
                  style={{ ...inputS, width: '90px', padding: '4px 10px' }}
                  value={![3,6].includes(form.internship_duration) && form.internship_duration > 0 ? form.internship_duration : ''}
                  onChange={e => setForm(p => ({ ...p, internship_duration: Number(e.target.value) }))}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <p style={{ ...mono, marginBottom: '6px' }}>Start Month</p>
              <input
                type="month" style={inputS}
                value={form.internship_start_date?.slice(0, 7) || ''}
                onChange={e => setForm(p => ({ ...p, internship_start_date: `${e.target.value}-01` }))}
              />
            </div>
            <div>
              <p style={{ ...mono, marginBottom: '6px' }}>Calculated End Date</p>
              <input type="date" style={{ ...inputS, opacity: 0.6 }} value={form.internship_end_date} readOnly />
            </div>
          </div>
        </>
      )}

      {error && <p style={{ fontSize: '12px', color: '#fca5a5', marginBottom: '8px' }}>{error}</p>}
      {saved && <p style={{ fontSize: '12px', color: '#10b981', marginBottom: '8px' }}>✓ Saved</p>}
      <button onClick={handleSave} disabled={saving} style={btnPrimary}>
        {saving ? 'Saving…' : 'Save Category & Internship Details'}
      </button>
    </div>
  );
}
