'use client';

import { useState, useEffect } from 'react';
import { PenLine, Plus, X, Loader2, Check, Upload, FileText, Paperclip, Target, Clock, Building2, ChevronDown, AlertCircle } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { brands as brandsApi, goals as goalsApi } from '@/lib/api';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

// ── Work categories ───────────────────────────────────────────
const CATEGORIES = [
  { value:'strategy',         label:'Strategy & Planning',    icon:'📊' },
  { value:'content_copy',     label:'Copywriting & Content',  icon:'✍️'  },
  { value:'design',           label:'Design & Creative',      icon:'🎨' },
  { value:'social_media',     label:'Social Media',           icon:'📱' },
  { value:'analytics',        label:'Analytics & Reporting',  icon:'📈' },
  { value:'video',            label:'Video & Photography',    icon:'🎬' },
  { value:'community',        label:'Community Management',   icon:'💬' },
  { value:'client_comms',     label:'Client Communication',   icon:'📧' },
  { value:'ads',              label:'Paid Advertising',       icon:'📣' },
  { value:'seo',              label:'SEO & Digital',          icon:'🔍' },
  { value:'other',            label:'Other',                  icon:'📌' },
];

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (path: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${path}`, {
    ...opts, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{}) },
  }).then(async r => { const b=await r.json(); if(!r.ok) throw new Error(b.message); return b; });

interface LogForm { brand_id:string; category:string; title:string; description:string; goal_id:string; hours:string; }
const EMPTY_FORM: LogForm = { brand_id:'', category:'', title:'', description:'', goal_id:'', hours:'' };

export default function MyWorkPage() {
  const { user } = useAgencyStore();
  const [logs, setLogs]         = useState<any[]>([]);
  const [myBrands, setMyBrands] = useState<any[]>([]);
  const [brandGoals, setBrandGoals] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<LogForm>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [files, setFiles]       = useState<File[]>([]);
  const [filter, setFilter]     = useState<'all'|'week'|'month'>('week');
  const [brandFilter, setBrandFilter] = useState('');

  const setF = (k: keyof LogForm, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    setError(null);
    Promise.all([
      api('/api/agency/staff/me/brands'),
      api('/api/agency/work-logs?limit=100'),
    ]).then(([b, l]) => { setMyBrands(b.data??[]); setLogs(l.data??[]); })
      .catch((e: any) => setError(e.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // Load goals when brand changes
  useEffect(() => {
    if (!form.brand_id) { setBrandGoals([]); return; }
    goalsApi.list({ brand_id: form.brand_id, status:'active' }).then((r:any) => setBrandGoals(r.data??[])).catch((e:any) => setError(e.message||'Failed to load goals'));
  }, [form.brand_id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand_id || !form.category || !form.title) return;
    setSaving(true); setError(null);
    try {
      const res: any = await api('/api/agency/work-logs', {
        method:'POST', body: JSON.stringify({ ...form, hours: Number(form.hours)||0 })
      });
      setLogs(p => [res.data, ...p]);
      setForm(EMPTY_FORM); setFiles([]); setShowForm(false);
    } catch (err: any) { setError(err.message || 'Failed to log work'); }
    finally { setSaving(false); }
  };

  // Filter logs
  const now = new Date();
  const filtered = logs.filter(l => {
    if (brandFilter && l.brand_id !== brandFilter) return false;
    if (filter === 'week') { const d = new Date(l.created_at); return (now.getTime()-d.getTime()) < 7*86400000; }
    if (filter === 'month') { const d = new Date(l.created_at); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }
    return true;
  });

  const totalHours = filtered.reduce((s,l) => s+(l.hours??0), 0);
  const catCount   = filtered.reduce((acc:any,l) => ({ ...acc,[l.category]:(acc[l.category]||0)+1 }), {});
  const topCat     = Object.entries(catCount).sort((a:any,b:any)=>b[1]-a[1])[0];

  const catInfo = (v: string) => CATEGORIES.find(c => c.value===v);

  if (loading) return <LoadingPage label="Loading your work log…"/>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-white">My Work</h1>
          <p className="text-sm text-white/40 mt-1">Log everything you do for every brand — this powers client reports</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="sabi-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus className="w-4 h-4"/> Log Work
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="sabi-card p-4 text-center">
          <p className="text-2xl font-black text-white">{filtered.length}</p>
          <p className="text-xs text-white/40 mt-1">Entries logged</p>
        </div>
        <div className="sabi-card p-4 text-center">
          <p className="text-2xl font-black text-white">{totalHours}h</p>
          <p className="text-xs text-white/40 mt-1">Hours recorded</p>
        </div>
        <div className="sabi-card p-4 text-center">
          <p className="text-2xl font-black text-white">{topCat?.[0] ? catInfo(String(topCat[0]))?.icon??'📌' : '—'}</p>
          <p className="text-xs text-white/40 mt-1">{topCat?.[0] ? catInfo(String(topCat[0]))?.label : 'No entries'}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-300 transition-colors text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
          {(['week','month','all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-all ${filter===f?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}>
              This {f === 'all' ? 'All Time' : f}
            </button>
          ))}
        </div>
        <select className="sabi-input w-40 text-sm" value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}>
          <option className="bg-black" value="">All brands</option>
          {myBrands.map((b:any) => <option  className="bg-black" key={b.brand_id??b.id} value={b.brand_id??b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Log form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white">Log Work</h2>
                <p className="text-xs text-white/30 mt-0.5">Record what you did — this builds the client's monthly report</p>
              </div>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              {/* Brand */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Brand *</label>
                <select className="sabi-input" required value={form.brand_id} onChange={e=>setF('brand_id',e.target.value)}>
                  <option className="bg-black" value="">Select brand…</option>
                  {myBrands.map((b:any) => <option className="bg-black" key={b.brand_id??b.id} value={b.brand_id??b.id}>{b.name}</option>)}
                </select>
                {myBrands.length===0 && <p className="text-xs text-amber-400 mt-1">Not assigned to any brands yet</p>}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Work Type *</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.value} onClick={() => setF('category',c.value)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-all ${
                        form.category===c.value?'border-purple-500/50 bg-purple-500/15 text-white':'border-white/5 hover:border-white/10 text-white/50 hover:text-white'
                      }`}>
                      <span className="text-sm flex-shrink-0">{c.icon}</span>
                      <span className="leading-tight">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task title */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">What did you do? *</label>
                <input className="sabi-input" required placeholder="e.g. Wrote 5 Instagram captions for the Eid campaign"
                  value={form.title} onChange={e=>setF('title',e.target.value)} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">More detail <span className="text-white/20">(optional)</span></label>
                <textarea className="sabi-input resize-none" rows={3} placeholder="Outcomes, metrics, context..."
                  value={form.description} onChange={e=>setF('description',e.target.value)} />
              </div>

              {/* Link to goal + hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Linked Goal <span className="text-white/20">(optional)</span></label>
                  <select className="sabi-input text-sm" value={form.goal_id} onChange={e=>setF('goal_id',e.target.value)}>
                    <option className="bg-black" value="">No goal</option>
                    {brandGoals.map((g:any) => <option className="bg-black" key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Hours Spent</label>
                  <input type="number" min="0" max="24" step="0.5" className="sabi-input text-sm" placeholder="e.g. 2.5"
                    value={form.hours} onChange={e=>setF('hours',e.target.value)} />
                </div>
              </div>

              {/* File upload */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Upload Evidence <span className="text-white/20">(optional — designs, docs, screenshots)</span></label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border border-dashed cursor-pointer transition-all ${files.length?'border-purple-500/30 bg-purple-500/5':'border-white/10 hover:border-white/20'}`}>
                  <Paperclip className="w-4 h-4 text-white/30 flex-shrink-0"/>
                  <span className="text-sm text-white/40">{files.length?`${files.length} file${files.length!==1?'s':''} selected`:'Click to attach files'}</span>
                  <input type="file" multiple className="sr-only" onChange={e=>setFiles(Array.from(e.target.files??[]))}/>
                </label>
                {files.length>0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((f,i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                        <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0"/>
                        {f.name} <span className="text-white/25">({(f.size/1024).toFixed(0)}KB)</span>
                        <button type="button" onClick={() => setFiles(p=>p.filter((_,j)=>j!==i))} className="text-white/25 hover:text-red-400 ml-auto"><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving||!form.brand_id||!form.category||!form.title}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  {saving?<><Loader2 className="w-4 h-4 animate-spin"/>Saving…</>:<><Check className="w-4 h-4"/>Log Work</>}
                </button>
                <button type="button" onClick={()=>{setShowForm(false);setForm(EMPTY_FORM);}}
                  className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Work log list */}
      {filtered.length === 0 ? (
        <EmptyState icon={PenLine} title={filter==='week'?'No work logged this week':'No entries found'}
          description="Log your work so it shows up in client reports and tracks your contributions to each brand."
          action={{ label:'Log First Entry', onClick:()=>setShowForm(true) }}/>
      ) : (
        <div className="space-y-3">
          {filtered.map((log, i) => {
            const cat = catInfo(log.category);
            return (
              <div key={log.id??i} className="sabi-card p-5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5 flex-shrink-0">{cat?.icon??'📌'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{log.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-white/40">{log.brands?.name}</span>
                      {cat && <Badge label={cat.label} color="purple"/>}
                      {log.goals?.title && <span className="text-xs text-green-400/70">→ {log.goals.title}</span>}
                    </div>
                    {log.description && <p className="text-xs text-white/40 mt-1.5 leading-relaxed">{log.description}</p>}
                    <div className="flex items-center gap-4 mt-2">
                      {log.hours > 0 && <span className="text-xs text-white/30 flex items-center gap-1"><Clock className="w-3 h-3"/>{log.hours}h</span>}
                      <span className="text-xs text-white/25">{new Date(log.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/15 text-center mt-6">
        Every entry you log becomes the raw material for ARIA to generate client reports.
        Log accurately — it builds trust.
      </p>
    </div>
  );
}
