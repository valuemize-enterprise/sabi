'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, Clock, CheckCircle2, PenLine,
  ChevronRight, Loader2, Target, Lightbulb, TrendingUp,
  AlertCircle, Plus,
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { strategies as stratApi, goals as goalsApi } from '@/lib/api';
import { isGlobalAdmin } from '@/lib/permissions';
import { StrategyCard } from '@/components/internal/StrategyCard';
import { StatCard } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const fetchMe = (path: string) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${path}`, {
    headers: { Authorization: `Bearer ${tok()}` },
  }).then(r => r.json()).catch(() => ({ data: [] }));

function QuickLink({ href, icon: Icon, label, color = 'purple' }: any) {
  const s: Record<string, string> = {
    purple:'hover:bg-purple-500/5 hover:border-purple-500/25',
    green: 'hover:bg-green-500/5 hover:border-green-500/25',
    amber: 'hover:bg-amber-500/5 hover:border-amber-500/25',
    blue:  'hover:bg-blue-500/5 hover:border-blue-500/25',
  };
  const ic: Record<string, string> = {
    purple:'text-purple-400 bg-purple-500/10', green:'text-green-400 bg-green-500/10',
    amber:'text-amber-400 bg-amber-500/10', blue:'text-blue-400 bg-blue-500/10',
  };
  return (
    <Link href={href} className={`sabi-card p-4 flex items-center gap-3 transition-all group border border-white/5 ${s[color]}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ic[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm text-white/70 group-hover:text-white transition-colors flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/50 flex-shrink-0" />
    </Link>
  );
}

// Loads all active strategies for the staff's brands
async function loadStrategiesForBrands(brandIds: string[]) {
  if (!brandIds.length) return {};
  const map: Record<string, any> = {};
  await Promise.all(
    brandIds.map(async id => {
      const res: any = await stratApi.list({ brand_id: id, status: 'active', limit: '1' }).catch(() => ({ data: [] }));
      const strategy = (res.data ?? [])[0];
      if (strategy) map[id] = strategy;
    })
  );
  return map;
}

export default function StaffDashboard() {
  const { user } = useAgencyStore();

  const [myBrands, setMyBrands]     = useState<any[]>([]);
  const [myStats, setMyStats]       = useState<any>({});
  const [strategies, setStrategies] = useState<Record<string, any>>({});
  const [atRiskGoals, setAtRiskGoals] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const load = async () => {
      const [brandsRes, statsRes] = await Promise.all([
        fetchMe('/api/agency/staff/me/brands'),
        fetchMe('/api/agency/staff/me/dashboard'),
      ]);
      const brands: any[] = brandsRes.data ?? [];
      setMyBrands(brands);
      setMyStats(statsRes.data ?? {});

      // Load active strategies for each brand
      const brandIds = brands.map((b: any) => b.id ?? b.brand_id);
      const strats   = await loadStrategiesForBrands(brandIds);
      setStrategies(strats);

      // Load at-risk goals (below 40% with upcoming deadline)
      const allGoals: any[] = [];
      await Promise.all(
        brandIds.slice(0, 5).map(async (id: string) => {
          const res: any = await goalsApi.list({ brand_id: id, status: 'active', limit: '20' }).catch(() => ({ data: [] }));
          const atRisk   = (res.data ?? []).filter((g: any) => {
            const pct = (g.current_value / Math.max(g.target_value, 1)) * 100;
            return pct < 40;
          });
          allGoals.push(...atRisk.map((g: any) => ({ ...g, brand_id: id })));
        })
      );
      setAtRiskGoals(allGoals.slice(0, 3));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
    </div>
  );

  const hasStrategies = Object.keys(strategies).length > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {greeting}, {user?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-white/35 text-sm mt-1 capitalize">
          {user?.role?.replace(/_/g, ' ')} · Cerebre Media Africa
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="My Brands"       value={myStats?.brands_count     ?? myBrands.length} icon={Building2}   color="purple" />
        <StatCard label="Open Tasks"      value={myStats?.open_tasks        ?? 0}              icon={Clock}       color="amber"  />
        <StatCard label="Done This Month" value={myStats?.tasks_done_month  ?? 0}              icon={CheckCircle2}color="green"  />
        <StatCard label="Work Logged"     value={myStats?.work_logs_month   ?? 0}              icon={PenLine}     color="blue"   />
      </div>

      {/* ── THE BIG PICTURE — Active Strategies ─────────────── */}
      {hasStrategies && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">The Big Picture</h2>
            <span className="text-xs text-white/25">— connect your work to these strategies</span>
          </div>

          <div className={`grid gap-4 ${myBrands.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {myBrands
              .filter((b: any) => strategies[b.id ?? b.brand_id])
              .map((b: any) => {
                const brandId = b.id ?? b.brand_id;
                const strategy = strategies[brandId];
                return (
                  <div key={brandId}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: `${b.primary_color || '#6d28d9'}30` }}>
                        {b.name?.[0] ?? 'B'}
                      </div>
                      <p className="text-xs font-medium text-white/50">{b.name}</p>
                    </div>
                    <Link href={`/brands/${brandId}/strategies`}>
                      <StrategyCard strategy={strategy} />
                    </Link>
                  </div>
                );
              })}
          </div>

          <p className="text-xs text-white/20 mt-3 text-center">
            Every task you log should connect to one of these strategies — this is what client reports are built from.
          </p>
        </section>
      )}

      {/* ── At-risk goals alert ──────────────────────────────── */}
      {atRiskGoals.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Goals Needing Attention</h2>
          </div>
          <div className="space-y-2">
            {atRiskGoals.map(g => {
              const pct = Math.round((g.current_value / Math.max(g.target_value, 1)) * 100);
              const brand = myBrands.find((b: any) => (b.id ?? b.brand_id) === g.brand_id);
              return (
                <Link key={g.id} href={`/brands/${g.brand_id}/goals`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/15 bg-amber-500/5 hover:bg-amber-500/8 transition-all group">
                  <TrendingUp className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{g.title}</p>
                    <p className="text-xs text-white/35">{brand?.name ?? ''} · {pct}% progress</p>
                  </div>
                  <div className="w-16 bg-white/8 rounded-full h-1.5 flex-shrink-0">
                    <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── My brands ────────────────────────────────────────── */}
      {myBrands.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">My Brands</h2>
            <Link href="/my-brands" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
              All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myBrands.slice(0, 4).map((b: any) => {
              const brandId = b.id ?? b.brand_id;
              const hasStrategy = !!strategies[brandId];
              return (
                <Link key={brandId} href={`/my-brands/${brandId}`}
                  className="sabi-card p-4 hover:border-purple-500/20 transition-all group block">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: `${b.primary_color || '#6d28d9'}28`, border:`1px solid ${b.primary_color || '#6d28d9'}40` }}>
                      {b.name?.[0] ?? 'B'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                        {b.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-white/35 capitalize">
                          {b.role_on_brand?.replace(/_/g, ' ')}
                        </p>
                        {b.role_on_brand === 'brand_admin' && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded font-bold">
                            ADMIN
                          </span>
                        )}
                        {hasStrategy && (
                          <span className="text-[10px] text-purple-400/50">· strategy active</span>
                        )}
                      </div>
                    </div>
                    {(b.open_tasks ?? 0) > 0 && (
                      <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        {b.open_tasks}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Quick actions ─────────────────────────────────────── */}
      <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3">
        <QuickLink href="/my-work"   icon={PenLine}  label="Log Work"       color="purple" />
        <QuickLink href="/my-brands" icon={Building2}label="My Brands"      color="blue"   />
      </div>
    </div>
  );
}
