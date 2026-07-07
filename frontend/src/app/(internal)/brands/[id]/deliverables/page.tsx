'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, Image, Film, Check, X, AlertCircle, Loader2, Paperclip, Download, Eye } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { LoadingPage, EmptyState, Badge, PageHeader } from '@/components/ui';

const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

const FILE_TYPES = [
  { value:'copy',     label:'Copy / Content',    icon:'✍️',  color:'amber'  },
  { value:'design',   label:'Design Asset',      icon:'🎨',  color:'pink'   },
  { value:'video',    label:'Video / Animation', icon:'🎬',  color:'purple' },
  { value:'report',   label:'Report / Deck',     icon:'📊',  color:'blue'   },
  { value:'strategy', label:'Strategy Doc',      icon:'🧠',  color:'green'  },
  { value:'photo',    label:'Photo Asset',       icon:'📸',  color:'teal'   },
  { value:'other',    label:'Other',             icon:'📎',  color:'gray'   },
];

const STATUS_BADGE: Record<string,string> = { pending:'amber', approved:'green', rejected:'red' };

const tok  = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api  = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000'}${p}`, {
    ...opts, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{}) }
  }).then(async r=>{ const b=await r.json(); if(!r.ok) throw new Error(b.message); return b; });

export default function BrandDeliverablesPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const { user } = useAgencyStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role??'');

  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm]         = useState({ title:'', file_type:'copy', description:'', client_visible:false });
  const [files, setFiles]       = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [actioning, setActioning] = useState<string|null>(null);
  const [filter, setFilter]     = useState<'all'|'pending'|'approved'>('all');
  const [error, setError] = useState('');

  const setF = (k: string, v: any) => setForm(p=>({...p,[k]:v}));

  useEffect(() => {
    api(`/api/agency/deliverables?brand_id=${brandId}&limit=100`)
      .then((r:any) => setItems(r.data??[]))
      .catch(()=>setItems([]))
      .finally(()=>setLoading(false));
  }, [brandId]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title||!form.file_type) return;
    setUploading(true);
    try {
      const res: any = await api('/api/agency/deliverables', {
        method:'POST', body: JSON.stringify({ ...form, brand_id: brandId }),
      });
      setItems(p=>[res.data,...p]);
      setForm({ title:'', file_type:'copy', description:'', client_visible:false });
      setFiles([]); setShowUpload(false);
    } catch (err:any) { setError(err.message); }
    finally { setUploading(false); }
  };

  const approve = async (id: string) => {
    setActioning(id+'_approve');
    try {
      await api(`/api/agency/deliverables/${id}/approve`,{ method:'PUT' });
      setItems(p=>p.map(d=>d.id===id?{...d,status:'approved',client_visible:true}:d));
    } finally { setActioning(null); }
  };

  const reject = async (id: string) => {
    const reason = prompt('Reason for rejection (shown to staff):');
    if (!reason) return;
    setActioning(id+'_reject');
    try {
      await api(`/api/agency/deliverables/${id}/reject`,{ method:'PUT', body:JSON.stringify({reason}) });
      setItems(p=>p.map(d=>d.id===id?{...d,status:'rejected',rejection_reason:reason}:d));
    } finally { setActioning(null); }
  };

  const filtered = filter==='all' ? items : items.filter(d=>d.status===filter);
  const pending  = items.filter(d=>d.status==='pending').length;
  const approved = items.filter(d=>d.status==='approved').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      <PageHeader title="Deliverables" subtitle="Work files uploaded by the team — approved files are visible to the client"
        action={
          <button onClick={()=>setShowUpload(true)} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Upload className="w-4 h-4"/> Upload Work
          </button>
        }/>

      {/* Pending approval alert */}
      {isAdmin && pending > 0 && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0"/>
          <div className="flex-1">
            <p className="text-sm text-white"><strong className="text-amber-400">{pending} deliverable{pending!==1?'s':''}</strong> waiting for your approval</p>
            <p className="text-xs text-white/40">Approve before the client can see them in their portal</p>
          </div>
          <button onClick={()=>setFilter('pending')} className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0">Review →</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Stats + filter */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
          {([['all',`All (${items.length})`],['pending',`Pending (${pending})`],['approved',`Approved (${approved})`]] as const).map(([v,l]) => (
            <button key={v} onClick={()=>setFilter(v)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${filter===v?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div><h2 className="text-base font-bold text-white">Upload Deliverable</h2><p className="text-xs text-white/30 mt-0.5">Pending admin approval before client sees it</p></div>
              <button onClick={()=>setShowUpload(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={upload} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Title / Name *</label>
                <input className="sabi-input" required placeholder="e.g. FiberOne Q2 Social Calendar"
                  value={form.title} onChange={e=>setF('title',e.target.value)}/>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">File Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {FILE_TYPES.map(t=>(
                    <button type="button" key={t.value} onClick={()=>setF('file_type',t.value)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition-all ${
                        form.file_type===t.value?'border-purple-500/40 bg-purple-500/10 text-white':'border-white/5 hover:border-white/10 text-white/50'
                      }`}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Description <span className="text-white/20">(optional)</span></label>
                <textarea className="sabi-input resize-none" rows={2} placeholder="What's in this file?"
                  value={form.description} onChange={e=>setF('description',e.target.value)}/>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">File</label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border border-dashed cursor-pointer transition-all ${files.length?'border-purple-500/30 bg-purple-500/5':'border-white/10 hover:border-white/20'}`}>
                  <Paperclip className="w-4 h-4 text-white/30 flex-shrink-0"/>
                  <span className="text-sm text-white/40">{files.length?files[0].name:'Click to attach file'}</span>
                  <input type="file" className="sr-only" onChange={e=>setFiles(Array.from(e.target.files??[]))}/>
                </label>
                <p className="text-xs text-white/20 mt-1">Note: File storage integration required. Metadata saved now.</p>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={uploading||!form.title}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  {uploading?<><Loader2 className="w-4 h-4 animate-spin"/>Uploading…</>:<><Upload className="w-4 h-4"/>Submit for Approval</>}
                </button>
                <button type="button" onClick={()=>setShowUpload(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deliverables list */}
      {loading ? <LoadingPage/> : filtered.length===0 ? (
        <EmptyState icon={Upload} title={filter==='pending'?'No pending deliverables':'No deliverables yet'}
          description="Upload work files from your team. Admins approve them before the client can see them."
          action={{ label:'Upload First Deliverable', onClick:()=>setShowUpload(true) }}/>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const ft = FILE_TYPES.find(t=>t.value===d.file_type);
            return (
              <div key={d.id} className="sabi-card p-5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className="text-2xl mt-0.5 flex-shrink-0">{ft?.icon??'📎'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-white">{d.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge label={ft?.label??d.file_type} color={ft?.color??'gray'}/>
                          <Badge label={d.status} color={STATUS_BADGE[d.status]??'gray'}/>
                          {d.client_visible && <Badge label="Client can see" color="green"/>}
                          <span className="text-xs text-white/25">{d.users?.full_name}</span>
                          <span className="text-xs text-white/20">{new Date(d.created_at).toLocaleDateString()}</span>
                        </div>
                        {d.description && <p className="text-xs text-white/40 mt-1.5">{d.description}</p>}
                        {d.status==='rejected' && d.rejection_reason && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                            <AlertCircle className="w-3 h-3 flex-shrink-0"/> Rejected: {d.rejection_reason}
                          </div>
                        )}
                      </div>
                      {/* Admin approve/reject */}
                      {isAdmin && d.status==='pending' && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={()=>approve(d.id)} disabled={actioning===d.id+'_approve'}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-500/15 border border-green-500/25 text-green-400 rounded-lg hover:bg-green-500/25 transition-all disabled:opacity-50">
                            {actioning===d.id+'_approve'?<Loader2 className="w-3 h-3 animate-spin"/>:<Check className="w-3 h-3"/>}Approve
                          </button>
                          <button onClick={()=>reject(d.id)} disabled={actioning===d.id+'_reject'}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-all disabled:opacity-50">
                            {actioning===d.id+'_reject'?<Loader2 className="w-3 h-3 animate-spin"/>:<X className="w-3 h-3"/>}Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
