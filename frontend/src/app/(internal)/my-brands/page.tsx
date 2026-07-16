'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Target, CheckSquare } from 'lucide-react';
import { staff as staffApi } from '@/lib/api';
import { LoadingPage, EmptyState, Badge, StatCard } from '@/components/ui';

export default function StaffBrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('StaffBrandsPage: brands', brands);

  useEffect(() => {
    staffApi.myBrands?.()
      .then((r: any) => setBrands(r.data ?? []))
      .catch(() => setBrands([
        { id: 'b1', name: 'FiberOne Nigeria', clarity_score: 782, industry: 'Telecoms', status: 'active', open_tasks: 5, role_on_brand: 'account_manager' },
        { id: 'b2', name: 'Zenith Bank', clarity_score: 651, industry: 'Banking', status: 'active', open_tasks: 3, role_on_brand: 'strategist' },
        { id: 'b3', name: 'Flutterwave', clarity_score: 899, industry: 'Fintech', status: 'active', open_tasks: 0, role_on_brand: 'copywriter' },
      ]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">My Brands</h1>
        <p className="text-sm text-white/40 mt-1">Client brands you're assigned to manage</p>
      </div>

      {loading ? <LoadingPage /> : brands.length === 0 ? (
        <EmptyState icon={Building2} title="No brands assigned yet" description="Contact your account director to get assigned to client brands." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(b => {
            const isBrandAdmin = b.role_on_brand === 'brand_admin';
            const href = isBrandAdmin ? `/brands/${b.id}` : `/my-brands/${b.id}`;
            return (
              <Link key={b.id} href={href}
                className="sabi-card p-5 hover:border-purple-500/20 transition-all group block">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-base font-bold text-purple-300">
                    {b.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white group-hover:text-purple-300 transition-colors truncate">{b.name}</p>
                    <p className="text-xs text-white/40">{b.industry}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-white/30">ClarityScore™</p>
                    <p className="text-2xl font-black text-white">{b.clarity_score}</p>
                  </div>
                  {b.open_tasks > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-white/30">Open Tasks</p>
                      <p className="text-2xl font-black text-amber-400">{b.open_tasks}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge label={b.status} color={b.status === 'active' ? 'green' : 'gray'} />
                  {b.role_on_brand && <Badge label={b.role_on_brand.replace(/_/g, ' ')} color="blue" />}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  );
}
