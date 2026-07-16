'use client';

import { useState, useEffect } from 'react';
import { Trophy, CheckCircle2, TrendingUp, Brain, Loader2, RefreshCw } from 'lucide-react';
import { clientPortal, clientPortalExtended } from '@/lib/api';
import { LoadingPage, EmptyState, Badge, StatCard } from '@/components/ui';

// Fallback demo data for when backend has no completed tasks yet
const DEMO_TASKS = [
  {
    id:           'demo-1',
    title:        'Launched Instagram Reels Strategy',
    completed_at: '2026-06-15',
    goals:        { title: 'Instagram Follower Growth' },
    proof_of_value_data: {
      povScore:              87,
      valueStatement:        'Generated 2.3M reach — 340% above industry average for brands in Lagos.',
      reportingSummary:      'Content strategy executed across 12 Reels posts. Engagement rate hit 8.4% vs 2.1% baseline.',
      impactLabel:           'High Impact',
      attributionConfidence: 'High',
    },
  },
  {
    id:           'demo-2',
    title:        'SEO Audit & Technical Fixes',
    completed_at: '2026-05-20',
    goals:        { title: 'Organic Search Growth' },
    proof_of_value_data: {
      povScore:              62,
      valueStatement:        'Improved organic search position for 34 target keywords.',
      reportingSummary:      'Technical SEO improvements led to 45% increase in organic traffic over 6 weeks.',
      impactLabel:           'Medium Impact',
      attributionConfidence: 'Medium',
    },
  },
  {
    id:           'demo-3',
    title:        'WhatsApp Campaign Builder Setup',
    completed_at: '2026-05-01',
    goals:        { title: 'Lead Generation' },
    proof_of_value_data: {
      povScore:              74,
      valueStatement:        'WhatsApp campaign delivered 420 qualified enquiries in 14 days.',
      reportingSummary:      'Broadcast list built to 1,200 subscribers. Open rate 94% vs 22% email average.',
      impactLabel:           'High Impact',
      attributionConfidence: 'High',
    },
  },
];

function POVScoreBadge({ score }: { score: number }) {
  const cfg =
    score >= 70 ? { color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'High' } :
    score >= 40 ? { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Medium' } :
                  { color: 'text-red-400 bg-red-500/10 border-red-500/20',       label: 'Low' };
  return (
    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border font-black flex-shrink-0 ${cfg.color}`}>
      <span className="text-xl leading-none">{score}</span>
      <span className="text-[9px] font-medium mt-0.5 opacity-80">{cfg.label}</span>
    </div>
  );
}

export default function ClientValuePage() {
  const [tasks, setTasks]         = useState<any[]>([]);
  const [summary, setSummary]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // ✅ FIXED: proofOfValue now exists in clientPortal (after api.ts patch)
      const res: any = await clientPortalExtended.proofOfValue();
      const fetchedTasks = res.data?.tasks ?? [];

      if (fetchedTasks.length === 0) {
        // No completed tasks yet — show demo data with a note
        setTasks(DEMO_TASKS);
        setSummary(null);
        setIsDemoData(true);
      } else {
        setTasks(fetchedTasks);
        setSummary(res.data?.summary ?? null);
        setIsDemoData(false);
      }
    } catch {
      // Backend route not yet registered OR network error — show demo data
      setTasks(DEMO_TASKS);
      setSummary(null);
      setIsDemoData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingPage label="Loading proof of value…" />;

  const withPOV    = tasks.filter(t => t.proof_of_value_data?.povScore !== undefined);
  const avgScore   = withPOV.length
    ? Math.round(withPOV.reduce((s, t) => s + (t.proof_of_value_data?.povScore ?? 0), 0) / withPOV.length)
    : 0;
  const highImpact = withPOV.filter(t => (t.proof_of_value_data?.povScore ?? 0) >= 70).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-xl font-bold text-white">Proof of Value</h1>
          <p className="text-sm text-white/40 mt-1">
            AI-verified evidence of the impact your Cerebre team has delivered
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Demo data notice */}
      {isDemoData && (
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Brain className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">No completed tasks yet</p>
            <p className="text-xs text-white/40 mt-0.5">
              The data below is illustrative. Once your team completes tasks and the Proof of Value Engine runs,
              real impact scores will appear here.
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Tasks Delivered"
          value={isDemoData ? tasks.length : (summary?.total ?? tasks.length)}
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          label="Avg Value Score"
          value={`${avgScore}/100`}
          icon={Trophy}
          color="purple"
        />
        <StatCard
          label="High-Impact Tasks"
          value={isDemoData ? highImpact : (summary?.highImpact ?? highImpact)}
          icon={TrendingUp}
          color="blue"
        />
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No completed tasks yet"
          description="Once your team completes tasks and ARIA validates their impact, results will appear here."
        />
      ) : (
        <div className="space-y-4">
          {tasks.map(task => {
            const pov = task.proof_of_value_data;
            const hasData = pov?.povScore !== undefined;

            return (
              <div key={task.id} className="sabi-card p-5 hover:border-white/10 transition-all">
                <div className="flex items-start gap-4">
                  {/* POV Score badge */}
                  {hasData ? (
                    <POVScoreBadge score={pov.povScore} />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-white/10 bg-white/3 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-white/30">No data</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Task title + goal */}
                    <p className="font-semibold text-white leading-snug">{task.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {task.goals?.title && (
                        <span className="text-xs text-white/30">
                          Goal: {task.goals.title}
                        </span>
                      )}
                      {task.completed_at && (
                        <span className="text-xs text-white/20">
                          Completed {new Date(task.completed_at).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' })}
                        </span>
                      )}
                    </div>

                    {/* POV data */}
                    {hasData ? (
                      <div className="mt-3 space-y-2">
                        {/* Value statement */}
                        {pov.valueStatement && (
                          <div className="bg-green-500/6 border border-green-500/15 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Trophy className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-xs text-green-400 font-medium">Value Statement</span>
                            </div>
                            <p className="text-sm text-white/75 leading-relaxed">{pov.valueStatement}</p>
                          </div>
                        )}

                        {/* Reporting summary */}
                        {pov.reportingSummary && (
                          <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Brain className="w-3.5 h-3.5 text-purple-400" />
                              <span className="text-xs text-purple-400 font-medium">ARIA Intelligence Summary</span>
                            </div>
                            <p className="text-sm text-white/60 leading-relaxed">{pov.reportingSummary}</p>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {pov.impactLabel && (
                            <Badge
                              label={pov.impactLabel}
                              color={
                                pov.povScore >= 70 ? 'green' :
                                pov.povScore >= 40 ? 'amber' : 'gray'
                              }
                            />
                          )}
                          {pov.attributionConfidence && (
                            <Badge
                              label={`ARIA Confidence: ${pov.attributionConfidence}`}
                              color="blue"
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-white/25 mt-2">
                        No Proof of Value score yet — the ARIA engine analyses tasks once they are linked to a goal.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/20 text-center mt-8">
        Proof of Value scores are computed by ARIA™ using metric correlation and attribution modelling.
        Powered by Anthropic Claude · Cerebre Media Africa
      </p>
    </div>
  );
}
