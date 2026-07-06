'use client';

import { useState, useEffect } from 'react';
import { FileText, Image, Film, Download, Paperclip, Clock, CheckCircle2 } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { Badge, LoadingPage, EmptyState } from '@/components/ui';

const FILE_TYPES: Record<string,{label:string;icon:string;color:string}> = {
  copy:     { label:'Copy / Content',  icon:'✍️',  color:'amber'  },
  design:   { label:'Design Asset',   icon:'🎨',  color:'pink'   },
  video:    { label:'Video',          icon:'🎬',  color:'purple' },
  report:   { label:'Report / Deck',  icon:'📊',  color:'blue'   },
  strategy: { label:'Strategy Doc',   icon:'🧠',  color:'green'  },
  photo:    { label:'Photo',          icon:'📸',  color:'teal'   },
  other:    { label:'Other',          icon:'📎',  color:'gray'   },
};

const DEMO = [
  { id:'d1', title:'Q2 Social Media Calendar — FiberOne',    file_type:'strategy', created_at:'2026-06-30T10:00:00Z', users:{ full_name:'Amaka Okonkwo' }, description:'30-day content plan with captions, hashtags and posting schedule' },
  { id:'d2', title:'Brand Identity Assets Pack',             file_type:'design',   created_at:'2026-06-28T14:00:00Z', users:{ full_name:'Chidinma Eze'  }, description:'Logo variations, colour palette, typography guide' },
  { id:'d3', title:'Eid Campaign Copy — 5 Captions',         file_type:'copy',     created_at:'2026-06-25T09:00:00Z', users:{ full_name:'Tunde Adewale' }, description:'Instagram and Facebook captions for the Eid Mubarak campaign' },
  { id:'d4', title:'Q2 Performance Analytics Report',        file_type:'report',   created_at:'2026-06-20T16:00:00Z', users:{ full_name:'Bode Fashola'  }, description:'Website traffic, social growth, ad performance — 12 pages' },
];

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;

export default function ClientDeliverablesPage() {
  const { client } = useClientStore();
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000'}/api/client/deliverables`, {
      headers:{ Authorization:`Bearer ${tok()}` }
    }).then(r=>r.json())
      .then((res:any) => {
        const data = res.data ?? [];
        if (data.length > 0) { setItems(data); setIsDemoData(false); }
        else { setItems(DEMO); setIsDemoData(true); }
      })
      .catch(()=>{ setItems(DEMO); setIsDemoData(true); })
      .finally(()=>setLoading(false));
  }, []);

  const filtered = filter ? items.filter(d=>d.file_type===filter) : items;

  if (loading) return <LoadingPage label="Loading deliverables…"/>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Deliverables</h1>
        <p className="text-sm text-white/40 mt-1">Work files approved and shared by your Cerebre team</p>
      </div>

      {isDemoData && (
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/70">These are illustrative examples. Approved files from your team will appear here.</p>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={()=>setFilter('')} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${!filter?'border-purple-500/30 bg-purple-500/10 text-purple-300':'border-white/10 text-white/40 hover:text-white'}`}>All</button>
        {Object.entries(FILE_TYPES).map(([v,t])=>(
          <button key={v} onClick={()=>setFilter(v)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 ${filter===v?'border-purple-500/30 bg-purple-500/10 text-purple-300':'border-white/10 text-white/40 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {filtered.length===0 ? (
        <EmptyState icon={Paperclip} title="No deliverables yet" description="Approved work files from your team will appear here."/>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(d=>{
            const ft = FILE_TYPES[d.file_type]??FILE_TYPES.other;
            return (
              <div key={d.id} className="sabi-card p-5 hover:border-purple-500/20 transition-all group">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl flex-shrink-0">{ft.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white leading-snug group-hover:text-purple-300 transition-colors">{d.title}</p>
                    <Badge label={ft.label} color={ft.color}/>
                  </div>
                </div>
                {d.description && <p className="text-xs text-white/40 leading-relaxed mb-3">{d.description}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/30">{d.users?.full_name}</span>
                    <span className="text-xs text-white/20 flex items-center gap-1">
                      <Clock className="w-3 h-3"/>
                      {new Date(d.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400"/>
                    <span className="text-xs text-green-400">Approved</span>
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
