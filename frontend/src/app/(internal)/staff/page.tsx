'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserCheck, Plus, Search, ChevronRight, UserX } from 'lucide-react';
import { staff as staffApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { PageHeader, LoadingPage, EmptyState, Badge } from '@/components/ui';

const ROLE_COLORS: Record<string,string> = { ceo:'purple',managing_director:'purple',account_director:'blue',account_manager:'teal',senior_strategist:'green',strategist:'green',copywriter:'amber',social_media_manager:'pink',analytics_specialist:'blue',creative_lead:'orange' };

export default function StaffListPage() {
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [role, setRole]       = useState('');

  useEffect(() => {
    const p: Record<string,string> = { limit:'100' };
    if (role) p.role = role;
    staffApi.list(p).then((r:any) => setItems(r.data??[])).finally(()=>setLoading(false));
  }, [role]);

  const filtered = search ? items.filter(u=>u.full_name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())) : items;

  const deactivate = async (id: string) => {
    if(!confirm('Deactivate this staff member?')) return;
    await staffApi.deactivate(id);
    setItems(p=>p.map(u=>u.id===id?{...u,is_active:false}:u));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <AgencyTopNav title="Staff" subtitle="Agency team members"/>
      <PageHeader title="Staff" subtitle={`${items.length} team member${items.length!==1?'s':''}`}
        action={<Link href="/staff/new" className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus className="w-4 h-4"/>Add Staff</Link>}/>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"/><input className="sabi-input pl-9 text-sm" placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <select className="sabi-input w-44 text-sm" value={role} onChange={e=>setRole(e.target.value)}>
          <option className='bg-black' value="">All roles</option>
          {['account_manager','senior_strategist','strategist','copywriter','social_media_manager','analytics_specialist'].map(r=>(
            <option className='bg-black' key={r} value={r}>{r.replace(/_/g,' ')}</option>
          ))}
        </select>
      </div>

      {loading?<LoadingPage/>:filtered.length===0?<EmptyState icon={UserCheck} title="No staff found"/>:(
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(u=>(
            <div key={u.id} className="sabi-card p-5 hover:border-purple-500/20 transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
                  {u.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{u.full_name}</p>
                  <p className="text-xs text-white/40 truncate">{u.email}</p>
                </div>
                <Badge label={u.is_active?'Active':'Inactive'} color={u.is_active?'green':'gray'}/>
              </div>
              <div className="flex items-center justify-between">
                <Badge label={u.role.replace(/_/g,' ')} color={ROLE_COLORS[u.role]??'gray'}/>
                <div className="flex items-center gap-2">
                  {u.is_active&&<button onClick={()=>deactivate(u.id)} className="text-xs text-white/20 hover:text-red-400 transition-colors"><UserX className="w-4 h-4"/></button>}
                  <Link href={`/staff/${u.id}`} className="text-white/20 hover:text-purple-400 transition-colors"><ChevronRight className="w-4 h-4"/></Link>
                </div>
              </div>
              {u.last_login&&<p className="text-xs text-white/20 mt-3">Last login: {new Date(u.last_login).toLocaleDateString()}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
