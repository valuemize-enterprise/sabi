'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, AlertCircle, Loader2,
  DollarSign, PieChart, ArrowRight
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    headers:{ Authorization:`Bearer ${tok()}` }
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const fmt = (n: number) => `₦${Number(n||0).toLocaleString('en-NG')}`;

export default function FinanceOverviewPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api('/api/agency/finance/overview')
      .then((r: any) => setData(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPage label="Loading agency financials…"/>;
  if (error) return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="sabi-card p-10 text-center">
        <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto mb-3"/>
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    </div>
  );

  const maxBrandRevenue = Math.max(...(data.revenueByBrand ?? []).map((b:any) => b.revenue), 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Finance Overview" subtitle={data.month}/>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="sabi-card p-5">
          <p className="text-xs text-white/30 mb-1">Expected This Month</p>
          <p className="text-2xl font-black text-white">{fmt(data.expected)}</p>
        </div>
        <div className="sabi-card p-5">
          <p className="text-xs text-white/30 mb-1">Collected So Far</p>
          <p className="text-2xl font-black text-green-400">{fmt(data.collected)}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-white/8 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-green-500" style={{ width:`${Math.min(data.collectionRate,100)}%` }}/>
            </div>
            <span className="text-xs text-white/40">{data.collectionRate}%</span>
          </div>
        </div>
      </div>

      {/* Retainer vs Project split */}
      <div className="sabi-card p-5 mb-6">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Revenue Split — Collected This Month</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <PieChart className="w-5 h-5 text-blue-400"/>
            </div>
            <div>
              <p className="text-xs text-white/30">Retainer</p>
              <p className="text-lg font-bold text-white">{fmt(data.retainerRevenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-purple-400"/>
            </div>
            <div>
              <p className="text-xs text-white/30">New Projects</p>
              <p className="text-lg font-bold text-white">{fmt(data.projectRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue */}
      {data.overdueCount > 0 && (
        <div className="sabi-card p-5 mb-6 border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-red-400"/>
            <h2 className="text-sm font-semibold text-white">Overdue Invoices — {data.overdueCount} totalling {fmt(data.overdueTotal)}</h2>
          </div>
          <div className="space-y-2">
            {data.overdueInvoices.slice(0,10).map((inv:any) => (
              <Link key={inv.id} href={`/brands/${inv.brand_id}/financials`}
                className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15 hover:bg-red-500/8 transition-all group">
                <div>
                  <p className="text-sm text-white font-medium">{inv.brands?.name ?? 'Brand'}</p>
                  <p className="text-xs text-white/35">{inv.invoice_type} · due {inv.due_date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-red-400">{fmt(inv.amount)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-red-400 transition-colors"/>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by brand */}
      <div className="sabi-card p-5">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Revenue by Brand — This Month</h2>
        <div className="space-y-3">
          {(data.revenueByBrand ?? []).filter((b:any) => b.revenue > 0).map((b:any) => (
            <Link key={b.brand_id} href={`/brands/${b.brand_id}/financials`} className="block group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{b.brand_name}</span>
                <span className="text-sm font-medium text-white">{fmt(b.revenue)}</span>
              </div>
              <div className="w-full bg-white/6 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-purple-500" style={{ width:`${(b.revenue/maxBrandRevenue)*100}%` }}/>
              </div>
            </Link>
          ))}
          {(data.revenueByBrand ?? []).filter((b:any) => b.revenue > 0).length === 0 && (
            <p className="text-sm text-white/25 text-center py-6">No revenue collected yet this month.</p>
          )}
        </div>
      </div>
    </div>
  );
}
