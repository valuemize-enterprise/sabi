'use client';

import { useState, useEffect } from 'react';
import { Star, ExternalLink, Check, Loader2, Award, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

export default function CreativeReviewPage() {
  const [byStaff, setByStaff]   = useState<any[]>([]);
  const [existingRatings, setExisting] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState('');
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ratings, setRatings]   = useState<Record<string, { score: number; note: string }>>({});
  const [creativeOfWeek, setCreativeOfWeek] = useState<string | null>(null);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<Set<string>>(new Set());
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    api('/api/agency/weekly-ratings/creative-review-data').then((r: any) => {
      setByStaff(r.data?.byStaff ?? []);
      setExisting(r.data?.existingRatings ?? []);
      setWeekStart(r.data?.week_start ?? '');
      const existingCow = (r.data?.existingRatings ?? []).find((rt:any) => rt.is_creative_of_week);
      if (existingCow) setCreativeOfWeek(existingCow.staff_id);
    }).catch((err) => { if (err.message?.includes('403') || err.message?.includes('Only the Creative')) setForbidden(true); })
    .finally(() => setLoading(false));
  }, []);

  const rateStaff = async (staffId: string, brandId: string) => {
    const r = ratings[staffId];
    if (!r?.score) return;
    if (r.score <= 2 && !r.note?.trim()) { alert('A note is required when rating 2 or below'); return; }

    setSaving(staffId);
    try {
      await api('/api/agency/weekly-ratings', {
        method: 'POST',
        body: JSON.stringify({
          staff_id: staffId, brand_id: brandId, score: r.score, note: r.note || null,
          is_creative_of_week: creativeOfWeek === staffId,
        }),
      });
      setSaved(prev => new Set([...prev, staffId]));
    } catch (err: any) { alert(err.message); }
    finally { setSaving(null); }
  };

  const setScore = (staffId: string, score: number) => setRatings(p => ({ ...p, [staffId]: { ...p[staffId], score } }));
  const setNote  = (staffId: string, note: string)  => setRatings(p => ({ ...p, [staffId]: { ...p[staffId], note } }));

  if (loading) return <LoadingPage label="Loading creative work…"/>;

  if (forbidden) return (
    <div className="p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="Creative Review"/>
      <div className="sabi-card p-10 text-center">
        <Lock className="w-8 h-8 text-white/15 mx-auto mb-3"/>
        <p className="text-white/40 text-sm">Creative Review is only available to the Creative Director, MD, and Super Admin.</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Creative Review" subtitle={`Week of ${weekStart} — rate your creative team's output`}/>

      {byStaff.length === 0 ? (
        <EmptyState icon={Award} title="No creative work logged this week" description="Once designers and content creators log work with proof links, it will appear here for review."/>
      ) : (
        <div className="space-y-4">
          {byStaff.map((group: any) => {
            const staff = group.staff;
            const isOpen = expanded === staff.id;
            const hasSaved = saved.has(staff.id);
            const alreadyRated = existingRatings.find((r:any) => r.staff_id === staff.id);

            return (
              <div key={staff.id} className="sabi-card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : staff.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/2 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center text-base font-bold text-purple-300 flex-shrink-0">
                    {staff.full_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{staff.full_name}</p>
                    <p className="text-xs text-white/40 capitalize">{staff.role?.replace(/_/g,' ')} · {group.entries.length} item{group.entries.length!==1?'s':''} this week</p>
                  </div>
                  {(hasSaved || alreadyRated) && <Check className="w-4 h-4 text-green-400 flex-shrink-0"/>}
                  {creativeOfWeek === staff.id && <Award className="w-4 h-4 text-amber-400 flex-shrink-0"/>}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-white/20 flex-shrink-0"/> : <ChevronDown className="w-4 h-4 text-white/20 flex-shrink-0"/>}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                    {/* Uploaded work */}
                    <div className="space-y-2">
                      {group.entries.map((e: any) => (
                        <div key={e.id} className="p-3 bg-white/3 border border-white/6 rounded-xl">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm text-white font-medium">{e.title}</p>
                              <p className="text-xs text-white/35">{e.brands?.name} · {new Date(e.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</p>
                            </div>
                          </div>
                          {(e.proof_links ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {e.proof_links.map((link: any, i: number) => (
                                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-all">
                                  {link.label} <ExternalLink className="w-3 h-3"/>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Rating */}
                    {alreadyRated ? (
                      <p className="text-xs text-green-400/70 flex items-center gap-1.5"><Check className="w-3.5 h-3.5"/>Already rated this week: {alreadyRated.score}/5</p>
                    ) : (
                      <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-4">
                        <p className="text-xs text-purple-400 font-medium mb-2">Rate this week's output</p>
                        <div className="flex items-center gap-1.5 mb-3">
                          {[1,2,3,4,5].map(n => (
                            <button key={n} onClick={() => setScore(staff.id, n)}
                              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                                (ratings[staff.id]?.score ?? 0) >= n ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/20'
                              }`}>
                              <Star className="w-4 h-4" fill={(ratings[staff.id]?.score ?? 0) >= n ? 'currentColor' : 'none'}/>
                            </button>
                          ))}
                        </div>
                        {(ratings[staff.id]?.score ?? 0) <= 2 && (ratings[staff.id]?.score ?? 0) > 0 && (
                          <textarea className="sabi-input resize-none text-sm mb-3" rows={2}
                            placeholder="Required: explain the low rating…"
                            value={ratings[staff.id]?.note ?? ''} onChange={e => setNote(staff.id, e.target.value)}/>
                        )}
                        <label className="flex items-center gap-2 text-xs text-white/40 mb-3 cursor-pointer">
                          <input type="checkbox" checked={creativeOfWeek === staff.id}
                            onChange={e => setCreativeOfWeek(e.target.checked ? staff.id : null)} className="rounded"/>
                          <Award className="w-3.5 h-3.5 text-amber-400"/> Nominate as Creative of the Week (+5 bonus)
                        </label>
                        <button onClick={() => rateStaff(staff.id, group.entries[0]?.brand_id)}
                          disabled={saving === staff.id || !ratings[staff.id]?.score}
                          className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                          {saving === staff.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} Submit Rating
                        </button>
                      </div>
                    )}
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
