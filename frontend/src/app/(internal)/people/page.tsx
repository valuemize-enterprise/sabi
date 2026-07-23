'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PersonRow from '@/components/people/PersonRow';
import PersonFile from '@/components/people/PersonFile';
import NarrativeHero from '@/components/people/NarrativeHero';
import AddPersonWizard from '@/components/people/AddPersonWizard';
import RequestLeaveForm from '@/components/people/RequestLeaveForm';
import {
  getRegistry, getInsights, getPendingLeave, decideLeave,
  type RegistryPayload, type PersonRow as PersonRowType, type InsightsPayload, type LeaveRequestRow,
} from '@/components/people/types';
import '@/styles/people-theme.css';
import { AgencyTopNav } from '@/components/internal';
import { useAgencyStore } from '@/lib/store';

type Tab = 'registry' | 'onboarding' | 'leave' | 'documents' | 'insights';
const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'registry', label: 'Registry', emoji: '👥' },
  { key: 'onboarding', label: 'Onboarding', emoji: '🚀' },
  { key: 'leave', label: 'Leave', emoji: '🌴' },
  { key: 'documents', label: 'Documents', emoji: '📁' },
  { key: 'insights', label: 'Insights', emoji: '📊' },
];
const ONBOARDING_STEPS: [string, string][] = [
  ['record_created', 'Record'], ['invite_sent', 'Invite'], ['portal_activated', 'Activated'],
  ['profile_draft', 'Draft'], ['profile_published', 'Profile live'], ['first_task_done', 'First task'],
];

export default function PeoplePage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'registry';
  const { user, } = useAgencyStore();
    const role     = user?.role ?? '';

  const [tab, setTab] = useState<Tab>(TABS.some(t => t.key === initialTab) ? initialTab : 'registry');

  const [data, setData] = useState<RegistryPayload | null>(null);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [pending, setPending] = useState<LeaveRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PersonRowType | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showRequestLeave, setShowRequestLeave] = useState(false);
  const [isHR, setIsHR] = useState(false);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState('');

  const load = useCallback(async () => {
    try {
      const reg = await getRegistry();
      setData(reg);
      setIsHR(reg.people.some(p => p.employment_type !== undefined));
      const [ins, pen] = await Promise.allSettled([getInsights(), getPendingLeave()]);
      if (ins.status === 'fulfilled') setInsights(ins.value.insights);
      if (pen.status === 'fulfilled') setPending(pen.value.requests);
      setError(null);
    } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const people = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return q ? data.people.filter(p => p.display_name.toLowerCase().includes(q) || p.role_title.toLowerCase().includes(q)) : data.people;
  }, [data, query]);

  if (error) throw new Error(error);
  if (!data) return <PeopleSkeleton />;

  const approve = async (id: string) => { await decideLeave(id, true).catch((e) => setError(e.message)); load(); };
  const confirmDecline = async (id: string) => {
    await decideLeave(id, false, declineNote || undefined).catch((e) => setError(e.message));
    setDecliningId(null); setDeclineNote(''); load();
  };

  return (
    <div> 
      <div className='px-4 md:hidden'><AgencyTopNav /></div>
    <div className="pp-scope">
      <div className="pp-inner">
        <div className="pp-topbar">
          <div className="pp-mark">P</div>
          <div><div className="pp-title">People OS</div><div className="pp-subtitle">The Ledger · Sabi</div></div>
          <div style={{ flex: 1 }} />
          <button className="pp-btn pp-btn-ghost" onClick={() => setShowRequestLeave(true)}>🌴 Request leave</button>
          {role === 'hr' || role ==='super_admin' ||  isHR && <button className="pp-btn pp-btn-primary" onClick={() => setShowAdd(true)}>+ Add person</button>}
        </div>

        <NarrativeHero data={data} insights={insights} />

        <div className="pp-tabs">
          {TABS.map(({ key, label, emoji }) => (
            <div key={key} className={`pp-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              {emoji} {label}
              {key === 'leave' && pending.length > 0 && <span className="badge">{pending.length}</span>}
            </div>
          ))}
        </div>

        <div className="pp-panel">
          {tab === 'registry' && (
            <>
              <div style={{ display: 'flex', marginBottom: 16 }}>
                <div className="pp-search">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                  <input placeholder="Name or role…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
              {people.map(p => <PersonRow key={p.user_id} p={p} onOpen={() => setSelected(p)} />)}
            </>
          )}

          {tab === 'onboarding' && (
            people.filter(p => p.onboarding && Object.values(p.onboarding).some(v => !v)).length === 0
              ? <Empty text="Nobody mid-onboarding. Clean pipeline. 🎉" />
              : people.filter(p => p.onboarding).map(p => (
                <div key={p.user_id} className="pp-pipe-card">
                  <div className="pp-pipe-name">{p.display_name}<span> · {p.role_title}</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ONBOARDING_STEPS.map(([key, label]) => (
                      <span key={key} className={`pp-pstep ${p.onboarding?.[key] ? 'done' : 'todo'}`}>{p.onboarding?.[key] ? '✓' : '○'} {label}</span>
                    ))}
                  </div>
                </div>
              ))
          )}

          {tab === 'leave' && (
            pending.length === 0 ? <Empty text="No pending requests. Everyone's either working or already resting." />
              : pending.map(r => (
                <div key={r.id} className="pp-leave-card">
                  <span style={{ fontSize: 16 }}>🌴</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 13.5 }}>{r.user?.full_name || 'Team member'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--soft)' }}>{r.leave_type} · {r.start_date} → {r.end_date}{r.note ? ` · "${r.note}"` : ''}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button className="pp-mini-btn pp-mini-approve" onClick={() => approve(r.id)}>✓ Approve</button>
                    <button className="pp-mini-btn pp-mini-decline" onClick={() => setDecliningId(decliningId === r.id ? null : r.id)}>Decline</button>
                  </div>
                  {decliningId === r.id && (
                    <div className="pp-decline-box">
                      <textarea autoFocus placeholder="Reason the person will see…" value={declineNote} onChange={(e) => setDeclineNote(e.target.value)} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="pp-mini-btn" style={{ background: 'var(--ember)', color: '#fff' }} disabled={!declineNote.trim()} onClick={() => confirmDecline(r.id)}>Confirm decline</button>
                        <button className="pp-mini-btn pp-btn-ghost" onClick={() => { setDecliningId(null); setDeclineNote(''); }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}

          {tab === 'documents' && (
            people.filter(p => p.docs_expiring > 0).length === 0
              ? <Empty text="No documents expiring in the next 30 days." />
              : <>
                {people.filter(p => p.docs_expiring > 0).map(p => (
                  <button key={p.user_id} className="pp-stamp-row" onClick={() => setSelected(p)}>
                    <span style={{ fontSize: 18 }}>📁</span>
                    <div className="pp-p-name" style={{ flex: 1 }}>{p.display_name}</div>
                    <span className="pp-ribbon" style={{ background: 'var(--ember-soft)', color: 'var(--ember)' }}>{p.docs_expiring} expiring ≤30d</span>
                  </button>
                ))}
                <p style={{ fontSize: 11.5, color: 'var(--soft)', marginTop: 6 }}>Open a person to view or add vault documents. Every confidential view is audit-logged.</p>
              </>
          )}

          {tab === 'insights' && insights && (
            <div className="pp-field-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="pp-igcard">
                <h4>Headcount by role</h4>
                {Object.entries(insights.by_role).sort((a, b) => b[1] - a[1]).map(([role, n]) => (
                  <div key={role} className="pp-igrow"><span>{role.replace(/_/g, ' ')}</span><b>{n}</b></div>
                ))}
              </div>
              <div className="pp-igcard">
                <div style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 700 }}>{insights.avg_tenure_years} yrs</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--soft)', marginBottom: 10 }}>Average tenure</div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
                  {Object.entries(insights.by_type).map(([t, n]) => (
                    <span key={t} style={{ color: 'var(--soft)' }}><b style={{ color: 'var(--ink)' }}>{n}</b> {t.replace('_', '-')}</span>
                  ))}
                </div>
              </div>
              <div className="pp-igcard">
                <h4>🎉 Anniversaries · 30 days</h4>
                {insights.upcoming_anniversaries.length === 0 ? <p style={{ fontSize: 12, color: 'var(--soft)' }}>None coming up.</p>
                  : insights.upcoming_anniversaries.map((a, i) => <div key={i} className="pp-igrow"><span>{a.name}</span><b>{new Date(a.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</b></div>)}
              </div>
              <div className="pp-igcard">
                <h4>🎂 Birthdays · 30 days</h4>
                {insights.upcoming_birthdays.length === 0 ? <p style={{ fontSize: 12, color: 'var(--soft)' }}>None coming up.</p>
                  : insights.upcoming_birthdays.map((b, i) => <div key={i} className="pp-igrow"><span>{b.name}</span><b>{b.day}</b></div>)}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--soft)', marginTop: 28 }}>
          SABI INTELLIGENCE SUITE · THE LEDGER · CEREBRE MEDIA AFRICA
        </div>
      </div>

      {selected && <PersonFile person={selected} isHR={isHR} onClose={() => setSelected(null)} onChanged={load} />}
      {showAdd && <AddPersonWizard onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
      {showRequestLeave && <RequestLeaveForm onClose={() => setShowRequestLeave(false)} onSent={() => { setShowRequestLeave(false); load(); }} />}
    </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--soft)' }}>{text}</div>;
}

function PeopleSkeleton() {
  return (
    <div className="pp-scope">
      <div className="pp-inner">
        <div style={{ height: 34, width: 200, background: 'var(--line)', borderRadius: 8, marginBottom: 24 }} />
        <div style={{ height: 140, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18 }} />
      </div>
    </div>
  );
}
