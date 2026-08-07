'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Opportunity,
  PipelineStage,
  PipelineAnalytics as PipelineAnalyticsType,
  StalenessAlert,
  pipelineApi,
} from '@/lib/pipeline-api';
import { KanbanView } from '@/components/pipeline/KanbanView';
import { ListView } from '@/components/pipeline/ListView';
import { PipelineAnalytics } from '@/components/pipeline/PipelineAnalytics';
import { AddOpportunityModal } from '@/components/pipeline/AddOpportunityModal';
import { OpportunityDetailSlideOver } from '@/components/pipeline/OpportunityDetailSlideOver';
import { PitchArchive, DebriefInsightsPanel } from '@/components/pipeline/PitchArchive';
import { RevenueWaterfall } from '@/components/pipeline/RevenueWaterfall';

const useUser = () => {
  if (typeof window === 'undefined') return { role: 'md' };
  try {
    const u = JSON.parse(localStorage.getItem('sabi_user') || '{}');
    return { role: u.role || 'md' };
  } catch {
    return { role: 'md' };
  }
};

type ViewMode = 'kanban' | 'list' | 'analytics';

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [analytics, setAnalytics] = useState<PipelineAnalyticsType | null>(null);
  const [alerts, setAlerts] = useState<StalenessAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const user = useUser();
  const canViewAnalytics = ['super_admin', 'md', 'admin'].includes(user.role);

  // Modal state
  const [addModal, setAddModal] = useState<{ open: boolean; defaultStage: PipelineStage }>({
    open: false,
    defaultStage: 'introduction',
  });
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadOpportunities = useCallback(async () => {
    try {
      const { opportunities } = await pipelineApi.list();
      setOpportunities(opportunities);
    } catch (e) {
      console.error('Failed to load pipeline', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [analyticsRes, alertsRes] = await Promise.all([
        pipelineApi.getAnalytics().catch(() => null),
        pipelineApi.getAlerts().catch(() => null),
      ]);
      if (analyticsRes) setAnalytics(analyticsRes.analytics);
      if (alertsRes) setAlerts(alertsRes.alerts);
    } catch (e) {
      // analytics may not be available to Brand Admins — fail silently
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpportunities();
    loadAnalytics();
  }, [loadOpportunities, loadAnalytics]);

  const handleRefresh = () => {
    loadOpportunities();
    loadAnalytics();
  };

  const activeCount = opportunities.filter(o => o.stage !== 'won' && o.stage !== 'lost_paused').length;
  const criticalAlerts = alerts.filter(a => a.staleness === 'red').length;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0d0d1a',
        color: '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
        padding: '32px 36px',
      }}
    >
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '26px',
              fontWeight: 800,
              color: '#f1f5f9',
              marginBottom: '4px',
            }}
          >
            New Business Pipeline
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            {loading
              ? 'Loading…'
              : `${activeCount} active deal${activeCount !== 1 ? 's' : ''} in pipeline`}
            {criticalAlerts > 0 && (
              <span
                style={{
                  marginLeft: '12px',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.2)',
                }}
              >
                ⚠ {criticalAlerts} overdue
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* View toggle */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '3px',
            }}
          >
            {(['kanban', 'list'] as ViewMode[])
              .concat(canViewAnalytics ? ['analytics' as ViewMode] : [])
              .map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    fontFamily: 'Inter, sans-serif',
                    background: viewMode === mode ? 'rgba(109,40,217,0.2)' : 'transparent',
                    color: viewMode === mode ? '#c4b5fd' : '#64748b',
                    transition: 'all .15s',
                  }}
                >
                  {mode === 'kanban' ? '⊞ Kanban' : mode === 'list' ? '☰ List' : '◎ Analytics'}
                </button>
            ))}
          </div>

          {/* Add deal button */}
          <button
            onClick={() => setAddModal({ open: true, defaultStage: 'introduction' })}
            style={{
              padding: '9px 18px',
              borderRadius: '9px',
              background: '#6d28d9',
              border: 'none',
              color: 'white',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'Space Grotesk, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#7c3aed')}
            onMouseLeave={e => (e.currentTarget.style.background = '#6d28d9')}
          >
            + Add Deal
          </button>
        </div>
      </div>

      {/* ── Staleness alerts banner ─────────────────────────────── */}
      {criticalAlerts > 0 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.07)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px',
          }}
        >
          <p style={{ fontSize: '12px', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>
            ⚠ {criticalAlerts} deal{criticalAlerts !== 1 ? 's' : ''} need immediate attention
          </p>
          {alerts.filter(a => a.staleness === 'red').map(a => (
            <p key={a.id} style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>
              {a.alert_message}
            </p>
          ))}
        </div>
      )}

      {/* ── Analytics mini-dashboard (admin/MD only) ────────────── */}
      {analytics && (
        <PipelineAnalytics analytics={analytics} loading={analyticsLoading} />
      )}

      {/* ── Main view ───────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: '#475569',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
          }}
        >
          Loading pipeline…
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanView
          opportunities={opportunities}
          onCardClick={opp => setDetailId(opp.id)}
          onAddInStage={stage => setAddModal({ open: true, defaultStage: stage })}
        />
      ) : viewMode === 'list' ? (
        <ListView
          opportunities={opportunities}
          onRowClick={opp => setDetailId(opp.id)}
        />
      ) : (
        <div style={{ maxWidth: '1200px' }}>
          <div style={{ marginBottom: '24px' }}>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>
              Pipeline Intelligence
            </p>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>
              Revenue Waterfall Forecast
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Forward-looking revenue from active deals in three probability layers. Bars show when revenue is expected to land, not just the weighted total.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px',
              padding: '18px',
            }}>
              <RevenueWaterfall months={6} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                padding: '18px',
              }}>
                <PitchArchive compact />
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                padding: '18px',
              }}>
                <DebriefInsightsPanel />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Opportunity Modal ────────────────────────────────── */}
      {addModal.open && (
        <AddOpportunityModal
          defaultStage={addModal.defaultStage}
          onClose={() => setAddModal({ open: false, defaultStage: 'introduction' })}
          onCreated={() => {
            setAddModal({ open: false, defaultStage: 'introduction' });
            handleRefresh();
          }}
        />
      )}

      {/* ── Opportunity Detail Slide-over ────────────────────────── */}
      {detailId && (
        <OpportunityDetailSlideOver
          opportunityId={detailId}
          onClose={() => setDetailId(null)}
            onUpdated={() => { handleRefresh(); loadOpportunities(); }}
        />
      )}
    </div>
  );
}
