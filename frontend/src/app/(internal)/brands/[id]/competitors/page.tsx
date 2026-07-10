'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Swords, Plus, Brain, Loader2, X,
  ChevronDown, ChevronUp, Trash2, Edit, ExternalLink,
  AlertTriangle, Zap, BarChart3, Target
} from 'lucide-react';
import { competitors as compApi } from '@/lib/api';
import { LoadingPage, EmptyState, Badge, PageHeader } from '@/components/ui';

const EMPTY_FORM = { name: '', website: '', industry: '', social_handles: { instagram: '', twitter: '', facebook: '', linkedin: '', tiktok: '' } };

const ACTIVITY_COLOR: Record<string, string> = {
  Low: 'green', Medium: 'amber', High: 'red', 'Very High': 'red', Critical: 'red',
};

export default function BrandCompetitorsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // CRUD modals
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // AI actions
  const [pulsing, setPulsing] = useState<string | null>(null);
  const [selectedForDepth, setSelectedForDepth] = useState<string[]>([]);
  const [depthRunning, setDepthRunning] = useState(false);

  useEffect(() => {
    compApi.list({ brand_id: brandId, limit: '50' })
      .then((r: any) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [brandId]);

  // ── CRUD ────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };


  const INDUSTRIES = [
  'FMCG','Fintech','Retail','Telecoms','Real Estate','Healthcare',
  'Education','Media & Entertainment','Fashion & Beauty','Food & Beverage',
  'Logistics','Agriculture','Oil & Gas','NGO / Non-Profit','Technology',
  'Hospitality','Insurance','Banking','E-commerce','Other',
];

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      name: c.name || '',
      website: c.website || '',
      industry: c.industry || '',
      social_handles: { instagram: '', twitter: '', facebook: '', linkedin: '', tiktok: '', ...(c.social_handles || {}) },
    });
    setShowForm(true);
  };

  const saveCompetitor = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        website: form.website.trim() || null,
        industry: form.industry.trim() || null,
        social_handles: Object.fromEntries(Object.entries(form.social_handles).filter(([, v]) => v.trim())),
      };
      if (editingId) {
        const res: any = await compApi.update(editingId, body);
        setItems(p => p.map(c => c.id === editingId ? { ...c, ...res.data.competitor } : c));
        toast.success('Competitor updated');
      } else {
        const res: any = await compApi.create({ brand_id: brandId, ...body });
        setItems(p => [res.data.competitor, ...p]);
        toast.success('Competitor added');
      }
      setShowForm(false);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const deleteCompetitor = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      await compApi.delete(deleteModal);
      setItems(p => p.filter(c => c.id !== deleteModal));
      toast.success('Competitor removed');
      setDeleteModal(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  // ── AI Actions ──────────────────────────────────────────
  const runPulse = async (id: string) => {
    setPulsing(id);
    try {
      const res: any = await compApi.pulse(id);
      setItems(p => p.map(c => c.id === id ? { ...c, pulse_data: res.data, last_pulse_at: new Date().toISOString() } : c));
      toast.success('IntelliPulse™ scan complete');
    } catch (err: any) { toast.error(err.message); }
    finally { setPulsing(null); }
  };

  const toggleDepthSelect = (id: string) => {
    setSelectedForDepth(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const runDepthView = async () => {
    if (selectedForDepth.length < 2) { toast.error('Select at least 2 competitors'); return; }
    setDepthRunning(true);
    try {
      const res: any = await compApi.depthView(brandId, selectedForDepth);
      // Update each competitor with depth view data from the response
      const comparisons = res.data?.comparisons || {};
      setItems(p => p.map(c => comparisons[c.id] ? { ...c, depth_view_data: { ...comparisons[c.id], summary: res.data?.summary, ourPosition: res.data?.ourPosition, strategicRecommendations: res.data?.strategicRecommendations } } : c));
      setSelectedForDepth([]);
      toast.success('DepthView™ analysis complete');
    } catch (err: any) { toast.error(err.message); }
    finally { setDepthRunning(false); }
  };

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const setSocial = (k: string, v: string) => setForm(p => ({ ...p, social_handles: { ...p.social_handles, [k]: v } }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Competitors</h1>
          <p className="text-sm text-white/40 mt-0.5">Track rivals · AI-powered intelligence with IntelliPulse™ & DepthView™</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedForDepth.length >= 2 && (
            <button onClick={runDepthView} disabled={depthRunning}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-50">
              {depthRunning ? <Loader2 className="w-4 h-4 animate-spin"/> : <BarChart3 className="w-4 h-4"/>}
              DepthView™ ({selectedForDepth.length})
            </button>
          )}
          <button onClick={openAdd} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4"/> Add Competitor
          </button>
        </div>
      </div>

      {/* DepthView selection hint */}
      {items.length >= 2 && selectedForDepth.length === 0 && (
        <div className="flex items-center gap-3 p-3 mb-5 rounded-xl bg-purple-500/8 border border-purple-500/15">
          <Target className="w-4 h-4 text-purple-400 flex-shrink-0"/>
          <p className="text-xs text-white/50">Select 2+ competitors to run a head-to-head <span className="text-purple-400 font-medium">DepthView™</span> comparison</p>
        </div>
      )}

      {loading ? <LoadingPage/> : items.length === 0 ? (
        <EmptyState icon={Swords} title="No competitors tracked"
          description="Add competitors to run AI-powered intelligence scans with IntelliPulse™ and DepthView™."
          action={{ label: 'Add First Competitor', onClick: openAdd }}/>
      ) : (
        <div className="space-y-4">
          {items.map(c => {
            const pulse = c.pulse_data ?? {};
            const depth = c.depth_view_data ?? {};
            const isOpen = expanded === c.id;
            const isSelected = selectedForDepth.includes(c.id);
            const pulseScore = pulse.pulseScore ?? null;

            return (
              <div key={c.id} className={`sabi-card overflow-hidden transition-all ${isSelected ? 'border-purple-500/30 ring-1 ring-purple-500/15' : ''}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* DepthView checkbox */}
                      {items.length >= 2 && (
                        <button onClick={() => toggleDepthSelect(c.id)}
                          className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-purple-500 border-purple-500 text-white' : 'border-white/20 hover:border-white/40'
                          }`}>
                          {isSelected && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                        </button>
                      )}
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-base font-bold text-red-300 flex-shrink-0">
                        {c.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.industry && <span className="text-xs text-white/40">{c.industry}</span>}
                          {c.website && (
                            <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-400/70 hover:text-blue-400 flex items-center gap-0.5 transition-colors">
                              {c.website.replace(/^https?:\/\//, '')} <ExternalLink className="w-2.5 h-2.5"/>
                            </a>
                          )}
                          {pulseScore != null && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                              pulseScore >= 70 ? 'bg-red-500/15 text-red-400' : pulseScore >= 40 ? 'bg-amber-500/15 text-amber-400' : 'bg-green-500/15 text-green-400'
                            }`}>
                              Pulse: {pulseScore}
                            </span>
                          )}
                          {pulse.overallActivityLevel && (
                            <Badge label={pulse.overallActivityLevel} color={ACTIVITY_COLOR[pulse.overallActivityLevel] ?? 'gray'}/>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => runPulse(c.id)} disabled={pulsing === c.id}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50">
                        {pulsing === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Zap className="w-3.5 h-3.5"/>}
                        {pulsing === c.id ? 'Scanning…' : 'IntelliPulse™'}
                      </button>
                      <button onClick={() => openEdit(c)} className="text-white/25 hover:text-white/60 transition-colors">
                        <Edit className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={() => setDeleteModal(c.id)} className="text-white/25 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                      <button onClick={() => setExpanded(isOpen ? null : c.id)} className="text-white/25 hover:text-white/60 transition-colors">
                        {isOpen ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>

                  {/* Social handles preview (collapsed) */}
                  {!isOpen && c.social_handles && Object.values(c.social_handles).some(v => v) && (
                    <div className="flex items-center gap-2 mt-3 ml-14 flex-wrap">
                      {Object.entries(c.social_handles).filter(([, v]) => v).map(([k, v]) => (
                        <span key={k} className="text-[10px] text-white/25 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full capitalize">{k}</span>
                      ))}
                    </div>
                  )}

                  {/* IntelliPulse results (collapsed preview) */}
                  {!isOpen && pulse.activities && (
                    <div className="mt-3 ml-14">
                      <p className="text-xs text-white/35 line-clamp-1">{pulse.keyThreat || 'Run IntelliPulse™ to see activity'}</p>
                    </div>
                  )}
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                    {/* Social handles */}
                    {c.social_handles && Object.values(c.social_handles).some(v => v) && (
                      <div>
                        <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Social Handles</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(c.social_handles).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} className="text-xs bg-white/5 border border-white/10 text-white/50 px-3 py-1 rounded-full capitalize flex items-center gap-1.5">
                              {k}: <span className="text-white/70">{v as string}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* IntelliPulse full results */}
                    {pulse.activities && (
                      <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Brain className="w-3.5 h-3.5 text-purple-400"/>
                          <span className="text-xs text-purple-400 font-semibold">IntelliPulse™ — ARIA Analysis</span>
                          {pulse.lastUpdated && <span className="text-[10px] text-white/20 ml-auto">{new Date(pulse.lastUpdated).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                        </div>

                        {pulse.summary && <p className="text-sm text-white/60 mb-3">{pulse.summary}</p>}

                        {/* Score + strength */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          {pulseScore != null && (
                            <div className="flex items-center gap-2">
                              <div className="relative w-12 h-12">
                                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
                                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                                    stroke={pulseScore >= 70 ? '#f87171' : pulseScore >= 40 ? '#fbbf24' : '#34d399'} strokeWidth="3"
                                    strokeDasharray={`${pulseScore}, 100`}/>
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{pulseScore}</span>
                              </div>
                              <span className="text-xs text-white/30">Pulse Score</span>
                            </div>
                          )}
                        </div>

                        {/* Activities */}
                        {pulse.activities?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs text-white/30 font-medium uppercase tracking-wider">Recent Activity</p>
                            {pulse.activities.map((a: any, i: number) => (
                              <div key={i} className="bg-white/3 rounded-lg p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge label={a.type} color="blue"/>
                                      <span className="text-xs font-medium text-white/70">{a.title}</span>
                                    </div>
                                    <p className="text-xs text-white/45">{a.description}</p>
                                  </div>
                                  <Badge label={a.threatLevel} color={ACTIVITY_COLOR[a.threatLevel] ?? 'gray'}/>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Key insights */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                          {pulse.keyThreat && (
                            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3">
                              <p className="text-[10px] text-red-400 font-medium uppercase tracking-wider mb-1">Key Threat</p>
                              <p className="text-xs text-white/60">{pulse.keyThreat}</p>
                            </div>
                          )}
                          {pulse.opportunity && (
                            <div className="bg-green-500/5 border border-green-500/15 rounded-lg p-3">
                              <p className="text-[10px] text-green-400 font-medium uppercase tracking-wider mb-1">Opportunity</p>
                              <p className="text-xs text-white/60">{pulse.opportunity}</p>
                            </div>
                          )}
                          {pulse.recommendedResponse && (
                            <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider mb-1">Recommended Response</p>
                              <p className="text-xs text-white/60">{pulse.recommendedResponse}</p>
                            </div>
                          )}
                        </div>

                        {pulse.nigerianContext && (
                          <p className="text-xs text-white/30 mt-3 italic">🇳🇬 {pulse.nigerianContext}</p>
                        )}
                      </div>
                    )}

                    {/* DepthView data */}
                    {depth.dimensions && (
                      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <BarChart3 className="w-3.5 h-3.5 text-blue-400"/>
                          <span className="text-xs text-blue-400 font-semibold">DepthView™ Comparison</span>
                        </div>
                        {depth.overallThreatLevel && (
                          <Badge label={`Threat: ${depth.overallThreatLevel}`} color={ACTIVITY_COLOR[depth.overallThreatLevel] ?? 'gray'}/>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                          {Object.entries(depth.dimensions).map(([key, dim]: [string, any]) => (
                            <div key={key} className="bg-white/3 rounded-lg p-3">
                              <p className="text-[10px] text-white/30 capitalize mb-1.5">{key.replace(/_/g, ' ')}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="text-blue-400">Us</span><span className="text-white/60">{dim.ours}/10</span>
                                  </div>
                                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(dim.ours / 10) * 100}%` }}/>
                                  </div>
                                </div>
                                <span className="text-white/15 text-[10px]">vs</span>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="text-red-400">Them</span><span className="text-white/60">{dim.theirs}/10</span>
                                  </div>
                                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${(dim.theirs / 10) * 100}%` }}/>
                                  </div>
                                </div>
                              </div>
                              {dim.insight && <p className="text-[10px] text-white/30 mt-1.5">{dim.insight}</p>}
                            </div>
                          ))}
                        </div>
                        {depth.competitorStrengths?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Strengths</p>
                            <div className="flex flex-wrap gap-1.5">
                              {depth.competitorStrengths.map((s: string, i: number) => (
                                <span key={i} className="text-[10px] bg-green-500/10 border border-green-500/15 text-green-400/70 px-2 py-0.5 rounded-full">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {depth.competitorWeaknesses?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Weaknesses</p>
                            <div className="flex flex-wrap gap-1.5">
                              {depth.competitorWeaknesses.map((w: string, i: number) => (
                                <span key={i} className="text-[10px] bg-red-500/10 border border-red-500/15 text-red-400/70 px-2 py-0.5 rounded-full">{w}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {depth.opportunityToWin && (
                          <p className="text-xs text-white/50 mt-3 italic">💡 {depth.opportunityToWin}</p>
                        )}
                      </div>
                    )}

                    {/* Empty state for no data */}
                    {!pulse.activities && !depth.dimensions && (
                      <p className="text-xs text-white/25 text-center py-2">No intelligence data yet. Run IntelliPulse™ or DepthView™ to analyse.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Modal ───────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">{editingId ? 'Edit Competitor' : 'Add Competitor'}</h2>
                <p className="text-xs text-white/30 mt-0.5">{editingId ? 'Update competitor details' : 'Track a new competitor'}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Name *</label>
                <input className="sabi-input text-sm" placeholder="e.g. Competitor Ltd"
                  value={form.name} onChange={e => setF('name', e.target.value)}/>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Website</label>
                <input className="sabi-input text-sm" placeholder="e.g. competitor.com"
                  value={form.website} onChange={e => setF('website', e.target.value)}/>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Industry / Category</label>
                  <select className="sabi-input" value={form.industry} onChange={e => setF('industry', e.target.value)} required>
                  <option className="bg-[#12122a]" value="">Select industry…</option>
                  {INDUSTRIES.map(i => <option className="bg-[#12122a]" key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Social Handles <span className="text-white/20">(optional)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {(['instagram', 'twitter', 'facebook', 'linkedin', 'tiktok'] as const).map(platform => (
                    <input key={platform} className="sabi-input text-sm" placeholder={platform.charAt(0).toUpperCase() + platform.slice(1)}
                      value={form.social_handles[platform]} onChange={e => setSocial(platform, e.target.value)}/>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveCompetitor} disabled={saving || !form.name.trim()}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : editingId ? 'Update' : 'Add Competitor'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────── */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-red-500/20 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">Remove Competitor</h2>
                <p className="text-xs text-white/30 mt-0.5">This action cannot be undone</p>
              </div>
              <button onClick={() => setDeleteModal(null)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0"/>
                <p className="text-sm text-white/60">All intelligence data (IntelliPulse™, DepthView™) for this competitor will be lost.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={deleteCompetitor} disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-50">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                  {deleting ? 'Removing…' : 'Remove'}
                </button>
                <button onClick={() => setDeleteModal(null)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
