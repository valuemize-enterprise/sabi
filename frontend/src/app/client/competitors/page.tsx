'use client';
import { useState, useEffect } from 'react';
import { Swords, Brain, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { clientPortal } from '@/lib/api';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

export default function ClientCompetitorsPage() {
  const [items, setItems]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    clientPortal.competitors().then((r: any) => setItems(r.data.competitors ?? [])).finally(() => setLoading(false));
  }, []);

  const strengthColor = (s: string) => s === 'Strong' ? 'green' : s === 'Moderate' ? 'amber' : 'red';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Competitors</h1>
        <p className="text-sm text-white/40 mt-1">AI-powered competitive intelligence for your market</p>
      </div>

      {loading ? <LoadingPage /> : items.length === 0 ? (
        <EmptyState icon={Swords} title="No competitors tracked yet"
          description="Your account team will add competitors to monitor. Check back soon." />
      ) : (
        <div className="space-y-4">
          {items.map((c: any) => {
            const pulse = c.intelligence_data;
            return (
              <div key={c.id} className="sabi-card p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-base font-bold text-red-300">
                      {c.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-white/40">{c.category} {c.website && `· ${c.website}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.market_position && <Badge label={c.market_position} color="gray" />}
                    {c.threat_level && <Badge label={`${c.threat_level} Threat`} color={c.threat_level === 'High' ? 'red' : c.threat_level === 'Medium' ? 'amber' : 'green'} />}
                  </div>
                </div>

                {pulse && (
                  <div className="bg-white/2 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Brain className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">IntelliPulse™ — ARIA Analysis</span>
                      {pulse.generatedAt && <span className="text-xs text-white/20 ml-auto">{new Date(pulse.generatedAt).toLocaleDateString()}</span>}
                    </div>
                    {pulse.summary && <p className="text-sm text-white/60 mb-3">{pulse.summary}</p>}
                    {pulse.recentActivities && pulse.recentActivities.length > 0 && (
                      <div>
                        <p className="text-xs text-white/30 mb-2">Recent Activity</p>
                        <div className="space-y-1.5">
                          {pulse.recentActivities.slice(0, 3).map((a: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-white/50">
                              <span className="text-white/20 mt-0.5">→</span>{a}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {pulse.overallStrength && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                        <span className="text-xs text-white/30">Overall Strength:</span>
                        <Badge label={pulse.overallStrength} color={strengthColor(pulse.overallStrength)} />
                      </div>
                    )}
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
