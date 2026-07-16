'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Loader2, FileText, Clock, Check, AlertCircle, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const BRIEF_TYPES = [
  { value:'campaign',     label:'Campaign',        icon:'🚀', desc:'New marketing campaign' },
  { value:'content',      label:'Content',         icon:'✍️',  desc:'Content creation request' },
  { value:'design',       label:'Design',          icon:'🎨', desc:'Design or creative work' },
  { value:'strategy',     label:'Strategy',        icon:'🧠', desc:'Strategic planning' },
  { value:'social_media', label:'Social Media',    icon:'📱', desc:'Social media request' },
  { value:'ads',          label:'Paid Ads',        icon:'📣', desc:'Advertising campaign' },
  { value:'event',        label:'Event',           icon:'🎉', desc:'Event marketing' },
  { value:'general',      label:'General',         icon:'📋', desc:'Other request' },
];

const PRIORITIES = [
  { value:'low',    label:'Low',    color:'text-white/40 bg-white/5 border-white/10'         },
  { value:'normal', label:'Normal', color:'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { value:'high',   label:'High',   color:'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { value:'urgent', label:'Urgent', color:'text-red-400 bg-red-500/10 border-red-500/20'    },
];

const STATUS_CONFIG: Record<string, { label:string; color:string; icon:string }> = {
  submitted:     { label:'Submitted',      color:'blue',   icon:'📤' },
  acknowledged:  { label:'Acknowledged',   color:'purple', icon:'👀' },
  in_review:     { label:'In Review',      color:'amber',  icon:'🔍' },
  accepted:      { label:'Accepted',       color:'green',  icon:'✅' },
  rejected:      { label:'Not Accepted',   color:'red',    icon:'❌' },
  completed:     { label:'Completed',      color:'green',  icon:'🎉' },
};

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts,
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{}) },
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message||`Error ${r.status}`); return b; });

const EMPTY = { title:'', description:'', brief_type:'general', priority:'normal', deadline:'' };

export default function ClientBriefsPage() {
  const { client } = useClientStore();
  const [briefs, setBriefs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    api('/api/client/briefs?limit=50')
      .then((r: any) => setBriefs(r.data ?? []))
      .catch(() => setBriefs([]))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title)       { setError('Brief title is required'); return; }
    if (!form.description) { setError('Please describe what you need'); return; }
    setSaving(true); setError('');
    try {
      const res: any = await api('/api/client/briefs', { method:'POST', body:JSON.stringify(form) });
      setBriefs(p => [res.data.brief, ...p]);
      setForm({ ...EMPTY }); setShowForm(false);
    } catch (err: any) { setError(err.message || 'Failed to submit brief'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-white">Briefs</h1>
          <p className="text-sm text-white/40 mt-1">
            Send a brief to your Cerebre team for what you need done
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setForm({ ...EMPTY }); }}
          className="sabi-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus className="w-4 h-4" /> New Brief
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-white/70">
          <strong className="text-white">How briefs work:</strong> Submit a brief and your Cerebre team will
          review it, acknowledge receipt, and get to work. You'll see updates here and receive notifications.
        </p>
      </div>

      {/* New brief modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div>
                <h2 className="text-base font-bold text-white">Submit a Brief</h2>
                <p className="text-xs text-white/30 mt-0.5">Tell your team what you need</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Brief Title *</label>
                <input className="sabi-input" required placeholder="e.g. Eid Campaign 2026 — Social Media"
                  value={form.title} onChange={e => setF('title', e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-2 block">Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {BRIEF_TYPES.map(t => (
                    <button type="button" key={t.value} onClick={() => setF('brief_type', t.value)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        form.brief_type === t.value ? 'border-purple-500/50 bg-purple-500/15' : 'border-white/5 hover:border-white/10'
                      }`}>
                      <span className="text-base">{t.icon}</span>
                      <div>
                        <p className={`text-xs font-semibold ${form.brief_type === t.value ? 'text-purple-300' : 'text-white/60'}`}>{t.label}</p>
                        <p className="text-[10px] text-white/25">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Description *</label>
                <textarea className="sabi-input resize-none" rows={5} required
                  placeholder="Describe exactly what you need. Be as specific as possible — include:
• What you want to achieve
• Target audience
• Tone / style preferences
• Any references or examples
• Deadlines or launch dates"
                  value={form.description} onChange={e => setF('description', e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Priority</label>
                  <div className="space-y-1.5">
                    {PRIORITIES.map(p => (
                      <button type="button" key={p.value} onClick={() => setF('priority', p.value)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                          form.priority === p.value ? p.color : 'border-white/5 text-white/40 hover:border-white/10'
                        }`}>
                        {form.priority === p.value && <Check className="w-3 h-3 flex-shrink-0" />}
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Deadline <span className="text-white/20">(optional)</span></label>
                  <input type="date" className="sabi-input text-sm" value={form.deadline} onChange={e => setF('deadline', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={submit} disabled={saving}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</> : <><FileText className="w-4 h-4" />Submit Brief</>}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Briefs list */}
      {loading ? <LoadingPage /> : briefs.length === 0 ? (
        <EmptyState icon={FileText} title="No briefs yet"
          description="Submit a brief to tell your Cerebre team what you need done."
          action={{ label: 'Submit First Brief', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-3">
          {briefs.map(b => {
            const sc     = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.submitted;
            const typeMeta = BRIEF_TYPES.find(t => t.value === b.brief_type);
            const priMeta  = PRIORITIES.find(p => p.value === b.priority);
            const isOpen   = expanded === b.id;
            return (
              <div key={b.id} className="sabi-card overflow-hidden">
                <button onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-start gap-3 p-5 text-left hover:bg-white/2 transition-all">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{typeMeta?.icon ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="font-semibold text-white">{b.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priMeta?.color}`}>{priMeta?.label}</span>
                        {b.work_type && b.work_type !== 'unclassified' && (
                          <Badge
                            label={b.work_type === 'new_project' ? '🚀 New Project' : '📋 Retainer Work'}
                            color={b.work_type === 'new_project' ? 'purple' : 'blue'}
                          />
                        )}
                        <Badge label={`${sc.icon} ${sc.label}`} color={sc.color} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-white/35">{typeMeta?.label}</span>
                      {b.deadline && <span className="text-xs text-white/25 flex items-center gap-1"><Clock className="w-3 h-3" />Due: {b.deadline}</span>}
                      <span className="text-xs text-white/20">{new Date(b.created_at).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-white/20 flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-white/20 flex-shrink-0 mt-1" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4">
                    <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{b.description}</p>
                    {b.work_type && b.work_type !== 'unclassified' && (
                      <div className={`mt-4 rounded-xl p-3 border ${
                        b.work_type === 'new_project'
                          ? 'bg-purple-500/8 border-purple-500/20'
                          : 'bg-blue-500/8 border-blue-500/20'
                      }`}>
                        <p className={`text-xs font-medium mb-1 ${b.work_type === 'new_project' ? 'text-purple-400' : 'text-blue-400'}`}>
                          {b.work_type === 'new_project' ? '🚀 Classified as New Project' : '📋 Classified as Retainer Work'}
                        </p>
                        <p className="text-xs text-white/40">
                          {b.work_type === 'new_project'
                            ? 'This brief requires a new strategy and will be quoted separately.'
                            : 'This brief falls within your existing retainer scope.'}
                        </p>
                      </div>
                    )}
                    {b.admin_notes && (
                      <div className="mt-4 bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
                        <p className="text-xs text-blue-400 font-medium mb-1">Note from your team:</p>
                        <p className="text-sm text-white/60">{b.admin_notes}</p>
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
