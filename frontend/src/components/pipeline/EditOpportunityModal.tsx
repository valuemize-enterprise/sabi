'use client';

import React, { useState, useEffect } from 'react';

// ── Constants — must match your pipeline-api.ts ───────────────────

const STAGE_LABELS: Record<string, string> = {
  introduction: 'Introduction', proposal: 'Proposal',
  pitch: 'Pitch', second_pitch: 'Second Pitch',
  decision: 'Decision', agreement: 'Agreement',
  onboarded: 'Onboarded', lost_paused: 'Lost / Paused',
};

const INDUSTRIES = [
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'fmcg', label: 'FMCG' },
  { value: 'tech', label: 'Technology' },
  { value: 'telecom', label: 'Telecoms' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'retail', label: 'Retail' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'media', label: 'Media & Entertainment' },
  { value: 'government', label: 'Government' },
  { value: 'ngo', label: 'NGO / Non-Profit' },
  { value: 'other', label: 'Other' },
];

const SERVICE_SCOPE_OPTIONS = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'content', label: 'Content' },
  { value: 'digital_ads', label: 'Digital Ads' },
  { value: 'seo', label: 'SEO' },
  { value: 'pr', label: 'PR' },
  { value: 'branding', label: 'Branding' },
  { value: 'website', label: 'Website' },
  { value: 'video', label: 'Video' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'events', label: 'Events' },
  { value: 'other', label: 'Other' },
];

// ── Shared style atoms ────────────────────────────────────────────

const fieldStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
  padding: '9px 12px', fontSize: '13px', color: '#f1f5f9',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace',
  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '5px', display: 'block',
};

const sectionTitle = (t: string) => (
  <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px', marginTop: '20px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    {t}
  </p>
);

const row2 = (children: React.ReactNode) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
    {children}
  </div>
);

// ── Types ─────────────────────────────────────────────────────────

export interface Opportunity {
  id: string;
  company_name: string;
  deal_title?: string | null;
  description?: string | null;
  stage: string;
  contact_name?: string | null;
  contact_position?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  deal_type?: 'retainer' | 'campaign' | 'project' | null | undefined;
  service_scope?: string[] | null;
  industry?: string | null;
  estimated_value?: number | null;
  retainer_monthly_amount?: number | null;
  retainer_duration_months?: number | null;
  retainer_start_date?: string | null;
  campaign_name?: string | null;
  campaign_total_amount?: number | null;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
  campaign_goals?: string | null;
  business_bringer_id?: string | null;
  account_manager_id?: string | null;
  deck_url?: string | null;
  date_briefed?: string | null;
  client_deadline?: string | null;
  agency_deadline?: string | null;
  source?: string | null;
  notes?: string | null;
  accountable_team_text?: string | null;
}

interface EditOpportunityModalProps {
  opportunity: Opportunity;
  onSaved: (updated: Opportunity) => void;
  onClose: () => void;
}

// ── API helper ────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
});

// ── Component ─────────────────────────────────────────────────────

export function EditOpportunityModal({ opportunity: opp, onSaved, onClose }: EditOpportunityModalProps) {
  // ── Form state — pre-populated from current opportunity ────────
  const [companyName, setCompanyName] = useState(opp.company_name || '');
  const [dealTitle, setDealTitle] = useState(opp.deal_title || '');
  const [description, setDescription] = useState(opp.description || '');
  const [contactName, setContactName] = useState(opp.contact_name || '');
  const [contactPosition, setContactPosition] = useState(opp.contact_position || '');
  const [contactEmail, setContactEmail] = useState(opp.contact_email || '');
  const [contactPhone, setContactPhone] = useState(opp.contact_phone || '');
  const [dealType, setDealType] = useState<'retainer' | 'campaign' | 'project' | ''>(opp.deal_type || '');
  const [serviceScope, setServiceScope] = useState<string[]>(opp.service_scope || []);
  const [industry, setIndustry] = useState(opp.industry || '');
  const [estimatedValue, setEstimatedValue] = useState(opp.estimated_value != null ? String(opp.estimated_value) : '');
  const [retainerAmount, setRetainerAmount] = useState(opp.retainer_monthly_amount != null ? String(opp.retainer_monthly_amount) : '');
  const [retainerMonths, setRetainerMonths] = useState(opp.retainer_duration_months != null ? String(opp.retainer_duration_months) : '');
  const [retainerStart, setRetainerStart] = useState(opp.retainer_start_date || '');
  const [campaignName, setCampaignName] = useState(opp.campaign_name || '');
  const [campaignTotal, setCampaignTotal] = useState(opp.campaign_total_amount != null ? String(opp.campaign_total_amount) : '');
  const [campaignStart, setCampaignStart] = useState(opp.campaign_start_date || '');
  const [campaignEnd, setCampaignEnd] = useState(opp.campaign_end_date || '');
  const [campaignGoals, setCampaignGoals] = useState(opp.campaign_goals || '');
  const [deckUrl, setDeckUrl] = useState(opp.deck_url || '');
  const [dateBriefed, setDateBriefed] = useState(opp.date_briefed || '');
  const [clientDeadline, setClientDeadline] = useState(opp.client_deadline || '');
  const [agencyDeadline, setAgencyDeadline] = useState(opp.agency_deadline || '');
  const [source, setSource] = useState(opp.source || '');
  const [notes, setNotes] = useState(opp.notes || '');
  const [accountableTeam, setAccountableTeam] = useState(opp.accountable_team_text || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleScope = (v: string) =>
    setServiceScope(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const validate = () => {
    if (!companyName.trim()) return 'Company name is required';
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return setError(err);
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      company_name: companyName.trim(),
      deal_title: dealTitle.trim() || null,
      description: description.trim() || null,
      contact_name: contactName.trim() || null,
      contact_position: contactPosition.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      deal_type: dealType || null,
      service_scope: serviceScope,
      industry: industry || null,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      deck_url: deckUrl.trim() || null,
      date_briefed: dateBriefed || null,
      client_deadline: clientDeadline || null,
      agency_deadline: agencyDeadline || null,
      source: source.trim() || null,
      notes: notes.trim() || null,
      accountable_team_text: accountableTeam.trim() || null,
    };

    if (dealType === 'retainer') {
      body.retainer_monthly_amount = retainerAmount ? Number(retainerAmount) : null;
      body.retainer_duration_months = retainerMonths ? Number(retainerMonths) : null;
      body.retainer_start_date = retainerStart || null;
    } else if (dealType === 'campaign') {
      body.campaign_name = campaignName.trim() || null;
      body.campaign_total_amount = campaignTotal ? Number(campaignTotal) : null;
      body.campaign_start_date = campaignStart || null;
      body.campaign_end_date = campaignEnd || null;
      body.campaign_goals = campaignGoals.trim() || null;
    }

    try {
      const res = await fetch(`${API}/pipeline/opportunities/${opp.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to save');
      onSaved(json.opportunity);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 90 }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 100, width: '680px', maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        background: '#0c0c1e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>
              Edit Opportunity
            </h2>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
              {opp.company_name} · {STAGE_LABELS[opp.stage] || opp.stage}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Scrollable form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── 1. Company + Contact ─────────────────────────── */}
          {sectionTitle('Company & Contact')}
          {row2(<>
            <div>
              <label style={labelStyle}>Company Name *</label>
              <input style={fieldStyle} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Zenith Bank" />
            </div>
            <div>
              <label style={labelStyle}>Deal Title</label>
              <input style={fieldStyle} value={dealTitle} onChange={e => setDealTitle(e.target.value)} placeholder="e.g. Social Media Retainer" />
            </div>
          </>)}
          {row2(<>
            <div>
              <label style={labelStyle}>Contact Name</label>
              <input style={fieldStyle} value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label style={labelStyle}>Contact Position</label>
              <input style={fieldStyle} value={contactPosition} onChange={e => setContactPosition(e.target.value)} placeholder="e.g. Head of Marketing" />
            </div>
          </>)}
          {row2(<>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input style={fieldStyle} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contact@company.com" />
            </div>
            <div>
              <label style={labelStyle}>Contact Phone</label>
              <input style={fieldStyle} type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+234..." />
            </div>
          </>)}

          {/* ── 2. Deal Structure ─────────────────────────────── */}
          {sectionTitle('Deal Structure')}

          {/* Deal type toggle */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Deal Type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ v: 'retainer', l: '📅 Retainer' }, { v: 'campaign', l: '⚡ Campaign' }, { v: 'project', l: '🗂 Project' }].map(({ v, l }) => (
                <button key={v} onClick={() => setDealType(dealType === v ? '' : v as 'retainer' | 'campaign')}
                  style={{ flex: 1, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', border: `1px solid ${dealType === v ? 'rgba(109,40,217,0.5)' : 'rgba(255,255,255,0.1)'}`, background: dealType === v ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.03)', color: dealType === v ? '#c4b5fd' : '#64748b' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Retainer fields */}
          {dealType === 'retainer' && (
            <>
              {row2(<>
                <div>
                  <label style={labelStyle}>Monthly Amount (₦)</label>
                  <input style={fieldStyle} type="number" value={retainerAmount} onChange={e => setRetainerAmount(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>Duration (months)</label>
                  <input style={fieldStyle} type="number" value={retainerMonths} onChange={e => setRetainerMonths(e.target.value)} placeholder="12" />
                </div>
              </>)}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Retainer Start Date</label>
                <input style={fieldStyle} type="date" value={retainerStart} onChange={e => setRetainerStart(e.target.value)} />
              </div>
            </>
          )}

          {/* Campaign fields */}
          {dealType === 'campaign' && (
            <>
              {row2(<>
                <div>
                  <label style={labelStyle}>Campaign Name</label>
                  <input style={fieldStyle} value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Q4 Launch Campaign" />
                </div>
                <div>
                  <label style={labelStyle}>Total Budget (₦)</label>
                  <input style={fieldStyle} type="number" value={campaignTotal} onChange={e => setCampaignTotal(e.target.value)} placeholder="0" />
                </div>
              </>)}
              {row2(<>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input style={fieldStyle} type="date" value={campaignStart} onChange={e => setCampaignStart(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input style={fieldStyle} type="date" value={campaignEnd} onChange={e => setCampaignEnd(e.target.value)} />
                </div>
              </>)}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Campaign Goals</label>
                <textarea style={{ ...fieldStyle, minHeight: '60px', resize: 'none' }} value={campaignGoals} onChange={e => setCampaignGoals(e.target.value)} placeholder="Key objectives for this campaign" />
              </div>
            </>
          )}

          {/* Estimated value (always visible) */}
          {row2(<>
            <div>
              <label style={labelStyle}>Estimated Value (₦)</label>
              <input style={fieldStyle} type="number" value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Industry</label>
              <select style={{ ...fieldStyle, cursor: 'pointer' }} value={industry} onChange={e => setIndustry(e.target.value)}>
                <option value="" style={{ background: '#1e1e35' }}>Select industry…</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value} style={{ background: '#1e1e35' }}>{i.label}</option>)}
              </select>
            </div>
          </>)}

          {/* Service scope chips */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Service Scope</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SERVICE_SCOPE_OPTIONS.map(s => {
                const active = serviceScope.includes(s.value);
                return (
                  <button key={s.value} onClick={() => toggleScope(s.value)}
                    style={{ padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', border: `1px solid ${active ? 'rgba(109,40,217,0.5)' : 'rgba(255,255,255,0.1)'}`, background: active ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.03)', color: active ? '#c4b5fd' : '#64748b' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 3. Attribution ────────────────────────────────── */}
          {sectionTitle('Attribution & Deck')}
          {row2(<>
            <div>
              <label style={labelStyle}>Source</label>
              <input style={fieldStyle} value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Referral, Cold Outreach" />
            </div>
            <div>
              <label style={labelStyle}>Accountable Team</label>
              <input style={fieldStyle} value={accountableTeam} onChange={e => setAccountableTeam(e.target.value)} placeholder="e.g. Digital Team" />
            </div>
          </>)}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Pitch Deck URL</label>
            <input style={fieldStyle} type="url" value={deckUrl} onChange={e => setDeckUrl(e.target.value)} placeholder="https://…" />
            {deckUrl && (
              <a href={deckUrl} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#6d28d9', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px', display: 'inline-block' }}>
                Preview deck ↗
              </a>
            )}
          </div>

          {/* ── 4. Timeline ───────────────────────────────────── */}
          {sectionTitle('Timeline')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Date Briefed</label>
              <input style={fieldStyle} type="date" value={dateBriefed} onChange={e => setDateBriefed(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Client Deadline</label>
              <input style={fieldStyle} type="date" value={clientDeadline} onChange={e => setClientDeadline(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Agency Deadline</label>
              <input style={fieldStyle} type="date" value={agencyDeadline} onChange={e => setAgencyDeadline(e.target.value)} />
            </div>
          </div>

          {/* ── 5. Notes ──────────────────────────────────────── */}
          {sectionTitle('Notes')}
          <div style={{ marginBottom: '8px' }}>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...fieldStyle, minHeight: '60px', resize: 'none' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief overview of this opportunity" />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Internal Notes</label>
            <textarea style={{ ...fieldStyle, minHeight: '80px', resize: 'none' }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes visible to Cerebre team only" />
          </div>

          {/* Stage notice */}
          <div style={{ padding: '10px 14px', background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.15)', borderRadius: '8px', fontSize: '12px', color: '#94a3b8' }}>
            💡 To change the stage, use the stage selector in the main deal view — stage transitions are tracked separately.
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          {error && <p style={{ fontSize: '13px', color: '#f87171', flex: 1, marginRight: '16px' }}>{error}</p>}
          {!error && <div />}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              style={{ padding: '9px 24px', borderRadius: '8px', background: saving ? 'rgba(109,40,217,0.4)' : '#6d28d9', border: 'none', color: 'white', fontSize: '14px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
