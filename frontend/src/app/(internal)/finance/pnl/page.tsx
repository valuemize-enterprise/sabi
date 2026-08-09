'use client';
/**
 * /finance/pnl/page.tsx — P&L Report + VAT Report
 * Tabs: Monthly P&L | Annual Summary | Brand Breakdown | VAT Report
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
async function apiFetch(path: string) {
  const res  = await fetch(`${API}${path}`, { headers: { Authorization:`Bearer ${tok()}` }, cache:'no-store' });
  const body = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(body?.error||`Request failed (${res.status})`);
  return body;
}

const naira  = (n: number) => n>=1e9?`₦${(n/1e9).toFixed(1)}B`:n>=1e6?`₦${(n/1e6).toFixed(1)}M`:n>=1e3?`₦${(n/1e3).toFixed(0)}K`:`₦${Math.round(n).toLocaleString()}`;
const pct    = (n: number|null) => n===null?'—':`${n}%`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FINANCE_ROLES = new Set(['super_admin','admin','md','accountant']);

export default function PnLPage() {
  const router  = useRouter();
  const { user } = useAgencyStore();
  const [tab,    setTab]    = useState<'monthly'|'annual'|'brands'|'vat'>('monthly');
  const [year,   setYear]   = useState(new Date().getFullYear());
  const [quarter,setQuarter]= useState(Math.ceil((new Date().getMonth()+1)/3));
  const [data,   setData]   = useState<any>(null);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState<string|null>(null);

  useEffect(()=>{ if(user&&!FINANCE_ROLES.has(user.role)) router.replace('/dashboard'); },[user,router]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let res;
      if (tab==='monthly') res = await apiFetch(`/api/finance/reports/pnl?year=${year}`);
      else if (tab==='annual') res = await apiFetch('/api/finance/reports/pnl/annual');
      else if (tab==='brands') res = await apiFetch(`/api/finance/reports/pnl/brands?year=${year}`);
      else res = await apiFetch(`/api/finance/reports/vat?year=${year}&quarter=${quarter}`);
      setData(res.data);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab, year, quarter]);

  useEffect(()=>{ load(); },[load]);

  const years = [2024,2025,2026,2027];

  const marginColor = (m: number|null) =>
    m===null?'text-white/30':m>=30?'text-green-400':m>=10?'text-amber-400':'text-red-400';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={()=>router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white"><ArrowLeft className="w-3.5 h-3.5"/>Finance</button>
        <span className="text-white/10">/</span>
        <h1 className="text-xl font-bold text-white">Financial Reports</h1>
        <div className="ml-auto flex items-center gap-2">
          {(tab==='monthly'||tab==='brands'||tab==='vat') && (
            <select value={year} onChange={e=>setYear(Number(e.target.value))} className="sabi-input text-xs">
              {years.map(y=><option className="bg-black" key={y} value={y}>{y}</option>)}
            </select>
          )}
          {tab==='vat' && (
            <select value={quarter} onChange={e=>setQuarter(Number(e.target.value))} className="sabi-input text-xs">
              {[1,2,3,4].map(q=><option className="bg-black" key={q} value={q}>Q{q}</option>)}
            </select>
          )}
        </div>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5"><AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0"/><p className="text-sm text-red-300">{error}</p></div>}

      <div className="flex gap-1 mb-6 border-b border-white/10">
        {[{id:'monthly',label:'Monthly P&L'},{id:'annual',label:'Annual Summary'},{id:'brands',label:'By Brand'},{id:'vat',label:'VAT Report'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab===t.id?'text-purple-400 border-purple-500':'text-white/30 border-transparent hover:text-white/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-purple-400 animate-spin"/></div> : (
        <>
          {/* ── MONTHLY P&L ── */}
          {tab==='monthly' && data?.report && (
            <div>
              {/* Year totals */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {[
                  {label:'Total revenue', value:naira(data.report.totals.revenue_total), color:'text-white'},
                  {label:'Retainer',      value:naira(data.report.totals.revenue_retainer), color:'text-purple-400'},
                  {label:'Total expenses',value:naira(data.report.totals.expenses_total), color:'text-red-400'},
                  {label:'Gross profit',  value:naira(data.report.totals.gross_profit), color:data.report.totals.gross_profit>=0?'text-green-400':'text-red-400'},
                ].map(s=>(
                  <div key={s.label} className="sabi-card p-4">
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-white/30 mt-1">{s.label} {year}</p>
                  </div>
                ))}
              </div>

              {/* Monthly table */}
              <div className="sabi-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead><tr className="border-b border-white/5 bg-white/3">
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">Month</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">Revenue</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">Expenses</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">Gross Profit</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">Margin</th>
                    </tr></thead>
                    <tbody>
                      {data.report.months.map((m: any, i: number) => (
                        <tr key={m.month} className={`border-b border-white/5 ${i%2===1?'bg-white/1':''}`}>
                          <td className="px-4 py-2.5 text-white/60 font-medium">{m.month_label}</td>
                          <td className="px-4 py-2.5 text-right text-white font-semibold">{naira(m.revenue.total)}</td>
                          <td className="px-4 py-2.5 text-right text-red-400/70">{naira(m.expenses.total)}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${m.gross_profit>=0?'text-green-400':'text-red-400'}`}>{naira(m.gross_profit)}</td>
                          <td className={`px-4 py-2.5 text-right ${marginColor(m.margin_pct)}`}>{pct(m.margin_pct)}</td>
                        </tr>
                      ))}
                      <tr className="bg-white/5 border-t border-white/10">
                        <td className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wider">Total {year}</td>
                        <td className="px-4 py-3 text-right font-bold text-white">{naira(data.report.totals.revenue_total)}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-400">{naira(data.report.totals.expenses_total)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${data.report.totals.gross_profit>=0?'text-green-400':'text-red-400'}`}>{naira(data.report.totals.gross_profit)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${marginColor(data.report.totals.margin_pct)}`}>{pct(data.report.totals.margin_pct)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── ANNUAL SUMMARY ── */}
          {tab==='annual' && data?.summary && (
            <div className="sabi-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/5 bg-white/3">
                  {['Year','Revenue','Retainer','Project','Expenses','Gross Profit','Margin','Growth'].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.summary.years.map((yr: any) => (
                    <tr key={yr.year} className="border-b border-white/5 hover:bg-white/2">
                      <td className="px-4 py-3 font-bold text-white">{yr.year}</td>
                      <td className="px-4 py-3 font-semibold text-white">{naira(yr.total_revenue)}</td>
                      <td className="px-4 py-3 text-purple-400">{naira(yr.retainer)}</td>
                      <td className="px-4 py-3 text-blue-400">{naira(yr.project)}</td>
                      <td className="px-4 py-3 text-red-400/70">{naira(yr.total_expenses)}</td>
                      <td className={`px-4 py-3 font-semibold ${yr.gross_profit>=0?'text-green-400':'text-red-400'}`}>{naira(yr.gross_profit)}</td>
                      <td className={`px-4 py-3 ${marginColor(yr.margin_pct)}`}>{pct(yr.margin_pct)}</td>
                      <td className="px-4 py-3">
                        {yr.growth_pct===null?'—':
                          <span className={`flex items-center gap-1 text-sm ${yr.growth_pct>=0?'text-green-400':'text-red-400'}`}>
                            {yr.growth_pct>=0?<TrendingUp className="w-3.5 h-3.5"/>:<TrendingDown className="w-3.5 h-3.5"/>}
                            {yr.growth_pct>0?'+':''}{yr.growth_pct}%
                          </span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── BY BRAND ── */}
          {tab==='brands' && data?.brands && (
            <div className="sabi-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/5 bg-white/3">
                  {['Brand','Revenue','Expenses','Gross Profit','Margin'].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {data.brands.map((b: any, i: number) => (
                    <tr key={b.brand_id} className={`border-b border-white/5 hover:bg-white/2 ${i%2===1?'bg-white/1':''}`}>
                      <td className="px-4 py-3 font-medium text-white">{b.brand_name}</td>
                      <td className="px-4 py-3 font-semibold text-white">{naira(b.revenue)}</td>
                      <td className="px-4 py-3 text-red-400/70">{naira(b.expenses)}</td>
                      <td className={`px-4 py-3 font-semibold ${b.gross_profit>=0?'text-green-400':'text-red-400'}`}>{naira(b.gross_profit)}</td>
                      <td className={`px-4 py-3 ${marginColor(b.margin_pct)}`}>{pct(b.margin_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── VAT REPORT ── */}
          {tab==='vat' && data?.report && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {[
                  {label:'Net (excl. VAT)', value:naira(data.report.totals.net_amount), color:'text-white'},
                  {label:'VAT charged (7.5%)', value:naira(data.report.totals.vat_amount), color:'text-amber-400'},
                  {label:'Gross invoiced', value:naira(data.report.totals.gross_amount), color:'text-purple-400'},
                ].map(s=>(
                  <div key={s.label} className="sabi-card p-4">
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-white/30 mt-1">{s.label} · Q{data.report.quarter} {data.report.year}</p>
                  </div>
                ))}
              </div>
              <div className="sabi-card p-4 bg-amber-500/5 border-amber-500/20">
                <p className="text-xs font-semibold text-amber-400 mb-1">FIRS Filing Due</p>
                <p className="text-sm text-white/60">Q{data.report.quarter} {data.report.year} VAT return is due by <strong className="text-white">{data.report.due_date}</strong>. Output VAT to remit: <strong className="text-amber-400">{naira(data.report.totals.vat_amount)}</strong></p>
              </div>
              <div className="sabi-card overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5"><p className="text-sm font-semibold text-white">VAT-applicable invoices — Q{data.report.quarter} {data.report.year}</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/5 bg-white/3">
                      {['Invoice','Brand','Type','Date','Net','VAT Rate','VAT Amount','Gross'].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.report.invoices.map((inv: any) => (
                        <tr key={inv.invoice_number} className="border-b border-white/5 hover:bg-white/2">
                          <td className="px-4 py-2.5 font-mono text-xs text-purple-400">{inv.invoice_number}</td>
                          <td className="px-4 py-2.5 text-white">{inv.brand_name}</td>
                          <td className="px-4 py-2.5 text-white/40 capitalize text-xs">{inv.type}</td>
                          <td className="px-4 py-2.5 text-white/40 text-xs">{inv.issued_date}</td>
                          <td className="px-4 py-2.5 text-white/60">{naira(inv.net_amount)}</td>
                          <td className="px-4 py-2.5 text-white/40 text-xs">{(inv.vat_rate*100).toFixed(1)}%</td>
                          <td className="px-4 py-2.5 text-amber-400 font-semibold">{naira(inv.vat_amount)}</td>
                          <td className="px-4 py-2.5 text-white font-semibold">{naira(inv.gross_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
