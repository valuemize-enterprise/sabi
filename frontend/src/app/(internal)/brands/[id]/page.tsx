'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { brands as brandsApi, analytics } from '@/lib/api';
import {
  Target, FileText, Users2, CheckSquare, Swords, Lightbulb,
  Brain, RefreshCw, Trophy, Loader2, TrendingUp, ArrowLeft, UserPlus, PenLine
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { Badge, LoadingPage, StatCard } from '@/components/ui';

const SUB_PAGES = [
  { href:'clients',       label:'Portal Accounts', icon:UserPlus,   desc:'Client logins',    color:'blue'   },
  { href:'team',          label:'Team',             icon:Users2,     desc:'Assigned staff',   color:'purple' },
  { href:'tasks',         label:'Tasks',            icon:CheckSquare,desc:'Ongoing work',     color:'amber'  },
  { href:'strategies',    label:'Strategies',       icon:Lightbulb,  desc:'Campaign plans',   color:'green'  },
  { href:'proof-of-work', label:'Proof of Work',    icon:Trophy,     desc:'Value delivered',  color:'teal'   },
  { href:'work',          label:'Work Log',         icon:PenLine,    desc:'Logged activities', color:'cyan'   },
  { href:'settings',      label:'Settings',         icon:Brain,      desc:'Brand config',     color:'red'    },
];

const ICON_COLORS: Record<string, string> = {
  blue:'text-blue-400 bg-blue-500/10 border-blue-500/15 group-hover:bg-blue-500/20',
  purple:'text-purple-400 bg-purple-500/10 border-purple-500/15 group-hover:bg-purple-500/20',
  amber:'text-amber-400 bg-amber-500/10 border-amber-500/15 group-hover:bg-amber-500/20',
  green:'text-green-400 bg-green-500/10 border-green-500/15 group-hover:bg-green-500/20',
  teal:'text-teal-400 bg-teal-500/10 border-teal-500/15 group-hover:bg-teal-500/20',
  cyan:'text-cyan-400 bg-cyan-500/10 border-cyan-500/15 group-hover:bg-cyan-500/20',
  red:'text-red-400 bg-red-500/10 border-red-500/15 group-hover:bg-red-500/20',
};

export default function BrandOverviewPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [brand, setBrand]     = useState<any>(null);
  const [stats, setStats]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    Promise.all([brandsApi.get(brandId), analytics.brand?.(brandId) ?? Promise.resolve({ data: {} })])
      .then(([b, s]: any) => { setBrand(b.data.brand); setStats(s.data); })
      .catch(console.error).finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => { load(); }, [brandId]);

  const refreshClarity = async () => {
    setRefreshing(true);
    try {
      const res: any = await brandsApi.refreshClarity(brandId);
      setBrand((prev: any) => ({ ...prev, clarity_score: res.data.score, clarity_score_breakdown: res.data.breakdown }));
    } catch {} finally { setRefreshing(false); }
  };

  if (loading) return <LoadingPage label="Loading brand…" />;
  if (!brand)  return <div className="p-6 text-white/40">Brand not found</div>;

  const score = brand.clarity_score ?? 0;
  const grade = score >= 850 ? 'S' : score >= 700 ? 'A' : score >= 550 ? 'B' : score >= 400 ? 'C' : 'D';
  const gradeColor = grade === 'S' ? 'text-yellow-400' : grade === 'A' ? 'text-green-400' : grade === 'B' ? 'text-blue-400' : 'text-amber-400';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AgencyTopNav />
      <Link href="/brands" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> All Brands
      </Link>

      {/* Brand header */}
      <div className="sabi-card p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white"
              style={{ backgroundColor:`${brand.primary_color||'#6d28d9'}33`, border:`1px solid ${brand.primary_color||'#6d28d9'}55` }}>
              {brand.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{brand.name}</h1>
              <p className="text-white/40 text-sm mt-0.5">{brand.industry} {brand.website && `· ${brand.website}`}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge label={brand.status} color={brand.status === 'active' ? 'green' : 'gray'} />
                {brand.users && <span className="text-xs text-white/30">AM: {brand.users.full_name}</span>}
              </div>
            </div>
          </div>

          {/* ClarityScore hero */}
          <div className="text-center">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">ClarityScore™</p>
            <div className="flex items-baseline gap-2 justify-center">
              <span className="text-5xl font-black text-white">{score}</span>
              <span className={`text-2xl font-bold ${gradeColor}`}>{grade}</span>
            </div>
            <div className="w-32 h-1.5 bg-white/8 rounded-full mx-auto mt-2 mb-3">
              <div className="h-1.5 rounded-full bg-purple-500 transition-all" style={{ width:`${(score/1000)*100}%` }} />
            </div>
            <button onClick={refreshClarity} disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors mx-auto disabled:opacity-50">
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Computing…' : 'Refresh Score'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Goals"      value={stats?.goals?.active ?? 0}     icon={Target}      color="purple" />
        <StatCard label="Tasks Done"        value={stats?.tasks?.done ?? 0}        icon={CheckSquare} color="green"  />
        <StatCard label="Reports Published" value={stats?.reports?.length ?? 0}    icon={FileText}    color="blue"   />
        <StatCard label="Client Contacts"   value={stats?.clients ?? 0}            icon={UserPlus}    color="amber"  />
      </div>

      {/* Sub-page navigation */}
      <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Manage Brand</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {SUB_PAGES.map(({ href, label, icon: Icon, desc, color }) => (
          <Link key={href} href={`/brands/${brandId}/${href}`}
            className="sabi-card p-4 hover:border-white/10 transition-all group cursor-pointer text-center">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mx-auto mb-3 transition-all ${ICON_COLORS[color]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-white group-hover:text-white transition-colors">{label}</p>
            <p className="text-xs text-white/30 mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Quick links bottom row */}
      <div className="grid grid-cols-2 gap-4">
        <Link href={`/reports?brand_id=${brandId}`} className="sabi-card p-4 hover:border-blue-500/20 transition-all group flex items-center gap-3">
          <FileText className="w-5 h-5 text-blue-400" />
          <div>
            <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">View Reports</p>
            <p className="text-xs text-white/30">All published reports</p>
          </div>
        </Link>
        <Link href={`/brands/${brandId}/goals`} className="sabi-card p-4 hover:border-green-500/20 transition-all group flex items-center gap-3">
          <Target className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-white group-hover:text-green-300 transition-colors">Track Goals</p>
            <p className="text-xs text-white/30">Goal progress tracking</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
