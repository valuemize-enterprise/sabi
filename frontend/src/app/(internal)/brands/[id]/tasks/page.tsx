'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Plus, X, Loader2, Check, ArrowLeft, AlertCircle,
  Clock, User, Target, Lightbulb, MessageSquare,
  Filter, LayoutGrid, List, ChevronRight
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { goals as goalsApi, strategies as stratApi } from '@/lib/api';
import { useBrandPermissions } from '@/lib/permissions';
import { AgencyTopNav }    from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{}) },
  }).then(async r => { const b=await r.json(); if(!r.ok) throw new Error(b.error||b.message); return b; });

const COLUMNS = [
  { key:'todo',        label:'To Do',         color:'border-white/10 bg-white/2',           dot:'bg-white/20'   },
  { key:'in_progress', label:'In Progress',   color:'border-blue-500/20 bg-blue-500/3',     dot:'bg-blue-500'   },
  { key:'in_review',   label:'In Review',     color:'border-amber-500/20 bg-amber-500/3',   dot:'bg-amber-500'  },
  { key:'done',        label:'Done',          color:'border-green-500/20 bg-green-500/3',   dot:'bg-green-500'  },
];

const PRIORITY_META: Record<string,{label:string;color:string;dot:string}> = {
  low:    { label:'Low',    color:'text-white/30',  dot:'bg-white/20'  },
  medium: { label:'Medium', color:'text-blue-400',  dot:'bg-blue-400'  },
  high:   { label:'High',   color:'text-amber-400', dot:'bg-amber-500' },
  urgent: { label:'Urgent', color:'text-red-400',   dot:'bg-red-500'   },
};

const EMPTY_FORM = { title:'', description:'', priority:'medium', due_date:'', assignee_id:'', strategy_id:'', goal_id:'', estimated_hours:'' };

export default function BrandTasksPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const { user }        = useAgencyStore();
  const perms           = useBrandPermissions(brandId);

  const [tasks, setTasks]       = useState<any[]>([]);
  const [teamMembers, setTeam]  = useState<any[]>([]);
  const [strategies, setStrats] = useState<any[]>([]);
  const [goals, setGoals]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<'kanban'|'list'>('kanban');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [filterAssignee, setFA] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      api(`/api/agency/tasks?brand_id=${brandId}&limit=200`),
      api(`/api/agency/brands/${brandId}/team`),
      stratApi.list({ brand_id: brandId, status:'active', limit:'10' }),
      goalsApi.list({ brand_id: brandId, status:'active', limit:'20' }),
    ]).then(([tr, teamr, sr, gr]: any) => {
      setTasks(tr.data ?? []);
      setTeam((teamr.data?.team ?? []).map((m:any) => ({ ...m.users, roles_on_brand: m.roles_on_brand })));
      setStrats(sr.data ?? []);
      setGoals(gr.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [brandId]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const res: any = await api('/api/agency/tasks', {
        method: 'POST',
        body: JSON.stringify({
          brand_id: brandId,
          title: form.title, description: form.description || null,
          priority: form.priority, due_date: form.due_date || null,
          assignee_id: form.assignee_id || null,
          strategy_id: form.strategy_id || null,
          goal_id:     form.goal_id     || null,
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
        }),
      });
      setTasks(p => [res.data.task, ...p]);
      setForm({ ...EMPTY_FORM }); setShowForm(false);
    } catch (err: any) { setError(err.message || 'Failed to create task'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    try {
      await api(`/api/agency/tasks/${taskId}/status`, { method:'PUT', body:JSON.stringify({ status: newStatus }) });
      setTasks(p => p.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err: any) { toast.error(err.message); }
  };

  const generateFromStrategy = async (strategyId: string) => {
    if (!confirm('Generate tasks from this strategy using ARIA? This will create multiple tasks assigned to the team.')) return;
    setGeneratingTasks(true);
    try {
      const res: any = await api('/api/agency/tasks/bulk-create', {
        method: 'POST',
        body: JSON.stringify({ strategy_id: strategyId, brand_id: brandId }),
      });
      setTasks(p => [...(res.data.tasks ?? []), ...p]);
      toast.success(`${res.data.count} tasks generated from strategy and assigned to the team!`);
    } catch (err: any) { toast.error(err.message || 'Failed to generate tasks'); }
    finally { setGeneratingTasks(false); }
  };

  const visibleTasks = filterAssignee ? tasks.filter(t => t.assignee_id === filterAssignee) : tasks;
  const tasksByStatus = (status: string) => visibleTasks.filter(t => t.status === status);

  if (loading) return <LoadingPage label="Loading tasks…" />;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <AgencyTopNav title="Tasks" breadcrumb={[{label:'Brands',href:'/brands'},{label:'Brand',href:`/brands/${brandId}`}]}/>
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-white/40 mt-0.5">{tasks.length} tasks · {tasksByStatus('in_progress').length} in progress</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Generate from strategy */}
          {strategies.length > 0 && perms.canManage && (
            <div className="relative group">
              <button disabled={generatingTasks}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/5 transition-all disabled:opacity-50">
                {generatingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Lightbulb className="w-3.5 h-3.5"/>}
                Generate from Strategy
              </button>
              {/* Dropdown of strategies */}
              <div className="absolute right-0 top-full mt-1 w-64 bg-[#12122a] border border-white/10 rounded-xl shadow-2xl z-20 hidden group-hover:block">
                {strategies.map(s => (
                  <button key={s.id} onClick={() => generateFromStrategy(s.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left hover:bg-white/5 transition-all">
                    <Lightbulb className="w-3.5 h-3.5 text-purple-400 flex-shrink-0"/>
                    <p className="text-white/70 truncate">{s.title}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
            <button onClick={() => setView('kanban')} className={`p-1.5 rounded-lg transition-all ${view==='kanban'?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}><LayoutGrid className="w-4 h-4"/></button>
            <button onClick={() => setView('list')}   className={`p-1.5 rounded-lg transition-all ${view==='list'  ?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}><List className="w-4 h-4"/></button>
          </div>

          <button onClick={() => { setShowForm(true); setError(''); setForm({ ...EMPTY_FORM }); }}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4"/> New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <select className="sabi-input w-44 text-sm" value={filterAssignee} onChange={e => setFA(e.target.value)}>
          <option  className='bg-black' value="">All assignees</option>
          {teamMembers.map(m => <option className='bg-black' key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {/* Create task modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-base font-bold text-white">New Task</h2>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Task Title *</label>
                <input className="sabi-input" required placeholder="e.g. Write 10 Instagram captions for Eid campaign"
                  value={form.title} onChange={e => setF('title',e.target.value)} autoFocus/>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Description</label>
                <textarea className="sabi-input resize-none" rows={3} placeholder="What needs to be done, and how…"
                  value={form.description} onChange={e => setF('description',e.target.value)}/>
              </div>

              {/* Assignee — key feature */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5"/> Assign to
                </label>
                <select className="sabi-input text-sm" value={form.assignee_id} onChange={e => setF('assignee_id',e.target.value)}>
                  <option  className='bg-black' value="">Unassigned</option>
                  {teamMembers.map(m => <option className="bg-black" key={m.id} value={m.id}>{m.full_name} — {m.roles_on_brand?.[0]?.replace(/_/g,' ')??m.role?.replace(/_/g,' ')}</option>)}
                </select>
                {form.assignee_id && <p className="text-xs text-green-400/70 mt-1.5">✓ They will be notified when you save this task</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Priority</label>
                  <div className="space-y-1.5">
                    {Object.entries(PRIORITY_META).map(([v,m]) => (
                      <button type="button" key={v} onClick={() => setF('priority',v)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${form.priority===v?`${m.color} border-current bg-current/10`:'border-white/5 text-white/40 hover:border-white/10'}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`}/>
                        {m.label}
                        {form.priority===v&&<Check className="w-3 h-3 ml-auto"/>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Due Date</label>
                    <input type="date" className="sabi-input text-sm" value={form.due_date} onChange={e => setF('due_date',e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Est. Hours</label>
                    <input type="number" min="0" step="0.5" className="sabi-input text-sm" placeholder="e.g. 3"
                      value={form.estimated_hours} onChange={e => setF('estimated_hours',e.target.value)}/>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Strategy</label>
                  <select className="sabi-input text-sm" value={form.strategy_id} onChange={e => setF('strategy_id',e.target.value)}>
                    <option className="bg-black" value="">No strategy</option>
                    {strategies.map(s => <option className="bg-black" key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Goal</label>
                  <select className="sabi-input text-sm" value={form.goal_id} onChange={e => setF('goal_id',e.target.value)}>
                    <option className="bg-black" value="">No goal</option>
                    {goals.map(g => <option className="bg-black" key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-white/5">
              <button onClick={createTask} disabled={saving||!form.title}
                className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                {saving?<><Loader2 className="w-4 h-4 animate-spin"/>Creating…</>:<><Check className="w-4 h-4"/>Create Task</>}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── KANBAN VIEW ────────────────────────────────────────── */}
      {view === 'kanban' && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colTasks = tasksByStatus(col.key);
            return (
              <div key={col.key} className={`rounded-2xl border p-4 min-h-48 ${col.color}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`}/>
                  <p className="text-xs font-semibold text-white">{col.label}</p>
                  <span className="text-xs text-white/30 ml-auto">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map(t => {
                    const pri = PRIORITY_META[t.priority ?? 'medium'];
                    const assignee = teamMembers.find(m => m.id === t.assignee_id);
                    return (
                      <div key={t.id} className="bg-[#12122a] border border-white/6 rounded-xl p-3 cursor-pointer hover:border-white/15 transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-xs font-medium text-white leading-snug">{t.title}</p>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${pri.dot}`} title={pri.label}/>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {t.due_date && (
                            <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5"/>{t.due_date}
                            </span>
                          )}
                          {t.strategies && (
                            <span className="text-[10px] text-purple-400/60 flex items-center gap-0.5 truncate max-w-[80px]">
                              <Lightbulb className="w-2.5 h-2.5 flex-shrink-0"/>{t.strategies.title}
                            </span>
                          )}
                        </div>
                        {assignee && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-300">
                              {assignee.full_name?.[0]}
                            </div>
                            <span className="text-[10px] text-white/40 truncate">{assignee.full_name}</span>
                          </div>
                        )}
                        {/* Status change */}
                        <select className="w-full mt-2 text-[10px] bg-white/5 border border-white/8 rounded-lg px-2 py-1 text-white/50 hover:text-white cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                          value={t.status} onChange={e => updateStatus(t.id, e.target.value)}>
                          {COLUMNS.map(c => <option className='bg-black' key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="text-center py-6 text-white/15 text-xs">No tasks here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────── */}
      {view === 'list' && (
        tasks.length === 0 ? (
          <EmptyState icon={AlertCircle} title="No tasks yet"
            description="Create tasks, assign them to staff, and track progress."
            action={{ label:'Create First Task', onClick:()=>setShowForm(true) }}/>
        ) : (
          <div className="sabi-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Task','Assignee','Priority','Strategy','Due','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wider first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((t,i) => {
                  const pri      = PRIORITY_META[t.priority ?? 'medium'];
                  const assignee = teamMembers.find(m => m.id === t.assignee_id);
                  const statusCol = { todo:'gray', in_progress:'blue', in_review:'amber', done:'green', blocked:'red' } as const;
                  return (
                    <tr key={t.id} className={`border-b border-white/3 hover:bg-white/2 transition-all ${i%2===0?'':'bg-white/1'}`}>
                      <td className="px-4 py-3 pl-5">
                        <p className="text-sm text-white font-medium">{t.title}</p>
                        {t.strategies && <p className="text-xs text-purple-400/60 mt-0.5 flex items-center gap-1"><Lightbulb className="w-3 h-3"/>{t.strategies.title}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {assignee ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-purple-500/25 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0">{assignee.full_name?.[0]}</div>
                            <span className="text-xs text-white/60">{assignee.full_name}</span>
                          </div>
                        ) : <span className="text-xs text-white/20">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium flex items-center gap-1 ${pri.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${pri.dot}`}/>{pri.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40 max-w-[120px] truncate">{t.strategies?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-white/35">{t.due_date ?? '—'}</td>
                      <td className="px-4 py-3 pr-5">
                        <select className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/50 hover:text-white cursor-pointer transition-all"
                          value={t.status} onChange={e => updateStatus(t.id, e.target.value)}>
                          {COLUMNS.map(c => <option className='bg-black' key={c.key} value={c.key}>{c.label}</option>)}
                          <option className='bg-black' value="blocked">Blocked</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
