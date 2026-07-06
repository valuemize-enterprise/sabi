'use client';
import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Brain, Loader2 } from 'lucide-react';
import { clientPortal } from '@/lib/api';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

export default function ClientGoalsPage() {
  const [goals, setGoals]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientPortal.goals().then((r: any) => setGoals(r.data?.goals ?? [])).finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = { active: 'purple', achieved: 'green', missed: 'red', paused: 'gray' };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Goals</h1>
        <p className="text-sm text-white/40 mt-1">Track your brand's KPIs and performance targets</p>
      </div>

      {loading ? <LoadingPage /> : goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals yet" description="Your account team will set up performance goals for your brand." />
      ) : (
        <div className="space-y-4">
          {goals.map((g: any) => {
            const pct = Math.min(100, Math.round((g.current_value / Math.max(g.target_value, 1)) * 100));
            const vel = g.velocity_data;
            return (
              <div key={g.id} className="sabi-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-semibold text-white">{g.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">{g.metric_type} · {g.unit} {g.deadline && `· Due ${g.deadline}`}</p>
                  </div>
                  <Badge label={g.status} color={statusColor[g.status] ?? 'gray'} />
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-white/40 mb-1.5">
                      <span>{g.current_value} {g.unit}</span>
                      <span>Target: {g.target_value} {g.unit}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-purple-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-black ${pct >= 100 ? 'text-green-400' : 'text-white'}`}>{pct}%</p>
                    <p className="text-xs text-white/30">complete</p>
                  </div>
                </div>

                {vel && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    vel.trajectoryLabel === 'On Track' || vel.trajectoryLabel === 'Accelerating' ? 'bg-green-500/5 text-green-400' :
                    vel.trajectoryLabel === 'At Risk' || vel.trajectoryLabel === 'Critical' ? 'bg-red-500/5 text-red-400' :
                    'bg-amber-500/5 text-amber-400'
                  }`}>
                    {vel.trajectoryLabel === 'Accelerating' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span className="font-medium">{vel.trajectoryLabel}</span>
                    {vel.recommendation && <span className="text-white/40 ml-1">— {vel.recommendation}</span>}
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
