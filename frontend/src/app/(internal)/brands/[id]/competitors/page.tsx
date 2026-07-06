'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Swords, Plus, Brain, Loader2 } from 'lucide-react';
import { competitors as compApi } from '@/lib/api';
import { LoadingPage, EmptyState, Badge, PageHeader } from '@/components/ui';

export default function BrandCompetitorsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsing, setPulsing] = useState<string|null>(null);

  useEffect(() => {
    compApi.list({ brand_id: brandId }).then((r:any)=>setItems(r.data??[])).finally(()=>setLoading(false));
  }, [brandId]);

  const runPulse = async (id: string) => {
    setPulsing(id);
    try {
      const res:any = await compApi.pulse(id);
      setItems(p=>p.map(c=>c.id===id?{...c,intelligence_data:res.data}:c));
    } catch {} finally { setPulsing(null); }
  };

  const THREAT_COLOR: Record<string,string> = { High:'red', Medium:'amber', Low:'green' };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"><ArrowLeft className="w-3.5 h-3.5"/>Back to Brand</Link>
      <PageHeader title="Competitors" subtitle="Competitor intelligence powered by IntelliPulse™"
        action={<button className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus className="w-4 h-4"/>Add Competitor</button>}/>
      {loading?<LoadingPage/>:items.length===0?<EmptyState icon={Swords} title="No competitors tracked" description="Add competitors to run AI-powered intelligence scans with IntelliPulse™."/>:(
        <div className="space-y-4">
          {items.map(c=>{
            const intel = c.intelligence_data;
            return (
              <div key={c.id} className="sabi-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-base font-bold text-red-300">{c.name[0]}</div>
                    <div><p className="font-semibold text-white">{c.name}</p><p className="text-xs text-white/40">{c.category}{c.website&&` · ${c.website}`}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.threat_level&&<Badge label={`${c.threat_level} Threat`} color={THREAT_COLOR[c.threat_level]??'gray'}/>}
                    <button onClick={()=>runPulse(c.id)} disabled={pulsing===c.id}
                      className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50">
                      {pulsing===c.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Brain className="w-3.5 h-3.5"/>}
                      {pulsing===c.id?'Scanning…':'Run IntelliPulse™'}
                    </button>
                  </div>
                </div>
                {intel&&<div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2"><Brain className="w-3.5 h-3.5 text-purple-400"/><span className="text-xs text-purple-400 font-medium">IntelliPulse™ — ARIA Analysis</span></div>
                  {intel.summary&&<p className="text-sm text-white/60">{intel.summary}</p>}
                  {intel.overallStrength&&<div className="mt-2"><Badge label={`Strength: ${intel.overallStrength}`} color={intel.overallStrength==='Strong'?'red':intel.overallStrength==='Moderate'?'amber':'green'}/></div>}
                </div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
