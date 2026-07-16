'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Lightbulb, Plus, Sparkles, Send, Check,
  X, Loader2, Pencil, Trash2, ChevronDown, ChevronUp,
  Calendar, Brain, ListTodo, Clock, DollarSign
} from 'lucide-react';
import { goals as goalsApi } from '@/lib/api';
import { AgencyTopNav }    from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const TYPE_META: Record<string,{label:string;icon:string}> = {
  content: { label: 'Content', icon: '✍️' },
  social:  { label: 'Social',  icon: '📱' },
  paid:    { label: 'Paid',    icon: '📣' },
  seo:     { label: 'SEO',     icon: '🔍' },
  email:   { label: 'Email',   icon: '📧' },
  brand:   { label: 'Brand',   icon: '🎯' },
  campaign:{ label: 'Campaign',icon: '🚀' },
  quarterly:{label: 'Quarterly',icon: '📊' },
  annual:  { label: 'Annual',  icon: '🗓️' },
  other:   { label: 'Other',   icon: '📌' },
};
const STATUS_COLOR: Record<string,string> = { draft:'gray',active:'green',paused:'amber',completed:'blue',archived:'gray' };

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const EMPTY = { title:'', type:'campaign', description:'', start_date:'', end_date:'', budget:'', status:'draft' };

// ── AI Generate form ─────────────────────────────────────────
const AI_EMPTY = { type:'campaign', brief:'', duration:'3 months', goals:'' };

export default function BrandStrategiesPage() {
  const { id: brandId } = useParams<{ id: string }>();

  const [items, setItems]       = useState<any[]>([]);
  const [brand, setBrand]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAI, setShowAI]     = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ ...EMPTY });
  const [aiForm, setAiForm]     = useState({ ...AI_EMPTY });
  const [saving, setSaving]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genTasksId, setGenTasksId] = useState<string | null>(null);
  const [sendingId, setSendingId]   = useState<string | null>(null);
  const [pnlStrategyId, setPnlStrategyId] = useState<string | null>(null);
  const [pnlForm, setPnlForm] = useState({ expected_revenue:'', estimated_cost:'', due_date:'' });
  const [costSuggestion, setCostSuggestion] = useState<any>(null);
  const [savingPnl, setSavingPnl] = useState(false);
  const [error, setError]       = useState('');

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const setAF = (k: string, v: string) => setAiForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      api(`/api/agency/strategies?brand_id=${brandId}&limit=50`),
      api(`/api/agency/brands/${brandId}`).catch(()=>({data:{name:'Brand'}})),
    ]).then(([sr, br]: any) => {
      setItems(sr.data ?? []);
      setBrand(br.data ?? {});
    }).catch(() => {}).finally(() => setLoading(false));
  }, [brandId]);

  // ── ARIA: generate full strategy ──────────────────────────
  const generateWithAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true); setError('');
    try {
      const res: any = await api('/api/agency/strategies/generate', {
        method: 'POST',
        body: JSON.stringify({
          brand_id: brandId,
          brand_name: brand?.name,
          industry:   brand?.industry,
          type:       aiForm.type,
          brief:      aiForm.brief,
          duration:   aiForm.duration,
          goals:      aiForm.goals,
        }),
      });
      setItems(p => [res.data.strategy, ...p]);
      setShowAI(false);
      setAiForm({ ...AI_EMPTY });
      setExpanded(res.data.strategy.id); // auto-expand the new strategy
    } catch (err: any) { setError(err.message || 'ARIA could not generate strategy. Try again.'); }
    finally { setGenerating(false); }
  };

  // ── Manual save ───────────────────────────────────────────
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const body = { brand_id: brandId, ...form, budget: form.budget ? parseFloat(form.budget) : null };
      if (editId) {
        const res: any = await api(`/api/agency/strategies/${editId}`, { method:'PUT', body:JSON.stringify(body) });
        setItems(p => p.map(s => s.id === editId ? { ...s, ...(res.data.strategy ?? res.data) } : s));
      } else {
        const res: any = await api('/api/agency/strategies', { method:'POST', body:JSON.stringify(body) });
        setItems(p => [res.data.strategy ?? res.data, ...p]);
      }
      setShowForm(false); setEditId(null); setForm({ ...EMPTY });
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ── Generate tasks from strategy ─────────────────────────
  const generateTasks = async (strategyId: string) => {
    if (!confirm('Generate tasks from this strategy using ARIA? Tasks will be created and assigned to the team.')) return;
    setGenTasksId(strategyId);
    try {
      const res: any = await api('/api/agency/tasks/bulk-create', {
        method: 'POST', body: JSON.stringify({ strategy_id: strategyId, brand_id: brandId }),
      });
      toast.success(`${res.data.count} tasks created and staff notified.`);
    } catch (err: any) { toast.error(err.message); }
    finally { setGenTasksId(null); }
  };

  // ── Send to client for review ────────────────────────────
  const sendToClient = async (strategyId: string) => {
    if (!confirm('Send this strategy to the client for review? They will receive a notification.')) return;
    setSendingId(strategyId);
    try {
      await api(`/api/agency/strategies/${strategyId}/send-to-client`, { method:'PUT' });
      setItems(p => p.map(s => s.id === strategyId ? { ...s, client_status:'sent', sent_to_client_at: new Date().toISOString() } : s));
    } catch (err: any) { toast.error(err.message); }
    finally { setSendingId(null); }
  };

  // ── P&L handlers ─────────────────────────────────────────
  const openPnl = async (strategy: any) => {
    setPnlStrategyId(strategy.id);
    setPnlForm({
      expected_revenue: strategy.expected_revenue ? String(strategy.expected_revenue) : '',
      estimated_cost:   strategy.estimated_cost   ? String(strategy.estimated_cost)   : '',
      due_date: '',
    });
    try {
      const res:any = await api(`/api/agency/strategies/${strategy.id}/pnl/cost-suggestion`);
      setCostSuggestion(res.data);
    } catch { setCostSuggestion(null); }
  };

  const savePnl = async () => {
    if (!pnlForm.expected_revenue || !pnlForm.estimated_cost) return;
    setSavingPnl(true);
    try {
      const res:any = await api(`/api/agency/strategies/${pnlStrategyId}/pnl`, {
        method: 'PATCH',
        body: JSON.stringify({
          expected_revenue: parseFloat(pnlForm.expected_revenue),
          estimated_cost:   parseFloat(pnlForm.estimated_cost),
          due_date: pnlForm.due_date || undefined,
        }),
      });
      setItems(p => p.map(s => s.id === pnlStrategyId ? { ...s, ...res.data.strategy } : s));
      setPnlStrategyId(null);
      toast.success(`P&L saved. Gross margin: ₦${res.data.grossMargin.toLocaleString()}. Invoice auto-created.`);
    } catch (err:any) { toast.error(err.message); }
    finally { setSavingPnl(false); }
  };

  const del = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await api(`/api/agency/strategies/${id}`, { method:'DELETE' });
    setItems(p => p.filter(s => s.id !== id));
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({ title:s.title||'', type:s.type||'campaign', description:s.description||'',
      start_date:s.start_date||'', end_date:s.end_date||'', budget:s.budget?String(s.budget):'', status:s.status||'draft' });
    setShowForm(true); setError('');
  };

  const STRATEGY_TYPES = [
    {value:'campaign',icon:'🚀',label:'Campaign'},{value:'content',icon:'✍️',label:'Content'},
    {value:'social',icon:'📱',label:'Social'},{value:'paid',icon:'📣',label:'Paid Ads'},
    {value:'brand',icon:'🎯',label:'Brand'},{value:'quarterly',icon:'📊',label:'Quarterly'},
    {value:'annual',icon:'🗓️',label:'Annual'},{value:'seo',icon:'🔍',label:'SEO'},
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Strategies"
        breadcrumb={[{label:'Brands',href:'/brands'},{label:brand?.name||'Brand',href:`/brands/${brandId}`}]}/>
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Strategies</h1>
          <p className="text-sm text-white/40 mt-0.5">{items.length} strateg{items.length!==1?'ies':'y'} for {brand?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAI(true); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all">
            <Sparkles className="w-4 h-4"/> Generate with ARIA
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({...EMPTY}); setError(''); }}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4"/> Manual
          </button>
        </div>
      </div>

      {/* ── AI Generate modal ─────────────────────────────── */}
      {showAI && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Brain className="w-4 h-4 text-purple-400"/>
                  <h2 className="text-base font-bold text-white">Generate Strategy with ARIA</h2>
                </div>
                <p className="text-xs text-white/30">ARIA will create a full digital marketing strategy for {brand?.name}</p>
              </div>
              <button onClick={() => setShowAI(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="text-xs text-white/50 mb-2 block">Strategy Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {STRATEGY_TYPES.map(t => (
                    <button type="button" key={t.value} onClick={() => setAF('type', t.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs transition-all ${aiForm.type===t.value?'border-purple-500/50 bg-purple-500/15':'border-white/5 hover:border-white/10'}`}>
                      <span className="text-xl">{t.icon}</span>
                      <span className={aiForm.type===t.value?'text-purple-300':'text-white/50'}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Goals / Objectives *</label>
                <textarea className="sabi-input resize-none" rows={3} required
                  placeholder="e.g. Grow Instagram following by 30%, increase website traffic, generate 50 leads per month"
                  value={aiForm.goals} onChange={e => setAF('goals', e.target.value)}/>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Brief / Additional Context</label>
                <textarea className="sabi-input resize-none" rows={3}
                  placeholder="Key messages, target audience, campaigns coming up, budget constraints, past performance…"
                  value={aiForm.brief} onChange={e => setAF('brief', e.target.value)}/>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Duration</label>
                <select className="sabi-input text-sm" value={aiForm.duration} onChange={e => setAF('duration', e.target.value)}>
                  {['1 month','3 months','6 months','12 months'].map(d=><option className='bg-black' key={d}>{d}</option>)}
                </select>
              </div>

              <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-4 text-xs text-white/50 leading-relaxed">
                <p className="font-medium text-purple-400 mb-1">What ARIA will generate:</p>
                <p>Executive summary · Objectives · Target audience personas · Key messages · Channel plan · Content pillars · Tactics · KPIs · Budget allocation · Timeline · Nigerian market considerations</p>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={generateWithAI} disabled={generating || !aiForm.goals}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {generating?<><Loader2 className="w-4 h-4 animate-spin"/>Generating…</>:<><Sparkles className="w-4 h-4"/>Generate Strategy</>}
              </button>
              <button onClick={() => setShowAI(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual create/edit modal ──────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-base font-bold text-white">{editId ? 'Edit Strategy' : 'New Strategy'}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
              <div><label className="text-xs text-white/50 mb-1.5 block">Title *</label>
                <input className="sabi-input" required placeholder="e.g. FiberOne Q3 Instagram Growth Strategy"
                  value={form.title} onChange={e => setF('title', e.target.value)}/></div>
              <div>
                <label className="text-xs text-white/50 mb-2 block">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {STRATEGY_TYPES.map(t=>(
                    <button type="button" key={t.value} onClick={()=>setF('type',t.value)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all ${form.type===t.value?'border-purple-500/50 bg-purple-500/15':'border-white/5 hover:border-white/10'}`}>
                      <span className="text-lg">{t.icon}</span>
                      <span className={form.type===t.value?'text-purple-300 text-[10px]':'text-white/50 text-[10px]'}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="text-xs text-white/50 mb-1.5 block">Description</label>
                <textarea className="sabi-input resize-none" rows={3} value={form.description} onChange={e=>setF('description',e.target.value)}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-white/50 mb-1.5 block">Start Date</label>
                  <input type="date" className="sabi-input text-sm" value={form.start_date} onChange={e=>setF('start_date',e.target.value)}/></div>
                <div><label className="text-xs text-white/50 mb-1.5 block">End Date</label>
                  <input type="date" className="sabi-input text-sm" value={form.end_date} onChange={e=>setF('end_date',e.target.value)}/></div>
              </div>
              <div><label className="text-xs text-white/50 mb-1.5 block">Budget (₦)</label>
                <input type="number" className="sabi-input text-sm" placeholder="e.g. 500000" value={form.budget} onChange={e=>setF('budget',e.target.value)}/></div>
              {editId && <div><label className="text-xs text-white/50 mb-1.5 block">Status</label>
                <select className="sabi-input text-sm" value={form.status} onChange={e=>setF('status',e.target.value)}>
                  {['draft','active','paused','completed','archived'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select></div>}
            </div>
            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={save} disabled={saving||!form.title}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {saving?<><Loader2 className="w-4 h-4 animate-spin"/>{editId?'Saving…':'Creating…'}</>:<><Check className="w-4 h-4"/>{editId?'Save Changes':'Create Strategy'}</>}
              </button>
              <button onClick={()=>setShowForm(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── P&L modal ──────────────────────────────────────── */}
      {pnlStrategyId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-amber-500/25 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <DollarSign className="w-4 h-4 text-amber-400"/>
                  <h2 className="text-base font-bold text-white">Project P&L</h2>
                </div>
                <p className="text-xs text-white/30">This is a New Project — set the expected revenue and cost</p>
              </div>
              <button onClick={() => setPnlStrategyId(null)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Expected Revenue (₦) *</label>
                <input type="number" className="sabi-input"
                  placeholder="What will the agency charge the client?"
                  value={pnlForm.expected_revenue}
                  onChange={e => setPnlForm(p => ({ ...p, expected_revenue: e.target.value }))}/>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Estimated Cost (₦) *</label>
                <input type="number" className="sabi-input"
                  placeholder="Cost to deliver this project"
                  value={pnlForm.estimated_cost}
                  onChange={e => setPnlForm(p => ({ ...p, estimated_cost: e.target.value }))}/>
                {costSuggestion && (
                  <button type="button"
                    onClick={() => setPnlForm(p => ({ ...p, estimated_cost: String(costSuggestion.suggestedCost) }))}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors mt-1.5">
                    💡 Use suggested: ₦{costSuggestion.suggestedCost.toLocaleString()}
                    {' '}({costSuggestion.totalHours}h × ₦{costSuggestion.hourlyRate.toLocaleString()}/hr)
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Invoice Due Date</label>
                <input type="date" className="sabi-input text-sm"
                  value={pnlForm.due_date}
                  onChange={e => setPnlForm(p => ({ ...p, due_date: e.target.value }))}/>
                <p className="text-xs text-white/20 mt-1">Defaults to 30 days from today if left blank</p>
              </div>

              {pnlForm.expected_revenue && pnlForm.estimated_cost && (
                <div className="bg-white/3 border border-white/8 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs text-white/40">Gross Margin</span>
                  <span className={`text-sm font-bold ${
                    (parseFloat(pnlForm.expected_revenue) - parseFloat(pnlForm.estimated_cost)) >= 0
                      ? 'text-green-400' : 'text-red-400'
                  }`}>
                    ₦{(parseFloat(pnlForm.expected_revenue) - parseFloat(pnlForm.estimated_cost)).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={savePnl}
                disabled={savingPnl || !pnlForm.expected_revenue || !pnlForm.estimated_cost}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {savingPnl ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : <><Check className="w-4 h-4"/>Save P&L</>}
              </button>
              <button onClick={() => setPnlStrategyId(null)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Strategy list ─────────────────────────────────── */}
      {loading ? <LoadingPage/> : items.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No strategies yet"
          description='Click "Generate with ARIA" to create a full strategy automatically, or add one manually.'
          action={{ label:'Generate with ARIA', onClick:()=>{setShowAI(true);setError('');} }}/>
      ) : (
        <div className="space-y-3">
          {items.map(s => {
            const icon  = TYPE_META[s.type] ?? '📌';
            const isOpen = expanded === s.id;
            const content = s.content ?? {};

            return (
              <div key={s.id} className="sabi-card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full flex items-start gap-3 p-5 text-left hover:bg-white/2 transition-all">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="font-semibold text-white">{s.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge label={s.status} color={STATUS_COLOR[s.status]??'gray'}/>
                        {s.client_status === 'sent'     && <Badge label="Sent to Client"  color="blue"/>}
                        {s.client_status === 'approved' && <Badge label="Client Approved" color="green"/>}
                        {s.content && !s.content.raw    && <Badge label="AI Generated"    color="purple"/>}
                        {s.pnl_status === 'pending'   && <Badge label="⚠️ P&L Pending" color="amber"/>}
                        {s.pnl_status === 'completed' && <Badge label={`💰 ₦${Number(s.expected_revenue).toLocaleString()}`} color="green"/>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {s.budget && <span className="text-xs text-white/30">₦{Number(s.budget).toLocaleString()}</span>}
                      {s.start_date && <span className="text-xs text-white/25 flex items-center gap-1"><Calendar className="w-3 h-3"/>{s.start_date} → {s.end_date}</span>}
                    </div>
                  </div>
                  {isOpen?<ChevronUp className="w-4 h-4 text-white/20 flex-shrink-0 mt-1"/>:<ChevronDown className="w-4 h-4 text-white/20 flex-shrink-0 mt-1"/>}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
                    {/* AI-generated content sections */}
                    {content.executive_summary && (
                      <div>
                        <p className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">Executive Summary</p>
                        <p className="text-sm text-white/65 leading-relaxed">{content.executive_summary}</p>
                      </div>
                    )}
                    {content.objectives?.length > 0 && (
                      <div>
                        <p className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">Objectives</p>
                        <ul className="space-y-1">{content.objectives.map((o:string,i:number)=><li key={i} className="text-sm text-white/60 flex items-start gap-2"><span className="text-purple-400 flex-shrink-0">✓</span>{o}</li>)}</ul>
                      </div>
                    )}
                    {content.key_messages?.length > 0 && (
                      <div>
                        <p className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">Key Messages</p>
                        <div className="flex flex-wrap gap-2">{content.key_messages.map((m:string,i:number)=><span key={i} className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full">{m}</span>)}</div>
                      </div>
                    )}
                    {content.channels?.length > 0 && (
                      <div>
                        <p className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-2">Channels</p>
                        <div className="grid grid-cols-2 gap-2">
                          {content.channels.map((c:any,i:number)=>(
                            <div key={i} className="bg-white/3 border border-white/6 rounded-xl p-3">
                              <p className="text-sm font-medium text-white">{c.name}</p>
                              <p className="text-xs text-white/40 mt-0.5">{c.role}</p>
                              <p className="text-xs text-white/25 mt-1 flex items-center gap-1"><Clock className="w-3 h-3"/>{c.frequency}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {content.nigerian_market_notes && (
                      <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                        <p className="text-xs text-green-400 font-semibold mb-2">🇳🇬 Nigerian Market Notes</p>
                        <p className="text-sm text-white/60">{content.nigerian_market_notes}</p>
                      </div>
                    )}
                    {s.description && !content.executive_summary && (
                      <p className="text-sm text-white/60 leading-relaxed">{s.description}</p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/5">
                      <button onClick={() => openEdit(s)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
                        <Pencil className="w-3.5 h-3.5"/> Edit
                      </button>
                      <button onClick={() => generateTasks(s.id)} disabled={genTasksId===s.id}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50">
                        {genTasksId===s.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<ListTodo className="w-3.5 h-3.5"/>}
                        Generate Tasks
                      </button>
                      {s.client_status !== 'sent' && s.client_status !== 'approved' && (
                        <button onClick={() => sendToClient(s.id)} disabled={sendingId===s.id}
                          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50">
                          {sendingId===s.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Send className="w-3.5 h-3.5"/>}
                          Send to Client
                        </button>
                      )}
                      {s.pnl_status === 'pending' && (
                        <button onClick={() => openPnl(s)}
                          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium">
                          <DollarSign className="w-3.5 h-3.5"/> Set P&L
                        </button>
                      )}
                      {s.pnl_status === 'completed' && (
                        <button onClick={() => openPnl(s)}
                          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
                          <DollarSign className="w-3.5 h-3.5"/> View P&L
                        </button>
                      )}
                      <button onClick={() => del(s.id, s.title)}
                        className="flex items-center gap-1.5 text-xs text-red-400/40 hover:text-red-400 transition-colors ml-auto">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
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
