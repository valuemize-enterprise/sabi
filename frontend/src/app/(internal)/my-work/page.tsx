'use client';

import { useState, useEffect } from 'react';
import { PenLine, Plus, X, Loader2, Check, Clock, Target, Lightbulb, ExternalLink, Star } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { goals as goalsApi, strategies as stratApi } from '@/lib/api';
import { LINK_META, type ProofLink } from '@/lib/permissions';
import { ProofLinksInput } from '@/components/internal/ProofLinksInput';
import { StrategyCard }    from '@/components/internal/StrategyCard';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const CATEGORIES = [
  { value:'strategy',     label:'Strategy & Planning',   icon:'📊' },
  { value:'content_copy', label:'Copywriting & Content', icon:'✍️'  },
  { value:'design',       label:'Design & Creative',     icon:'🎨' },
  { value:'social_media', label:'Social Media',          icon:'📱' },
  { value:'analytics',    label:'Analytics & Reporting', icon:'📈' },
  { value:'video',        label:'Video & Photography',   icon:'🎬' },
  { value:'community',    label:'Community Management',  icon:'💬' },
  { value:'client_comms', label:'Client Communication',  icon:'📧' },
  { value:'ads',          label:'Paid Advertising',      icon:'📣' },
  { value:'seo',          label:'SEO & Digital',         icon:'🔍' },
  { value:'other',        label:'Other',                 icon:'📌' },
];

const catInfo = (v: string) => CATEGORIES.find(c => c.value === v);

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(opts?.headers ?? {}) },
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.message); return b; });

const EMPTY_FORM = { brand_id:'', category:'', title:'', description:'', goal_id:'', strategy_id:'', hours:'' };

export default function MyWorkPage() {
  const { user } = useAgencyStore();
  const [logs, setLogs]           = useState<any[]>([]);
  const [myBrands, setMyBrands]   = useState<any[]>([]);
  const [brandGoals, setBrandGoals]   = useState<any[]>([]);
  const [brandStrategies, setBrandStrats] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [proofLinks, setProofLinks] = useState<ProofLink[]>([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [period, setPeriod]       = useState<'week'|'month'|'all'>('week');
  const [brandFilter, setBrandFilter] = useState('');
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimForm, setClaimForm] = useState({ brand_id:'', title:'', description:'' });
  const [claimLinks, setClaimLinks] = useState<ProofLink[]>([]);
  const [savingClaim, setSavingClaim] = useState(false);
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [weekClaimCount, setWeekClaimCount] = useState(0);
  const maxClaimsPerWeek = 2;

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      apiFetch('/api/agency/staff/me/brands').catch(() => ({ data: [] })),
      apiFetch('/api/agency/work-logs?limit=100').catch(() => ({ data: [] })),
    ]).then(([b, l]) => { setMyBrands(b.data ?? []); setLogs(l.data ?? []); })
      .finally(() => setLoading(false));

    apiFetch('/api/agency/contribution-claims/mine')
      .then((r: any) => { setMyClaims(r.data?.claims ?? []); setWeekClaimCount(r.data?.thisWeekCount ?? 0); })
      .catch(() => {});
  }, []);

  // Load goals + strategies when brand changes
  useEffect(() => {
    if (!form.brand_id) { setBrandGoals([]); setBrandStrats([]); return; }
    Promise.all([
      goalsApi.list({ brand_id: form.brand_id, status: 'active', limit: '20' }),
      stratApi.list({ brand_id: form.brand_id, status: 'active', limit: '10' }),
    ]).then(([gr, sr]: any) => {
      setBrandGoals(gr.data ?? []);
      setBrandStrats(sr.data ?? []);
    }).catch(() => {});
  }, [form.brand_id]);

  const openForm = () => {
    setForm({ ...EMPTY_FORM });
    setProofLinks([]);
    setError('');
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand_id)  { setError('Please select a brand');    return; }
    if (!form.category)  { setError('Please select a work type'); return; }
    if (!form.title)     { setError('Please describe what you did'); return; }

    setSaving(true); setError('');
    try {
      const res: any = await apiFetch('/api/agency/work-logs', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          hours:       parseFloat(form.hours) || 0,
          strategy_id: form.strategy_id || null,
          goal_id:     form.goal_id     || null,
          proof_links: proofLinks,
        }),
      });
      setLogs(p => [res.data, ...p]);
      setForm({ ...EMPTY_FORM }); setProofLinks([]); setShowForm(false);
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const submitClaim = async () => {
    if (!claimForm.brand_id || !claimForm.title || !claimForm.description) { setError('All fields are required'); return; }
    if (claimLinks.length === 0) { setError('At least one proof link is required'); return; }
    setSavingClaim(true); setError('');
    try {
      const res: any = await apiFetch('/api/agency/contribution-claims', {
        method: 'POST',
        body: JSON.stringify({ ...claimForm, proof_links: claimLinks }),
      });
      setMyClaims(p => [res.data.claim, ...p]);
      setWeekClaimCount(p => p + 1);
      setClaimForm({ brand_id:'', title:'', description:'' });
      setClaimLinks([]);
      setShowClaimForm(false);
    } catch (err: any) { setError(err.message); }
    finally { setSavingClaim(false); }
  };

  // Filters
  const now = new Date();
  const visible = logs.filter(l => {
    if (brandFilter && l.brand_id !== brandFilter) return false;
    if (period === 'week')  return (now.getTime() - new Date(l.created_at).getTime()) < 7 * 86400000;
    if (period === 'month') { const d = new Date(l.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }
    return true;
  });

  const totalHours = visible.reduce((s, l) => s + (l.hours ?? 0), 0);
  const selectedStrategy = brandStrategies.find(s => s.id === form.strategy_id);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-white">My Work</h1>
          <p className="text-sm text-white/40 mt-1">
            {visible.length} entr{visible.length !== 1 ? 'ies' : 'y'} · {totalHours.toFixed(1)}h · feeds directly into client reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowClaimForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/8 transition-all">
            <Star className="w-4 h-4"/> Claim a Contribution
          </button>
          <button onClick={openForm} className="sabi-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
            <Plus className="w-4 h-4"/> Log Work
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="sabi-card p-4 text-center">
          <p className="text-2xl font-black text-white">{visible.length}</p>
          <p className="text-xs text-white/40 mt-1">Entries logged</p>
        </div>
        <div className="sabi-card p-4 text-center">
          <p className="text-2xl font-black text-white">{totalHours.toFixed(1)}h</p>
          <p className="text-xs text-white/40 mt-1">Hours recorded</p>
        </div>
        <div className="sabi-card p-4 text-center">
          <p className="text-2xl font-black text-white">
            {visible.filter(l => (l.proof_links ?? []).length > 0).length}
          </p>
          <p className="text-xs text-white/40 mt-1">With proof links</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
          {(['week','month','all'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${period === p ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>
              {p === 'all' ? 'All Time' : `This ${p.charAt(0).toUpperCase() + p.slice(1)}`}
            </button>
          ))}
        </div>
        <select className="sabi-input w-40 text-sm" value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
          <option className="bg-black" value="">All brands</option>
          {myBrands.map((b: any) => <option className="bg-black" key={b.id ?? b.brand_id} value={b.brand_id ?? b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* ── Log work modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">Log Work</h2>
                <p className="text-xs text-white/30 mt-0.5">Add proof links so supervisors can verify your work</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              {/* Brand */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Brand *</label>
                <select className="sabi-input" required value={form.brand_id} onChange={e => setF('brand_id', e.target.value)}>
                  <option value="">Select brand…</option>
                  {myBrands.map((b: any) => <option key={b.brand_id ?? b.id} value={b.brand_id ?? b.id}>{b.name}</option>)}
                </select>
              </div>

              {/* ── THE BIG STRATEGY — shown when brand is selected ── */}
              {form.brand_id && brandStrategies.length > 0 && (
                <div>
                  <label className="text-xs text-white/50 mb-2 block flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-purple-400" />
                    Link to Strategy <span className="text-white/20">(recommended — helps build the client report)</span>
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {brandStrategies.map(s => (
                      <StrategyCard key={s.id} strategy={s} compact
                        selected={form.strategy_id === s.id}
                        onClick={() => setF('strategy_id', form.strategy_id === s.id ? '' : s.id)} />
                    ))}
                  </div>
                  {selectedStrategy && (
                    <p className="text-xs text-purple-400/70 mt-2 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Connected to "{selectedStrategy.title}"
                    </p>
                  )}
                </div>
              )}

              {/* Work type */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Work Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.value} onClick={() => setF('category', c.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        form.category === c.value ? 'border-purple-500/50 bg-purple-500/15' : 'border-white/5 hover:border-white/10'
                      }`}>
                      <span className="text-sm flex-shrink-0">{c.icon}</span>
                      <span className={`text-xs font-medium ${form.category === c.value ? 'text-purple-300' : 'text-white/60'}`}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* What did you do */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">What did you do? *</label>
                <input className="sabi-input" required
                  placeholder="e.g. Created July content calendar with 30 posts"
                  value={form.title} onChange={e => setF('title', e.target.value)} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Detail <span className="text-white/20">(optional)</span></label>
                <textarea className="sabi-input resize-none" rows={2}
                  placeholder="Outcomes, metrics, context, what was delivered…"
                  value={form.description} onChange={e => setF('description', e.target.value)} />
              </div>

              {/* Goal + hours in a row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Linked Goal</label>
                  <select className="sabi-input text-sm" value={form.goal_id} onChange={e => setF('goal_id', e.target.value)}>
                    <option className="bg-black" value="">No goal</option>
                    {brandGoals.map((g: any) => <option className="bg-black" key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Hours Spent</label>
                  <input type="number" min="0" max="24" step="0.5" className="sabi-input text-sm" placeholder="e.g. 2.5"
                    value={form.hours} onChange={e => setF('hours', e.target.value)} />
                </div>
              </div>

              {/* ── PROOF LINKS — the key new feature ──────────── */}
              <ProofLinksInput value={proofLinks} onChange={setProofLinks} />
            </div>

            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={save} disabled={saving || !form.brand_id || !form.category || !form.title}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Log Work</>}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 text-sm text-white/40 hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Claim a Contribution modal ──────────────────────── */}
      {showClaimForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-amber-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">Claim a Contribution</h2>
                <p className="text-xs text-white/30 mt-0.5">Something beyond your core function — bring proof</p>
              </div>
              <button onClick={() => setShowClaimForm(false)}><X className="w-5 h-5 text-white/30"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
              <select className="sabi-input" value={claimForm.brand_id} onChange={e => setClaimForm(p=>({...p,brand_id:e.target.value}))}>
                <option className='bg-black' value="">Select brand…</option>
                {myBrands.map((b: any) => <option className='bg-black' key={b.brand_id??b.id} value={b.brand_id??b.id}>{b.name}</option>)}
              </select>
              <input className="sabi-input" placeholder="What did you do? e.g. 'Introduced Reels trend-jacking format'"
                value={claimForm.title} onChange={e => setClaimForm(p=>({...p,title:e.target.value}))}/>
              <textarea className="sabi-input resize-none" rows={4}
                placeholder="Explain why this goes beyond your normal role — what impact did it have?"
                value={claimForm.description} onChange={e => setClaimForm(p=>({...p,description:e.target.value}))}/>
              <ProofLinksInput value={claimLinks} onChange={setClaimLinks}/>
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-400/60">
                  {weekClaimCount >= maxClaimsPerWeek
                    ? `⚠️ You've already used your ${maxClaimsPerWeek} weekly claims — this one rolls to next week.`
                    : `${maxClaimsPerWeek - weekClaimCount} of ${maxClaimsPerWeek} weekly claim${maxClaimsPerWeek - weekClaimCount !== 1 ? 's' : ''} remaining`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={submitClaim} disabled={savingClaim || claimLinks.length === 0}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {savingClaim ? <><Loader2 className="w-4 h-4 animate-spin"/>Submitting…</> : <><Check className="w-4 h-4"/>Submit Claim</>}
              </button>
              <button onClick={() => setShowClaimForm(false)} className="px-4 text-sm text-white/40">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Work log list */}
      {loading ? <LoadingPage /> : visible.length === 0 ? (
        <EmptyState icon={PenLine} title={period === 'week' ? 'No work logged this week' : 'No entries yet'}
          description="Log your work so it shows in client reports. Add proof links so your manager can verify."
          action={{ label: 'Log First Entry', onClick: openForm }} />
      ) : (
        <div className="space-y-3">
          {visible.map((l, i) => {
            const cat   = catInfo(l.category);
            const links: ProofLink[] = l.proof_links ?? [];
            return (
              <div key={l.id ?? i} className="sabi-card p-5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">{cat?.icon ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white leading-snug">{l.title}</p>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {cat && <Badge label={cat.label} color="purple" />}
                      {l.strategies?.title && (
                        <span className="text-xs text-purple-400/70 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" /> {l.strategies.title}
                        </span>
                      )}
                      {l.goals?.title && (
                        <span className="text-xs text-green-400/70 flex items-center gap-1">
                          <Target className="w-3 h-3" /> {l.goals.title}
                        </span>
                      )}
                      {(l.hours ?? 0) > 0 && (
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{l.hours}h
                        </span>
                      )}
                      <span className="text-xs text-white/20">
                        {new Date(l.created_at).toLocaleDateString('en-NG', { day:'numeric', month:'short' })}
                      </span>
                    </div>

                    {l.description && (
                      <p className="text-xs text-white/35 mt-1.5 leading-relaxed">{l.description}</p>
                    )}

                    {/* Proof links */}
                    {links.length > 0 && (
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        {links.map((link, li) => {
                          const meta = LINK_META[link.type];
                          return (
                            <a key={li} href={link.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white/4 border border-white/8 text-white/50 hover:text-white hover:border-white/20 transition-all">
                              <span>{meta.icon}</span>
                              <span>{link.label}</span>
                              <ExternalLink className="w-3 h-3 opacity-50" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contribution claims history */}
      {myClaims.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-3">My Contribution Claims</h2>
          <div className="space-y-2">
            {myClaims.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-white/3 border border-white/6 rounded-xl">
                <div>
                  <p className="text-sm text-white">{c.title}</p>
                  <p className="text-xs text-white/30">{c.brands?.name} · {c.week_start}</p>
                </div>
                {c.status === 'pending'  && <Badge label="Pending" color="amber"/>}
                {c.status === 'verified' && <Badge label={`+${c.points_awarded} pts`} color="green"/>}
                {c.status === 'rejected' && <Badge label="Not verified" color="red"/>}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-white/15 text-center mt-6">
        Every entry — especially those with proof links — becomes verifiable evidence in client reports.
      </p>
    </div>
  );
}
