'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GoalCategory, GoalPulseItem, HEALTH_CONFIG, agencyGoalsApi } from '@/lib/agency-goals-api';
import { GoalCategoryCard } from '@/components/agency-goals/GoalCategoryCard';

// ── Auth placeholder — replace with your existing auth hook ───────
const useUser = () => {
  if (typeof window === 'undefined') return { role: 'md', name: 'MD' };
  try {
    const u = JSON.parse(localStorage.getItem('sabi_user') || '{}');
    return { role: u.role || 'md', name: u.name || u.full_name || '' };
  } catch { return { role: 'md', name: '' }; }
};

// ── Aggregate health summary across all categories ─────────────────
const getAggregateHealth = (categories: GoalCategory[]) => {
  const counts = { green: 0, amber: 0, red: 0 };
  categories.forEach(c => { if (c.health) counts[c.health]++; });
  if (counts.red   > 0) return 'red';
  if (counts.amber > 0) return 'amber';
  return 'green';
};

const HEALTH_LABEL = { green: 'All systems on track', amber: 'Some areas need attention', red: 'Immediate attention required' };

export default function AgencyGoalsPage() {
  const user = useUser();
  const isSuperAdmin = user.role === 'super_admin';

  const [categories,  setCategories]  = useState<GoalCategory[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { categories: cats, fetched_at } = await agencyGoalsApi.getAll();
      setCategories(cats);
      setLastUpdated(
        new Date(fetched_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load Agency Goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const aggregateHealth = categories.length ? getAggregateHealth(categories) : 'amber';
  const hc              = HEALTH_CONFIG[aggregateHealth];
  const year            = new Date().getFullYear();

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Page header ──────────────────────────────────────────── */}
      <div style={{
        padding: '24px 36px',
        background: `linear-gradient(135deg, ${hc.bg}, rgba(0,0,0,0.2))`,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>
              Agency Goals · {year}
            </p>
            <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '26px', fontWeight: 800, marginBottom: '4px', letterSpacing: '-0.01em' }}>
              Mission Control
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              {loading ? 'Loading…' : `Last updated ${lastUpdated} · 6 goal categories`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Aggregate health badge */}
            {!loading && categories.length > 0 && (
              <div style={{
                padding: '8px 16px', borderRadius: '10px',
                background: hc.bg, border: `1px solid ${hc.border}`,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: hc.text }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: hc.text, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {HEALTH_LABEL[aggregateHealth]}
                </span>
              </div>
            )}

            {/* Refresh button */}
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: '8px 16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                color: '#64748b', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? '↺ Loading…' : '↺ Refresh'}
            </button>
          </div>
        </div>

        {/* Mini summary strip */}
        {!loading && categories.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            {categories.map(c => {
              const chc = HEALTH_CONFIG[c.health];
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '4px 12px', borderRadius: '20px',
                    background: chc.bg, border: `1px solid ${chc.border}`,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px' }}>{c.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: chc.text, fontFamily: 'JetBrains Mono, monospace' }}>
                    {c.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={{ padding: '28px 36px' }}>

        {error && (
          <div style={{
            padding: '14px 18px', borderRadius: '10px', marginBottom: '20px',
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '13px', color: '#fca5a5',
          }}>
            {error}
          </div>
        )}

        {/* ── Skeleton ───────────────────────────────────────────── */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: '180px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>
          </div>
        )}

        {/* ── 6-category grid ────────────────────────────────────── */}
        {!loading && categories.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
              {categories.map(cat => (
                <GoalCategoryCard
                  key={cat.id}
                  category={cat}
                  isSuperAdmin={isSuperAdmin}
                  onTargetSaved={load}
                />
              ))}
            </div>

            {/* ── How targets work note ─────────────────────────── */}
            {isSuperAdmin && (
              <div style={{
                padding: '16px 20px', borderRadius: '10px',
                background: 'rgba(109,40,217,0.07)', border: '1px solid rgba(109,40,217,0.18)',
                fontSize: '13px', color: '#c4b5fd', lineHeight: 1.65,
              }}>
                <strong style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Setting targets: </strong>
                Click any category card to expand it, then click "Edit targets" to configure the goals for {year}. Targets are saved per year. All progress values update automatically from live Sabi data — no manual input needed. Once targets are set, every module that feeds a category will show progress against your configured number.
              </div>
            )}

            {/* ── Footer ───────────────────────────────────────── */}
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                All metrics compute live from Sabi data · No manual reporting required · {year} targets
              </p>
              <p style={{ fontSize: '11px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
                Click any card to expand · {isSuperAdmin ? 'Super Admin — targets editable' : 'Read-only view'}
              </p>
            </div>
          </>
        )}

        {!loading && categories.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '14px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
              No goal data available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
