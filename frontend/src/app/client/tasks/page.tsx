'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, PenLine, Loader2, Search, Filter, Calendar, User } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { Badge, LoadingPage, EmptyState, StatCard } from '@/components/ui';

const CATEGORIES: Record<string,{ label:string; icon:string; color:string }> = {
  strategy:     { label:'Strategy & Planning',  icon:'📊', color:'blue'   },
  content_copy: { label:'Copywriting',          icon:'✍️',  color:'amber'  },
  design:       { label:'Design',               icon:'🎨', color:'pink'   },
  social_media: { label:'Social Media',         icon:'📱', color:'green'  },
  analytics:    { label:'Analytics',            icon:'📈', color:'purple' },
  video:        { label:'Video',                icon:'🎬', color:'teal'   },
  community:    { label:'Community',            icon:'💬', color:'teal'   },
  client_comms: { label:'Communication',        icon:'📧', color:'blue'   },
  ads:          { label:'Paid Ads',             icon:'📣', color:'amber'  },
  seo:          { label:'SEO & Digital',        icon:'🔍', color:'green'  },
  other:        { label:'Other',                icon:'📌', color:'gray'   },
};

// Demo data shown when no real work logs exist yet
const DEMO_LOGS = [
  { id:'d1', title:'Wrote 5 Instagram captions for Eid campaign',          category:'content_copy',  users:{ full_name:'Tunde Adewale',  role:'copywriter'           }, created_at:'2026-07-01T10:00:00Z', hours:2   },
  { id:'d2', title:'Designed 3 banner assets for FiberOne Q3 push',        category:'design',        users:{ full_name:'Chidinma Eze',   role:'graphic_designer'     }, created_at:'2026-07-02T11:30:00Z', hours:4   },
  { id:'d3', title:'Scheduled 12 posts across Instagram and Twitter',       category:'social_media',  users:{ full_name:'Amaka Okonkwo',  role:'social_media_manager' }, created_at:'2026-07-03T09:00:00Z', hours:1.5 },
  { id:'d4', title:'Published Q2 Analytics Report — website performance',  category:'analytics',     users:{ full_name:'Bode Fashola',   role:'analytics_specialist' }, created_at:'2026-07-04T14:00:00Z', hours:3   },
  { id:'d5', title:'Held strategy review call — outlined Q3 content plan', category:'strategy',      users:{ full_name:'Kalu Kingsley',  role:'account_manager'      }, created_at:'2026-07-07T15:00:00Z', hours:1   },
  { id:'d6', title:'Ran Meta Ads A/B test — creative variant 2 wins (+34%)',category:'ads',          users:{ full_name:'Amaka Okonkwo',  role:'social_media_manager' }, created_at:'2026-07-08T10:00:00Z', hours:2.5 },
];

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;

export default function ClientTasksPage() {
  const { client } = useClientStore();
  const [logs, setLogs]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [period, setPeriod]     = useState<'week'|'month'|'all'>('month');

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000'}/api/client/work-logs?limit=200`, {
      headers: { Authorization:`Bearer ${tok()}` }
    }).then(r => r.json())
      .then((res: any) => {
        const data = res.data ?? [];
        if (data.length > 0) { setLogs(data); setIsDemoData(false); }
        else { setLogs(DEMO_LOGS); setIsDemoData(true); }
      })
      .catch(() => { setLogs(DEMO_LOGS); setIsDemoData(true); })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const filtered = logs.filter(l => {
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && l.category !== catFilter) return false;
    if (period==='week')  return (now.getTime()-new Date(l.created_at).getTime()) < 7*86400000;
    if (period==='month') { const d=new Date(l.created_at); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }
    return true;
  });

  const totalHours = filtered.reduce((s,l)=>s+(l.hours??0),0);
  const teamCount  = new Set(filtered.map(l=>l.users?.full_name)).size;
  const catCounts  = filtered.reduce((acc:any,l)=>({...acc,[l.category]:(acc[l.category]||0)+1}),{});
  const topCat     = Object.entries(catCounts).sort((a:any,b:any)=>b[1]-a[1])[0];

  if (loading) return <LoadingPage label="Loading your brand's work log…"/>;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Work Done for You</h1>
        <p className="text-sm text-white/40 mt-1">
          Everything your Cerebre team has done for <strong className="text-white">{client?.brand?.name ?? 'your brand'}</strong>
        </p>
      </div>

      {isDemoData && (
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <PenLine className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-medium text-white">Work logs will appear here</p>
            <p className="text-xs text-white/40 mt-0.5">The data below is illustrative. As your team logs their work in Sabi, it will appear here in real time.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Tasks Completed"  value={filtered.length}              icon={CheckCircle2} color="green"/>
        <StatCard label="Hours Invested"   value={`${totalHours.toFixed(1)}h`}  icon={Clock}        color="purple"/>
        <StatCard label="Team Members"     value={teamCount}                    icon={User}         color="blue"/>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5">
          {(['week','month','all'] as const).map(p=>(
            <button key={p} onClick={()=>setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-all ${period===p?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}>
              {p==='all'?'All Time':`This ${p.charAt(0).toUpperCase()+p.slice(1)}`}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"/>
          <input className="sabi-input pl-9 text-sm w-48" placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="sabi-input w-44 text-sm" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
          <option className='bg-black' value="">All work types</option>
          {Object.entries(CATEGORIES).map(([v,c])=><option  className='bg-black' key={v} value={v}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      {/* Work log */}
      {filtered.length===0 ? (
        <EmptyState icon={CheckCircle2} title="No work logged in this period" description="Your team's work will appear here as they log it."/>
      ) : (
        <div className="space-y-3">
          {filtered.map((log,i)=>{
            const cat = CATEGORIES[log.category] ?? { label:log.category, icon:'📌', color:'gray' };
            const date = new Date(log.created_at);
            return (
              <div key={log.id??i} className="sabi-card p-5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-3">
                  <div className="text-xl mt-0.5 flex-shrink-0">{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white leading-snug">{log.title}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <Badge label={cat.label} color={cat.color}/>
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <User className="w-3 h-3"/>{log.users?.full_name ?? '—'}
                        <span className="text-white/20 capitalize">· {log.users?.role?.replace(/_/g,' ')}</span>
                      </span>
                      {(log.hours??0)>0 && <span className="text-xs text-white/30 flex items-center gap-1"><Clock className="w-3 h-3"/>{log.hours}h</span>}
                      <span className="text-xs text-white/20 flex items-center gap-1">
                        <Calendar className="w-3 h-3"/>
                        {date.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}
                      </span>
                    </div>
                    {log.goals?.title && (
                      <p className="text-xs text-green-400/70 mt-1.5 flex items-center gap-1">→ Goal: {log.goals.title}</p>
                    )}
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-400/50 flex-shrink-0 mt-1"/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/15 text-center mt-6">
        All work entries are logged by your Cerebre team and verified by ARIA™ for accuracy.
      </p>
    </div>
  );
}
