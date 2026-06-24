'use client';

import { useEffect, useState } from 'react';
import { clientPortal } from '@/lib/api';
import { useClientStore } from '@/lib/store';
import { BarChart2, Target, FileText, Brain, Calendar, Loader2 } from 'lucide-react';

export default function ClientDashboardPage() {
  const { client } = useClientStore();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientPortal.dashboard()
      .then((res: any) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        <p className="text-white/40 text-sm">Loading your dashboard...</p>
      </div>
    </div>
  );

  const brand = data?.brand;
  const score = brand?.clarity_score ?? 0;
  const grade = score >= 850 ? 'S' : score >= 700 ? 'A' : score >= 550 ? 'B' : score >= 400 ? 'C' : 'D';

  return (
    <div className="min-h-screen bg-[#0d0d1a] p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg font-bold text-purple-300">
          {brand?.name?.[0] ?? '?'}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{brand?.name}</h1>
          <p className="text-white/40 text-sm">{brand?.industry} · Welcome, {client?.full_name?.split(' ')[0]}</p>
        </div>
      </div>

      {/* ClarityScore™ Hero */}
      <div className="sabi-card p-8 mb-6 text-center clarity-glow">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-3">ClarityScore™</p>
        <div className="text-6xl font-black text-white mb-1">{score}</div>
        <div className="text-2xl font-bold text-purple-400 mb-3">Grade {grade}</div>
        <div className="w-full bg-white/10 rounded-full h-2 max-w-xs mx-auto">
          <div className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-1000"
            style={{ width: `${(score / 1000) * 100}%` }} />
        </div>
        <p className="text-xs text-white/30 mt-3">Last updated: {brand?.clarity_score_updated_at ? new Date(brand.clarity_score_updated_at).toLocaleDateString() : 'Not yet computed'}</p>
      </div>

      {/* Active Goals */}
      {(data?.activeGoals?.length > 0) && (
        <div className="sabi-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Active Goals</h2>
          </div>
          <div className="space-y-3">
            {data.activeGoals.map((goal: any) => {
              const pct = Math.min(100, Math.round((goal.current_value / Math.max(goal.target_value, 1)) * 100));
              return (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-white">{goal.title}</p>
                    <span className="text-xs text-white/50">{goal.current_value} / {goal.target_value} {goal.unit}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">{pct}% complete</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ask ARIA CTA */}
      <a href="/client/ask" className="sabi-card p-6 flex items-center gap-4 hover:border-purple-500/40 transition-all cursor-pointer group block">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Brain className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-white font-medium">Ask ARIA</p>
          <p className="text-white/40 text-sm">Get instant AI-powered insights about your brand performance</p>
        </div>
        <span className="text-white/20 group-hover:text-purple-400 transition-colors text-lg">→</span>
      </a>
    </div>
  );
}
