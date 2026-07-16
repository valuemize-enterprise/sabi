'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Loader2, X, Check, Info } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const COMPONENT_META: Record<string, { label: string; icon: string; desc: string }> = {
  satisfaction:    { label:'Client Satisfaction',  icon:'😊', desc:'Average client rating across your brands this week' },
  tasks:           { label:'Verified Tasks',       icon:'✅', desc:'Tasks completed and verified by your Brand Admin' },
  managerRating:   { label:'Manager Rating',       icon:'⭐', desc:'Weekly qualitative rating from your Brand Admin' },
  contributions:   { label:'Contributions',        icon:'🌟', desc:'Verified extra-mile contributions (up to 2/week)' },
  creativeBonus:   { label:'Creative of the Week', icon:'🏆', desc:'+5 bonus for being nominated Creative of the Week' },
  goalAchievement: { label:'Goal Achievement',     icon:'🎯', desc:'% of your brand\'s goals currently on track' },
  teamCompletion:  { label:'Team Task Completion', icon:'👥', desc:'How well your team is completing verified work' },
  revenue:         { label:'New Brief Revenue',    icon:'💰', desc:'Revenue from approved new projects this month' },
};

export default function MyScorePage() {
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [disputed, setDisputed] = useState(false);

  useEffect(() => {
    api('/api/agency/scores/mine')
      .then((r: any) => setData(r.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const submitDispute = async () => {
    if (!disputeNote.trim() || !data?.latestWeek?.id) return;
    setSubmitting(true);
    try {
      await api('/api/agency/scores/disputes', {
        method: 'POST',
        body: JSON.stringify({ weekly_score_id: data.latestWeek.id, note: disputeNote.trim() }),
      });
      setDisputed(true); setShowDispute(false); setDisputeNote('');
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingPage label="Loading your score…"/>;
  if (error) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="sabi-card p-10 text-center">
        <AlertCircle className="w-8 h-8 text-red-400/50 mx-auto mb-3"/>
        <p className="text-white/40 text-sm">{error}</p>
      </div>
    </div>
  );

  const latest = data?.latestWeek;
  const history = data?.history ?? [];
  const trend = history.length >= 2 ? history[0].total - history[1].total : 0;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="My Score" subtitle={data?.scoreType === 'brand_admin' ? 'Your weekly Brand Admin scorecard' : 'Your weekly performance score'}/>

      {!latest ? (
        <div className="sabi-card p-10 text-center">
          <Info className="w-8 h-8 text-white/15 mx-auto mb-3"/>
          <p className="text-white/40 text-sm">No score yet — scores begin after your first two full weeks on the platform.</p>
        </div>
      ) : (
        <>
          {/* Rolling average headline */}
          <div className="sabi-card p-6 mb-5 text-center" style={{ background:'linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(13,13,26,1) 70%)' }}>
            <p className="text-xs text-purple-400/70 uppercase tracking-widest font-semibold mb-2">4-Week Rolling Average</p>
            <p className="text-5xl font-black text-white mb-2">{data.rollingAverage ?? '—'}</p>
            <div className="flex items-center justify-center gap-1.5">
              {trend > 0 && <><TrendingUp className="w-4 h-4 text-green-400"/><span className="text-sm text-green-400">+{trend.toFixed(1)} from last week</span></>}
              {trend < 0 && <><TrendingDown className="w-4 h-4 text-red-400"/><span className="text-sm text-red-400">{trend.toFixed(1)} from last week</span></>}
              {trend === 0 && <><Minus className="w-4 h-4 text-white/30"/><span className="text-sm text-white/30">Steady</span></>}
            </div>
          </div>

          {/* This week's breakdown */}
          <div className="sabi-card p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Week of {latest.week_start}</h2>
              <span className="text-lg font-bold text-purple-400">{latest.total}/100</span>
            </div>

            <div className="space-y-3">
              {Object.entries(latest.components ?? {}).map(([key, comp]: [string, any]) => {
                if (!comp || key === 'reason') return null;
                if (key === 'creativeBonus' && !comp.isCreativeOfWeek) return null;
                const meta = COMPONENT_META[key];
                if (!meta) return null;
                const pct = comp.weight > 0 ? Math.round((comp.points / comp.weight) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/60 flex items-center gap-1.5">
                        <span>{meta.icon}</span>{meta.label}
                      </span>
                      <span className="text-xs text-white font-medium">{comp.points}/{comp.weight}</span>
                    </div>
                    <div className="w-full bg-white/8 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width:`${Math.min(pct,100)}%` }}/>
                    </div>
                    <p className="text-[10px] text-white/20 mt-1">{meta.desc}</p>
                    {key === 'managerRating' && comp.wasDefaulted && (
                      <p className="text-[10px] text-amber-400/60 mt-0.5">No rating submitted — defaulted to neutral</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispute */}
          {!disputed ? (
            <button onClick={() => setShowDispute(true)} className="text-xs text-white/25 hover:text-white/50 transition-colors">
              Something look wrong with this week's score? Flag it →
            </button>
          ) : (
            <p className="text-xs text-green-400/70 flex items-center gap-1.5"><Check className="w-3.5 h-3.5"/>Dispute submitted — a Super Admin will review it</p>
          )}

          {showDispute && (
            <div className="sabi-card p-5 mt-3 border-amber-500/20">
              <textarea className="sabi-input resize-none text-sm mb-3" rows={3}
                placeholder="Explain what looks incorrect about this week's score…"
                value={disputeNote} onChange={e => setDisputeNote(e.target.value)}/>
              <div className="flex gap-2">
                <button onClick={submitDispute} disabled={submitting || !disputeNote.trim()}
                  className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} Submit
                </button>
                <button onClick={() => setShowDispute(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 1 && (
            <div className="mt-8">
              <h2 className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-3">History</h2>
              <div className="space-y-2">
                {history.slice(1).map((h: any) => (
                  <div key={h.week_start} className="flex items-center justify-between p-3 bg-white/3 border border-white/6 rounded-xl">
                    <span className="text-xs text-white/40">{h.week_start}</span>
                    {h.excluded ? (
                      <span className="text-xs text-white/25 italic">Excluded ({h.components?.reason?.replace('_',' ')})</span>
                    ) : (
                      <span className="text-sm font-medium text-white">{h.total}/100</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
