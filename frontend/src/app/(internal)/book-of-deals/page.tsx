'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  bookOfDealsApi, AgencyProgress, MyStats,
  fmtNaira, dealDisplayValue,
} from '@/lib/book-of-deals-api';
import { STAGE_LABELS, STAGE_COLOURS, SERVICE_SCOPE_LABELS } from '@/lib/pipeline-api';
import type { Opportunity, PipelineStage } from '@/lib/pipeline-api';
import { MyDealsForm }   from '@/components/book-of-deals/MyDealsForm';
import { PursuitBoard }  from '@/components/book-of-deals/PursuitBoard';

const useUser = () => {
  if (typeof window === 'undefined') return { role: 'staff', id: '', name: '', deal_book_full_access: false };
  try {
    const u = JSON.parse(localStorage.getItem('sabi_user') || '{}');
    return {
      role: u.role || 'staff',
      id: u.id || '',
      name: u.full_name || u.name || '',
      deal_book_full_access: Boolean(u.deal_book_full_access),
    };
  } catch { return { role: 'staff', id: '', name: '', deal_book_full_access: false }; }
};

type Tab = 'my-deals' | 'full-view' | 'pursuit-board';

// ── Agency progress bar ───────────────────────────────────────────
const AgencyProgressBar = ({ progress }: { progress: AgencyProgress | null }) => {
  if (!progress) return null;

  const hasClientTarget  = progress.client_target  > 0;
  const hasRevenueTarget = progress.revenue_target > 0;

  if (!hasClientTarget && !hasRevenueTarget) return null;

  return (
    <div style={{
      background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.18)',
      borderRadius: '12px', padding: '14px 18px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
          New Business Target — {progress.year}
        </p>
        <p style={{ fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
          {progress.active_pipeline} deals in pipeline
        </p>
      </div>

      {hasClientTarget && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              New clients onboarded: <strong style={{ color: '#f1f5f9' }}>{progress.onboarded_this_year}</strong> of <strong style={{ color: '#f1f5f9' }}>{progress.client_target}</strong>
            </p>
            <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#6d28d9', fontWeight: 700 }}>
              {progress.client_pct}%
            </p>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '3px', background: '#6d28d9', width: `${progress.client_pct ?? 0}%`, transition: 'width .6s ease' }} />
          </div>
        </div>
      )}

      {hasRevenueTarget && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              New revenue: <strong style={{ color: '#f1f5f9' }}>{fmtNaira(progress.revenue_this_year)}</strong> of <strong style={{ color: '#f1f5f9' }}>{fmtNaira(progress.revenue_target)}</strong>
            </p>
            <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#10b981', fontWeight: 700 }}>
              {progress.revenue_pct}%
            </p>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '3px', background: '#10b981', width: `${progress.revenue_pct ?? 0}%`, transition: 'width .6s ease' }} />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Deal card (My Deals list) ─────────────────────────────────────
const DealCard = ({ deal }: { deal: Opportunity }) => {
  const sc   = STAGE_COLOURS[deal.stage as PipelineStage] || STAGE_COLOURS.introduction;
  const val  = dealDisplayValue(deal);
  const days = deal.stage_changed_at
    ? Math.floor((Date.now() - new Date(deal.stage_changed_at).getTime()) / 86400000)
    : null;

  return (
    <div style={{
      padding: '14px 16px',
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '11px', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
              {deal.company_name}
            </p>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
            }}>
              {STAGE_LABELS[deal.stage as PipelineStage] || deal.stage}
            </span>
            {deal.deal_type && (
              <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                {deal.deal_type}
              </span>
            )}
          </div>

          {deal.contact_name && (
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>
              {deal.contact_name}{deal.contact_position ? ` · ${deal.contact_position}` : ''}
            </p>
          )}

          {deal.service_scope?.length ? (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {deal.service_scope.slice(0, 3).map(s => (
                <span key={s} style={{
                  padding: '1px 6px', borderRadius: '3px', fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                  background: 'rgba(109,40,217,0.1)', color: '#c4b5fd',
                }}>
                  {SERVICE_SCOPE_LABELS[s as keyof typeof SERVICE_SCOPE_LABELS] || s}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 800, color: '#10b981' }}>
            {val}
          </p>
          {days != null && (
            <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
              {days}d in stage
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── My Stats strip ────────────────────────────────────────────────
const StatsStrip = ({ stats }: { stats: MyStats }) => {
  const items = [
    { label: 'Total Pitched',    value: stats.total_pitched,        colour: '#94a3b8' },
    { label: 'Deals Won',        value: stats.total_won,            colour: '#10b981' },
    { label: 'Conversion Rate',  value: `${stats.conversion_rate}%`, colour: '#6d28d9' },
    { label: 'Active Pipeline',  value: stats.active_pipeline,      colour: '#38bdf8' },
    {
      label: 'Revenue Attributed',
      value: fmtNaira(stats.attributed_revenue),
      colour: '#f59e0b',
    },
  ];
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
      {items.map(item => (
        <div key={item.label} style={{
          flex: '1 1 130px', padding: '12px 14px', borderRadius: '10px',
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px', fontWeight: 800, color: item.colour, marginBottom: '2px' }}>
            {item.value}
          </p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────
export default function BookOfDealsPage() {
  const user         = useUser();
  const searchParams = useSearchParams();
  const initialTab   = (searchParams?.get('tab') as Tab) || 'my-deals';

  const isFullAccess = user.role === 'super_admin' || user.deal_book_full_access;

  const [tab,        setTab]        = useState<Tab>(initialTab);
  const [showForm,   setShowForm]   = useState(false);
  const [myDeals,    setMyDeals]    = useState<Opportunity[]>([]);
  const [myStats,    setMyStats]    = useState<MyStats | null>(null);
  const [fullDeals,  setFullDeals]  = useState<Opportunity[]>([]);
  const [progress,   setProgress]   = useState<AgencyProgress | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [fullSearch, setFullSearch] = useState('');

  const loadMyData = useCallback(async () => {
    setLoading(true);
    const [dealsRes, statsRes, progressRes] = await Promise.allSettled([
      bookOfDealsApi.getMyDeals(),
      bookOfDealsApi.getMyStats(),
      bookOfDealsApi.getAgencyProgress(),
    ]);
    if (dealsRes.status    === 'fulfilled') setMyDeals(dealsRes.value.deals);
    if (statsRes.status    === 'fulfilled') setMyStats(statsRes.value.stats);
    if (progressRes.status === 'fulfilled') setProgress(progressRes.value);
    setLoading(false);
  }, []);

  const loadFullBook = useCallback(async (search = '') => {
    try {
      const { deals } = await bookOfDealsApi.getFullBook({ search: search || undefined });
      setFullDeals(deals);
    } catch {}
  }, []);

  useEffect(() => { loadMyData(); }, [loadMyData]);
  useEffect(() => { if (tab === 'full-view') loadFullBook(fullSearch); }, [tab, loadFullBook, fullSearch]);

  const TABS = [
    { id: 'my-deals'       as Tab, label: 'My Deals' },
    { id: 'pursuit-board'  as Tab, label: 'The Pursuit Board' },
    ...(isFullAccess ? [{ id: 'full-view' as Tab, label: 'Full Book' }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Page header ──────────────────────────────────────── */}
      <div style={{ padding: '24px 36px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
          <div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>
              Book of Deals · Cerebre Media Africa
            </p>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Book of Deals
            </h1>
          </div>
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setTab('my-deals'); }}
              style={{
                padding: '10px 20px', borderRadius: '9px', background: '#6d28d9',
                border: 'none', color: 'white', fontSize: '14px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              🎯 Log a Deal
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setShowForm(false); }}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: 'Inter, sans-serif', border: 'none', whiteSpace: 'nowrap',
                background: tab === t.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: tab === t.id ? '#f1f5f9' : '#64748b',
                borderBottom: tab === t.id ? '2px solid #6d28d9' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      <div style={{ padding: '24px 36px' }}>

        {/* Agency progress bar — visible on My Deals tab */}
        {tab === 'my-deals' && !showForm && (
          <AgencyProgressBar progress={progress} />
        )}

        {/* ── MY DEALS TAB ─────────────────────────────────── */}
        {tab === 'my-deals' && !showForm && (
          <div>
            {loading ? (
              <p style={{ fontSize: '13px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>Loading your deals…</p>
            ) : (
              <>
                {myStats && myStats.total_pitched > 0 && <StatsStrip stats={myStats} />}

                {myDeals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>
                      You haven't logged any deals yet
                    </p>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
                      Every deal you bring in — referral, cold outreach, or inbound — belongs here. Log it and it appears on The Pursuit Board.
                    </p>
                    <button
                      onClick={() => setShowForm(true)}
                      style={{
                        padding: '10px 24px', borderRadius: '9px', background: '#6d28d9',
                        border: 'none', color: 'white', fontSize: '14px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      🎯 Log Your First Deal
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginBottom: '12px' }}>
                      {myDeals.length} deal{myDeals.length !== 1 ? 's' : ''} · All pipeline opportunities where you are the business bringer
                    </p>
                    {myDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MY DEALS FORM ────────────────────────────────── */}
        {tab === 'my-deals' && showForm && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>
                Log a Deal
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}>
                ← Back to My Deals
              </button>
            </div>
            <MyDealsForm
              onSubmitted={() => { setShowForm(false); loadMyData(); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* ── PURSUIT BOARD TAB ────────────────────────────── */}
        {tab === 'pursuit-board' && (
          <PursuitBoard />
        )}

        {/* ── FULL VIEW TAB ────────────────────────────────── */}
        {tab === 'full-view' && isFullAccess && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                style={{
                  flex: 1, minWidth: '200px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  padding: '8px 13px', fontSize: '13px', color: '#f1f5f9', outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
                placeholder="Search by company name…"
                value={fullSearch}
                onChange={e => setFullSearch(e.target.value)}
              />
              <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', alignSelf: 'center' }}>
                {fullDeals.length} deals · Full details including amounts
              </p>
            </div>

            {fullDeals.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#475569' }}>
                {fullSearch ? `No results for "${fullSearch}"` : 'No deals with business_bringer attribution found yet.'}
              </p>
            ) : (
              fullDeals.map(deal => (
                <div key={deal.id} style={{
                  padding: '14px 16px', marginBottom: '8px',
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '11px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                          {deal.company_name}
                        </p>
                        <span style={{
                          padding: '2px 7px', borderRadius: '4px', fontSize: '10px',
                          fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                          background: STAGE_COLOURS[deal.stage as PipelineStage]?.bg || 'rgba(255,255,255,0.06)',
                          color: STAGE_COLOURS[deal.stage as PipelineStage]?.text || '#94a3b8',
                        }}>
                          {STAGE_LABELS[deal.stage as PipelineStage] || deal.stage}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>
                        Brought by: <strong style={{ color: '#f1f5f9' }}>
                          {(deal as any).business_bringer?.full_name || 'Unknown'}
                        </strong>
                        {deal.contact_name ? ` · Contact: ${deal.contact_name}` : ''}
                      </p>
                    </div>
                    <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '16px', fontWeight: 800, color: '#10b981', flexShrink: 0 }}>
                      {dealDisplayValue(deal)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
