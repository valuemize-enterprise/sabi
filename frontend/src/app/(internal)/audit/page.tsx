'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { superAdmin } from '@/lib/api';

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const c: Record<string,string> = {
    gray:'bg-white/5 text-white/40', green:'bg-green-500/10 text-green-400 border border-green-500/20',
    blue:'bg-blue-500/10 text-blue-400 border border-blue-500/20', red:'bg-red-500/10 text-red-400 border border-red-500/20',
    amber:'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    purple:'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  };
  return <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium border ${c[color]??c.gray}`}>{label}</span>;
}

const ACTION_META: Record<string, { color: string; label: string }> = {
  LOGIN:                { color:'green',  label:'LOGIN'          },
  LOGOUT:               { color:'gray',   label:'LOGOUT'         },
  SA_LOGIN:             { color:'red',    label:'SA LOGIN'       },
  SA_CREATE_USER:       { color:'blue',   label:'CREATE USER'    },
  SA_DEACTIVATE_USER:   { color:'red',    label:'DEACTIVATE USER'},
  SA_ACTIVATE_USER:     { color:'green',  label:'ACTIVATE USER'  },
  CREATE_BRAND:         { color:'blue',   label:'CREATE BRAND'   },
  UPDATE_BRAND:         { color:'amber',  label:'UPDATE BRAND'   },
  DELETE_BRAND:         { color:'red',    label:'DELETE BRAND'   },
  CREATE_CLIENT:        { color:'blue',   label:'CREATE CLIENT'  },
  PUBLISH_REPORT:       { color:'green',  label:'PUBLISH REPORT' },
  GENERATE_NARRATIVE:   { color:'purple', label:'ARIA NARRATIVE' },
  PASSWORD_CHANGED:     { color:'amber',  label:'PW CHANGED'     },
  UPDATE_SETTING:       { color:'amber',  label:'UPDATE SETTING' },
  DEACTIVATE_STAFF:     { color:'red',    label:'DEACTIVATE STAFF'},
};

const ROLES = ['super_admin','ceo','managing_director','account_director','account_manager','senior_strategist','strategist','copywriter','social_media_manager'];

export default function SuperAdminAuditPage() {
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [role, setRole]       = useState('');
  const [action, setAction]   = useState('');
  const [search, setSearch]   = useState('');
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string,string> = { page: String(page), limit: String(LIMIT) };
      if (role)   p.actor_role = role;
      if (action) p.action     = action;
      const res: any = await superAdmin.audit(p);
      setLogs(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
    } catch {} finally { setLoading(false); }
  }, [page, role, action]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? logs.filter(l => l.actor_email?.toLowerCase().includes(search.toLowerCase()) || l.action?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const totalPages = Math.ceil(total / LIMIT);

  const exportCSV = () => {
    const rows = [['Time','Actor','Role','Action','Resource Type','IP'].join(','),
      ...filtered.map(l => [new Date(l.created_at).toISOString(), l.actor_email||'', l.actor_role||'', l.action||'', l.resource_type||'', l.ip_address||''].join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type:'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='sabi-audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-red-400/60 font-semibold uppercase tracking-widest mb-1">Security & Compliance</p>
          <h1 className="text-2xl font-bold text-white">Audit Log</h1>
          <p className="text-white/30 text-sm mt-1">{total.toLocaleString()} total events · Page {page} of {totalPages || 1}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-white/30 hover:text-white hover:border-white/20 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 text-sm border border-white/10 rounded-lg text-white/50 hover:text-white hover:border-white/20 transition-all">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="sabi-input pl-9 text-sm w-56" placeholder="Search email or action…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="sabi-input w-44 text-sm" value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}>
          <option value="">All roles</option>
          {ROLES.map(r=><option className='bg-black' key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
        </select>
        <select className="sabi-input w-44 text-sm" value={action} onChange={e=>{setAction(e.target.value);setPage(1);}}>
          <option value="">All actions</option>
          {Object.keys(ACTION_META).map(a=><option className='bg-black' key={a} value={a}>{a}</option>)}
        </select>
        {(role||action||search) && (
          <button onClick={()=>{setRole('');setAction('');setSearch('');setPage(1);}} className="text-xs text-red-400 hover:text-red-300 transition-colors">
            Clear filters ×
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
        </div>
      ) : (
        <>
          <div className="sabi-card overflow-hidden mb-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Timestamp','Actor','Role','Action','Resource','IP Address'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wider first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-white/20 text-sm">No audit logs found</td></tr>
                )}
                {filtered.map((log, i) => {
                  const meta = ACTION_META[log.action] ?? { color:'gray', label: log.action };
                  return (
                    <tr key={log.id??i} className={`border-b border-white/3 hover:bg-white/2 transition-all ${i%2===0?'':'bg-white/1'}`}>
                      <td className="px-4 py-3 pl-5 whitespace-nowrap">
                        <p className="text-xs text-white/60">{new Date(log.created_at).toLocaleDateString('en-NG',{month:'short',day:'numeric',year:'numeric'})}</p>
                        <p className="text-xs text-white/25">{new Date(log.created_at).toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/60 max-w-[180px] truncate">{log.actor_email||'System'}</td>
                      <td className="px-4 py-3">
                        <Badge label={(log.actor_role||'—').replace(/_/g,' ')} color="gray" />
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={meta.label} color={meta.color} />
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40">
                        {log.resource_type ? (
                          <span>{log.resource_type}{log.resource_id ? <span className="text-white/20"> #{log.resource_id.slice(0,8)}</span> : ''}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 pr-5 font-mono text-xs text-white/25">{log.ip_address||'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/30">
                Showing {((page-1)*LIMIT)+1}–{Math.min(page*LIMIT, total)} of {total.toLocaleString()} events
              </p>
              <div className="flex items-center gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                  const p = Math.max(1,Math.min(page-2,totalPages-4))+i;
                  return (
                    <button key={p} onClick={()=>setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs transition-all ${page===p?'bg-red-600 text-white':'border border-white/10 text-white/40 hover:text-white hover:border-white/20'}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 disabled:opacity-30 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
