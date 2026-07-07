'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Plus, Key, UserX, UserCheck,
  Loader2, X, Check, AlertTriangle, Mail, Phone
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { PageHeader, EmptyState, Badge, LoadingPage } from '@/components/ui';

const agencyToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

const agFetch = async (path: string, opts?: RequestInit) => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res  = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${agencyToken()}`,
      ...(opts?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || `Error ${res.status}`);
  return body;
};

function CredentialCard({ client, temp, onClose }: { client: any; temp: string; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const copy = (val: string, k: string) => {
    navigator.clipboard.writeText(val);
    setCopied(k);
    setTimeout(() => setCopied(''), 2000);
  };
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/30">{label}</p>
        <p className="text-sm font-mono text-white truncate">{value}</p>
      </div>
      <button onClick={() => copy(value, label)} className="text-white/30 hover:text-purple-400 transition-colors">
        {copied === label ? <Check className="w-4 h-4 text-green-400" /> : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        )}
      </button>
    </div>
  );

  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-6 h-6 text-green-400" />
      </div>
      <h3 className="font-bold text-white mb-1">Client account created!</h3>
      <p className="text-sm text-white/40 mb-5">{client.full_name} · {client.email}</p>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-5 text-left">
        <p className="text-xs text-amber-400 font-semibold mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Send these to the client securely — do not email plain text passwords
        </p>
        <Row label="Email"           value={client.email} />
        <Row label="Temp Password"   value={temp} />
        <Row label="Client Login URL" value={`${window.location.origin}/client/login`} />
      </div>
      <p className="text-xs text-white/30 mb-5">The client must change their password on first login.</p>
      <button onClick={onClose} className="sabi-btn-primary w-full py-2.5 text-sm">Done</button>
    </div>
  );
}

export default function BrandClientsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [clients, setClients]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [createResult, setCreateResult] = useState<{ client: any; temp: string } | null>(null);
  const [form, setForm] = useState({ email:'', full_name:'', job_title:'', phone:'' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    agFetch(`/api/agency/clients?brand_id=${brandId}&limit=50`)
      .then((r: any) => setClients(r.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [brandId]);

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.full_name) return;
    setCreating(true);
    try {
      const res: any = await agFetch('/api/agency/clients', {
        method: 'POST',
        body: JSON.stringify({ ...form, brand_id: brandId }),
      });
      setCreateResult({ client: res.data.client, temp: res.data.temp_password });
      setClients(p => [res.data.client, ...p]);
      setForm({ email:'', full_name:'', job_title:'', phone:'' });
    } catch (err: any) { setError(err.message || 'Failed to create client'); }
    finally { setCreating(false); }
  };

  const resetPw = async (id: string, email: string) => {
    if (!confirm(`Reset password for ${email}?`)) return;
    setActionLoading(`${id}_reset`);
    try {
      const res: any =       await agFetch(`/api/agency/clients/${id}/reset-password`, { method: 'POST' });
      setResetResult(res.data.temp_password);
    } catch (err: any) { setError(err.message); }
    finally { setActionLoading(null); }
  };

  const deactivate = async (id: string) => {
    if (!confirm('Deactivate this client account?')) return;
    setActionLoading(`${id}_deact`);
    try {
      await agFetch(`/api/agency/clients/${id}/deactivate`, { method: 'POST' });
      setClients(p => p.map(c => c.id === id ? { ...c, is_active: false } : c));
    } finally { setActionLoading(null); }
  };

  const activate = async (id: string) => {
    setActionLoading(`${id}_act`);
    try {
      await agFetch(`/api/agency/clients/${id}/activate`, { method: 'POST' });
      setClients(p => p.map(c => c.id === id ? { ...c, is_active: true } : c));
    } finally { setActionLoading(null); }
  };

  const closeModal = () => { setShowCreate(false); setCreateResult(null); };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AgencyTopNav />
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Brand
      </Link>

      <PageHeader
        title="Client Portal Accounts"
        subtitle={`${clients.length} contact${clients.length !== 1 ? 's' : ''} with access to the client portal`}
        action={
          <button onClick={() => { setShowCreate(true); setCreateResult(null); }}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <Plus className="w-4 h-4" /> Create Client Account
          </button>
        }
      />

      {/* Info banner */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 mb-6 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Client portal accounts give your clients read access to their brand's intelligence</p>
          <p className="text-xs text-white/40 mt-0.5">They can view reports, goals, ClarityScore™, Ask ARIA, and more — but cannot edit anything.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {resetResult && (
        <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300 mb-1">Password reset successful</p>
            <p className="text-xs text-white/50 mb-2">Temporary password: <code className="text-amber-300 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">{resetResult}</code></p>
            <p className="text-xs text-white/30">Send this to the client securely. They must change it on first login.</p>
          </div>
          <button onClick={() => setResetResult(null)} className="text-amber-400/50 hover:text-amber-400 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white">Create Client Account</h2>
                <p className="text-xs text-white/30 mt-0.5">Portal login for a brand contact</p>
              </div>
              <button onClick={closeModal} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createResult ? (
              <CredentialCard client={createResult.client} temp={createResult.temp} onClose={closeModal} />
            ) : (
              <form onSubmit={createClient} className="space-y-4">
                {[
                  ['email',     'Email Address *', 'email', 'contact@brand.com'],
                  ['full_name', 'Full Name *',      'text',  'e.g. Amaka Obi'],
                  ['job_title', 'Job Title',        'text',  'e.g. CEO, Marketing Manager'],
                  ['phone',     'Phone Number',     'text',  '+234 800 000 0000'],
                ].map(([k, l, t, ph]) => (
                  <div key={k}>
                    <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
                    <input type={t} className="sabi-input" placeholder={ph}
                      required={l.includes('*')}
                      value={(form as any)[k]}
                      onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
                <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-3">
                  <p className="text-xs text-purple-400/80">
                    A temporary password will be auto-generated. The client must change it on first login via <span className="font-mono">/client/login</span>
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating}
                    className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Account'}
                  </button>
                  <button type="button" onClick={closeModal} className="px-4 py-2.5 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Clients table */}
      {loading ? <LoadingPage label="Loading client accounts…" /> : clients.length === 0 ? (
        <EmptyState icon={Users} title="No client accounts yet"
          description="Create a client account so your brand contact can log in and view their brand intelligence."
          action={{ label: 'Create First Client Account', onClick: () => setShowCreate(true) }} />
      ) : (
        <div className="sabi-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Contact', 'Job Title', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wider first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} className={`border-b border-white/3 hover:bg-white/2 transition-all ${i%2===0?'':'bg-white/1'}`}>
                  <td className="px-4 py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
                        {(c.full_name || c.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{c.full_name}</p>
                        <p className="text-xs text-white/30">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white/50">{c.job_title || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge label={c.is_active ? 'Active' : 'Inactive'} color={c.is_active ? 'green' : 'gray'} />
                      {c.must_reset_password && <span className="text-xs text-amber-400">Needs reset</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/30">
                    {c.last_login ? new Date(c.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 pr-5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => resetPw(c.id, c.email)} disabled={actionLoading === `${c.id}_reset`}
                        className="flex items-center gap-1 text-xs text-amber-400/70 hover:text-amber-400 transition-colors disabled:opacity-40">
                        {actionLoading === `${c.id}_reset` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}Reset PW
                      </button>
                      {c.is_active ? (
                        <button onClick={() => deactivate(c.id)} disabled={actionLoading === `${c.id}_deact`}
                          className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40">
                          {actionLoading === `${c.id}_deact` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}Deactivate
                        </button>
                      ) : (
                        <button onClick={() => activate(c.id)} disabled={actionLoading === `${c.id}_act`}
                          className="flex items-center gap-1 text-xs text-green-400/70 hover:text-green-400 transition-colors disabled:opacity-40">
                          {actionLoading === `${c.id}_act` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}Activate
                        </button>
                      )}
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
