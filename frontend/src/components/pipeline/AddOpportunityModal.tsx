'use client';

import React, { useState } from 'react';
import {
  CreateOpportunityPayload,
  PipelineStage,
  ServiceType,
  OpportunitySource,
  STAGE_LABELS,
  STAGE_ORDER,
  SERVICE_TYPE_LABELS,
  SOURCE_LABELS,
  pipelineApi,
} from '@/lib/pipeline-api';

interface AddOpportunityModalProps {
  defaultStage?: PipelineStage;
  onClose: () => void;
  onCreated: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f1f5f9',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontFamily: 'JetBrains Mono, monospace',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  marginBottom: '6px',
};

const ACTIVE_STAGES = STAGE_ORDER.filter(s => s !== 'won' && s !== 'lost_paused');
const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[];
const SOURCES = Object.keys(SOURCE_LABELS) as OpportunitySource[];

export function AddOpportunityModal({ defaultStage = 'identified', onClose, onCreated }: AddOpportunityModalProps) {
  const [form, setForm] = useState<CreateOpportunityPayload>({
    company_name: '',
    deal_title: '',
    description: '',
    service_types: [],
    source: undefined,
    stage: defaultStage,
    estimated_value: undefined,
    date_briefed: '',
    client_deadline: '',
    agency_deadline: '',
    accountable_team_text: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof CreateOpportunityPayload, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const toggleService = (st: ServiceType) => {
    const current = form.service_types || [];
    set(
      'service_types',
      current.includes(st) ? current.filter(s => s !== st) : [...current, st]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) { setError('Company name is required'); return; }
    if (!form.deal_title.trim()) { setError('Deal title is required'); return; }

    setLoading(true);
    setError(null);
    try {
      await pipelineApi.create({
        ...form,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : undefined,
        date_briefed: form.date_briefed || undefined,
        client_deadline: form.client_deadline || undefined,
        agency_deadline: form.agency_deadline || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create opportunity');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: '540px',
          background: '#0f1020',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f1f5f9' }}>
              Add Deal to Pipeline
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Log a new business opportunity
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Row 1: Company + Deal Title */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Company Name *</label>
              <input
                style={inputStyle}
                placeholder="FiberOne"
                value={form.company_name}
                onChange={e => set('company_name', e.target.value)}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Deal Title *</label>
              <input
                style={inputStyle}
                placeholder="Digital Strategy Campaign"
                value={form.deal_title}
                onChange={e => set('deal_title', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>What They Asked For</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
              placeholder="Brief description of their request, scope, or the ask…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          {/* Row 2: Stage + Source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Pipeline Stage</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.stage}
                onChange={e => set('stage', e.target.value as PipelineStage)}
              >
                {ACTIVE_STAGES.map(s => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Source</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.source || ''}
                onChange={e => set('source', e.target.value || undefined)}
              >
                <option value="">Select source…</option>
                {SOURCES.map(s => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Service Types */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Service Types</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SERVICE_TYPES.map(st => {
                const selected = (form.service_types || []).includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => toggleService(st)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: selected ? 700 : 400,
                      cursor: 'pointer',
                      border: '1px solid',
                      background: selected ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.03)',
                      color: selected ? '#c4b5fd' : '#64748b',
                      borderColor: selected ? 'rgba(109,40,217,0.4)' : 'rgba(255,255,255,0.08)',
                      transition: 'all .15s',
                    }}
                  >
                    {SERVICE_TYPE_LABELS[st]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Value + Date Briefed */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Estimated Value (₦)</label>
              <input
                type="number"
                style={inputStyle}
                placeholder="3000000"
                value={form.estimated_value || ''}
                onChange={e => set('estimated_value', e.target.value ? Number(e.target.value) : undefined)}
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Date Briefed</label>
              <input
                type="date"
                style={inputStyle}
                value={form.date_briefed}
                onChange={e => set('date_briefed', e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: Deadlines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Client Deadline</label>
              <input
                type="date"
                style={inputStyle}
                value={form.client_deadline}
                onChange={e => set('client_deadline', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Agency Deadline</label>
              <input
                type="date"
                style={inputStyle}
                value={form.agency_deadline}
                onChange={e => set('agency_deadline', e.target.value)}
              />
            </div>
          </div>

          {/* Accountable team */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Accountable Team</label>
            <input
              style={inputStyle}
              placeholder="Ada, Emeka, Tunde…"
              value={form.accountable_team_text}
              onChange={e => set('accountable_team_text', e.target.value)}
            />
          </div>

          {/* Initial notes */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Initial Notes / Context</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
              placeholder="Any context on where this is at or what happened this week…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: '10px',
                borderRadius: '8px',
                background: loading ? 'rgba(109,40,217,0.4)' : '#6d28d9',
                border: 'none',
                color: 'white',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Space Grotesk, sans-serif',
                transition: 'all .15s',
              }}
            >
              {loading ? 'Adding…' : 'Add to Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
