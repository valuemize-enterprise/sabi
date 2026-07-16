'use client';

import { useState, useEffect } from 'react';
import { Star, ExternalLink, Check, X, Loader2, ListChecks } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const TIERS = [
  { value: 5,  label:'Minor',       desc:'A small, genuine extra effort' },
  { value: 10, label:'Solid',       desc:'A clear contribution with real impact' },
  { value: 15, label:'Exceptional', desc:'Went well beyond expectations' },
];

export default function ContributionClaimsReviewPage() {
  const [claims, setClaims]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Record<string, number>>({});
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showReject, setShowReject] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = () => {
    api('/api/agency/contribution-claims/pending').then((r: any) => setClaims(r.data?.claims ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const verify = async (claimId: string) => {
    const tier = selectedTier[claimId];
    if (!tier) return;
    setProcessing(claimId);
    try {
      await api(`/api/agency/contribution-claims/${claimId}/verify`, {
        method: 'PUT', body: JSON.stringify({ points_awarded: tier }),
      });
      setClaims(p => p.filter(c => c.id !== claimId));
    } catch (err: any) { alert(err.message); }
    finally { setProcessing(null); }
  };

  const reject = async (claimId: string) => {
    const note = rejectNote[claimId];
    if (!note?.trim()) { alert('A reason is required'); return; }
    setProcessing(claimId);
    try {
      await api(`/api/agency/contribution-claims/${claimId}/reject`, {
        method: 'PUT', body: JSON.stringify({ review_note: note.trim() }),
      });
      setClaims(p => p.filter(c => c.id !== claimId));
    } catch (err: any) { alert(err.message); }
    finally { setProcessing(null); setShowReject(null); }
  };

  if (loading) return <LoadingPage label="Loading claims…"/>;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <AgencyTopNav title="Contribution Claims" subtitle={`${claims.length} pending review`}/>

      {claims.length === 0 ? (
        <EmptyState icon={Star} title="No pending claims" description="Contribution claims from your team will appear here for review."/>
      ) : (
        <div className="space-y-4">
          {claims.map(c => {
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="sabi-card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full flex items-start gap-3 p-5 text-left hover:bg-white/2 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-sm font-bold text-amber-400 flex-shrink-0">
                    {c.staff?.full_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{c.title}</p>
                    <p className="text-xs text-white/40">{c.staff?.full_name} · {c.brands?.name} · {c.week_start}</p>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                    <p className="text-sm text-white/65 leading-relaxed">{c.description}</p>

                    {/* Proof links */}
                    <div className="flex flex-wrap gap-2">
                      {(c.proof_links ?? []).map((l: any, i: number) => (
                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
                          {l.label} <ExternalLink className="w-3 h-3"/>
                        </a>
                      ))}
                    </div>

                    {/* Core functions reference — makes the "is this actually extra?" call fast */}
                    {c.staffCoreFunctions?.length > 0 && (
                      <div className="bg-white/3 border border-white/6 rounded-xl p-3">
                        <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ListChecks className="w-3 h-3"/> {c.staff?.full_name?.split(' ')[0]}'s Core Functions (for comparison)
                        </p>
                        <div className="space-y-1">
                          {c.staffCoreFunctions.map((f: string, i: number) => (
                            <p key={i} className="text-xs text-white/40">→ {f}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verify with tier */}
                    <div>
                      <p className="text-xs text-white/40 mb-2">Award points:</p>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {TIERS.map(t => (
                          <button key={t.value} onClick={() => setSelectedTier(p => ({ ...p, [c.id]: t.value }))}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              selectedTier[c.id] === t.value ? 'border-green-500/40 bg-green-500/10' : 'border-white/8 hover:border-white/15'
                            }`}>
                            <p className={`text-lg font-bold ${selectedTier[c.id] === t.value ? 'text-green-400' : 'text-white/50'}`}>+{t.value}</p>
                            <p className="text-[10px] text-white/30">{t.label}</p>
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => verify(c.id)} disabled={!selectedTier[c.id] || processing === c.id}
                          className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2 text-sm disabled:opacity-50">
                          {processing === c.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} Verify
                        </button>
                        <button onClick={() => setShowReject(showReject === c.id ? null : c.id)}
                          className="px-4 py-2 text-sm text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/8 transition-all">
                          Reject
                        </button>
                      </div>

                      {showReject === c.id && (
                        <div className="mt-3">
                          <textarea className="sabi-input resize-none text-sm mb-2" rows={2}
                            placeholder="Reason for rejecting (visible to staff member)…"
                            value={rejectNote[c.id] ?? ''} onChange={e => setRejectNote(p => ({ ...p, [c.id]: e.target.value }))}/>
                          <button onClick={() => reject(c.id)} disabled={processing === c.id}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors">
                            Confirm Rejection →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
