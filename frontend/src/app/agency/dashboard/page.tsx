'use client';

import { useEffect, useState } from 'react';
import { analytics } from '@/lib/api';
import { useAgencyStore } from '@/lib/store';
import { BarChart2, Target, CheckSquare, FileText, TrendingUp, Loader2 } from 'lucide-react';

interface DashboardData {
  stats:         { totalBrands: number; activeGoals: number; pendingTasks: number; publishedReports: number };
  recentReports: Array<{ id: string; title: string; type: string; status: string; brands: { name: string; logo_url?: string } }>;
  topBrands:     Array<{ id: string; name: string; clarity_score: number; industry: string; logo_url?: string }>;
}

export default function AgencyDashboardPage() {
  const { user } = useAgencyStore();
  const [data, setData]   = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.dashboard().then((res: any) => setData(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        <p className="text-white/40 text-sm">Loading dashboard...</p>
      </div>
    </div>
  );

  const stats = [
    { label: 'Total Brands',     value: data?.stats.totalBrands    ?? 0, icon: BarChart2,    color: 'text-purple-400' },
    { label: 'Active Goals',     value: data?.stats.activeGoals    ?? 0, icon: Target,       color: 'text-blue-400'   },
    { label: 'Pending Tasks',    value: data?.stats.pendingTasks   ?? 0, icon: CheckSquare,  color: 'text-amber-400'  },
    { label: 'Reports Published',value: data?.stats.publishedReports ?? 0, icon: FileText, color: 'text-green-400'  },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d1a] p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-white/40 text-sm mt-1">Here's what's happening across your brands today.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className="sabi-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-white/40">{s.label}</span>
            </div>
            <p className="text-3xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Brands by ClarityScore */}
        <div className="sabi-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Top Brands — ClarityScore™</h2>
          </div>
          <div className="space-y-3">
            {(data?.topBrands ?? []).map((brand, i) => (
              <div key={brand.id} className="flex items-center gap-3">
                <span className="text-xs text-white/30 w-4 text-center">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                  {brand.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{brand.name}</p>
                  <p className="text-xs text-white/30">{brand.industry}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-white">{brand.clarity_score}</span>
                  <p className="text-xs text-white/30">/ 1000</p>
                </div>
              </div>
            ))}
            {!data?.topBrands?.length && <p className="text-white/30 text-sm text-center py-4">No brands yet</p>}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="sabi-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Recent Reports</h2>
          </div>
          <div className="space-y-3">
            {(data?.recentReports ?? []).map(report => (
              <div key={report.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/2 hover:bg-white/4 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-300 mt-0.5">
                  {report.brands?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{report.title}</p>
                  <p className="text-xs text-white/40">{report.brands?.name} · {report.type}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${report.status === 'published' ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/40'}`}>
                  {report.status}
                </span>
              </div>
            ))}
            {!data?.recentReports?.length && <p className="text-white/30 text-sm text-center py-4">No reports yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
