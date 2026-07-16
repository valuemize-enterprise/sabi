'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain, FileText, Target, Swords, Users2, Trophy,
  Calendar, TrendingUp, TrendingDown, Bell, ChevronRight,
  Loader2, RefreshCw, Star, Smartphone, Lightbulb, HelpCircle, X
} from 'lucide-react';
import { clientPortal } from '@/lib/api';
import { useClientStore } from '@/lib/store';

// ── Sub-components ────────────────────────────────────────────
function ClarityDonut({ score }: { score: number }) {
  const pct  = Math.min(100, Math.round((score / 1000) * 100));
  const r    = 44;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const grade = score >= 850 ? ['S','#FCD34D'] : score >= 700 ? ['A','#34D399'] : score >= 550 ? ['B','#60A5FA'] : score >= 400 ? ['C','#FBBF24'] : ['D','#F87171'];

  return (
    <div className="relative w-28 h-28">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={grade[1]} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white leading-none">{grade[0]}</span>
        <span className="text-xs text-white/40 mt-0.5">{pct}%</span>
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, color = 'purple' }: { href: string; icon: any; label: string; color?: string }) {
  const c: Record<string, string> = {
    purple:'from-purple-600/20 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40',
    green: 'from-green-600/20 to-green-600/5 border-green-500/20 hover:border-green-500/40',
    blue:  'from-blue-600/20 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40',
    amber: 'from-amber-600/20 to-amber-600/5 border-amber-500/20 hover:border-amber-500/40',
    teal:  'from-teal-600/20 to-teal-600/5 border-teal-500/20 hover:border-teal-500/40',
    red:   'from-red-600/20 to-red-600/5 border-red-500/20 hover:border-red-500/40',
  };
  const ic: Record<string, string> = {
    purple:'text-purple-400 bg-purple-500/15', green:'text-green-400 bg-green-500/15',
    blue:'text-blue-400 bg-blue-500/15', amber:'text-amber-400 bg-amber-500/15',
    teal:'text-teal-400 bg-teal-500/15', red:'text-red-400 bg-red-500/15',
  };
  return (
    <Link href={href}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-b border transition-all group ${c[color]}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ic[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors text-center">{label}</span>
    </Link>
  );
}

export default function ClientDashboardPage() {
  const { client } = useClientStore();
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSatisfactionPrompt, setShowSatisfactionPrompt] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState(0);
  const [satisfactionComment, setSatisfactionComment] = useState('');
  const [submittingSatisfaction, setSubmittingSatisfaction] = useState(false);

  const load = async () => {
    try {
      const res: any = await clientPortal.dashboard();
      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const tok = typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/client/satisfaction/prompt-status`, {
      headers: { Authorization: `Bearer ${tok}` },
    }).then(r => r.json()).then((r: any) => {
      setShowSatisfactionPrompt(!r.data?.submittedThisWeek);
    }).catch(() => {});
  }, []);

  const refresh = () => { setRefreshing(true); load(); };

  const submitSatisfaction = async () => {
    if (!satisfactionScore) return;
    setSubmittingSatisfaction(true);
    try {
      const tok = typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/client/satisfaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ nps_score: satisfactionScore, comment: satisfactionComment || null }),
      }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || b.message); });
      setShowSatisfactionPrompt(false);
    } catch (err) { console.error(err); }
    finally { setSubmittingSatisfaction(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#0d0d1a]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        <p className="text-white/30 text-sm">Loading your dashboard…</p>
      </div>
    </div>
  );

  const brand        = data?.brand || {};
  const score        = brand.clarity_score ?? 0;
  const activeGoals  = (data?.activeGoals ?? []) as any[];
  const recentReports= (data?.recentReports ?? []) as any[];
  const hour         = new Date().getHours();
  const greeting     = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Calculate goal health
  const atRisk = activeGoals.filter((g: any) => {
    const pct = (g.current_value / Math.max(g.target_value, 1)) * 100;
    return pct < 40;
  }).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Greeting header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <p className="text-white/30 text-sm">{greeting},</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            {client?.full_name?.split(' ')[0] ?? 'Welcome'} 👋
          </h1>
          <p className="text-white/40 text-sm mt-1">{client?.job_title} · {brand.name}</p>
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Weekly satisfaction prompt ────────────────────────── */}
      {showSatisfactionPrompt && (
        <div className="sabi-card p-5 mb-6 border-purple-500/25" style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.1) 0%, rgba(13,13,26,1) 70%)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">How was this week? 👋</p>
              <p className="text-xs text-white/40 mt-0.5">Your honest rating helps your Cerebre team stay accountable</p>
            </div>
            <button onClick={() => setShowSatisfactionPrompt(false)} className="text-white/20 hover:text-white transition-colors">
              <X className="w-4 h-4"/>
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setSatisfactionScore(n)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  satisfactionScore >= n ? 'bg-amber-500/25 text-amber-400' : 'bg-white/5 text-white/20'
                }`}>
                <Star className="w-5 h-5" fill={satisfactionScore >= n ? 'currentColor' : 'none'}/>
              </button>
            ))}
          </div>
          {satisfactionScore > 0 && (
            <>
              <input className="sabi-input text-sm mb-3" placeholder="Anything specific? (optional)"
                value={satisfactionComment} onChange={e => setSatisfactionComment(e.target.value)}/>
              <button onClick={submitSatisfaction} disabled={submittingSatisfaction}
                className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                {submittingSatisfaction ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Submit'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ClarityScore™ hero card */}
      <div className="sabi-card p-6 mb-5"
        style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.15) 0%, rgba(13,13,26,1) 60%)' }}>
        <div className="flex items-center gap-6">
          <ClarityDonut score={score} />
          <div className="flex-1">
            <p className="text-xs text-purple-400/70 font-semibold uppercase tracking-widest mb-1">ClarityScore™</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-black text-white">{score}</span>
              <span className="text-lg text-white/30">/ 1000</span>
            </div>
            <p className="text-sm text-white/40">
              {score >= 850 ? 'Exceptional — your brand is firing on all cylinders.' :
               score >= 700 ? 'Strong — minor optimisations will push you to the top tier.' :
               score >= 550 ? 'Growing — consistent execution will drive your score up.' :
               score >= 400 ? 'Building — your team is working to improve your brand health.' :
                              'Early stage — strong foundations being laid for your brand.'}
            </p>
            {brand.clarity_score_updated_at && (
              <p className="text-xs text-white/20 mt-2">
                Last updated: {new Date(brand.clarity_score_updated_at).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' })}
              </p>
            )}
          </div>

          {/* Score breakdown if available */}
          {brand.clarity_score_breakdown && (
            <div className="hidden md:block w-48 space-y-1.5">
              {Object.entries(brand.clarity_score_breakdown as Record<string, number>).slice(0, 5).map(([k, v]) => (
                <div key={k}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] text-white/30 capitalize">{k.replace(/_/g,' ')}</p>
                    <p className="text-[10px] text-white/50 font-mono">{Math.round(v * 100)}%</p>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className="h-1 rounded-full bg-purple-500" style={{ width: `${v * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* At-risk alert */}
      {atRisk > 0 && (
        <Link href="/client/goals"
          className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20 hover:border-red-500/35 transition-all group">
          <TrendingDown className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{atRisk} goal{atRisk > 1 ? 's are' : ' is'} at risk</p>
            <p className="text-xs text-white/40">Below 40% progress — your team is aware and working on it.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-red-400 transition-colors" />
        </Link>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Active Goals */}
        <div className="sabi-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">Active Goals</h2>
            </div>
            <Link href="/client/goals" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">View all →</Link>
          </div>
          {activeGoals.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-6">No active goals set</p>
          ) : (
            <div className="space-y-3">
              {activeGoals.slice(0, 4).map((g: any) => {
                const pct = Math.min(100, Math.round((g.current_value / Math.max(g.target_value, 1)) * 100));
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-white truncate flex-1 mr-3">{g.title}</p>
                      <span className={`text-xs font-bold flex-shrink-0 ${pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-purple-400' : 'text-amber-400'}`}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full bg-white/8 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-purple-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-white/25 mt-0.5">{g.current_value} / {g.target_value} {g.unit}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Reports */}
        <div className="sabi-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-white">Recent Reports</h2>
            </div>
            <Link href="/client/reports" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
          </div>
          {recentReports.length === 0 ? (
            <p className="text-white/20 text-sm text-center py-6">No reports published yet</p>
          ) : (
            <div className="space-y-2">
              {recentReports.slice(0, 4).map((r: any) => (
                <Link key={r.id} href={`/client/reports/${r.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/4 transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate group-hover:text-blue-300 transition-colors">{r.title}</p>
                    {r.published_at && (
                      <p className="text-xs text-white/30">{new Date(r.published_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  {r.clarity_score && (
                    <span className="text-xs font-bold text-purple-400 flex-shrink-0">{r.clarity_score}</span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick navigation grid */}
      <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">Quick Access</h2>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 mb-5">
        <QuickLink href="/client/ask"          icon={Brain}     label="Ask ARIA"       color="purple" />
        <QuickLink href="/client/reports"      icon={FileText}  label="Reports"        color="blue"   />
        <QuickLink href="/client/goals"        icon={Target}    label="Goals"          color="green"  />
        <QuickLink href="/client/competitors"  icon={Swords}    label="Competitors"    color="red"    />
        <QuickLink href="/client/strategies"   icon={Lightbulb} label="Strategies"     color="amber"  />
        <QuickLink href="/client/moments"      icon={Calendar}  label="MomentMap™"    color="teal"   />
        <QuickLink href="/client/value"        icon={Trophy}    label="Proof of Value" color="amber"  />
        <QuickLink href="/client/platforms"    icon={Smartphone}label="Platforms"      color="blue"   />
      </div>

      {/* Bottom row: Team + Satisfaction CTA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your team */}
        <Link href="/client/team"
          className="sabi-card p-5 hover:border-purple-500/20 transition-all group flex items-center gap-4">
          <div className="flex -space-x-2">
            {['K','A','T','C'].map((l, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-purple-500/30 border-2 border-[#12122a] flex items-center justify-center text-xs font-bold text-purple-300">
                {l}
              </div>
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">Your Cerebre Team</p>
            <p className="text-xs text-white/40">4 specialists working on your brand</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors" />
        </Link>

        {/* Satisfaction / Feedback */}
        <Link href="/client/satisfaction"
          className="sabi-card p-5 hover:border-amber-500/20 transition-all group flex items-center gap-4">
          <div className="flex items-center gap-0.5">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-5 h-5 ${n <= 4 ? 'text-amber-400 fill-amber-400' : 'text-white/10'}`} />
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors">Share Your Feedback</p>
            <p className="text-xs text-white/40">Help us improve your experience</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 transition-colors" />
        </Link>
      </div>

      {/* Help footer */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/5">
        <p className="text-xs text-white/20">
          Powered by <span className="text-purple-400">Cerebre Media Africa</span> · Sabi Intelligence Suite
        </p>
        <Link href="/client/help" className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors">
          <HelpCircle className="w-3.5 h-3.5" /> Help & Support
        </Link>
      </div>
    </div>
  );
}
