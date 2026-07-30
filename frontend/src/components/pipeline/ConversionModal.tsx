'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Opportunity } from '@/lib/pipeline-api';
import { pipelinePhase3Api, ConversionConfig, ConversionResult, formatNaira } from '@/lib/pipeline-phase3-api';

interface ConversionModalProps {
  opportunity: Opportunity;
  onClose: () => void;
  onConverted: (result: ConversionResult) => void;
}

type Step = 'confirm' | 'configure' | 'success';

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
  boxSizing: 'border-box',
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

export function ConversionModal({ opportunity: opp, onClose, onConverted }: ConversionModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('confirm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const [config, setConfig] = useState<ConversionConfig>({
    brand_name: opp.company_name,
    brand_description: opp.description || '',
    retainer_amount: opp.estimated_value ?? undefined,
    onboarding_date: new Date().toISOString().split('T')[0],
    create_invoice: true,
  });

  const set = <K extends keyof ConversionConfig>(k: K, v: ConversionConfig[K]) =>
    setConfig(prev => ({ ...prev, [k]: v }));

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pipelinePhase3Api.convert(opp.id, config);
      setResult(res);
      setStep('success');
      onConverted(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget && step !== 'success') onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: '520px',
          background: '#0c0c1e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: step === 'success'
              ? 'rgba(16,185,129,0.08)'
              : 'rgba(109,40,217,0.08)',
          }}
        >
          {/* Step indicators */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {(['confirm', 'configure', 'success'] as Step[]).map((s, i) => (
              <div
                key={s}
                style={{
                  height: '3px',
                  flex: 1,
                  borderRadius: '2px',
                  background: step === s
                    ? (s === 'success' ? '#10b981' : '#6d28d9')
                    : ['confirm', 'configure', 'success'].indexOf(step) > i
                    ? 'rgba(109,40,217,0.4)'
                    : 'rgba(255,255,255,0.08)',
                  transition: 'background .3s',
                }}
              />
            ))}
          </div>

          {step === 'confirm' && (
            <>
              <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', marginBottom: '6px' }}>
                🏆 Deal Won — Step 1 of 3
              </p>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>
                Create Brand Workspace?
              </h2>
            </>
          )}
          {step === 'configure' && (
            <>
              <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#7c3aed', marginBottom: '6px' }}>
                Configure — Step 2 of 3
              </p>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>
                Set Up the Brand
              </h2>
            </>
          )}
          {step === 'success' && (
            <>
              <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#10b981', marginBottom: '6px' }}>
                ✓ Complete — Step 3 of 3
              </p>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>
                Brand Workspace Created
              </h2>
            </>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────── */}
        <div style={{ padding: '24px', maxHeight: '68vh', overflowY: 'auto' }}>

          {/* ── Step 1: Confirm ──────────────────────────────────── */}
          {step === 'confirm' && (
            <>
              <div
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  marginBottom: '20px',
                }}
              >
                <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', marginBottom: '4px' }}>
                  WON OPPORTUNITY
                </p>
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '17px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
                  {opp.company_name}
                </p>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                  {opp.deal_title}
                </p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {opp.estimated_value && (
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>Value</p>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{formatNaira(opp.estimated_value)}</p>
                    </div>
                  )}
                  {opp.lead_ba_name && (
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>Brand Admin</p>
                      <p style={{ fontSize: '14px', color: '#f1f5f9' }}>{opp.lead_ba_name}</p>
                    </div>
                  )}
                  {opp.accountable_team_text && (
                    <div>
                      <p style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>Team</p>
                      <p style={{ fontSize: '14px', color: '#f1f5f9' }}>{opp.accountable_team_text}</p>
                    </div>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '20px' }}>
                One click will create a full Brand workspace in Sabi — pre-seeded with this opportunity's context so the team can start immediately without manual setup.
              </p>

              <div
                style={{
                  background: 'rgba(109,40,217,0.07)',
                  border: '1px solid rgba(109,40,217,0.15)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '20px',
                }}
              >
                <p style={{ fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#c4b5fd', marginBottom: '8px' }}>
                  What will be created:
                </p>
                {[
                  `Brand record: "${opp.company_name}"`,
                  opp.lead_ba_name ? `Brand Admin assigned: ${opp.lead_ba_name}` : 'Brand Admin: you',
                  opp.accountable_team_text ? `Team assigned: ${opp.accountable_team_text}` : null,
                  'First Brief: created from the opportunity description',
                  opp.estimated_value ? `Draft retainer invoice: ${formatNaira(opp.estimated_value)}` : null,
                ].filter(Boolean).map((item, i) => (
                  <p key={i} style={{ fontSize: '13px', color: '#a78bfa', marginBottom: '4px' }}>
                    ✦ {item}
                  </p>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '11px',
                    borderRadius: '9px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: '#64748b', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Not Yet
                </button>
                <button
                  onClick={() => setStep('configure')}
                  style={{
                    flex: 2, padding: '11px',
                    borderRadius: '9px',
                    background: '#6d28d9',
                    border: 'none', color: 'white',
                    fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  Yes, Set Up Brand →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Configure ────────────────────────────────── */}
          {step === 'configure' && (
            <>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                Review and adjust the details below. Everything is pre-filled from the opportunity — change anything before creating the workspace.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Brand Name *</label>
                <input
                  style={inputStyle}
                  value={config.brand_name}
                  onChange={e => set('brand_name', e.target.value)}
                  placeholder={opp.company_name}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Brand Description / First Brief Context</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                  value={config.brand_description}
                  onChange={e => set('brand_description', e.target.value)}
                  placeholder="What was the deal about? This becomes the first Brief."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Retainer Amount (₦)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={config.retainer_amount ?? ''}
                    onChange={e => set('retainer_amount', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 320000"
                    min={0}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Onboarding Start Date</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={config.onboarding_date ?? ''}
                    onChange={e => set('onboarding_date', e.target.value)}
                  />
                </div>
              </div>

              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: 'pointer', marginBottom: '20px',
                  padding: '12px 14px',
                  background: config.create_invoice ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${config.create_invoice ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '9px',
                  transition: 'all .15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.create_invoice}
                  onChange={e => set('create_invoice', e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                    Create draft retainer invoice
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b' }}>
                    {config.retainer_amount
                      ? `${formatNaira(config.retainer_amount)} — marked as Draft for you to confirm and send`
                      : 'Set a retainer amount above to enable this'}
                  </p>
                </div>
              </label>

              {error && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: '8px',
                    fontSize: '13px', color: '#fca5a5',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setStep('confirm'); setError(null); }}
                  style={{
                    flex: 1, padding: '11px',
                    borderRadius: '9px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: '#64748b', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleConvert}
                  disabled={loading || !config.brand_name?.trim()}
                  style={{
                    flex: 2, padding: '11px',
                    borderRadius: '9px',
                    background: loading ? 'rgba(16,185,129,0.4)' : '#10b981',
                    border: 'none', color: 'white',
                    fontSize: '14px', fontWeight: 700,
                    cursor: loading ? 'wait' : 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                    transition: 'background .2s',
                  }}
                >
                  {loading ? 'Creating workspace…' : 'Create Brand Workspace ✓'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Success ──────────────────────────────────── */}
          {step === 'success' && result && (
            <>
              {/* Confetti-style celebration */}
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div
                  style={{
                    width: '72px', height: '72px',
                    borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)',
                    border: '2px solid rgba(16,185,129,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: '30px',
                  }}
                >
                  🏆
                </div>
                <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: '#10b981', marginBottom: '6px' }}>
                  {result.brand.name} is now a Sabi brand!
                </p>
                <p style={{ fontSize: '13px', color: '#64748b' }}>
                  The pitch is over. The real work begins.
                </p>
              </div>

              {/* What was created */}
              <div
                style={{
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  marginBottom: '20px',
                }}
              >
                {[
                  { icon: '🏢', label: 'Brand workspace', value: result.brand.name },
                  { icon: '👥', label: 'Team assigned', value: `${result.team_assigned} member${result.team_assigned !== 1 ? 's' : ''}` },
                  result.brief && { icon: '📋', label: 'First brief created', value: result.brief.title.slice(0, 60) + (result.brief.title.length > 60 ? '…' : '') },
                  result.invoice && { icon: '💰', label: 'Draft invoice created', value: `${formatNaira(result.invoice.amount)} — awaiting confirmation` },
                ].filter(Boolean).map((item, i) => item && (
                  <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: i < 3 ? '12px' : 0, paddingBottom: i < 3 ? '12px' : 0, borderBottom: i < 3 ? '1px solid rgba(16,185,129,0.1)' : 'none' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', marginBottom: '2px' }}>{item.label}</p>
                      <p style={{ fontSize: '13px', color: '#f1f5f9' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '11px',
                    borderRadius: '9px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: '#64748b', fontSize: '14px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Stay in Pipeline
                </button>
                <button
                  onClick={() => router.push(`/brands/${result.brand.id}`)}
                  style={{
                    flex: 2, padding: '11px',
                    borderRadius: '9px',
                    background: '#10b981',
                    border: 'none', color: 'white',
                    fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  Open Brand Workspace →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
