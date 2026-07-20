'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FleetGauge from '@/components/command/FleetGauge';
import BrandRow from '@/components/command/BrandRow';
import { fetchCommand, type CommandPayload } from '@/components/command/types';
import '@/styles/command-theme.css';
import { AgencyTopNav } from '@/components/internal';

type Filter = 'all' | 'at_risk' | 'watch' | 'healthy';

export default function CommandCenterPage() {
  const [data, setData] = useState<CommandPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [spinning, setSpinning] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (soft) setSpinning(true);
    try { setData(await fetchCommand()); setError(null); }
    catch (e: any) { if (!soft) setError(e.message || 'Failed to load'); }
    finally { setTimeout(() => setSpinning(false), 500); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  // '/' focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('cc-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const brands = useMemo(() => {
    if (!data) return [];
    let list = data.brands;
    if (filter !== 'all') list = list.filter((b) => b.status === filter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q) || (b.team.brand_admin || '').toLowerCase().includes(q));
    return list;
  }, [data, filter, query]);

  if (error) throw new Error(error);

  const s = data?.summary;

  return (
    <div>
      <div className='px-4 md:hidden'><AgencyTopNav /></div>
      <div className="cc-scope">
        <div className="cc-inner">
          <div className="cc-topbar">
            <div className="cc-word">
              <div className="cc-mark">S</div>
              <div>
                <div className="cc-title">Command</div>
                <div className="cc-eyebrow">The Bridge · Sabi</div>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="cc-searchbox">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              <input id="cc-search-input" placeholder="Search brand or Brand Admin…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <kbd>/</kbd>
            </div>
            <div className="cc-iconbtn" onClick={() => load(true)} title="Refresh" style={{ cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: spinning ? 'spin .6s linear' : undefined }}>
                <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </div>
          </div>

          {!data ? (
            <CommandSkeleton />
          ) : (
            <>
              <div className="cc-hero">
                <FleetGauge healthy={s!.healthy} total={s!.brands} />
                <div className="cc-hero-right">
                  <div className="cc-hero-title">
                    Every number traces to a verified record — updated{' '}
                    <b>{new Date(data.computed_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</b>
                  </div>
                  <div className="cc-readout-row"><div className="cc-rr-tick" style={{ background: '#EF5A61' }} /><div className="cc-rr-label">At Risk</div><div className="cc-rr-val" style={{ color: '#EF5A61' }}>{s!.at_risk} brand{s!.at_risk !== 1 ? 's' : ''}</div></div>
                  <div className="cc-readout-row"><div className="cc-rr-tick" style={{ background: '#E3A62F' }} /><div className="cc-rr-label">Watch</div><div className="cc-rr-val" style={{ color: '#E3A62F' }}>{s!.watch} brand{s!.watch !== 1 ? 's' : ''}</div></div>
                  <div className="cc-readout-row"><div className="cc-rr-tick" style={{ background: '#3FBE8A' }} /><div className="cc-rr-label">Healthy</div><div className="cc-rr-val" style={{ color: '#3FBE8A' }}>{s!.healthy} brand{s!.healthy !== 1 ? 's' : ''}</div></div>
                  <div className="cc-hero-stats">
                    <div className="cc-hstat"><b>{fmtNaira(s!.expected_revenue_mtd)}</b><span>Expected · MTD</span></div>
                    <div className="cc-hstat"><b>{s!.avg_satisfaction ?? '—'}</b><span>Avg satisfaction</span></div>
                    <div className="cc-hstat"><b>{s!.brands}</b><span>Active brands</span></div>
                  </div>
                </div>
              </div>

              <div className="cc-filters">
                {(['all', 'at_risk', 'watch', 'healthy'] as Filter[]).map((f) => (
                  <div key={f} className={`cc-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'All' : f === 'at_risk' ? 'At Risk' : f === 'watch' ? 'Watch' : 'Healthy'}
                    <span className="n">{f === 'all' ? s!.brands : f === 'at_risk' ? s!.at_risk : f === 'watch' ? s!.watch : s!.healthy}</span>
                  </div>
                ))}
                <div className="cc-sort-note">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h12M3 18h6" /></svg>
                  worst-first
                </div>
              </div>

              <div>
                {brands.length === 0
                  ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--dim)', fontSize: 13 }}>No brands match this view.</div>
                  : brands.map((b) => <BrandRow key={b.id} brand={b} />)}
              </div>
            </>
          )}

          <div style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--dim2)', marginTop: 32, letterSpacing: '.04em' }}>
            SABI INTELLIGENCE SUITE · THE BRIDGE · CEREBRE MEDIA AFRICA
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtNaira(n: number) {
  return n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `₦${Math.round(n / 1_000)}k` : `₦${n}`;
}

function CommandSkeleton() {
  return (
    <>
      <div className="cc-hero">
        <div className="cc-skel" style={{ width: 200, height: 200, borderRadius: '50%' }} />
        <div style={{ display: 'grid', gap: 10 }}>
          {[1, 2, 3].map(i => <div key={i} className="cc-skel" style={{ height: 20 }} />)}
        </div>
      </div>
      {[1, 2, 3].map(i => <div key={i} className="cc-skel" style={{ height: 66, marginBottom: 8, borderRadius: 12 }} />)}
    </>
  );
}
