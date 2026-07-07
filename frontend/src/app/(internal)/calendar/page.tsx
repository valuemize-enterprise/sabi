'use client';
import { useState, useEffect } from 'react';
import { Calendar as CalIcon, Brain, Plus, Loader2, Star, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { calendar, brands as brandsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { PageHeader, LoadingPage, EmptyState, Badge } from '@/components/ui';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const TYPE_COLOR: Record<string,string> = { cultural:'purple', national:'green', religious:'amber', commercial:'blue', sports:'teal' };
const TYPE_EMOJI: Record<string,string> = { cultural:'🎭', national:'🇳🇬', religious:'🕌', commercial:'🛍️', sports:'⚽' };

export default function CalendarPage() {
  const today = new Date();
  const [month, setMonth]   = useState(today.getMonth() + 1);
  const [year, setYear]     = useState(today.getFullYear());
  const [events, setEvents] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [selBrand, setSelBrand] = useState('');
  const [loading, setLoading]   = useState(true);
  const [recommending, setRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [newEvt, setNewEvt]  = useState({ title:'', event_date:'', event_type:'cultural', is_global: true });

  const loadEvents = () => {
    setLoading(true);
    calendar.list({ month: String(month), year: String(year), brand_id: selBrand })
      .then((r:any) => setEvents(r.data?.events ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvents(); }, [month, year, selBrand]);
  useEffect(() => { brandsApi.list({ limit:'50' }).then((r:any) => setBrands(r.data??[])); }, []);

  const recommend = async () => {
    setError('');
    if (!selBrand) { setError('Select a brand first'); return; }
    setRecommending(true);
    try {
      const res: any = await calendar.recommend(selBrand, month, year);
      setRecommendations(res.data);
    } catch {} finally { setRecommending(false); }
  };

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await calendar.create({ ...newEvt, brand_id: selBrand || undefined });
      setEvents(p => [...p, res.data.event]);
      setShowNew(false);
    } catch {}
  };

  const prevMonth = () => { if (month===1) { setMonth(12); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===12) { setMonth(1); setYear(y=>y+1); } else setMonth(m=>m+1); };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AgencyTopNav title="Calendar" subtitle="MomentMap™ — Nigerian cultural & commercial calendar"/>
      <PageHeader title="Calendar" subtitle="Plan content around Nigerian cultural moments"
        action={
          <div className="flex items-center gap-3">
            <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 text-sm border border-white/10 rounded-lg text-white/60 hover:text-white hover:border-white/20 transition-all">
              <Plus className="w-4 h-4"/>Add Event
            </button>
            <button onClick={recommend} disabled={recommending||!selBrand} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
              {recommending?<Loader2 className="w-4 h-4 animate-spin"/>:<Sparkles className="w-4 h-4"/>}
              {recommending?'Generating…':'ARIA Recommend'}
            </button>
          </div>
        }/>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all"><ChevronLeft className="w-4 h-4"/></button>
          <h2 className="text-lg font-bold text-white w-36 text-center">{MONTHS[month-1]} {year}</h2>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-all"><ChevronRight className="w-4 h-4"/></button>
        </div>
        <select className="sabi-input w-48 text-sm" value={selBrand} onChange={e=>setSelBrand(e.target.value)}>
          <option className='bg-black' value="">All brands</option>
          {brands.map((b:any)=><option className='bg-black' key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* ARIA Recommendations */}
      {recommendations && (
        <div className="sabi-card p-5 mb-6 border-purple-500/20">
          <div className="flex items-center gap-2 mb-4"><Brain className="w-4 h-4 text-purple-400"/><h3 className="text-sm font-semibold text-white">MomentMap™ Recommendations</h3><span className="text-xs text-purple-400/60">by ARIA</span></div>
          {recommendations.summary && <p className="text-sm text-white/60 mb-4">{recommendations.summary}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(recommendations.recommendations||[]).slice(0,4).map((r:any,i:number)=>(
              <div key={i} className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{r.momentName}</p>
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3 h-3 text-amber-400"/>
                    <span className="text-xs text-amber-400">{r.relevanceScore}</span>
                  </div>
                </div>
                <p className="text-xs text-white/50 mb-2">{r.recommendation}</p>
                <div className="flex items-center gap-2">
                  <Badge label={r.bestPlatform} color="purple"/>
                  <Badge label={r.estimatedImpact} color={r.estimatedImpact==='High'?'green':r.estimatedImpact==='Medium'?'amber':'gray'}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add event form */}
      {showNew && (
        <form onSubmit={addEvent} className="sabi-card p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Add Calendar Event</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-white/50 mb-1.5 block">Title *</label><input className="sabi-input text-sm" value={newEvt.title} onChange={e=>setNewEvt(p=>({...p,title:e.target.value}))} required/></div>
            <div><label className="text-xs text-white/50 mb-1.5 block">Date *</label><input type="date" className="sabi-input text-sm" value={newEvt.event_date} onChange={e=>setNewEvt(p=>({...p,event_date:e.target.value}))} required/></div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Type</label>
              <select className="sabi-input text-sm" value={newEvt.event_type} onChange={e=>setNewEvt(p=>({...p,event_type:e.target.value}))}>
                {['cultural','national','religious','commercial','sports'].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="global" checked={newEvt.is_global} onChange={e=>setNewEvt(p=>({...p,is_global:e.target.checked}))} className="w-4 h-4"/>
              <label htmlFor="global" className="text-sm text-white/60">Global event (all brands)</label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="sabi-btn-primary px-4 py-2 text-sm">Add Event</button>
            <button type="button" onClick={()=>setShowNew(false)} className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Events list */}
      {loading ? <LoadingPage/> : events.length===0 ? <EmptyState icon={CalIcon} title="No events this month" description="Add events manually or use ARIA to recommend cultural moments for your brands."/> : (
        <div className="space-y-3">
          {[...events].sort((a,b)=>a.event_date.localeCompare(b.event_date)).map(ev=>(
            <div key={ev.id} className="sabi-card p-4 flex items-center gap-4 hover:border-white/10 transition-all">
              <div className="text-2xl flex-shrink-0">{TYPE_EMOJI[ev.event_type]||'📅'}</div>
              <div className="w-14 text-center flex-shrink-0">
                <p className="text-xs text-white/30">{MONTHS[new Date(ev.event_date).getMonth()].slice(0,3)}</p>
                <p className="text-xl font-black text-white">{new Date(ev.event_date).getDate()}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{ev.title}</p>
                {ev.description && <p className="text-xs text-white/40 mt-0.5">{ev.description}</p>}
                {ev.ai_recommendation && <p className="text-xs text-purple-400 mt-1 truncate">💡 {ev.ai_recommendation}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge label={ev.event_type} color={TYPE_COLOR[ev.event_type]??'gray'}/>
                {ev.is_global && <Badge label="Global" color="blue"/>}
                {ev.relevance_score && <span className="text-xs text-amber-400 font-medium">★{ev.relevance_score}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
