'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { bookOfDealsApi, WidgetData } from '@/lib/book-of-deals-api';

// ── Pursuit Board homepage widget ─────────────────────────────────
// Compact — sits on every staff member's dashboard.
// Shows top 3 most active deal-chasers + total count.
// Click → /book-of-deals?tab=pursuit-board

export function DashboardPursuitWidget() {
  const router = useRouter();
  const [data,    setData]    = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookOfDealsApi.getWidget()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const RANK_COLOURS = ['#f59e0b', '#94a3b8', '#92400e'];

  return (
    <div
      onClick={() => router.push('/book-of-deals?tab=pursuit-board')}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color .15s, background .15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(109,40,217,0.3)';
        (e.currentTarget as HTMLElement).style.background  = 'rgba(109,40,217,0.05)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.background  = 'rgba(255,255,255,0.02)';
      }}
    >
      {/* Widget header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '14px' }}>🏆</span>
          <span style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px',
            fontWeight: 700, color: '#f1f5f9',
          }}>
            The Pursuit Board
          </span>
        </div>
        {!loading && data && (
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
            fontWeight: 700, color: '#6d28d9',
          }}>
            {data.total_active} active →
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '10px 14px 12px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: '22px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
          </div>
        ) : !data || data.top_chasers.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center', padding: '8px 0' }}>
            No active deals yet. Be the first to log one.
          </p>
        ) : (
          data.top_chasers.map((chaser, i) => (
            <div
              key={chaser.full_name}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 0',
                borderBottom: i < data.top_chasers.length - 1
                  ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px',
                  color: RANK_COLOURS[i], fontWeight: 800, minWidth: '14px',
                }}>
                  {['🥇', '🥈', '🥉'][i]}
                </span>
                <span style={{ fontSize: '13px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
                  {chaser.full_name}
                </span>
              </div>
              <span style={{
                fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
                fontWeight: 800, color: RANK_COLOURS[i],
              }}>
                {chaser.deal_count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
