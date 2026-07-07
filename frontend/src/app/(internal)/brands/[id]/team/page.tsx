'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, UserPlus, X, Search, Check, Loader2,
  ChevronDown, Users2, Shield, AlertTriangle
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { AgencyTopNav }   from '@/components/internal/AgencyTopNav';
import { BRAND_ROLE_OPTIONS } from '@/components/internal/RoleChip';
import { useBrandPermissions, canCreateBrandAdmin } from '@/lib/permissions';
import { LoadingPage, EmptyState, Badge, PageHeader } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(opts?.headers ?? {}) },
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.message); return b; });

function RoleDropdown({ current, staffId, brandId, canElevate, onChanged }: any) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const change = async (val: string) => {
    setError('');
    if (val === current) { setOpen(false); return; }
    if (!canElevate && val === 'brand_admin') {
      setError('Only the Super Admin can assign the Brand Admin role.');
      setOpen(false); return;
    }
    setSaving(true);
    try {
      await api(`/api/agency/brands/${brandId}/team/${staffId}`, {
        method: 'PATCH', body: JSON.stringify({ role_on_brand: val }),
      });
      onChanged(val);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); setOpen(false); }
  };

  const current_meta = BRAND_ROLE_OPTIONS.find(r => r.value === current);

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all hover:opacity-80 ${
          current === 'brand_admin'
            ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
            : 'bg-white/5 text-white/50 border-white/10'
        }`}>
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{current_meta?.icon}</span>}
        <span>{current_meta?.label ?? current}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {error && (
        <p className="text-[11px] text-red-400 mt-1 text-right max-w-48 ml-auto leading-tight">{error}</p>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-72 bg-[#12122a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest px-3 py-2 border-b border-white/5">
              Change Role on Brand
            </p>
            <div className="max-h-72 overflow-y-auto">
              {BRAND_ROLE_OPTIONS.map(r => {
                const locked = r.elevated && !canElevate;
                return (
                  <button key={r.value} onClick={() => change(r.value)} disabled={locked}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                      r.value === current ? 'bg-purple-500/10' :
                      locked ? 'opacity-40 cursor-not-allowed' :
                      'hover:bg-white/5'
                    }`}>
                    <span className="text-sm flex-shrink-0">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-medium ${r.value === current ? 'text-purple-300' : 'text-white/70'}`}>{r.label}</p>
                        {r.elevated && <Shield className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                        {locked && <span className="text-[9px] text-amber-400">SA only</span>}
                      </div>
                      <p className="text-[10px] text-white/30 leading-tight">{r.desc}</p>
                    </div>
                    {r.value === current && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BrandTeamPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const { user }        = useAgencyStore();
  const perms           = useBrandPermissions(brandId);
  const canElevate      = canCreateBrandAdmin(user?.role);

  const [team, setTeam]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [available, setAvailable] = useState<any[]>([]);
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [selRole, setSelRole] = useState('account_manager');
  const [adding, setAdding]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api(`/api/agency/brands/${brandId}/team`);
      setTeam(res.data?.team ?? []);
    } catch { setTeam([]); }
    finally { setLoading(false); }
  }, [brandId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const openAdd = async () => {
    setError(''); setShowAdd(true); setSelected(null); setSelRole('account_manager'); setSearch('');
    try {
      const res: any = await api(`/api/agency/brands/${brandId}/team/available`);
      setAvailable(res.data?.staff ?? []);
    } catch { setAvailable([]); }
  };

  const addMember = async () => {
    setError('');
    if (!selected) return;
    if (selRole === 'brand_admin' && !canElevate) {
      setError('Only the Super Admin can assign the Brand Admin role.'); return;
    }
    setAdding(true);
    try {
      await api(`/api/agency/brands/${brandId}/team`, {
        method: 'POST', body: JSON.stringify({ staff_id: selected.id, role_on_brand: selRole }),
      });
      await loadTeam();
      setShowAdd(false); setSelected(null);
    } catch (err: any) { setError(err.message); }
    finally { setAdding(false); }
  };

  const removeMember = async (staffId: string) => {
    setError('');
    if (!confirm('Remove this person from the brand team?')) return;
    setRemoving(staffId);
    try {
      await api(`/api/agency/brands/${brandId}/team/${staffId}`, { method: 'DELETE' });
      setTeam(p => p.filter(m => m.users?.id !== staffId));
    } catch (err: any) { setError(err.message); }
    finally { setRemoving(null); }
  };

  const brandAdmins = team.filter(m => m.role_on_brand === 'brand_admin');
  const filtered = search
    ? available.filter(s => s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.role?.toLowerCase().includes(search.toLowerCase()))
    : available;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {perms.canAssignStaff && (
      <AgencyTopNav title="Brand Team"
        breadcrumb={[{ label: 'Brands', href: '/brands' }, { label: 'Brand', href: `/brands/${brandId}` }]} />)}

      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Brand
      </Link>

      <PageHeader title="Brand Team" subtitle={`${team.length} member${team.length !== 1 ? 's' : ''} assigned`}
        action={
          <button onClick={openAdd} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        } />

      {/* Brand Admin info */}
      {brandAdmins.length > 0 && (
        <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-violet-500/8 border border-violet-500/20">
          <Shield className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">
              {brandAdmins.map(a => a.users?.full_name).join(', ')} {brandAdmins.length === 1 ? 'is' : 'are'} the Brand Admin{brandAdmins.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Brand Admins have full control of this brand — they can manage reports, goals, staff, and deliverables.
              Only the Super Admin can assign this role.
            </p>
          </div>
        </div>
      )}

      {!perms.canAssignStaff && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-white/3 border border-white/8">
          <AlertTriangle className="w-4 h-4 text-white/30 flex-shrink-0" />
          <p className="text-xs text-white/40">Only Admins and Brand Admins can manage the team.</p>
        </div>
      )}

      {/* Add member modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Add Team Member</h3>
                <p className="text-xs text-white/30 mt-0.5">Pick a staff member and their role on this brand</p>
              </div>
              <button onClick={() => { setError(''); setShowAdd(false); }} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input className="sabi-input pl-9 text-sm" placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 mb-4">
              {filtered.length === 0 ? (
                <p className="text-white/25 text-sm text-center py-8">
                  {available.length === 0 ? 'All staff already assigned' : 'No staff match'}
                </p>
              ) : filtered.map(s => (
                <button key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selected?.id === s.id ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/5 hover:border-white/10 hover:bg-white/3'}`}>
                  <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
                    {s.full_name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{s.full_name}</p>
                    <p className="text-xs text-white/40 capitalize">{s.role?.replace(/_/g, ' ')}</p>
                  </div>
                  {selected?.id === s.id && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-red-500/8 border border-red-500/20">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}
            {selected && (
              <div className="border-t border-white/5 pt-4">
                <p className="text-xs text-white/50 mb-3">
                  Assign <strong className="text-white">{selected.full_name}</strong> as:
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4 max-h-56 overflow-y-auto pr-1">
                  {BRAND_ROLE_OPTIONS.map(r => {
                    const locked = r.elevated && !canElevate;
                    return (
                      <button key={r.value} onClick={() => !locked && setSelRole(r.value)} disabled={locked}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          selRole === r.value ? 'border-purple-500/50 bg-purple-500/15' :
                          locked ? 'opacity-40 cursor-not-allowed border-white/5' :
                          'border-white/5 hover:border-white/10 hover:bg-white/3'
                        }`}>
                        <span className="text-base mt-0.5 flex-shrink-0">{r.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className={`text-xs font-semibold leading-none ${selRole === r.value ? 'text-purple-300' : 'text-white/70'}`}>{r.label}</p>
                            {r.elevated && <Shield className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                          </div>
                          <p className="text-[10px] text-white/30 leading-tight mt-1">{locked ? 'Super Admin only' : r.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button onClick={addMember} disabled={adding}
                  className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  {adding ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</> : <><UserPlus className="w-4 h-4" />Add {BRAND_ROLE_OPTIONS.find(r => r.value === selRole)?.label}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Team list */}
      {loading ? <LoadingPage /> : team.length === 0 ? (
        <EmptyState icon={Users2} title="No team members"
          description="Assign staff to this brand with their specific role."
          action={{ label: 'Add First Member', onClick: openAdd }} />
      ) : (
        <div className="space-y-3">
          {[...team].sort((a, b) => {
            if (a.role_on_brand === 'brand_admin') return -1;
            if (b.role_on_brand === 'brand_admin') return 1;
            return (a.users?.full_name ?? '').localeCompare(b.users?.full_name ?? '');
          }).map(m => {
            const u = m.users;
            if (!u) return null;
            const roleMeta = BRAND_ROLE_OPTIONS.find(r => r.value === m.role_on_brand);
            return (
              <div key={m.id} className={`sabi-card p-5 hover:border-white/10 transition-all group ${m.role_on_brand === 'brand_admin' ? 'border-violet-500/15' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-base font-bold text-purple-300 flex-shrink-0">
                    {u.full_name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{u.full_name}</p>
                      {!u.is_active && <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">Inactive</span>}
                    </div>
                    <p className="text-xs text-white/40 capitalize mt-0.5">{u.role?.replace(/_/g, ' ')} <span className="text-white/20">· System Role</span></p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div>
                      <p className="text-[10px] text-white/25 mb-1.5 text-right">Role on this brand</p>
                      {perms.canAssignStaff ? (
                        <RoleDropdown current={m.role_on_brand} staffId={u.id} brandId={brandId}
                          canElevate={canElevate} onChanged={(r: string) => setTeam(p => p.map(x => x.id === m.id ? { ...x, role_on_brand: r } : x))} />
                      ) : (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${m.role_on_brand === 'brand_admin' ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-white/5 text-white/50 border-white/10'}`}>
                          <span>{roleMeta?.icon}</span>
                          <span>{roleMeta?.label ?? m.role_on_brand}</span>
                        </div>
                      )}
                    </div>
                    {perms.canAssignStaff && m.role_on_brand !== 'brand_admin' && (
                      <button onClick={() => removeMember(u.id)} disabled={removing === u.id}
                        className="text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-4">
                        {removing === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
