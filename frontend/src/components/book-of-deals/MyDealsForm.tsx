'use client';

import React, { useState, useEffect } from 'react';
import {
  bookOfDealsApi, LogDealPayload, LEAD_SOURCES,
} from '@/lib/book-of-deals-api';
import {
  STAGE_ORDER, STAGE_LABELS, STAGE_COLOURS,
  SERVICE_SCOPE_LABELS, INDUSTRY_LABELS,
  ServiceScope, Industry, DealType, PipelineStage,
} from '@/lib/pipeline-api';

interface MyDealsFormProps {
  onSubmitted: (opportunityId: string) => void;
  onCancel:    () => void;
}

const SERVICE_SCOPES = Object.keys(SERVICE_SCOPE_LABELS) as ServiceScope[];
const INDUSTRIES     = Object.keys(INDUSTRY_LABELS)     as Industry[];
const ACTIVE_STAGES  = STAGE_ORDER.filter(s => !['agreement', 'onboarded'].includes(s));

// ── Shared styles ─────────────────────────────────────────────────
const iS: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
  padding: '9px 13px', fontSize: '13px', color: '#f1f5f9',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const sLabel: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace', fontSize: '10px',
  color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px',
};
const sHead: React.CSSProperties = {
  fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700,
  color: '#f1f5f9', marginBottom: '12px',
};
const sSection: React.CSSProperties = {
  padding: '16px', borderRadius: '10px', marginBottom: '16px',
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.02)',
};
const grid2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
};

// ── Staff search ──────────────────────────────────────────────────
const StaffSearch = ({
  label, placeholder, onSelect,
}: { label: string; placeholder: string; onSelect: (id: string, name: string) => void }) => {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [open, setOpen]     = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('sabi_token') || '' : '';
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/users/search?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setResults(d.users || []))
      .catch(() => {});
  }, [q]);

  return (
    <div style={{ position: 'relative' }}>
      <p style={sLabel}>{label}</p>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            padding: '4px 10px', background: 'rgba(109,40,217,0.12)',
            border: '1px solid rgba(109,40,217,0.25)', borderRadius: '6px',
            fontSize: '12px', color: '#c4b5fd',
          }}>{selected}</span>
          <button onClick={() => { setSelected(''); onSelect('', ''); }}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <>
          <input style={iS} placeholder={placeholder} value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 200)} />
          {open && results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#12122a', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', overflow: 'hidden', marginTop: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {results.slice(0, 5).map(u => (
                <button key={u.id} style={{ all: 'unset', display: 'block', width: '100%', padding: '10px 14px', cursor: 'pointer', boxSizing: 'border-box', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(109,40,217,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={() => { onSelect(u.id, u.full_name); setSelected(u.full_name); setQ(''); setOpen(false); }}>
                  <p style={{ fontSize: '13px', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>{u.full_name}</p>
                  <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>{u.role}</p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Main form ─────────────────────────────────────────────────────
export function MyDealsForm({ onSubmitted, onCancel }: MyDealsFormProps) {
  // A — Company
  const [companyName,  setCompanyName]  = useState('');
  const [industry,     setIndustry]     = useState<Industry | ''>('');
  const [leadSource,   setLeadSource]   = useState('');

  // B — Contact
  const [contactName,     setContactName]     = useState('');
  const [contactPosition, setContactPosition] = useState('');
  const [contactPhone,    setContactPhone]    = useState('');
  const [contactEmail,    setContactEmail]    = useState('');

  // C — Deal
  const [dealType,     setDealType]     = useState<DealType | ''>('');
  const [serviceScope, setServiceScope] = useState<ServiceScope[]>([]);
  const [stage,        setStage]        = useState<PipelineStage>('introduction');
  // retainer
  const [retainerAmt,  setRetainerAmt]  = useState('');
  const [retainerDur,  setRetainerDur]  = useState<number | ''>('');
  const [retainerStart,setRetainerStart]= useState('');
  // campaign
  const [campName,  setCampName]   = useState('');
  const [campGoals, setCampGoals]  = useState('');
  const [campStart, setCampStart]  = useState('');
  const [campEnd,   setCampEnd]    = useState('');
  const [campAmt,   setCampAmt]    = useState('');

  // D — Supporting doc
  const [deckUrl, setDeckUrl] = useState('');

  // E — Notes + attribution
  const [notes,     setNotes]     = useState('');
  const [managerId, setManagerId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const toggleScope = (s: ServiceScope) =>
    setServiceScope((prev: ServiceScope[]) => prev.includes(s) ? prev.filter((x: ServiceScope) => x !== s) : [...prev, s]);

  const handleSubmit = async () => {
    if (!companyName.trim()) { setError('Company name is required to log a deal'); return; }
    setSubmitting(true);
    setError(null);

    const payload: LogDealPayload = {
      company_name:     companyName.trim(),
      contact_name:     contactName.trim()     || undefined,
      contact_position: contactPosition.trim() || undefined,
      contact_email:    contactEmail.trim()    || undefined,
      contact_phone:    contactPhone.trim()    || undefined,
      deal_type:        dealType               || undefined,
      service_scope:    serviceScope.length    ? serviceScope : undefined,
      industry:         industry               || undefined,
      stage,
      deck_url:         deckUrl.trim()         || undefined,
      notes:            notes.trim()           || undefined,
      account_manager_id: managerId            || undefined,
    };

    if (dealType === 'retainer') {
      if (retainerAmt)   payload.retainer_monthly_amount  = Number(retainerAmt);
      if (retainerDur)   payload.retainer_duration_months = Number(retainerDur);
      if (retainerStart) payload.retainer_start_date       = retainerStart;
    }
    if (dealType === 'campaign') {
      if (campName)  payload.campaign_name         = campName.trim();
      if (campGoals) payload.campaign_goals        = campGoals.trim();
      if (campStart) payload.campaign_start_date   = campStart;
      if (campEnd)   payload.campaign_end_date     = campEnd;
      if (campAmt)   payload.campaign_total_amount = Number(campAmt);
    }

    try {
      const { opportunity } = await bookOfDealsApi.logDeal(payload);
      onSubmitted(opportunity.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log deal');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* Section A — The Company */}
      <div style={sSection}>
        <p style={{ ...sHead, color: '#c4b5fd' }}>A — The Company</p>
        <div style={{ marginBottom: '12px' }}>
          <p style={sLabel}>Company / Brand Name <span style={{ color: '#f43f5e' }}>*</span></p>
          <input style={iS} placeholder="Who are you pursuing?" value={companyName} onChange={e => setCompanyName(e.target.value)} autoFocus />
        </div>
        <div style={grid2}>
          <div>
            <p style={sLabel}>Industry</p>
            <select style={{ ...iS, cursor: 'pointer' }} value={industry} onChange={e => setIndustry(e.target.value as Industry)}>
              <option value="" style={{ background: '#1e1e35' }}>Select industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i} style={{ background: '#1e1e35' }}>{INDUSTRY_LABELS[i]}</option>)}
            </select>
          </div>
          <div>
            <p style={sLabel}>How did you find this lead?</p>
            <select style={{ ...iS, cursor: 'pointer' }} value={leadSource} onChange={e => setLeadSource(e.target.value)}>
              <option value="" style={{ background: '#1e1e35' }}>Select source…</option>
              {LEAD_SOURCES.map(s => <option key={s.value} value={s.value} style={{ background: '#1e1e35' }}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section B — Contact */}
      <div style={sSection}>
        <p style={{ ...sHead, color: '#38bdf8' }}>B — The Contact Person</p>
        <div style={{ ...grid2, marginBottom: '10px' }}>
          <div>
            <p style={sLabel}>Contact Name</p>
            <input style={iS} placeholder="Full name" value={contactName} onChange={e => setContactName(e.target.value)} />
          </div>
          <div>
            <p style={sLabel}>Position / Title</p>
            <input style={iS} placeholder="e.g. Head of Marketing" value={contactPosition} onChange={e => setContactPosition(e.target.value)} />
          </div>
        </div>
        <div style={grid2}>
          <div>
            <p style={sLabel}>Phone (optional)</p>
            <input style={iS} type="tel" placeholder="+234 8…" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
          </div>
          <div>
            <p style={sLabel}>Email (optional)</p>
            <input style={iS} type="email" placeholder="contact@company.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Section C — The Deal */}
      <div style={sSection}>
        <p style={{ ...sHead, color: '#10b981' }}>C — The Deal</p>

        {/* Deal type */}
        <div style={{ marginBottom: '12px' }}>
          <p style={sLabel}>Deal Type</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['retainer', 'campaign', 'project'] as DealType[]).map(t => (
              <button key={t} onClick={() => setDealType(prev => prev === t ? '' : t)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  border: `1px solid ${dealType === t ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: dealType === t ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                  color: dealType === t ? '#10b981' : '#64748b',
                }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Service scope */}
        <div style={{ marginBottom: '12px' }}>
          <p style={sLabel}>Service Scope</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SERVICE_SCOPES.map(s => (
              <button key={s} onClick={() => toggleScope(s)}
                style={{
                  padding: '4px 12px', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                  border: `1px solid ${serviceScope.includes(s) ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  background: serviceScope.includes(s) ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                  color: serviceScope.includes(s) ? '#10b981' : '#64748b',
                }}>
                {SERVICE_SCOPE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Retainer conditional */}
        {dealType === 'retainer' && (
          <div style={{ padding: '12px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', marginBottom: '12px' }}>
            <div style={{ ...grid2, marginBottom: '8px' }}>
              <div>
                <p style={sLabel}>Monthly Amount (₦)</p>
                <input style={iS} type="number" placeholder="0" value={retainerAmt} onChange={e => setRetainerAmt(e.target.value)} />
              </div>
              <div>
                <p style={sLabel}>Duration (months)</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[3, 6, 12].map(d => (
                    <button key={d} onClick={() => setRetainerDur(prev => prev === d ? '' : d)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
                        border: `1px solid ${retainerDur === d ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        background: retainerDur === d ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                        color: retainerDur === d ? '#10b981' : '#64748b',
                      }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <p style={sLabel}>Expected Start Date</p>
              <input style={iS} type="date" value={retainerStart} onChange={e => setRetainerStart(e.target.value)} />
            </div>
          </div>
        )}

        {/* Campaign conditional */}
        {dealType === 'campaign' && (
          <div style={{ padding: '12px', background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: '8px', marginBottom: '12px' }}>
            <div style={{ marginBottom: '8px' }}>
              <p style={sLabel}>Campaign Name</p>
              <input style={iS} placeholder="e.g. Q4 Brand Launch" value={campName} onChange={e => setCampName(e.target.value)} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <p style={sLabel}>Campaign Goals</p>
              <textarea style={{ ...iS, minHeight: '56px', resize: 'none' }} placeholder="What do they want to achieve?" value={campGoals} onChange={e => setCampGoals(e.target.value)} />
            </div>
            <div style={{ ...grid2, marginBottom: '8px' }}>
              <div><p style={sLabel}>Start Date</p><input style={iS} type="date" value={campStart} onChange={e => setCampStart(e.target.value)} /></div>
              <div><p style={sLabel}>End Date</p><input style={iS} type="date" value={campEnd} onChange={e => setCampEnd(e.target.value)} /></div>
            </div>
            <div>
              <p style={sLabel}>Total Value (₦)</p>
              <input style={iS} type="number" placeholder="0" value={campAmt} onChange={e => setCampAmt(e.target.value)} />
            </div>
          </div>
        )}

        {/* Stage */}
        <div>
          <p style={sLabel}>Current Stage of This Conversation <span style={{ color: '#f43f5e' }}>*</span></p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ACTIVE_STAGES.map(s => {
              const sc = STAGE_COLOURS[s];
              return (
                <button key={s} onClick={() => setStage(s)}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                    border: `1px solid ${stage === s ? sc.border : 'rgba(255,255,255,0.08)'}`,
                    background: stage === s ? sc.bg : 'rgba(255,255,255,0.03)',
                    color: stage === s ? sc.text : '#64748b',
                  }}>
                  {STAGE_LABELS[s]}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: '11px', color: '#475569', marginTop: '6px', fontStyle: 'italic' }}>
            If you're just logging someone you plan to contact, choose Introduction.
          </p>
        </div>
      </div>

      {/* Section D — Supporting document */}
      <div style={sSection}>
        <p style={{ ...sHead, color: '#fde68a' }}>D — Supporting Document</p>
        <p style={sLabel}>RFP / Brief / Pitch Deck Link</p>
        <input style={{ ...iS, marginBottom: '8px' }} type="url" placeholder="Paste shareable link here…" value={deckUrl} onChange={e => setDeckUrl(e.target.value)} />
        <div style={{
          padding: '10px 14px', background: 'rgba(217,119,6,0.07)',
          border: '1px solid rgba(217,119,6,0.2)', borderRadius: '7px',
          fontSize: '12px', color: '#fde68a', lineHeight: 1.55,
        }}>
          📎 <strong>How to attach a document:</strong> Upload to your ZOHO Drive folder → open the file → click Share → Copy Link → paste the link above. This makes the document accessible to the full team without file size limits inside Sabi.
        </div>
      </div>

      {/* Section E — Context and attribution */}
      <div style={sSection}>
        <p style={{ ...sHead, color: '#94a3b8' }}>E — Context & Notes</p>
        <div style={{ marginBottom: '12px' }}>
          <p style={sLabel}>What do you know about this deal?</p>
          <textarea
            style={{ ...iS, minHeight: '80px', resize: 'vertical' }}
            placeholder="Background, what they mentioned, any constraints, timelines, or sensitivities. The account manager who picks this up reads this first."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={600}
          />
          <p style={{ fontSize: '10px', color: '#374151', textAlign: 'right', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
            {notes.length}/600
          </p>
        </div>
        <StaffSearch
          label="Who else at Cerebre should be involved? (Account Manager)"
          placeholder="Search by name…"
          onSelect={(id) => setManagerId(id)}
        />
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: '8px', fontSize: '13px', color: '#fca5a5', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            flex: 1, padding: '12px', borderRadius: '10px',
            background: submitting ? 'rgba(109,40,217,0.3)' : '#6d28d9',
            border: 'none', color: 'white', fontSize: '15px', fontWeight: 800,
            cursor: submitting ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          {submitting ? 'Logging Deal…' : '🎯 Log This Deal'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 20px', borderRadius: '10px', cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
            color: '#64748b', fontSize: '14px', fontFamily: 'Inter, sans-serif',
          }}
        >
          Cancel
        </button>
      </div>
      <p style={{ fontSize: '12px', color: '#374151', textAlign: 'center', marginTop: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
        A Pipeline opportunity is created automatically on submit.
      </p>
    </div>
  );
}
