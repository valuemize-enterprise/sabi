'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Trophy, Clock, Users, CheckCircle2,
  Upload, Brain, Loader2, Search, SlidersHorizontal,
  TrendingUp, PenLine, Star,
} from 'lucide-react';
import { workLogs, deliverables as delivsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge, StatCard } from '@/components/ui';

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  strategy:     { label: 'Strategy',       icon: '📊' },
  content_copy: { label: 'Copywriting',    icon: '✍️'  },
  design:       { label: 'Design',         icon: '🎨' },
  social_media: { label: 'Social Media',   icon: '📱' },
  analytics:    { label: 'Analytics',      icon: '📈' },
  video:        { label: 'Video',          icon: '🎬' },
  community:    { label: 'Community',      icon: '💬' },
  client_comms: { label: 'Communication',  icon: '📧' },
  ads:          { label: 'Paid Ads',       icon: '📣' },
  seo:          { label: 'SEO',            icon: '🔍' },
  other:        { label: 'Other',          icon: '📌' },
};

const FILE_TYPES: Record<string, { label: string; icon: string }> = {
  copy:     { label: 'Copy',     icon: '✍️'  },
  design:   { label: 'Design',   icon: '🎨' },
  video:    { label: 'Video',    icon: '🎬' },
  report:   { label: 'Report',   icon: '📊' },
  strategy: { label: 'Strategy', icon: '🧠' },
  photo:    { label: 'Photo',    icon: '📸' },
  other:    { label: 'Other',    icon: '📎' },
};

type Tab = 'work' | 'deliverables';

export default function BrandProofOfWorkPage() {
  const { id: brandId } = useParams<{ id: string }>();

  const [tab, setTab]           = useState<Tab>('work');
  const [logs, setLogs]         = useState<any[]>([]);
  const [delivs, setDelivs]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [period, setPeriod]     = useState<'all' | 'month' | 'week'>('month');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workLogs.list({ brand_id: brandId, limit: '200' }),
      delivsApi.list({ brand_id: brandId, limit: '100' }),
    ])
      .then(([wr, dr]: any) => {
        setLogs(wr.data ?? []);
        setDelivs(dr.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brandId]);

  // ── Filters ──────────────────────────────────────────────────
  const now = new Date();
  const filteredLogs = logs.filter(l => {
    if (search && !l.title?.toLowerCase().includes(search.toLowerCase()) &&
        !l.users?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && l.category !== catFilter) return false;
    if (period === 'week')  return (now.getTime() - new Date(l.created_at).getTime()) < 7 * 86400000;
    if (period === 'month') {
      const d = new Date(l.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const filteredDelivs = delivs.filter(d => {
    if (search && !d.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────
  const totalHours    = filteredLogs.reduce((s, l) => s + (l.hours ?? 0), 0);
  const teamMembers   = new Set(filteredLogs.map(l => l.users?.id).filter(Boolean)).size;
  const approvedFiles = delivs.filter(d => d.status === 'approved').length;
  const pendingFiles  = delivs.filter(d => d.status === 'pending').length;

  // ── Category breakdown ────────────────────────────────────────
  const catBreakdown = filteredLogs.reduce((acc: Record<string, number>, l) => {
    acc[l.category] = (acc[l.category] ?? 0) + 1;
    return acc;
  }, {});
  const topCats = Object.entries(catBreakdown)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  if (loading) return <LoadingPage label="Loading proof of work…" />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AgencyTopNav
        title="Proof of Work"
        subtitle="Everything the team has done for this brand"
        breadcrumb={[{ label: 'Brands', href: '/brands' }, { label: 'Brand', href: `/brands/${brandId}` }]}
      />

      <Link href={`/brands/${brandId}`}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Brand
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Proof of Work</h1>
          <p className="text-sm text-white/40 mt-0.5">
            The complete record of everything delivered for this brand
          </p>
        </div>
        <Link href="/my-work"
          className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/20 px-3 py-2 rounded-lg hover:bg-purple-500/5">
          <PenLine className="w-3.5 h-3.5" /> Log New Work
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Work Entries"    value={logs.length}         icon={CheckCircle2} color="purple" />
        <StatCard label="Hours Logged"    value={`${totalHours.toFixed(1)}h`} icon={Clock} color="blue" />
        <StatCard label="Team Members"    value={teamMembers}         icon={Users}        color="green"  />
        <StatCard label="Files Delivered" value={approvedFiles}       icon={Upload}       color="amber"  />
      </div>

      {/* Category breakdown */}
      {topCats.length > 0 && (
        <div className="sabi-card p-5 mb-6">
          <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-4">Work Breakdown</h2>
          <div className="space-y-2.5">
            {topCats.map(([cat, count]) => {
              const c = CATEGORIES[cat] ?? { label: cat, icon: '📌' };
              const pct = Math.round(((count as number) / filteredLogs.length) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-base w-6 flex-shrink-0">{c.icon}</span>
                  <span className="text-xs text-white/60 w-32 flex-shrink-0">{c.label}</span>
                  <div className="flex-1 bg-white/8 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-purple-500 transition-all"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-white/30 w-12 text-right flex-shrink-0">
                    {count as number} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 w-fit mb-5">
        <button onClick={() => setTab('work')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${tab === 'work' ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>
          <PenLine className="w-3.5 h-3.5" />
          Work Logs
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'work' ? 'bg-white/20' : 'bg-white/8'}`}>
            {logs.length}
          </span>
        </button>
        <button onClick={() => setTab('deliverables')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all ${tab === 'deliverables' ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>
          <Upload className="w-3.5 h-3.5" />
          Deliverables
          {pendingFiles > 0 && (
            <span className="text-xs bg-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-full">
              {pendingFiles} pending
            </span>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'deliverables' ? 'bg-white/20' : 'bg-white/8'}`}>
            {delivs.length}
          </span>
        </button>
      </div>

      {/* Filters (work tab) */}
      {tab === 'work' && (
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
            {(['week', 'month', 'all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all capitalize ${period === p ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>
                {p === 'all' ? 'All Time' : `This ${p.charAt(0).toUpperCase() + p.slice(1)}`}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input className="sabi-input pl-9 text-sm w-44" placeholder="Search…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="sabi-input w-44 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option  className="bg-black" value="">All types</option>
            {Object.entries(CATEGORIES).map(([v, c]) => (
              <option className="bg-black" key={v} value={v}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── WORK LOGS TAB ────────────────────────────────────── */}
      {tab === 'work' && (
        filteredLogs.length === 0 ? (
          <EmptyState icon={PenLine} title="No work logs for this period"
            description="Staff can log their work from the My Work page."
            action={{ label: 'Go to My Work', onClick: () => window.location.href = '/my-work' }} />
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((l, i) => {
              const cat = CATEGORIES[l.category] ?? { label: l.category, icon: '📌' };
              return (
                <div key={l.id ?? i} className="sabi-card p-4 hover:border-white/10 transition-all">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 flex-shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white leading-snug">{l.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-white/50 font-medium">{l.users?.full_name ?? '—'}</span>
                        <span className="text-xs text-white/25 capitalize">{l.users?.role?.replace(/_/g, ' ')}</span>
                        <Badge label={cat.label} color="purple" />
                        {l.goals?.title && (
                          <span className="text-xs text-green-400/70">→ {l.goals.title}</span>
                        )}
                        {(l.hours ?? 0) > 0 && (
                          <span className="text-xs text-white/25 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{l.hours}h
                          </span>
                        )}
                        <span className="text-xs text-white/20">
                          {new Date(l.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      {l.description && (
                        <p className="text-xs text-white/35 mt-1.5 leading-relaxed">{l.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── DELIVERABLES TAB ─────────────────────────────────── */}
      {tab === 'deliverables' && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input className="sabi-input pl-9 text-sm" placeholder="Search deliverables…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {filteredDelivs.length === 0 ? (
            <EmptyState icon={Upload} title="No deliverables uploaded"
              description="Staff can upload work files from the brand's Deliverables page." />
          ) : (
            filteredDelivs.map(d => {
              const ft = FILE_TYPES[d.file_type] ?? { label: d.file_type, icon: '📎' };
              const statusCfg: Record<string, { color: string; label: string }> = {
                pending:  { color: 'amber', label: 'Awaiting Approval' },
                approved: { color: 'green', label: 'Approved' },
                rejected: { color: 'red',   label: 'Rejected' },
              };
              const sc = statusCfg[d.status] ?? { color: 'gray', label: d.status };

              return (
                <div key={d.id} className="sabi-card p-4 hover:border-white/10 transition-all">
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5 flex-shrink-0">{ft.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="font-medium text-white">{d.title}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={ft.label} color="blue" />
                          <Badge label={sc.label} color={sc.color} />
                        </div>
                      </div>
                      {d.description && (
                        <p className="text-xs text-white/35 mt-1">{d.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-white/40">{d.users?.full_name ?? '—'}</span>
                        <span className="text-xs text-white/20">
                          {new Date(d.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {d.status === 'rejected' && d.rejection_reason && (
                          <span className="text-xs text-red-400">Reason: {d.rejection_reason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Link to full deliverables page */}
          {delivs.length > 0 && (
            <Link href={`/brands/${brandId}/deliverables`}
              className="flex items-center justify-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors py-3 border border-dashed border-purple-500/20 rounded-xl hover:border-purple-500/30">
              Manage all deliverables (approve / reject) →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}