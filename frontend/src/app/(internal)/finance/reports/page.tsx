'use client';

/**
 * /finance/reports/page.tsx — Finance Reports
 * Aging report · Revenue vs targets · Payment risk scores
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, Loader2, Target, ShieldAlert,
  ShieldCheck, Shield,
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';

// ── API ───────────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || '';
const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

async function apiFetch(path: string, init?: RequestInit) {
  const res  = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

const naira = (n: number) =>
  n >= 1_000_000_000 ? `₦${(n / 1_000_000_000).toFixed(1)}B`
  : n >= 1_000_000   ? `₦${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000       ? `₦${(n / 1_000).toFixed(0)}K`
  : `₦${Math.round(n).toLocaleString()}`;

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const capped = Math.min(pct, 100);
  return (
    <div className="w-full bg-white/8 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${capped}%` }} />
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────

function RiskBadge({ level, score }: { level: string; score: number | null }) {
  const cfg: Record<string, [string, any]> = {
    low:     ['bg-green-500/10 text-green-400 border-green-500/20',   <ShieldCheck  className="w-3 h-3" />],
    medium:  ['bg-amber-500/10 text-amber-400 border-amber-500/20',   <Shield       className="w-3 h-3" />],
    high:    ['bg-red-500/10 text-red-400 border-red-500/20',         <ShieldAlert  className="w-3 h-3" />],
    unknown: ['bg-white/5 text-white/30 border-white/10',             <Shield       className="w-3 h-3" />],
  };
  const [cls, icon] = cfg[level] || cfg.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {icon} {level}{score !== null ? ` · ${score}` : ''}
    </span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgingRow {
  brand_id: string; brand_name: string;
  current_outstanding: number; overdue_0_7: number; overdue_8_30: number;
  overdue_31_60: number; overdue_60_plus: number; total_outstanding: number;
  open_invoice_count: number;
}

interface AgingReport {
  brands: AgingRow[];
  totals: Omit<AgingRow, 'brand_id' | 'brand_name' | 'open_invoice_count'>;
  critical: { brand_name: string; amount: number }[];
  generated_at: string;
}

interface RevenueDashboard {
  year: number; quarter: number; month: number;
  targets: { annual: number; quarterly: number; monthly: number; monthly_retainer: number; quarterly_project: number; annual_retainer: number; annual_project: number; };
  ytd:  { total: number; retainer: number; project: number; pct_of_target: number };
  qtd:  { total: number; retainer: number; project: number; target: number; pct_of_target: number };
  mtd:  { total: number; retainer: number; project: number; target: number; pct_of_target: number; vs_last_month: number | null };
  forecast: { year_end_at_run_rate: number; pct_of_target: number; on_track: boolean };
}

interface RiskScore {
  brand_id: string; risk_level: string; risk_score: number | null;
  avg_days_to_pay: number; times_on_time: number; times_late: number;
  aria_summary: string; computed_at: string;
  brand?: { name: string };
  largest_delay: string | number
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FINANCE_ROLES = new Set(['super_admin', 'admin', 'md', 'accountant']);

export default function FinanceReportsPage() {
  const router   = useRouter();
  const { user } = useAgencyStore();

  const [tab,       setTab]       = useState<'aging' | 'revenue' | 'risk'>('aging');
  const [aging,     setAging]     = useState<AgingReport | null>(null);
  const [revenue,   setRevenue]   = useState<RevenueDashboard | null>(null);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);

  useEffect(() => {
    if (user && !FINANCE_ROLES.has(user.role)) router.replace('/dashboard');
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [agingRes, revRes, riskRes] = await Promise.all([
        apiFetch('/api/finance/reports/aging'),
        apiFetch('/api/finance/reports/revenue'),
        apiFetch('/api/finance/risk'),
      ]);
      setAging(agingRes.report);
      setRevenue(revRes.dashboard);
      setRiskScores(riskRes.scores || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const triggerRisk = async (brandId: string) => {
    setScoringId(brandId);
    try {
      const res = await apiFetch(`/api/finance/risk/${brandId}/score`, { method: 'POST' });
      setRiskScores(p => p.map(r => r.brand_id === brandId ? { ...r, ...res.result } : r));
    } catch (e: any) { setError(e.message); }
    finally { setScoringId(null); }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Finance
        </button>
        <span className="text-white/10">/</span>
        <h1 className="text-xl font-bold text-white">Reports</h1>
        <button onClick={load} disabled={loading} className="ml-auto text-white/30 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400/50 text-lg">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/10">
        {(['aging', 'revenue', 'risk'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'text-purple-400 border-purple-500' : 'text-white/30 border-transparent hover:text-white/60'}`}>
            {t === 'aging' ? 'Aging report' : t === 'revenue' ? 'Revenue vs target' : 'Payment risk'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      ) : (

        <>
          {/* ── AGING REPORT ── */}
          {tab === 'aging' && aging && (
            <div>
              {/* Critical alert */}
              {aging.critical.length > 0 && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-300">60+ day overdue — immediate action required</p>
                    <p className="text-xs text-red-400/70 mt-0.5">
                      {aging.critical.map(c => `${c.brand_name} (${naira(c.amount)})`).join(' · ')}
                    </p>
                  </div>
                </div>
              )}

              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                {[
                  { label: 'Current',   value: aging.totals.current_outstanding, color: 'text-green-400'  },
                  { label: '0–7 days',  value: aging.totals.overdue_0_7,         color: 'text-amber-400'  },
                  { label: '8–30 days', value: aging.totals.overdue_8_30,        color: 'text-orange-400' },
                  { label: '31–60 days',value: aging.totals.overdue_31_60,       color: 'text-red-400'    },
                  { label: '60+ days',  value: aging.totals.overdue_60_plus,     color: 'text-red-600'    },
                ].map(s => (
                  <div key={s.label} className="sabi-card p-3 text-center">
                    <p className={`text-base font-black ${s.color}`}>{naira(s.value)}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Aging table */}
              <div className="sabi-card overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Outstanding by brand</p>
                  <p className="text-xs text-white/30">
                    Generated {new Date(aging.generated_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Brand', 'Current', '0–7d', '8–30d', '31–60d', '60d+', 'Total'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {aging.brands.filter(b => b.total_outstanding > 0).map(row => (
                        <tr key={row.brand_id} className="border-b border-white/5 hover:bg-white/2">
                          <td className="px-4 py-3 font-medium text-white">{row.brand_name}</td>
                          <td className="px-4 py-3 text-green-400/80">{naira(Number(row.current_outstanding))}</td>
                          <td className="px-4 py-3 text-amber-400/80">{naira(Number(row.overdue_0_7))}</td>
                          <td className="px-4 py-3 text-orange-400/80">{naira(Number(row.overdue_8_30))}</td>
                          <td className="px-4 py-3 text-red-400/80">{naira(Number(row.overdue_31_60))}</td>
                          <td className="px-4 py-3 text-red-500 font-semibold">{naira(Number(row.overdue_60_plus))}</td>
                          <td className="px-4 py-3 font-bold text-white">{naira(Number(row.total_outstanding))}</td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-white/3 border-t border-white/10">
                        <td className="px-4 py-3 font-bold text-white/60 text-xs uppercase tracking-wider">Total</td>
                        <td className="px-4 py-3 font-bold text-white">{naira(aging.totals.current_outstanding)}</td>
                        <td className="px-4 py-3 font-bold text-white">{naira(aging.totals.overdue_0_7)}</td>
                        <td className="px-4 py-3 font-bold text-white">{naira(aging.totals.overdue_8_30)}</td>
                        <td className="px-4 py-3 font-bold text-white">{naira(aging.totals.overdue_31_60)}</td>
                        <td className="px-4 py-3 font-bold text-red-400">{naira(aging.totals.overdue_60_plus)}</td>
                        <td className="px-4 py-3 font-bold text-purple-400">{naira(aging.totals.total_outstanding)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── REVENUE VS TARGET ── */}
          {tab === 'revenue' && revenue && (
            <div className="space-y-5">

              {/* Forecast banner */}
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${revenue.forecast.on_track ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                {revenue.forecast.on_track
                  ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                <div>
                  <p className={`text-sm font-semibold ${revenue.forecast.on_track ? 'text-green-300' : 'text-amber-300'}`}>
                    {revenue.forecast.on_track ? 'On track for annual target' : 'Below run-rate for annual target'}
                  </p>
                  <p className={`text-xs mt-0.5 ${revenue.forecast.on_track ? 'text-green-400/70' : 'text-amber-400/70'}`}>
                    At current pace, year-end projection is <strong>{naira(revenue.forecast.year_end_at_run_rate)}</strong> ({revenue.forecast.pct_of_target}% of ₦5B target)
                  </p>
                </div>
              </div>

              {/* Period cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* MTD */}
                <div className="sabi-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-white/30">Month to date</p>
                      <p className="text-[10px] text-white/20">{MONTHS[revenue.month - 1]} {revenue.year}</p>
                    </div>
                    <p className="text-2xl font-black text-white">{revenue.mtd.pct_of_target}%</p>
                  </div>
                  <ProgressBar pct={revenue.mtd.pct_of_target} color={revenue.mtd.pct_of_target >= 80 ? 'bg-green-500' : revenue.mtd.pct_of_target >= 50 ? 'bg-purple-500' : 'bg-amber-500'} />
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-white/40"><span>Received</span><span className="text-white font-semibold">{naira(revenue.mtd.total)}</span></div>
                    <div className="flex justify-between text-xs text-white/40"><span>Target</span><span>{naira(revenue.mtd.target)}</span></div>
                    {revenue.mtd.vs_last_month !== null && (
                      <div className="flex justify-between text-xs text-white/40">
                        <span>vs last month</span>
                        <span className={revenue.mtd.vs_last_month >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {revenue.mtd.vs_last_month >= 0 ? '+' : ''}{revenue.mtd.vs_last_month}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* QTD */}
                <div className="sabi-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-white/30">Quarter to date</p>
                      <p className="text-[10px] text-white/20">Q{revenue.quarter} {revenue.year}</p>
                    </div>
                    <p className="text-2xl font-black text-white">{revenue.qtd.pct_of_target}%</p>
                  </div>
                  <ProgressBar pct={revenue.qtd.pct_of_target} color={revenue.qtd.pct_of_target >= 80 ? 'bg-green-500' : revenue.qtd.pct_of_target >= 50 ? 'bg-purple-500' : 'bg-amber-500'} />
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-white/40"><span>Received</span><span className="text-white font-semibold">{naira(revenue.qtd.total)}</span></div>
                    <div className="flex justify-between text-xs text-white/40"><span>Target</span><span>{naira(revenue.qtd.target)}</span></div>
                    <div className="flex justify-between text-xs text-white/40"><span>Retainer</span><span className="text-purple-400">{naira(revenue.qtd.retainer)}</span></div>
                    <div className="flex justify-between text-xs text-white/40"><span>Project</span><span className="text-blue-400">{naira(revenue.qtd.project)}</span></div>
                  </div>
                </div>

                {/* YTD */}
                <div className="sabi-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-white/30">Year to date</p>
                      <p className="text-[10px] text-white/20">{revenue.year}</p>
                    </div>
                    <p className="text-2xl font-black text-white">{revenue.ytd.pct_of_target}%</p>
                  </div>
                  <ProgressBar pct={revenue.ytd.pct_of_target} color={revenue.ytd.pct_of_target >= 80 ? 'bg-green-500' : revenue.ytd.pct_of_target >= 50 ? 'bg-purple-500' : 'bg-amber-500'} />
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-white/40"><span>Received</span><span className="text-white font-semibold">{naira(revenue.ytd.total)}</span></div>
                    <div className="flex justify-between text-xs text-white/40"><span>Annual target</span><span>{naira(revenue.targets.annual)}</span></div>
                    <div className="flex justify-between text-xs text-white/40"><span>Remaining</span><span className="text-amber-400">{naira(revenue.targets.annual - revenue.ytd.total)}</span></div>
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="sabi-card p-5">
                <p className="text-sm font-semibold text-white mb-4">Revenue breakdown — YTD {revenue.year}</p>
                <div className="space-y-4">
                  {[
                    { label: 'Retainer revenue', actual: revenue.ytd.retainer, target: revenue.targets.annual_retainer || 0, color: 'bg-purple-500' },
                    { label: 'Project revenue',  actual: revenue.ytd.project,  target: revenue.targets.annual_project  || 0, color: 'bg-blue-500'   },
                  ].map(row => {
                    const pct = row.target > 0 ? Math.min(Math.round((row.actual / row.target) * 100), 100) : 0;
                    return (
                      <div key={row.label}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-white/60">{row.label}</span>
                          <span className="text-white font-semibold">{naira(row.actual)} <span className="text-white/30">of {naira(row.target)}</span></span>
                        </div>
                        <ProgressBar pct={pct} color={row.color} />
                        <p className="text-[10px] text-white/20 mt-1">{pct}% of target</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENT RISK ── */}
          {tab === 'risk' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-white/40">ARIA analyses payment history to assign risk levels. Re-score anytime.</p>
              </div>

              {riskScores.length === 0 ? (
                <div className="text-center py-16">
                  <Shield className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/30">No risk scores computed yet</p>
                  <p className="text-xs text-white/20 mt-1">Click score on any brand below, or use score-all from the API</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {riskScores.map(score => (
                    <div key={score.brand_id} className="sabi-card p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-white text-sm">{score.brand?.name}</p>
                            <RiskBadge level={score.risk_level} score={score.risk_score} />
                          </div>
                          <p className="text-xs text-white/40 leading-relaxed">{score.aria_summary}</p>
                        </div>
                        <button onClick={() => triggerRisk(score.brand_id)} disabled={scoringId === score.brand_id}
                          className="flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300 border border-purple-500/20 rounded-lg px-2.5 py-1.5 flex-shrink-0 disabled:opacity-50">
                          {scoringId === score.brand_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Re-score
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: 'On time',    value: score.times_on_time, color: 'text-green-400' },
                          { label: 'Late',       value: score.times_late,    color: score.times_late > 0 ? 'text-red-400' : 'text-white/40' },
                          { label: 'Avg delay',  value: `${score.avg_days_to_pay || 0}d`, color: 'text-white/60' },
                          { label: 'Worst',      value: `${score.largest_delay || 0}d`,   color: 'text-white/60' },
                        ].map(s => (
                          <div key={s.label} className="sabi-card p-2 bg-white/3">
                            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-[10px] text-white/20 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/20 mt-2">Last scored {new Date(score.computed_at).toLocaleDateString('en-NG')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
