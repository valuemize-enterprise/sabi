'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trophy, Award, TrendingUp, TrendingDown, Minus, Calendar, ChevronDown, Check } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState } from '@/components/ui';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, { headers: { Authorization: `Bearer ${tok()}` } })
    .then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || b.message); return b; });

const BAND_COLOR: Record<string, string> = {
  purple: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  green: 'bg-green-500/15 text-green-400 border-green-500/25',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  gray: 'bg-white/5 text-white/40 border-white/10',
};

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// App launched August 2026 — months roll forward automatically, no need to touch this again
const APP_LAUNCH = { year: 2026, month: 8 }; // month is 1-indexed (August)

type MonthOption = { value: string; label: string };

function getMonthOptions(): MonthOption[] {
  const now = new Date();
  const start = new Date(APP_LAUNCH.year, APP_LAUNCH.month - 1, 1);
  // Stop at LAST month — the current month is locked server-side until it ends,
  // so there's no point offering it in the dropdown.
  const end = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const months: MonthOption[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const label = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });
    months.push({ value, label });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months.reverse(); // most recent first
}

export default function LeaderboardPage() {
  const [type, setType] = useState<'staff' | 'brand_admin'>('staff');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(monthOptions[0]?.value);

  useEffect(() => {
    if (period === 'month' && !selectedMonth) return; // no completed month to show yet

    setLoading(true);

    const request =
      period === 'month'
        ? api(`/api/agency/monthly-leaderboard?type=${type}&month=${selectedMonth}`)
        : api(`/api/agency/leaderboard?type=${type}&period=${period}`);

    request
      .then((r: any) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [type, period, selectedMonth]);

  const list = data?.leaderboard ?? [];
  const isLocked = period === 'month' && !!data?.locked;
  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? 'Select month';

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="Leaderboard" subtitle="Recognizing consistent contribution — updated weekly" />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 mb-4 w-fit">
        <button onClick={() => setType('staff')} className={`px-4 py-1.5 text-sm rounded-lg transition-all ${type === 'staff' ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>Staff</button>
        <button onClick={() => setType('brand_admin')} className={`px-4 py-1.5 text-sm rounded-lg transition-all ${type === 'brand_admin' ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}>Brand Admins</button>
      </div>

      {/* Period + Month picker */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 w-fit">
          {(['week', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${period === p ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              {p === 'week' ? 'This Week' : p === 'month' ? 'By Month' : 'All Time'}
            </button>
          ))}
        </div>

        {period === 'month' && monthOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-white/3 text-white/70 hover:text-white hover:border-purple-500/30 hover:bg-purple-500/5 transition-all">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-medium">{selectedMonthLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-white/30" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-[#111116] border border-white/10 rounded-xl p-1 min-w-[180px] shadow-xl shadow-black/40"
            >
              {monthOptions.map(m => (
                <DropdownMenuItem
                  key={m.value}
                  onClick={() => setSelectedMonth(m.value)}
                  className={`flex items-center justify-between text-sm rounded-lg px-2.5 py-2 cursor-pointer focus:bg-purple-500/10 focus:text-white ${selectedMonth === m.value ? 'text-white bg-purple-500/10' : 'text-white/60'
                    }`}
                >
                  {m.label}
                  {selectedMonth === m.value && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {loading ? <LoadingPage /> : period === 'month' && monthOptions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Not available yet"
          description="Monthly rankings will appear once the first full month has ended."
        />
      ) : isLocked ? (
        <EmptyState
          icon={Calendar}
          title="Not available yet"
          description={data?.message ?? "This month's rankings will be available once the month ends."}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No scores yet"
          description={
            period === 'month'
              ? `No scores recorded for ${selectedMonthLabel} yet.`
              : "Scores appear here once staff have completed their first two full weeks on the platform."
          }
        />
      ) : (
        <div className="space-y-2">
          {list.map((entry: any) => {
            return (
              <div key={entry.user_id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${entry.isSelf ? 'border-purple-500/40 bg-purple-500/8' : 'border-white/6 bg-white/2'
                  }`}>
                <div className="w-8 text-center flex-shrink-0">
                  {RANK_MEDAL[entry.rank] ? <span className="text-xl">{RANK_MEDAL[entry.rank]}</span> : <span className="text-sm text-white/30 font-medium">#{entry.rank}</span>}
                </div>

                <div className="w-10 h-10 rounded-xl overflow-hidden bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
                  {entry.avatar_url ? <img src={entry.avatar_url} className="w-full h-full object-cover" /> : entry.full_name?.[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white truncate">{entry.full_name}</p>
                    {entry.isCreativeOfWeek && <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    {entry.isSelf && <span className="text-[10px] text-purple-400 border border-purple-500/25 rounded px-1 flex-shrink-0">You</span>}
                  </div>
                  <p className="text-xs text-white/30 capitalize">{entry.role?.replace(/_/g, ' ')}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {entry.fullScore !== undefined && (
                    <span className="text-sm font-bold text-white">{entry.fullScore}</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${BAND_COLOR[entry.scoreBandColor] ?? BAND_COLOR.gray}`}>
                    {entry.scoreBand}
                  </span>
                  {entry.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
                  {entry.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                  {entry.trend === 'same' && <Minus className="w-3.5 h-3.5 text-white/15 flex-shrink-0" />}
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