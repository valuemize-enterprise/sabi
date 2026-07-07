'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, UserCheck, UserX, Key, Loader2,
  X, Check, ChevronDown, AlertTriangle, Building2, Mail
} from 'lucide-react';
import { superAdmin } from '@/lib/api';
import { brands as brandsApi } from '@/lib/api';

// ── Shared helpers ────────────────────────────────────────────
const SA_TOKEN = () =>
  typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

const saFetch = async (path: string, opts?: RequestInit) => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res  = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${SA_TOKEN()}`,
      ...(opts?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || `Error ${res.status}`);
  return body;
};

const ROLES = [
 'CEO','Managing Director','Account Director','Account Manager',
  'Senior Strategist','Strategist','Copywriter','Social Media Manager',
  'Analytics Specialist','Creative Lead',
  'Art Director',
  'Senior Art Director',
  'Business Director',
  'Brand Manager',
  'Senior Brand Manager',
  'Economist',
  'Website Developer',
  'Video Editor',
  'Cinematographer',
  'Intern',
  'Researcher',
  'Webmaster',
  'Influencer Marketing Expert',
  'Other'
];

const ROLE_COLOR: Record<string, string> = {
  ceo:'red', managing_director:'red', account_director:'purple',
  account_manager:'blue', senior_strategist:'green', strategist:'green',
  copywriter:'amber', social_media_manager:'pink', analytics_specialist:'teal',
};

function Badge({ label, color = 'gray' }: { label: string; color?: string }) {
  const c: Record<string, string> = {
    gray:  'bg-white/5 text-white/40 border-white/10',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    red:   'bg-red-500/10 text-red-400 border-red-500/20',
    blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple:'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    teal:  'bg-teal-500/10 text-teal-400 border-teal-500/20',
    pink:  'bg-pink-500/10 text-pink-400 border-pink-500/20',
  };
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${c[color] ?? c.gray}`}>
      {label}
    </span>
  );
}

// ── Credential card shown after creation ──────────────────────
function CredentialCard({ result, onClose, isClient }: { result: any; onClose: () => void; isClient: boolean }) {
  const [copied, setCopied] = useState('');
  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-6 h-6 text-green-400" />
      </div>
      <h3 className="font-bold text-white mb-0.5">Account created!</h3>
      <p className="text-sm text-white/40 mb-4">
        {isClient ? result.client?.full_name : result.user?.full_name}
        {isClient && result.brand_name ? ` · ${result.brand_name}` : ''}
      </p>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-5 text-left">
        <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Share these credentials securely
        </p>
        {[
          ['Email', isClient ? result.client?.email : result.user?.email],
          ['Temp Password', result.temp_password],
          ['Portal URL', isClient ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/client/login` : `${process.env.NEXT_PUBLIC_APP_URL || ''}/login`],
        ].map(([label, val]) => (
          <div key={label} className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/30">{label}</p>
              <p className="text-sm font-mono text-white truncate">{val}</p>
            </div>
            <button onClick={() => copy(val as string, label as string)}
              className="text-white/30 hover:text-white transition-colors flex-shrink-0">
              {copied === label ? <Check className="w-4 h-4 text-green-400" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
      <button onClick={onClose}
        className="w-full py-2.5 text-sm bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-600/30 transition-all">
        Done — Close
      </button>
    </div>
  );
}

export default function SuperAdminUsersPage() {
  const [items, setItems]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'staff' | 'clients'>('staff');
  const [search, setSearch]   = useState('');
  const [role, setRole]       = useState('');
  const [total, setTotal]     = useState(0);
  const [brands, setBrands]   = useState<any[]>([]);

  // Modal state
  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);

  // Staff form
  const [staffForm, setStaffForm] = useState({ email:'', full_name:'', role:'', department:'' });
  // Client form
  const [clientForm, setClientForm] = useState({ email:'', full_name:'', brand_id:'', job_title:'', phone:'', company_name:'' });

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pwResetResult, setPwResetResult] = useState<{ name: string; temp: string } | null>(null);

  // Load brands for client creation dropdown
  useEffect(() => {
    brandsApi.list({ limit:'100' }).then((r: any) => setBrands(r.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = tab === 'clients' ? '/api/super-admin/clients' : undefined;
      let data: any[], count = 0;
      if (tab === 'clients') {
        const res: any = await saFetch(`/api/super-admin/clients?limit=50`);
        data  = res.data ?? [];
        count = res.pagination?.total ?? data.length;
      } else {
        const p: Record<string, string> = { type: 'staff', limit: '50' };
        if (role) p.role = role;
        const res: any = await superAdmin.users(p);
        data  = res.data ?? [];
        count = res.pagination?.total ?? data.length;
      }
      const filtered = search ? data.filter((u: any) =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      ) : data;
      setItems(filtered);
      setTotal(count);
    } catch {} finally { setLoading(false); }
  }, [tab, role, search]);

  useEffect(() => { load(); }, [load]);

  // ── Create staff ──────────────────────────────────────────
  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.email || !staffForm.full_name || !staffForm.role) return;
    setCreating(true);
    try {
      const res: any = await superAdmin.createUser(staffForm);
      setCreateResult({ ...res.data, isClient: false });
      setItems(p => [res.data.user, ...p]);
      setStaffForm({ email:'', full_name:'', role:'', department:'' });
    } catch (err: any) { setError(err.message || 'Failed to create staff account'); }
    finally { setCreating(false); }
  };

  // ── Create client ─────────────────────────────────────────
  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.email || !clientForm.full_name || !clientForm.brand_id) return;
    setCreating(true);
    try {
      const res: any = await saFetch('/api/super-admin/clients', {
        method: 'POST',
        body: JSON.stringify(clientForm),
      });
      setCreateResult({ ...res.data, isClient: true });
      setItems(p => [res.data.client, ...p]);
      setClientForm({ email:'', full_name:'', brand_id:'', job_title:'', phone:'', company_name:'' });
    } catch (err: any) { setError(err.message || 'Failed to create client account'); }
    finally { setCreating(false); }
  };

  // ── Table actions ─────────────────────────────────────────
  const tableAction = async (id: string, action: 'deactivate'|'activate'|'reset') => {
    setActionLoading(`${id}_${action}`);
    try {
      const table = tab === 'clients' ? 'clients' : 'users';
      if (action === 'deactivate') {
        await saFetch(`/api/super-admin/${table}/${id}/deactivate`, { method: 'PUT' });
        setItems(p => p.map(u => u.id === id ? { ...u, is_active: false } : u));
      } else if (action === 'activate') {
        await saFetch(`/api/super-admin/${table}/${id}/activate`, { method: 'PUT' });
        setItems(p => p.map(u => u.id === id ? { ...u, is_active: true } : u));
      } else {
        const res: any = await saFetch(`/api/super-admin/${table}/${id}/reset-password`, { method: 'PUT' });
        const u = items.find(i => i.id === id);
        setPwResetResult({ name: u?.full_name || u?.email || 'User', temp: res.data.temp_password });
      }
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const closeModal = () => { setShowCreate(false); setCreateResult(null); };
  const isClient  = tab === 'clients';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-red-400/60 font-semibold uppercase tracking-widest mb-1">User Management</p>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-white/30 text-sm mt-1">
            {total} {isClient ? 'client portal accounts' : 'staff members'}
          </p>
        </div>
        <button onClick={() => { setShowCreate(true); setCreateResult(null); }}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-600/30 transition-all">
          <Plus className="w-4 h-4" />
          {isClient ? 'Create Client Account' : 'Create Staff Account'}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 w-fit mb-6">
        {(['staff', 'clients'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch(''); setRole(''); }}
            className={`px-5 py-2 text-sm rounded-lg transition-all capitalize ${t === tab ? 'bg-red-600 text-white' : 'text-white/40 hover:text-white'}`}>
            {t === 'clients' ? 'Client Accounts' : 'Staff'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input className="sabi-input pl-9 text-sm w-60" placeholder={`Search ${isClient ? 'clients' : 'staff'}…`}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {!isClient && (
          <select className="sabi-input w-44 text-sm" value={role} onChange={e => setRole(e.target.value)}>
            <option className='bg-black' value="">All roles</option>
            {ROLES.map(r => <option className='bg-black' key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        )}
        {isClient && (
          <select className="sabi-input w-52 text-sm" onChange={e => setSearch(e.target.value)}>
            <option className='bg-black'  value="">All brands</option>
            {brands.map((b: any) => <option className='bg-black'  key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {pwResetResult && (
        <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300 mb-1">Password reset for <strong>{pwResetResult.name}</strong></p>
            <p className="text-xs text-white/50 mb-2">Temporary password: <code className="text-amber-300 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">{pwResetResult.temp}</code></p>
            <p className="text-xs text-white/30">Share this with the user securely — they must change it on first login.</p>
          </div>
          <button onClick={() => setPwResetResult(null)} className="text-amber-400/50 hover:text-amber-400 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-red-500/20 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white">
                  {isClient ? 'Create Client Account' : 'Create Staff Account'}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  {isClient ? 'Creates a client portal login linked to a brand' : 'Creates an agency staff login'}
                </p>
              </div>
              <button onClick={closeModal} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createResult ? (
              <CredentialCard result={createResult} onClose={closeModal} isClient={!!createResult.isClient} />
            ) : isClient ? (
              /* Client creation form */
              <form onSubmit={createClient} className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Brand *</label>
                  <select className="sabi-input" required value={clientForm.brand_id}
                    onChange={e => setClientForm(f => ({ ...f, brand_id: e.target.value }))}>
                    <option value="">Select brand this client belongs to…</option>
                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {brands.length === 0 && (
                    <p className="text-xs text-amber-400 mt-1">No brands found — create a brand first.</p>
                  )}
                </div>
                {[
                  ['email',        'Email Address *',  'email',  'client@yourbrand.com'],
                  ['full_name',    'Full Name *',      'text',   'e.g. Amaka Obi'],
                  ['job_title',    'Job Title',        'text',   'e.g. Marketing Manager'],
                  ['company_name', 'Company Name',     'text',   'e.g. Flutterwave Ltd'],
                  ['phone',        'Phone Number',     'text',   '+234 800 000 0000'],
                ].map(([key, label, type, placeholder]) => (
                  <div key={key}>
                    <label className="text-xs text-white/50 mb-1.5 block">{label}</label>
                    <input type={type} className="sabi-input" placeholder={placeholder}
                      required={label.includes('*')}
                      value={(clientForm as any)[key]}
                      onChange={e => setClientForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                  <p className="text-xs text-blue-400/80">
                    A temporary password will be generated. The client must change it on first login.<br />
                    Portal URL: <span className="font-mono">/client/login</span>
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating || !clientForm.brand_id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-600/30 transition-all disabled:opacity-50">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Client Account'}
                  </button>
                  <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
                </div>
              </form>
            ) : (
              /* Staff creation form */
              <form onSubmit={createStaff} className="space-y-4">
                {[
                  ['email',      'Email Address *', 'email'],
                  ['full_name',  'Full Name *',      'text'],
                  ['department', 'Department',       'text'],
                ].map(([k, l, t]) => (
                  <div key={k}>
                    <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
                    <input type={t} className="sabi-input" required={l.includes('*')}
                      value={(staffForm as any)[k]}
                      onChange={e => setStaffForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Role *</label>
                  <select className="sabi-input" required value={staffForm.role}
                    onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}>
                    <option className='bg-black' value="">Select role…</option>
                    {ROLES.map(r => <option key={r} className='bg-black' value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-red-600/20 border border-red-500/30 text-red-300 rounded-lg hover:bg-red-600/30 transition-all disabled:opacity-50">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Staff Account'}
                  </button>
                  <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-white/20 text-sm">
          No {isClient ? 'client accounts' : 'staff members'} found
          {isClient && (
            <p className="text-xs text-white/15 mt-2">
              Create client accounts so brand contacts can access the client portal
            </p>
          )}
        </div>
      ) : (
        <div className="sabi-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {(isClient
                  ? ['Name / Email', 'Brand', 'Job Title', 'Status', 'Joined', 'Actions']
                  : ['Name / Email', 'Role', 'Status', 'Joined', 'Actions']
                ).map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wider first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((u, i) => (
                <tr key={u.id} className={`border-b border-white/3 hover:bg-white/2 transition-all ${i%2===0?'':'bg-white/1'}`}>
                  <td className="px-4 py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                        {(u.full_name || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{u.full_name || '—'}</p>
                        <p className="text-xs text-white/30">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  {isClient && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-white/20" />
                        <span className="text-sm text-white/60">{u.brands?.name || '—'}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {isClient
                      ? <span className="text-sm text-white/50">{u.job_title || '—'}</span>
                      : <Badge label={(u.role || '—').replace(/_/g, ' ')} color={ROLE_COLOR[u.role ?? ''] ?? 'gray'} />
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge label={u.is_active ? 'Active' : 'Inactive'} color={u.is_active ? 'green' : 'red'} />
                      {u.must_reset_password && <span className="text-xs text-amber-400">Needs reset</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/30">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <div className="flex items-center gap-3 flex-wrap">
                      {u.is_active ? (
                        <button onClick={() => tableAction(u.id, 'deactivate')} disabled={actionLoading === `${u.id}_deactivate`}
                          className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40">
                          {actionLoading === `${u.id}_deactivate` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}Deactivate
                        </button>
                      ) : (
                        <button onClick={() => tableAction(u.id, 'activate')} disabled={actionLoading === `${u.id}_activate`}
                          className="flex items-center gap-1 text-xs text-green-400/70 hover:text-green-400 transition-colors disabled:opacity-40">
                          {actionLoading === `${u.id}_activate` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}Activate
                        </button>
                      )}
                      <button onClick={() => tableAction(u.id, 'reset')} disabled={actionLoading === `${u.id}_reset`}
                        className="flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-400 transition-colors disabled:opacity-40">
                        {actionLoading === `${u.id}_reset` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}Reset PW
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
