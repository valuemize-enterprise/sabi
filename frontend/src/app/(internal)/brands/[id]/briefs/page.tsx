'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, FileText, Loader2, X, Check, ChevronDown,
  ChevronUp, User, Clock, AlertCircle, Sparkles, Brain
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const TYPE_META: Record<string,{label:string;icon:string}> = {
  campaign:     { label:'Campaign',     icon:'🚀' },
  content:      { label:'Content',      icon:'✍️'  },
  design:       { label:'Design',       icon:'🎨' },
  strategy:     { label:'Strategy',     icon:'🧠' },
  social_media: { label:'Social Media', icon:'📱' },
  ads:          { label:'Paid Ads',     icon:'📣' },
  event:        { label:'Event',        icon:'🎉' },
  general:      { label:'General',      icon:'📋' },
};

const STATUS_FLOW = [
  { value:'submitted',    label:'Submitted',    color:'blue'   },
  { value:'acknowledged', label:'Acknowledged', color:'purple' },
  { value:'in_review',    label:'In Review',    color:'amber'  },
  { value:'accepted',     label:'Accepted',     color:'green'  },
  { value:'rejected',     label:'Rejected',     color:'red'    },
  { value:'completed',    label:'Completed',    color:'green'  },
];

const PRIORITY_COLOR: Record<string,string> = {
  low:'text-white/30 border-white/10',
  normal:'text-blue-400 border-blue-500/20',
  high:'text-amber-400 border-amber-500/20',
  urgent:'text-red-400 border-red-500/20',
};

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

export default function BrandBriefsPage() {
  const { id: brandId } = useParams<{ id: string }>();

  const [briefs, setBriefs]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [teamMembers, setTeam] = useState<any[]>([]);
  const [showConvert, setShowConvert] = useState<string | null>(null);
  const [convertForm, setConvertForm] = useState({ assignee_id:'', priority:'medium', due_date:'' });
  const [noteText, setNoteText] = useState<Record<string,string>>({});
  const [brandScope, setBrandScope] = useState('');
  const [classifying, setClassifying] = useState<string | null>(null);
  const [strategyMap, setStrategyMap] = useState<Record<string, any>>({});

  useEffect(() => {
    Promise.all([
      api(`/api/agency/briefs?brand_id=${brandId}&limit=50`),
      api(`/api/agency/brands/${brandId}/team`),
      api(`/api/agency/strategies?brand_id=${brandId}&limit=100`),
    ]).then(([br, tr, sr]: any) => {
      setBriefs(br.data ?? []);
      setTeam((tr.data?.team ?? []).map((m:any) => m.users).filter(Boolean));
      // Map strategies by brief_id for quick lookup
      const map: Record<string, any> = {};
      (sr.data ?? []).forEach((s: any) => { if (s.brief_id) map[s.brief_id] = s; });
      setStrategyMap(map);
    }).catch(() => {}).finally(() => setLoading(false));

    api(`/api/agency/brands/${brandId}/financials`)
      .then((r:any) => setBrandScope(r.data?.financials?.retainer_scope ?? ''))
      .catch(() => {});
  }, [brandId]);

  const updateStatus = async (briefId: string, status: string) => {
    setUpdating(briefId+'_'+status);
    try {
      await api(`/api/agency/briefs/${briefId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_notes: noteText[briefId] || null }),
      });
      setBriefs(p => p.map(b => b.id === briefId ? { ...b, status } : b));
    } catch (err: any) { toast.error(err.message); }
    finally { setUpdating(null); }
  };

  const convertToTask = async (briefId: string) => {
    setConverting(briefId);
    try {
      const res: any = await api(`/api/agency/briefs/${briefId}/convert-task`, {
        method: 'POST',
        body: JSON.stringify(convertForm),
      });
      setBriefs(p => p.map(b => b.id === briefId ? { ...b, status:'accepted' } : b));
      setShowConvert(null);
      toast.success(`Task created: "${res.data.task.title}" — The assignee has been notified.`);
    } catch (err: any) { toast.error(err.message); }
    finally { setConverting(null); }
  };

  const classify = async (briefId: string, work_type: string) => {
    setClassifying(briefId);
    try {
      await api(`/api/agency/briefs/${briefId}/classify`, {
        method: 'PATCH', body: JSON.stringify({ work_type }),
      });
      setBriefs(p => p.map(b => b.id === briefId ? { ...b, work_type } : b));
    } catch (err:any) { toast.error(err.message); }
    finally { setClassifying(null); }
  };

  const pendingCount = briefs.filter(b => b.status === 'submitted').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Client Briefs"
        breadcrumb={[{label:'Brands',href:'/brands'},{label:'Brand',href:`/brands/${brandId}`}]}/>
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Client Briefs</h1>
          <p className="text-sm text-white/40 mt-0.5">{briefs.length} brief{briefs.length!==1?'s':''} received</p>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0"/>
          <p className="text-sm text-white">
            <strong className="text-amber-400">{pendingCount} new brief{pendingCount!==1?'s':''}</strong> waiting for acknowledgement
          </p>
        </div>
      )}

      {loading ? <LoadingPage/> : briefs.length === 0 ? (
        <EmptyState icon={FileText} title="No briefs yet"
          description="When clients submit briefs from their portal, they'll appear here."/>
      ) : (
        <div className="space-y-3">
          {briefs.map(b => {
            const tm   = TYPE_META[b.brief_type] ?? { label: b.brief_type, icon:'📋' };
            const sc   = STATUS_FLOW.find(s => s.value === b.status);
            const isOpen = expanded === b.id;
            const ai   = b.metadata ?? {};
            const linkedStrategy = strategyMap[b.id];

            return (
              <div key={b.id} className={`sabi-card overflow-hidden ${b.status==='submitted'?'border-amber-500/20':''}`}>
                {/* Header */}
                <button onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-start gap-3 p-5 text-left hover:bg-white/2 transition-all">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{tm.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-white">{b.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {b.clients && <span className="text-xs text-white/40 flex items-center gap-1"><User className="w-3 h-3"/>{b.clients.full_name}</span>}
                          <Badge label={tm.label} color="blue"/>
                          {sc && <Badge label={sc.label} color={sc.color}/>}
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PRIORITY_COLOR[b.priority]}`}>{b.priority}</span>
                          {b.work_type === 'new_project' && linkedStrategy && (
                            linkedStrategy.pnl_status === 'completed'
                              ? <Badge label={`P&L ✓ ₦${Number(linkedStrategy.expected_revenue||0).toLocaleString('en-NG')}`} color="green"/>
                              : <Badge label="P&L Pending" color="amber"/>
                          )}
                          {b.deadline && <span className="text-xs text-white/25 flex items-center gap-1"><Clock className="w-3 h-3"/>Due: {b.deadline}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-white/20 flex-shrink-0">
                        {new Date(b.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}
                      </span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-white/20 flex-shrink-0 mt-1"/> : <ChevronDown className="w-4 h-4 text-white/20 flex-shrink-0 mt-1"/>}
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-5">
                    {/* Brief description */}
                    <div>
                      <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Brief</p>
                      <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{b.description}</p>
                    </div>

                    {/* ARIA insights */}
                    {Object.keys(ai).length > 0 && (
                      <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Brain className="w-3.5 h-3.5 text-purple-400"/>
                          <span className="text-xs text-purple-400 font-semibold">ARIA Brief Analysis</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {ai.core_objective && (
                            <div><p className="text-white/30 mb-0.5">Core Objective</p><p className="text-white/70">{ai.core_objective}</p></div>
                          )}
                          {ai.complexity && (
                            <div><p className="text-white/30 mb-0.5">Complexity</p><p className="text-white/70 capitalize">{ai.complexity}</p></div>
                          )}
                          {ai.estimated_timeline && (
                            <div><p className="text-white/30 mb-0.5">Est. Timeline</p><p className="text-white/70">{ai.estimated_timeline}</p></div>
                          )}
                          {ai.suggested_strategy_type && (
                            <div><p className="text-white/30 mb-0.5">Strategy Type</p><p className="text-white/70 capitalize">{ai.suggested_strategy_type}</p></div>
                          )}
                        </div>
                        {ai.key_deliverables?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-white/30 text-xs mb-1">Key Deliverables</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ai.key_deliverables.map((d:string,i:number) => (
                                <span key={i} className="text-xs bg-white/5 border border-white/10 text-white/50 px-2 py-0.5 rounded-full">{d}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {ai.questions_to_ask?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-white/30 text-xs mb-1">Clarifying Questions to Ask</p>
                            <ul className="space-y-0.5">
                              {ai.questions_to_ask.map((q:string,i:number) => (
                                <li key={i} className="text-xs text-white/50 flex items-start gap-1.5"><span className="text-white/20 flex-shrink-0">→</span>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Classification */}
                    <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                          Classification — Is this Retainer Work or a New Project?
                        </p>
                        {b.work_type && b.work_type !== 'unclassified' && (
                          <Badge
                            label={b.work_type === 'new_project' ? '🚀 New Project' : '📋 Retainer'}
                            color={b.work_type === 'new_project' ? 'purple' : 'blue'}
                          />
                        )}
                      </div>

                      {/* P&L status for new projects */}
                      {b.work_type === 'new_project' && linkedStrategy && (
                        <div className={`rounded-lg p-3 mb-3 border ${
                          linkedStrategy.pnl_status === 'completed'
                            ? 'bg-green-500/6 border-green-500/15'
                            : 'bg-amber-500/6 border-amber-500/15'
                        }`}>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-white/50">P&L Status</p>
                            {linkedStrategy.pnl_status === 'completed' ? (
                              <span className="text-xs text-green-400 font-medium">Completed</span>
                            ) : (
                              <span className="text-xs text-amber-400 font-medium">Pending — fill in Strategies page</span>
                            )}
                          </div>
                          {linkedStrategy.pnl_status === 'completed' && (
                            <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                              <div><p className="text-white/30">Revenue</p><p className="text-white/70 font-medium">₦{Number(linkedStrategy.expected_revenue||0).toLocaleString('en-NG')}</p></div>
                              <div><p className="text-white/30">Cost</p><p className="text-white/70 font-medium">₦{Number(linkedStrategy.estimated_cost||0).toLocaleString('en-NG')}</p></div>
                              <div><p className="text-white/30">Margin</p><p className={`font-medium ${(linkedStrategy.expected_revenue-linkedStrategy.estimated_cost)>=0?'text-green-400':'text-red-400'}`}>₦{Number((linkedStrategy.expected_revenue||0)-(linkedStrategy.estimated_cost||0)).toLocaleString('en-NG')}</p></div>
                            </div>
                          )}
                        </div>
                      )}

                      {brandScope && (
                        <div className="bg-blue-500/6 border border-blue-500/15 rounded-lg p-3 mb-3">
                          <p className="text-[10px] text-blue-400 font-medium mb-1">📎 Documented Retainer Scope (for reference)</p>
                          <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{brandScope}</p>
                        </div>
                      )}

                      {b.work_type === 'new_project' && linkedStrategy && linkedStrategy.pnl_status !== 'completed' && (
                        <Link href={`/brands/${brandId}/strategies`}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors">
                          → Go to Strategies to fill P&L
                        </Link>
                      )}

                      {!brandScope && (
                        <p className="text-xs text-amber-400/70 mb-3">
                          ⚠️ No retainer scope documented for this brand yet. Add one in Financials before classifying to avoid disputes.
                        </p>
                      )}

                      <p className="text-xs text-white/25 mb-3">
                        Rule of thumb: if this brief requires a new strategy, it is a New Project — not Retainer.
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={() => classify(b.id, 'retainer')}
                          disabled={classifying === b.id}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg border transition-all disabled:opacity-50 ${
                            b.work_type === 'retainer'
                              ? 'border-blue-500/40 bg-blue-500/15 text-blue-300 font-medium'
                              : 'border-white/8 text-white/40 hover:border-blue-500/25 hover:text-blue-300'
                          }`}
                        >
                          📋 Retainer Work
                        </button>
                        <button
                          onClick={() => classify(b.id, 'new_project')}
                          disabled={classifying === b.id}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg border transition-all disabled:opacity-50 ${
                            b.work_type === 'new_project'
                              ? 'border-purple-500/40 bg-purple-500/15 text-purple-300 font-medium'
                              : 'border-white/8 text-white/40 hover:border-purple-500/25 hover:text-purple-300'
                          }`}
                        >
                          🚀 New Project
                        </button>
                      </div>
                    </div>

                    {/* Admin note */}
                    <div>
                      <label className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2 block">Note to Client <span className="text-white/15">(optional — shown to them on status update)</span></label>
                      <textarea className="sabi-input resize-none text-sm" rows={2}
                        placeholder="e.g. Brief received. We'll review and get back within 2 business days."
                        value={noteText[b.id] ?? b.admin_notes ?? ''}
                        onChange={e => setNoteText(p => ({ ...p, [b.id]: e.target.value }))}/>
                    </div>

                    {/* Status actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-white/25 w-full mb-1">Update status:</p>
                      {STATUS_FLOW.filter(s => s.value !== 'submitted').map(s => (
                        <button key={s.value} onClick={() => updateStatus(b.id, s.value)}
                          disabled={b.status === s.value || !!updating}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-40 ${
                            b.status === s.value
                              ? `bg-${s.color}-500/15 text-${s.color}-400 border-${s.color}-500/25 font-medium`
                              : 'border-white/8 text-white/40 hover:border-white/20 hover:text-white'
                          }`}>
                          {updating === b.id+'_'+s.value ? <Loader2 className="w-3 h-3 animate-spin"/> : b.status === s.value ? <Check className="w-3 h-3"/> : null}
                          {s.label}
                        </button>
                      ))}
                    </div>

                    {/* Convert to task */}
                    {!['rejected','completed'].includes(b.status) && (
                      <div>
                        {showConvert === b.id ? (
                          <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-4">
                            <p className="text-xs text-purple-400 font-semibold mb-3">Convert to Task — Choose Assignee</p>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">Assign to</label>
                                <select className="sabi-input text-sm"
                                  value={convertForm.assignee_id}
                                  onChange={e => setConvertForm(p=>({...p,assignee_id:e.target.value}))}>
                                  <option className='bg-black' value="">Unassigned</option>
                                  {teamMembers.map(m => <option className='bg-black' key={m.id} value={m.id}>{m.full_name}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-white/40 mb-1 block">Priority</label>
                                <select className="sabi-input text-sm"
                                  value={convertForm.priority}
                                  onChange={e => setConvertForm(p=>({...p,priority:e.target.value}))}>
                                  {['low','medium','high','urgent'].map(v=><option className='bg-black' key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="mb-3">
                              <label className="text-xs text-white/40 mb-1 block">Due Date</label>
                              <input type="date" className="sabi-input text-sm"
                                value={convertForm.due_date}
                                onChange={e => setConvertForm(p=>({...p,due_date:e.target.value}))}/>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => convertToTask(b.id)} disabled={!!converting}
                                className="sabi-btn-primary flex items-center gap-1.5 px-4 py-2 text-sm flex-1 justify-center disabled:opacity-50">
                                {converting===b.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Check className="w-3.5 h-3.5"/>}
                                Create Task & Notify Staff
                              </button>
                              <button onClick={() => setShowConvert(null)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowConvert(b.id)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all">
                            <Sparkles className="w-3.5 h-3.5"/> Convert to Task
                          </button>
                        )}
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
