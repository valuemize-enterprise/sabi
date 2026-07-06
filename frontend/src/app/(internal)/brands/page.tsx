'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Building2, TrendingUp, Users, ChevronRight, Filter } from 'lucide-react';
import { brands as brandsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { PageHeader, EmptyState, LoadingPage, Badge } from '@/components/ui';

const STATUS_COLORS: Record<string, string> = {
  active:   'green',
  inactive: 'gray',
  suspended:'red',
};

const SCORE_GRADE = (s: number) => s >= 850 ? ['S', 'text-yellow-400'] : s >= 700 ? ['A', 'text-green-400'] : s >= 550 ? ['B', 'text-blue-400'] : s >= 400 ? ['C', 'text-amber-400'] : ['D', 'text-red-400'];

export default function ClientsPage() {
  const [items, setItems]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [total, setTotal]     = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const p: Record<string,string> = { limit: '50' };
      if (search) p.search = search;
      if (status) p.status = status;
      const res: any = await brandsApi.list(p);
      setItems(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, status]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AgencyTopNav title="Clients" subtitle="All brand accounts" />
      <PageHeader
        title="Clients"
        subtitle={`${total} brand${total !== 1 ? 's' : ''} under management`}
        action={
          <Link href="/brands/new" className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4" /> New Brand
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="sabi-input pl-9 text-sm" placeholder="Search brands…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="sabi-input w-36 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option className='bg-black' value="">All status</option>
          <option className='bg-black' value="active">Active</option>
          <option className='bg-black' value="inactive">Inactive</option>
          <option className='bg-black' value="suspended">Suspended</option>
        </select>
      </div>

      {loading ? <LoadingPage label="Loading brands…" /> : items.length === 0 ? (
        <EmptyState icon={Building2} title="No brands yet" description="Add your first client brand to get started." action={{ label: 'Add Brand', onClick: () => {} }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(brand => {
            const [grade, gradeColor] = SCORE_GRADE(brand.clarity_score ?? 0);
            return (
              <Link key={brand.id} href={`/brands/${brand.id}`}
                className="sabi-card p-5 hover:border-purple-500/30 hover:bg-purple-500/3 transition-all group cursor-pointer block">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: (brand.primary_color || '#6d28d9') + '33', border: `1px solid ${brand.primary_color || '#6d28d9'}55` }}>
                      {brand.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm group-hover:text-purple-300 transition-colors">{brand.name}</p>
                      <p className="text-xs text-white/40">{brand.industry}</p>
                    </div>
                  </div>
                  <Badge label={brand.status} color={STATUS_COLORS[brand.status] ?? 'gray'} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/30 mb-1">ClarityScore™</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-white">{brand.clarity_score ?? 0}</span>
                      <span className={`text-base font-bold ${gradeColor}`}>{grade}</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 relative">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#8b5cf6" strokeWidth="4"
                        strokeDasharray={`${((brand.clarity_score ?? 0) / 1000) * 125.66} 125.66`}
                        strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-purple-400">
                      {Math.round(((brand.clarity_score ?? 0) / 1000) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <p className="text-xs text-white/30">
                    AM: {brand.users?.full_name ?? 'Unassigned'}
                  </p>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
