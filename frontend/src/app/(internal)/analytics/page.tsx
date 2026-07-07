'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Building2, Users, FileText, Target, TrendingUp, PieChart } from 'lucide-react';
import { superAdmin } from '@/lib/api';

function StatCard({ label, value, icon: Icon, color='red', sub }:
  { label:string; value:string|number; icon:any; color?:string; sub?:string }) {
  const c: Record<string,string> = {
    red:'text-red-400 bg-red-500/10', purple:'text-purple-400 bg-purple-500/10',
    blue:'text-blue-400 bg-blue-500/10', green:'text-green-400 bg-green-500/10',
    amber:'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="sabi-card p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${c[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
      {sub && <p className="text-xs text-white/20 mt-0.5">{sub}</p>}
    </div>
  );
}

function HorizontalBar({ label, value, total, color='purple' }:
  { label:string; value:number; total:number; color?:string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const c: Record<string,string> = {
    purple:'bg-purple-500', blue:'bg-blue-500', green:'bg-green-500',
    amber:'bg-amber-500', red:'bg-red-500', teal:'bg-teal-500', pink:'bg-pink-500',
  };
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-white/70 capitalize">{label.replace(/_/g,' ')}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/30">{value}</span>
          <span className="text-xs text-white/20">({pct}%)</span>
        </div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${c[color]??c.purple}`} style={{ width:`${pct}%` }} />
      </div>
    </div>
  );
}

const INDUSTRY_COLORS = ['purple','blue','green','amber','red','teal','pink','orange','gray'];

export default function SuperAdminAnalyticsPage() {
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdmin.analytics().then((r: any) => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const industryEntries = data?.industryBreakdown ? Object.entries(data.industryBreakdown).sort((a:any,b:any)=>b[1]-a[1]) : [];
  const roleEntries     = data?.roleBreakdown     ? Object.entries(data.roleBreakdown).sort((a:any,b:any)=>b[1]-a[1])     : [];
  const totalBrandCount = industryEntries.reduce((s:number,[,v]:any) => s+v, 0);
  const totalRoleCount  = roleEntries.reduce((s:number,[,v]:any) => s+v, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-red-400/60 font-semibold uppercase tracking-widest mb-1">Platform Intelligence</p>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-white/30 text-sm mt-1">Platform-wide usage and composition overview</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Brands"   value={data?.stats.totalBrands       ?? 0} icon={Building2} color="purple" />
            <StatCard label="Active Staff"   value={data?.stats.totalStaff  ?? 0} icon={Users}     color="blue"   />
            <StatCard label="Active Clients" value={data?.stats.activeClients ?? 0} icon={Users}     color="green"  />
            <StatCard label="Total Reports"  value={data?.stats.totalReports ?? 0} icon={FileText}  color="amber"  />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Industry breakdown */}
            <div className="sabi-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <PieChart className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-white">Brands by Industry</h2>
                <span className="ml-auto text-xs text-white/25">{totalBrandCount} total</span>
              </div>
              {industryEntries.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-8">No brand data available</p>
              ) : (
                <div>
                  {industryEntries.map(([industry, count]: any, i: number) => (
                    <HorizontalBar key={industry} label={industry} value={count} total={totalBrandCount} color={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} />
                  ))}
                </div>
              )}
            </div>

            {/* Role breakdown */}
            <div className="sabi-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-semibold text-white">Staff by Role</h2>
                <span className="ml-auto text-xs text-white/25">{totalRoleCount} total</span>
              </div>
              {roleEntries.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-8">No staff data available</p>
              ) : (
                <div>
                  {roleEntries.map(([role, count]: any, i: number) => (
                    <HorizontalBar key={role} label={role} value={count} total={totalRoleCount} color={INDUSTRY_COLORS[i % INDUSTRY_COLORS.length]} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Platform health row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="sabi-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <p className="text-sm font-medium text-white">Staff-to-Brand Ratio</p>
              </div>
              <p className="text-3xl font-black text-white">
                {data?.brands && data?.activeStaff
                  ? (data.activeStaff / Math.max(data.brands, 1)).toFixed(1)
                  : '—'}
              </p>
              <p className="text-xs text-white/30 mt-1">staff members per brand</p>
              <p className="text-xs text-white/20 mt-0.5">Recommended: 3–5 per brand</p>
            </div>
            <div className="sabi-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-blue-400" />
                <p className="text-sm font-medium text-white">Reports per Brand</p>
              </div>
              <p className="text-3xl font-black text-white">
                {data?.totalReports && data?.brands
                  ? (data.totalReports / Math.max(data.brands, 1)).toFixed(1)
                  : '—'}
              </p>
              <p className="text-xs text-white/30 mt-1">avg reports per brand</p>
            </div>
            <div className="sabi-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-purple-400" />
                <p className="text-sm font-medium text-white">Client Coverage</p>
              </div>
              <p className="text-3xl font-black text-white">
                {data?.activeClients && data?.brands
                  ? Math.round((data.activeClients / Math.max(data.brands, 1)) * 100)
                  : '—'}%
              </p>
              <p className="text-xs text-white/30 mt-1">brands with active client logins</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
