'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign, Users, Trophy, MessageSquare, AlertTriangle, Target,
  TrendingUp, TrendingDown, Minus, Sparkles, Loader2, X, ArrowRight, Lock, Printer, Copy, Check
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const fmt = (n: number) => `₦${Number(n||0).toLocaleString('en-NG')}`;

const LIGHT_COLOR: Record<string,string> = {
  green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-white/20',
};

function TrafficDot({ status }: { status: string }) {
  return <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${LIGHT_COLOR[status] ?? 'bg-white/20'}`}/>;
}

function PanelHeader({ icon: Icon, title, status }: any) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-purple-400"/>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {status && <TrafficDot status={status}/>}
    </div>
  );
}

export default function PulsePage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [report, setReport]   = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api('/api/agency/pulse')
      .then((r: any) => setData(r.data))
      .catch(err => { if (err.message?.includes('403')) setForbidden(true); else setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  const generateReport = async () => {
    setGenerating(true);
    try {
      const res: any = await api('/api/agency/pulse/generate-report', { method: 'POST' });
      setReport(res.data?.summary);
    } catch (err: any) { alert(err.message); }
    finally { setGenerating(false); }
  };

  const formatReport = () => {
    if (!report) return '';
    let text = `WEEKLY PULSE — ${data.weekStart}\n${'═'.repeat(40)}\n\n`;
    text += `${report.headline}\n\n`;
    if (report.went_well?.length) {
      text += `✓ WENT WELL\n${report.went_well.map((p:string) => `  • ${p}`).join('\n')}\n\n`;
    }
    if (report.needs_attention?.length) {
      text += `⚠ NEEDS ATTENTION\n${report.needs_attention.map((p:string) => `  • ${p}`).join('\n')}\n\n`;
    }
    if (report.recommended_actions?.length) {
      text += `→ RECOMMENDED ACTIONS\n${report.recommended_actions.map((p:string) => `  • ${p}`).join('\n')}\n\n`;
    }
    if (report.closing_note) text += `${report.closing_note}\n`;
    return text;
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(formatReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Weekly Pulse ${data.weekStart}</title><style>
      body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.6}
      h1{font-size:18px;margin-bottom:4px} .date{color:#666;font-size:13px;margin-bottom:24px}
      h2{font-size:14px;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
      .green{color:#16a34a} .amber{color:#d97706} .blue{color:#2563eb}
      ul{padding-left:20px} li{margin-bottom:4px;font-size:13px}
      .headline{font-size:15px;font-weight:600;margin-bottom:16px}
      .closing{font-style:italic;color:#666;margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px}
    </style></head><body>
      <h1>Weekly Pulse</h1><p class="date">Week of ${data.weekStart}</p>
      <p class="headline">${report.headline}</p>`);
    if (report.went_well?.length) {
      w.document.write(`<h2 class="green">✓ Went Well</h2><ul>${report.went_well.map((p:string) => `<li>${p}</li>`).join('')}</ul>`);
    }
    if (report.needs_attention?.length) {
      w.document.write(`<h2 class="amber">⚠ Needs Attention</h2><ul>${report.needs_attention.map((p:string) => `<li>${p}</li>`).join('')}</ul>`);
    }
    if (report.recommended_actions?.length) {
      w.document.write(`<h2 class="blue">→ Recommended Actions</h2><ul>${report.recommended_actions.map((p:string) => `<li>${p}</li>`).join('')}</ul>`);
    }
    if (report.closing_note) w.document.write(`<p class="closing">${report.closing_note}</p>`);
    w.document.write('</body></html>');
    w.document.close();
    w.print();
  };

  if (forbidden) return (
    <div className="p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="Weekly Pulse"/>
      <div className="sabi-card p-10 text-center">
        <Lock className="w-8 h-8 text-white/15 mx-auto mb-3"/>
        <p className="text-white/40 text-sm">The Weekly Pulse is only visible to MD, CEO, and Super Admin.</p>
      </div>
    </div>
  );

  if (loading) return <LoadingPage label="Compiling the week's pulse…"/>;
  if (error) return <div className="p-6 max-w-2xl mx-auto"><div className="sabi-card p-8 text-center text-red-400 text-sm">{error}</div></div>;

  const { pnl, activeStaff, achievements, clientReview: clientReviewRaw, challenges, goalAlignment: goalAlignmentRaw } = data.panels;
  const clientReview = clientReviewRaw.brands ?? clientReviewRaw;
  const goalAlignment = goalAlignmentRaw.admins ?? goalAlignmentRaw;
  const targets = data.targets;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AgencyTopNav title="Weekly Pulse" subtitle={`Week of ${data.weekStart}`}/>

      <button onClick={generateReport} disabled={generating}
        className="sabi-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm mb-6 disabled:opacity-50">
        {generating ? <><Loader2 className="w-4 h-4 animate-spin"/>ARIA is compiling…</> : <><Sparkles className="w-4 h-4"/>Generate Weekly Report</>}
      </button>

      {report && (
        <div className="sabi-card p-6 mb-6 border-purple-500/25" style={{ background:'linear-gradient(135deg, rgba(109,40,217,0.1) 0%, rgba(13,13,26,1) 70%)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400"/>
              <h2 className="text-sm font-semibold text-white">ARIA's Executive Summary</h2>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={copyReport} className="text-white/20 hover:text-white transition-colors p-1" title="Copy to clipboard">
                {copied ? <Check className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4"/>}
              </button>
              <button onClick={printReport} className="text-white/20 hover:text-white transition-colors p-1" title="Print report">
                <Printer className="w-4 h-4"/>
              </button>
              <button onClick={() => setReport(null)} className="text-white/20 hover:text-white transition-colors p-1"><X className="w-4 h-4"/></button>
            </div>
          </div>
          <p className="text-base font-medium text-white mb-4">{report.headline}</p>
          {report.went_well?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-green-400 font-medium mb-2">✓ Went Well</p>
              {report.went_well.map((p:string,i:number) => <p key={i} className="text-sm text-white/60 mb-1">• {p}</p>)}
            </div>
          )}
          {report.needs_attention?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-amber-400 font-medium mb-2">⚠ Needs Attention</p>
              {report.needs_attention.map((p:string,i:number) => <p key={i} className="text-sm text-white/60 mb-1">• {p}</p>)}
            </div>
          )}
          {report.recommended_actions?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-blue-400 font-medium mb-2">→ Recommended Actions</p>
              {report.recommended_actions.map((p:string,i:number) => <p key={i} className="text-sm text-white/60 mb-1">• {p}</p>)}
            </div>
          )}
          {report.closing_note && <p className="text-sm text-white/45 italic mt-4 pt-4 border-t border-white/10">{report.closing_note}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* PANEL 1: P&L */}
        <div className="sabi-card p-5">
          <PanelHeader icon={DollarSign} title="P&L Snapshot" status={pnl.status}/>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><p className="text-xs text-white/30">Expected</p><p className="text-lg font-bold text-white">{fmt(pnl.expected)}</p></div>
            <div><p className="text-xs text-white/30">Collected</p><p className="text-lg font-bold text-green-400">{fmt(pnl.collected)}</p></div>
            <div><p className="text-xs text-white/30">Retainer</p><p className="text-sm text-white/60">{fmt(pnl.retainerCollected)}</p></div>
            <div><p className="text-xs text-white/30">Projects</p><p className="text-sm text-white/60">{fmt(pnl.projectCollected)}</p></div>
          </div>
          {pnl.overdueCount > 0 && (
            <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-2.5 mt-2">
              <p className="text-xs text-red-400">{pnl.overdueCount} overdue · {fmt(pnl.overdueTotal)}</p>
            </div>
          )}
          {targets && <p className="text-[10px] text-white/20 mt-2">Target: {fmt(targets.monthly_retainer_revenue_target)}/mo retainer</p>}
        </div>

        {/* PANEL 2: Active Staff */}
        <div className="sabi-card p-5">
          <PanelHeader icon={Users} title="Active Staff" status={activeStaff.status}/>
          <p className="text-2xl font-black text-white mb-1">{activeStaff.activeCount}<span className="text-sm text-white/30 font-normal"> / {activeStaff.totalStaff} logged activity</span></p>
          {activeStaff.zeroActivity.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-white/30 mb-1.5">No activity this week:</p>
              <div className="flex flex-wrap gap-1.5">
                {activeStaff.zeroActivity.map((s:any) => (
                  <span key={s.id} className="text-xs bg-white/5 border border-white/8 text-white/35 px-2 py-0.5 rounded-full">{s.full_name}</span>
                ))}
              </div>
            </div>
          )}
          {activeStaff.topContributors.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <p className="text-xs text-white/30 mb-1.5">Top hours logged:</p>
              {activeStaff.topContributors.slice(0,3).map((s:any) => (
                <div key={s.id} className="flex justify-between text-xs text-white/50 mb-0.5"><span>{s.full_name}</span><span>{s.hours}h</span></div>
              ))}
            </div>
          )}
        </div>

        {/* PANEL 3: Achievements */}
        <div className="sabi-card p-5">
          <PanelHeader icon={Trophy} title="Achievements"/>
          <div className="space-y-2">
            {[
              { label:'Tasks Verified', key:'tasksVerified' },
              { label:'Briefs Resolved', key:'briefsResolved' },
              { label:'Strategies Approved', key:'strategiesApproved' },
              { label:'Contributions Verified', key:'contributionsVerified' },
            ].map(({label,key}) => {
              const delta = achievements.deltas[key];
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{achievements.thisWeek[key]}</span>
                    <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-white/20'}`}>
                      {delta > 0 ? <TrendingUp className="w-3 h-3"/> : delta < 0 ? <TrendingDown className="w-3 h-3"/> : <Minus className="w-3 h-3"/>}
                      {delta !== 0 && Math.abs(delta)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL 4: Client Review */}
        <div className="sabi-card p-5">
          <PanelHeader icon={MessageSquare} title="Client Review" status={clientReviewRaw.status}/>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {clientReview.map((c:any) => (
              <Link key={c.brand_id} href={`/brands/${c.brand_id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/3 transition-all group">
                <span className="text-xs text-white/60 group-hover:text-white transition-colors">{c.brand_name}</span>
                <div className="flex items-center gap-2">
                  {c.satisfaction != null && (
                    <span className={`text-xs flex items-center gap-0.5 ${c.satisfactionTrend > 0 ? 'text-green-400' : c.satisfactionTrend < 0 ? 'text-red-400' : 'text-white/40'}`}>
                      {c.satisfaction.toFixed(1)}★
                    </span>
                  )}
                  {c.overdueTasks > 0 && <span className="text-xs text-red-400">{c.overdueTasks} overdue</span>}
                  {c.openBriefs > 0 && <span className="text-xs text-amber-400">{c.openBriefs} briefs</span>}
                  {c.daysSinceReport != null && <span className="text-[10px] text-white/25">{c.daysSinceReport}d since report</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* PANEL 5: Challenges */}
        <div className="sabi-card p-5 lg:col-span-2 border-amber-500/15">
          <PanelHeader icon={AlertTriangle} title={`Challenges — ${challenges.totalFlags} flagged`}/>
          <div className="grid grid-cols-2 gap-4">
            {challenges.goalsAtRisk.length > 0 && (
              <div>
                <p className="text-xs text-red-400 font-medium mb-1.5">Goals at Risk</p>
                {challenges.goalsAtRisk.map((g:any) => <p key={g.id} className="text-xs text-white/50 mb-1">→ {g.title} ({g.brands?.name})</p>)}
              </div>
            )}
            {challenges.unansweredBriefs.length > 0 && (
              <div>
                <p className="text-xs text-amber-400 font-medium mb-1.5">Unanswered Briefs (3+ days)</p>
                {challenges.unansweredBriefs.map((b:any) => <p key={b.id} className="text-xs text-white/50 mb-1">→ {b.title} ({b.brands?.name})</p>)}
              </div>
            )}
            {challenges.staleVerifications.length > 0 && (
              <div>
                <p className="text-xs text-purple-400 font-medium mb-1.5">Stale Verifications</p>
                {challenges.staleVerifications.map((t:any) => <p key={t.id} className="text-xs text-white/50 mb-1">→ {t.title} ({t.brands?.name})</p>)}
              </div>
            )}
            {challenges.satisfactionDrops.length > 0 && (
              <div>
                <p className="text-xs text-red-400 font-medium mb-1.5">Satisfaction Drops</p>
                {challenges.satisfactionDrops.map((c:any) => <p key={c.brand_id} className="text-xs text-white/50 mb-1">→ {c.brand_name} ({c.satisfactionTrend.toFixed(1)})</p>)}
              </div>
            )}
          </div>
          {challenges.totalFlags === 0 && <p className="text-sm text-green-400/70 text-center py-4">No flags this week — clean sheet 🎉</p>}
        </div>

        {/* PANEL 6: Goal Alignment */}
        <div className="sabi-card p-5 lg:col-span-2">
          <PanelHeader icon={Target} title="Brand Admin Goal Alignment" status={goalAlignmentRaw.status}/>
          <div className="space-y-2">
            {goalAlignment.map((g:any) => (
              <div key={`${g.staff_id}_${g.brand_id}`} className="flex items-center justify-between p-2.5 bg-white/3 rounded-xl">
                <div>
                  <p className="text-sm text-white">{g.staff_name}</p>
                  <p className="text-xs text-white/30">{g.brand_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-white/30">Goals On Track</p>
                    <p className="text-sm font-medium text-white">{g.onTrackPct ?? '—'}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/30">Score</p>
                    <p className="text-sm font-medium text-purple-400">{g.rollingScore ?? '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
