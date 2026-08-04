'use client';

import React, { useState, useEffect } from 'react';
import {
  pipelineAnalyticsApi, FollowUpResult, StalenessCheck,
} from '@/lib/pipeline-analytics-api';

type Format = 'email' | 'whatsapp' | 'linkedin';

const FORMAT_LABELS: Record<Format, string> = {
  email:    '📧 Email',
  whatsapp: '💬 WhatsApp',
  linkedin: '💼 LinkedIn',
};

const FORMAT_DETAILS: Record<Format, string> = {
  email:    '3–4 sentences · Professional · Subject line included',
  whatsapp: '1–2 sentences · Casual and warm',
  linkedin: '2–3 sentences · Professional but personal',
};

// ── Copy button ────────────────────────────────────────────────────
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={copy}
      style={{
        padding: '6px 16px', borderRadius: '7px', cursor: 'pointer',
        fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
        border: '1px solid',
        background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(109,40,217,0.15)',
        borderColor: copied ? 'rgba(16,185,129,0.35)' : 'rgba(109,40,217,0.35)',
        color: copied ? '#10b981' : '#c4b5fd',
        transition: 'all .2s',
        flexShrink: 0,
      }}
    >
      {copied ? '✓ Copied' : '📋 Copy'}
    </button>
  );
};

// ── Main panel ─────────────────────────────────────────────────────
interface SmartFollowUpPanelProps {
  opportunityId: string;
  companyName:   string;
  daysInStage?:  number;
  stage?:        string;
}

export function SmartFollowUpPanel({
  opportunityId, companyName, daysInStage, stage,
}: SmartFollowUpPanelProps) {
  const [expanded,    setExpanded]    = useState(false);
  const [staleness,   setStaleness]   = useState<StalenessCheck | null>(null);
  const [result,      setResult]      = useState<FollowUpResult | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<Format>('email');

  // Check staleness on mount (lightweight — no ARIA)
  useEffect(() => {
    pipelineAnalyticsApi.checkStaleness(opportunityId)
      .then(setStaleness)
      .catch(() => {});
  }, [opportunityId]);

  const isStale    = staleness?.is_stale ?? false;
  const daysOver   = staleness?.days_in_stage != null && staleness?.threshold != null
    ? staleness.days_in_stage - staleness.threshold
    : null;

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const r = await pipelineAnalyticsApi.generateFollowUp(opportunityId);
      setResult(r);
      setExpanded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // Build the display text for the active format
  const getDisplayText = (): string => {
    if (!result) return '';
    const { drafts } = result;

    if (activeFormat === 'email' && drafts.email) {
      return `Subject: ${drafts.email.subject}\n\n${drafts.email.body}`;
    }
    if (activeFormat === 'whatsapp' && drafts.whatsapp) {
      return drafts.whatsapp;
    }
    if (activeFormat === 'linkedin' && drafts.linkedin) {
      return drafts.linkedin;
    }
    return '';
  };

  const displayText = getDisplayText();

  return (
    <div style={{
      marginTop: '16px',
      background: isStale
        ? 'rgba(245,158,11,0.05)' : 'rgba(109,40,217,0.04)',
      border: `1px solid ${isStale ? 'rgba(245,158,11,0.2)' : 'rgba(109,40,217,0.15)'}`,
      borderRadius: '11px', overflow: 'hidden',
    }}>
      {/* Panel trigger */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '12px', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '14px' }}>{isStale ? '⚠️' : '✉️'}</span>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
              Smart Follow-Up Draft
            </p>
            {isStale && (
              <span style={{
                padding: '1px 8px', borderRadius: '4px', fontSize: '10px',
                fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)',
              }}>
                STALE {daysOver != null ? `+${daysOver}d` : ''}
              </span>
            )}
          </div>
          <p style={{ fontSize: '11px', color: '#64748b' }}>
            {isStale
              ? `${companyName} has been in this stage for ${staleness?.days_in_stage}d (threshold: ${staleness?.threshold}d) — ARIA can draft your follow-up.`
              : `Generate a personalized follow-up message for ${companyName}.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {result && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                padding: '6px 12px', borderRadius: '7px', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'Inter, sans-serif',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: '#64748b',
              }}
            >
              {expanded ? 'Hide' : 'Show draft'}
            </button>
          )}
          <button
            onClick={generate}
            disabled={generating}
            style={{
              padding: '7px 16px', borderRadius: '7px', cursor: generating ? 'wait' : 'pointer',
              fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif',
              border: `1px solid ${isStale ? 'rgba(245,158,11,0.4)' : 'rgba(109,40,217,0.4)'}`,
              background: isStale ? 'rgba(245,158,11,0.15)' : 'rgba(109,40,217,0.15)',
              color: isStale ? '#f59e0b' : '#c4b5fd',
              opacity: generating ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {generating ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                ARIA thinking…
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </>
            ) : result ? '↺ Regenerate' : '✨ Generate Draft'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.07)', borderTop: '1px solid rgba(239,68,68,0.15)', fontSize: '12px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Draft content */}
      {result && expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>

          {/* Format tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
            {(['email', 'whatsapp', 'linkedin'] as Format[]).map(f => (
              <button
                key={f}
                onClick={() => setActiveFormat(f)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  border: '1px solid',
                  background: activeFormat === f ? 'rgba(109,40,217,0.2)' : 'rgba(255,255,255,0.03)',
                  borderColor: activeFormat === f ? 'rgba(109,40,217,0.4)' : 'rgba(255,255,255,0.08)',
                  color: activeFormat === f ? '#c4b5fd' : '#64748b',
                }}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Format detail */}
          <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginBottom: '10px' }}>
            {FORMAT_DETAILS[activeFormat]}
          </p>

          {/* Draft text */}
          {displayText ? (
            <div>
              <pre style={{
                background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px', padding: '14px 16px',
                fontSize: '13px', color: '#e2e8f0', lineHeight: 1.65,
                fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap',
                wordBreak: 'break-word', margin: 0, marginBottom: '10px',
              }}>
                {displayText}
              </pre>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <CopyButton text={displayText} />
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#475569' }}>
              No {FORMAT_LABELS[activeFormat]} draft available.
            </p>
          )}

          {/* ARIA attribution */}
          <p style={{ marginTop: '10px', fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>
            Generated by ARIA · {new Date(result.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })} · Review before sending
          </p>
        </div>
      )}
    </div>
  );
}

// ── Standalone staleness indicator for deal cards ──────────────────
// Used on the Book of Deals My Deals list — a small chip if stale.

export function StalenessBadge({
  daysInStage, stage,
}: {
  daysInStage: number;
  stage: string;
}) {
  const THRESHOLDS: Record<string, number> = {
    introduction: 14, proposal: 7, pitch: 10,
    second_pitch: 7, decision: 14,
  };
  const threshold = THRESHOLDS[stage];
  if (!threshold || daysInStage < threshold) return null;
  const daysOver = daysInStage - threshold;

  return (
    <span style={{
      padding: '1px 7px', borderRadius: '4px', fontSize: '10px',
      fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
      background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.25)',
      display: 'inline-block',
    }}>
      Stale {daysOver > 0 ? `+${daysOver}d` : ''}
    </span>
  );
}
