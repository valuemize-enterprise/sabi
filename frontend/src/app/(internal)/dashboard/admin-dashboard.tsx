'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Users, FileText, Target, TrendingUp, PenLine, Clock, CheckCircle2, AlertCircle, ChevronRight, BarChart3, Loader2 } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { analytics, brands as brandsApi, staff as staffApi } from '@/lib/api';
import { StatCard, Badge } from '@/components/ui';

const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director'];

function QuickAction({ href, icon: Icon, label, color='purple' }: any) {
  const c: Record<string,string> = {
    purple:'border-purple-500/20 hover:bg-purple-500/5 hover:border-purple-500/30',
    blue:'border-blue-500/20 hover:bg-blue-500/5 hover:border-blue-500/30',
    green:'border-green-500/20 hover:bg-green-500/5 hover:border-green-500/30',
    amber:'border-amber-500/20 hover:bg-amber-500/5 hover:border-amber-500/30',
  };
  const ic: Record<string,string> = { purple:'text-purple-400 bg-purple-500/10', blue:'text-blue-400 bg-blue-500/10', green:'text-green-400 bg-green-500/10', amber:'text-amber-400 bg-amber-500/10' };
  return (
    <Link href={href} className={`sabi-card p-4 flex items-center gap-3 transition-all group border ${c[color]}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ic[color]}`}><Icon className="w-4 h-4"/></div>
      <span className="text-sm text-white/70 group-hover:text-white transition-colors">{label}</span>
      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 ml-auto"/>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAgencyStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');
  const isSA    = user?.role === 'super_admin';

  const [data, setData]         = useState<any>(null);
  const [myBrands, setMyBrands] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const promises: Promise<any>[] = [];
    if (isAdmin) promises.push(analytics.dashboard?.() ?? Promise.resolve({ data: {} }));
    else promises.push(
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agency/staff/me/brands`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sabi_token')}` }
      }).then(r => r.json()).catch(() => ({ data: [] }))
    );
    Promise.all(promises).then(([res]) => {
      if (isAdmin) setData(res.data ?? {});
      else setMyBrands(res.data ?? []);
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          {greeting}, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-white/35 text-sm mt-1 capitalize">
          {user?.role === 'super_admin' ? 'Super Admin' : user?.role?.replace(/_/g,' ')} · Cerebre Media Africa
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      ) : isAdmin ? (
        /* ── ADMIN / SA VIEW ───────────────────────────── */
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Brands"    value={data?.stats.totalBrands ?? 0}    icon={Building2}  color="purple" />
            <StatCard label="Active Staff"    value={data?.stats.activeStaff ?? 0}     icon={Users}      color="blue"   />
            <StatCard label="Active Goals"    value={data?.stats.activeGoals ?? 0}    icon={Target}     color="green"  />
            <StatCard label="Reports Published"value={data?.stats.publishedReports ?? 0} icon={FileText}   color="amber"  />
          </div>

          {/* Top brands leaderboard */}
          {(data?.topBrands ?? []).length > 0 && (
            <div className="sabi-card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Brand Performance — ClarityScore™</h2>
                <Link href="/brands" className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex  items-center">All brands <ChevronRight /></Link>
              </div>
              <div className="space-y-3">
                {(data.topBrands ?? []).slice(0,5).map((b: any, i: number) => (
                  <Link key={b.id} href={`/brands/${b.id}`} className="flex items-center gap-3 group">
                    <span className={`text-sm font-bold w-4 ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-600':'text-white/20'}`}>{i+1}</span>
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">{b.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white group-hover:text-purple-300 transition-colors">{b.name}</p>
                      <div className="w-full bg-white/8 rounded-full h-1 mt-1">
                        <div className="h-1 rounded-full bg-purple-500" style={{width:`${((b.clarity_score??0)/1000)*100}%`}}/>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-white flex-shrink-0">{b.clarity_score ?? 0}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction href="/brands/new"  icon={Building2} label="New Brand"   color="purple"/>
            <QuickAction href="/staff"       icon={Users}     label="Manage Staff" color="blue"/>
            <QuickAction href="/reports"     icon={FileText}  label="View Reports" color="amber"/>
            <QuickAction href="/ask"         icon={BarChart3} label="Ask ARIA"    color="green"/>
          </div>
        </>
      ) : (
        /* ── STAFF VIEW ─────────────────────────────────── */
        <>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <StatCard label="My Brands"   value={myBrands.length}                                  icon={Building2}   color="purple"/>
            <StatCard label="Open Tasks"  value={myBrands.reduce((s:number,b:any)=>s+(b.open_tasks??0),0)} icon={Clock} color="amber"/>
          </div>

          {myBrands.length === 0 ? (
            <div className="sabi-card p-10 text-center">
              <Building2 className="w-10 h-10 text-white/10 mx-auto mb-3"/>
              <p className="text-white/40 text-sm">You haven't been assigned to any brands yet.</p>
              <p className="text-white/20 text-xs mt-1">Contact your Account Director to get assigned.</p>
            </div>
          ) : (
            <>
              <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">My Assigned Brands</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {myBrands.slice(0,4).map((b:any) => (
                  <Link key={b.id} href={`/my-brands/${b.id ?? b.brand_id}`}
                    className="sabi-card p-5 hover:border-purple-500/20 transition-all group block">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-base font-bold text-purple-300">{b.name?.[0]??'B'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white group-hover:text-purple-300 transition-colors truncate">{b.name}</p>
                        <p className="text-xs text-white/40 capitalize">{b.role_on_brand?.replace(/_/g,' ')}</p>
                      </div>
                      {(b.open_tasks??0)>0 && <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">{b.open_tasks} tasks</span>}
                    </div>
                    <div className="w-full bg-white/8 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-purple-500" style={{width:`${((b.clarity_score??0)/1000)*100}%`}}/>
                    </div>
                    <p className="text-xs text-white/25 mt-1">ClarityScore™: {b.clarity_score??0}</p>
                  </Link>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction href="/my-work"   icon={PenLine}       label="Log My Work"   color="purple"/>
                <QuickAction href="/my-brands" icon={Building2}     label="All My Brands" color="blue"/>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
