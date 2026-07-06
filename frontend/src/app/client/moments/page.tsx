'use client';
import { useState } from 'react';
import { Calendar, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui';

const MOMENTS = [
  { date:'Jul 4',  name:"Children's Day Campaign Window", type:'cultural',    rec:'Launch family-focused content series. Target parents in Tier-1 cities.',    platform:'Instagram + Facebook', score:9 },
  { date:'Jul 12', name:'Mid-Year Sale Season',           type:'commercial',  rec:'Push value messaging and bundle offers. High consumer intent period.',        platform:'All Platforms',        score:8 },
  { date:'Aug 1',  name:'NYSC Orientation Season',        type:'cultural',    rec:'Target youth demographic with aspirational content tied to independence.',    platform:'TikTok + Twitter',     score:7 },
  { date:'Aug 12', name:'World Youth Day',                type:'cultural',    rec:'Engage Gen-Z with purpose-driven campaigns. UGC challenge recommended.',     platform:'TikTok + Instagram',   score:9 },
  { date:'Sep 1',  name:'Back-to-School Season',          type:'commercial',  rec:'High purchase intent. Target decision-making parents with ROI messaging.',    platform:'Facebook + Radio',     score:8 },
  { date:'Sep 27', name:'World Tourism Day (Lagos Focus)',type:'national',    rec:'Leverage Lagos tourism narrative. Partner with local influencers.',           platform:'Instagram + LinkedIn', score:6 },
];

const TYPE_COLORS: Record<string,string> = { cultural:'purple',national:'green',religious:'amber',commercial:'blue',sports:'teal' };

export default function ClientMomentsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-white">MomentMap™</h1>
          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium">ARIA</span>
        </div>
        <p className="text-sm text-white/40">Nigerian cultural and commercial moments curated for your brand by ARIA</p>
      </div>

      <div className="space-y-3">
        {MOMENTS.map((m, i) => (
          <div key={i} className="sabi-card p-5 hover:border-purple-500/20 transition-all">
            <div className="flex items-start gap-4">
              <div className="text-center flex-shrink-0 w-12">
                <p className="text-xs text-white/30">{m.date.split(' ')[0]}</p>
                <p className="text-2xl font-black text-white leading-none">{m.date.split(' ')[1]}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <p className="font-semibold text-white">{m.name}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge label={m.type} color={TYPE_COLORS[m.type] ?? 'gray'} />
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs text-amber-400 font-bold">{m.score}/10</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-white/60 leading-relaxed">{m.rec}</p>
                </div>
                <p className="text-xs text-white/30 mt-2">📣 Best Platform: <span className="text-white/50">{m.platform}</span></p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
