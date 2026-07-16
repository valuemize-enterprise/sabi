'use client';

import { useState, useEffect } from 'react';
import { Trophy, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, { headers:{ Authorization:`Bearer ${tok()}` } })
    .then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const BAND_COLOR: Record<string,string> = {
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  green:  'bg-green-500/15 text-green-400 border-green-500/25',
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  gray:   'bg-white/5 text-white/40 border-white/10',
};

const RANK_MEDAL: Record<number,string> = { 1:'🥇', 2:'🥈', 3:'🥉' };

export default function LeaderboardPage() {
  const [type, setType]     = useState<'staff'|'brand_admin'>('staff');
  const [period, setPeriod] = useState<'week'|'month'|'all'>('week');
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/agency/leaderboard?type=${type}&period=${period}`)
      .then((r: any) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [type, period]);

  const list = data?.leaderboard ?? [];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="Leaderboard" subtitle="Recognizing consistent contribution — updated weekly"/>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 mb-4 w-fit">
        <button onClick={() => setType('staff')} className={`px-4 py-1.5 text-sm rounded-lg transition-all ${type==='staff'?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}>Staff</button>
        <button onClick={() => setType('brand_admin')} className={`px-4 py-1.5 text-sm rounded-lg transition-all ${type==='brand_admin'?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}>Brand Admins</button>
      </div>

      {/* Period */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 mb-6 w-fit">
        {(['week','month','all'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs rounded-lg transition-all ${period===p?'bg-purple-600 text-white':'text-white/40 hover:text-white'}`}>
            {p==='week'?'This Week':p==='month'?'This Month':'All Time'}
          </button>
        ))}
      </div>

      {loading ? <LoadingPage/> : list.length === 0 ? (
        <EmptyState icon={Trophy} title="No scores yet" description="Scores appear here once staff have completed their first two full weeks on the platform."/>
      ) : (
        <div className="space-y-2">
          {list.map((entry: any) => {
            const isLast = entry.rank === list.length && entry.rank > 3;
            return (
              <div key={entry.user_id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  entry.isSelf ? 'border-purple-500/40 bg-purple-500/8' : 'border-white/6 bg-white/2'
                }`}>
                <div className="w-8 text-center flex-shrink-0">
                  {RANK_MEDAL[entry.rank] ? <span className="text-xl">{RANK_MEDAL[entry.rank]}</span> : <span className="text-sm text-white/30 font-medium">#{entry.rank}</span>}
                </div>

                <div className="w-10 h-10 rounded-xl overflow-hidden bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
                  {entry.avatar_url ? <img src={entry.avatar_url} className="w-full h-full object-cover"/> : entry.full_name?.[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white truncate">{entry.full_name}</p>
                    {entry.isCreativeOfWeek && <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0"/>}
                    {entry.isSelf && <span className="text-[10px] text-purple-400 border border-purple-500/25 rounded px-1 flex-shrink-0">You</span>}
                  </div>
                  <p className="text-xs text-white/30 capitalize">{entry.role?.replace(/_/g,' ')}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {entry.fullScore !== undefined && (
                    <span className="text-sm font-bold text-white">{entry.fullScore}</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${BAND_COLOR[entry.scoreBandColor] ?? BAND_COLOR.gray}`}>
                    {entry.scoreBand}
                  </span>
                  {entry.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0"/>}
                  {entry.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0"/>}
                  {entry.trend === 'same' && <Minus className="w-3.5 h-3.5 text-white/15 flex-shrink-0"/>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/15 text-center mt-8">
        Rankings reflect client satisfaction, verified work, and manager feedback — not just activity.
      </p>
      {list.length > 3 && (
        <p className="text-[11px] text-white/10 text-center mt-3 italic">
          Every score is a stepping stone — keep building.
        </p>
      )}
    </div>
  );
}
