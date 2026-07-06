'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Building2, Calendar, Mail, Phone } from 'lucide-react';
import { staff as staffApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, Badge } from '@/components/ui';

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { staffApi.get(id).then((r:any)=>setUser(r.data.user)).finally(()=>setLoading(false)); }, [id]);

  if (loading) return <LoadingPage/>;
  if (!user)   return <div className="p-6 text-white/40">Staff member not found</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <AgencyTopNav/>
      <Link href="/internal/staff" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"><ArrowLeft className="w-3.5 h-3.5"/>Back to Staff</Link>

      <div className="sabi-card p-6 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-2xl font-black text-purple-300">{user.full_name[0]}</div>
          <div>
            <h1 className="text-xl font-bold text-white">{user.full_name}</h1>
            <Badge label={user.role.replace(/_/g,' ')} color="purple"/>
            <p className="text-sm text-white/40 mt-2 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/>{user.email}</p>
            {user.phone&&<p className="text-sm text-white/40 flex items-center gap-1.5 mt-1"><Phone className="w-3.5 h-3.5"/>{user.phone}</p>}
            {user.department&&<p className="text-sm text-white/40 flex items-center gap-1.5 mt-1"><Building2 className="w-3.5 h-3.5"/>Dept: {user.department}</p>}
            {user.last_login&&<p className="text-xs text-white/20 mt-2">Last login: {new Date(user.last_login).toLocaleDateString()}</p>}
          </div>
          <div className="ml-auto"><Badge label={user.is_active?'Active':'Inactive'} color={user.is_active?'green':'gray'}/></div>
        </div>
      </div>

      {user.staff_brand_assignments?.length > 0 && (
        <div className="sabi-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Assigned Brands</h2>
          <div className="grid grid-cols-2 gap-3">
            {user.staff_brand_assignments.map((a:any)=>(
              <Link key={a.brand_id} href={`/brands/${a.brand_id}`} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5 hover:border-purple-500/20 transition-all">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">{a.brands?.name?.[0]}</div>
                <div><p className="text-sm text-white">{a.brands?.name}</p><p className="text-xs text-white/30 capitalize">{a.role_on_brand}</p></div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
