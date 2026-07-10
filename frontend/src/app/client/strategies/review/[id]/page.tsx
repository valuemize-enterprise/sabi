'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, X, MessageSquare, Loader2, Brain, Calendar, Target } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { LoadingPage } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

export default function ClientStrategyReviewPage() {
  const { id: strategyId } = useParams<{ id: string }>();
  const router = useRouter();
  const { client } = useClientStore();

  const [strategy, setStrategy] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [decision, setDecision] = useState<'approved'|'needs_revision'|null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    api(`/api/client/strategies/${strategyId}`)
      .then((r: any) => setStrategy(r.data?.strategy ?? r.data))
      .catch(() => setError('Strategy not found'))
      .finally(() => setLoading(false));
  }, [strategyId]);

  const submit = async () => {
    if (!decision) { setError('Please select Approve or Request Revision'); return; }
    if (decision === 'needs_revision' && !feedback.trim()) { setError('Please describe what needs to be revised'); return; }
    setSubmitting(true); setError('');
    try {
      await api(`/api/client/strategies/${strategyId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, feedback: feedback.trim() || null }),
      });
      setDone(true);
    } catch (err: any) { setError(err.message || 'Failed to submit review'); }
    finally { setSubmitting(false); }
  };

  const content = strategy?.content ?? {};

  if (loading) return <LoadingPage label="Loading strategy…"/>;
  if (error && !strategy) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="sabi-card p-10 text-center">
        <p className="text-white/40">{error}</p>
        <Link href="/client/strategies" className="text-purple-400 text-sm mt-3 block">← Back to Strategies</Link>
      </div>
    </div>
  );

  if (done) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="sabi-card p-12 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${decision==='approved'?'bg-green-500/20 border border-green-500/30':'bg-amber-500/20 border border-amber-500/30'}`}>
          {decision==='approved' ? <Check className="w-8 h-8 text-green-400"/> : <MessageSquare className="w-8 h-8 text-amber-400"/>}
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {decision === 'approved' ? 'Strategy Approved! 🎉' : 'Revision Request Sent'}
        </h2>
        <p className="text-white/50 text-sm mb-6">
          {decision === 'approved'
            ? 'Your Cerebre team has been notified. Work on this strategy will begin immediately.'
            : 'Your feedback has been sent to your Cerebre team. They\'ll update the strategy shortly.'}
        </p>
        <Link href="/client/strategies"
          className="sabi-btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm">
          Back to Strategies
        </Link>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/client/strategies" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Strategies
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-purple-400"/>
          <span className="text-xs text-purple-400 font-medium uppercase tracking-wider">Strategy for Review</span>
        </div>
        <h1 className="text-2xl font-bold text-white">{strategy?.title}</h1>
        {strategy?.sent_to_client_at && (
          <p className="text-sm text-white/35 mt-1">
            Sent {new Date(strategy.sent_to_client_at).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}
          </p>
        )}
      </div>

      {/* Strategy content */}
      <div className="space-y-5 mb-8">
        {content.executive_summary && (
          <div className="sabi-card p-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Overview</h3>
            <p className="text-sm text-white/70 leading-relaxed">{content.executive_summary}</p>
          </div>
        )}

        {content.objectives?.length > 0 && (
          <div className="sabi-card p-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">What We'll Achieve</h3>
            <ul className="space-y-2">
              {content.objectives.map((o:string,i:number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-white/65">
                  <Target className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5"/>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.channels?.length > 0 && (
          <div className="sabi-card p-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Channels & Approach</h3>
            <div className="space-y-3">
              {content.channels.map((c:any,i:number) => (
                <div key={i} className="flex items-start gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-sm flex-shrink-0">
                    {c.name === 'Instagram' ? '📸' : c.name === 'Facebook' ? '👍' : c.name === 'Twitter' || c.name?.includes('X') ? '🐦' : '📱'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-white/45 mt-0.5">{c.role}</p>
                    <p className="text-xs text-white/25 mt-0.5">{c.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {content.kpis?.length > 0 && (
          <div className="sabi-card p-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Success Metrics (KPIs)</h3>
            <div className="grid grid-cols-2 gap-3">
              {content.kpis.map((k:any,i:number) => (
                <div key={i} className="bg-white/3 rounded-xl p-3">
                  <p className="text-xs text-white/30">{k.metric}</p>
                  <p className="text-base font-bold text-white mt-0.5">{k.target}</p>
                  <p className="text-xs text-white/25">{k.timeframe}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {content.timeline?.length > 0 && (
          <div className="sabi-card p-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Timeline</h3>
            <div className="space-y-3">
              {content.timeline.map((t:any,i:number) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-purple-500/25 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">{i+1}</div>
                    {i < content.timeline.length-1 && <div className="w-0.5 bg-white/8 flex-1 my-1"/>}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-semibold text-white">{t.phase}</p>
                    <p className="text-xs text-white/35 mb-1.5 flex items-center gap-1"><Calendar className="w-3 h-3"/>{t.duration}</p>
                    <ul className="space-y-0.5">
                      {(t.activities ?? []).map((a:string,j:number) => <li key={j} className="text-xs text-white/50">· {a}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review decision */}
      {strategy?.client_status === 'sent' ? (
        <div className="sabi-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Your Decision</h3>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button onClick={() => setDecision('approved')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${decision==='approved'?'border-green-500/50 bg-green-500/15':'border-white/8 hover:border-green-500/25 hover:bg-green-500/5'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${decision==='approved'?'bg-green-500/30':'bg-white/5'}`}>
                <Check className={`w-5 h-5 ${decision==='approved'?'text-green-400':'text-white/30'}`}/>
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${decision==='approved'?'text-green-400':'text-white/60'}`}>Approve</p>
                <p className="text-xs text-white/30 mt-0.5">Ready to proceed</p>
              </div>
            </button>
            <button onClick={() => setDecision('needs_revision')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${decision==='needs_revision'?'border-amber-500/50 bg-amber-500/10':'border-white/8 hover:border-amber-500/25 hover:bg-amber-500/5'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${decision==='needs_revision'?'bg-amber-500/20':'bg-white/5'}`}>
                <MessageSquare className={`w-5 h-5 ${decision==='needs_revision'?'text-amber-400':'text-white/30'}`}/>
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${decision==='needs_revision'?'text-amber-400':'text-white/60'}`}>Request Revision</p>
                <p className="text-xs text-white/30 mt-0.5">Something needs changing</p>
              </div>
            </button>
          </div>

          {decision === 'needs_revision' && (
            <div className="mb-5">
              <label className="text-xs text-white/50 mb-1.5 block">What needs to be revised? *</label>
              <textarea className="sabi-input resize-none" rows={4}
                placeholder="Be specific — e.g. 'The target audience description doesn't match our actual customers. We focus on ages 25-35 not 18-24. Also please increase the Instagram frequency to daily.'"
                value={feedback} onChange={e => setFeedback(e.target.value)}/>
            </div>
          )}

          <button onClick={submit} disabled={submitting || !decision}
            className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-40">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin"/>Submitting…</>
              : decision === 'approved' ? <><Check className="w-4 h-4"/>Approve Strategy</> : <><MessageSquare className="w-4 h-4"/>Submit Revision Request</>}
          </button>
        </div>
      ) : (
        <div className="sabi-card p-5 text-center">
          {strategy?.client_status === 'approved' && <p className="text-green-400 font-medium">✓ You approved this strategy</p>}
          {strategy?.client_status === 'needs_revision' && <p className="text-amber-400 font-medium">Revision requested — your team is working on an update</p>}
        </div>
      )}
    </div>
  );
}
