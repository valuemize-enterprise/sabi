'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, UserPlus, X, Search, Check, Loader2,
  ChevronDown, Users2, Mail, Shield, RefreshCw, AlertCircle
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { PageHeader, EmptyState, LoadingPage } from '@/components/ui';

// ── Brand-level roles ─────────────────────────────────────────
const BRAND_ROLES = [
  { value:'account_manager',      label:'Account Manager',      desc:'Overall client relationship owner',         icon:'👔', color:'purple' },
  { value:'brand_manager',        label:'Brand Manager',        desc:'Day-to-day brand stewardship',              icon:'🎯', color:'blue'   },
  { value:'creative_director',    label:'Creative Director',    desc:'Oversees all creative output',              icon:'🎨', color:'pink'   },
  { value:'senior_strategist',    label:'Senior Strategist',    desc:'Leads marketing strategy and planning',     icon:'🧠', color:'green'  },
  { value:'strategist',           label:'Strategist',           desc:'Develops and executes campaign strategies', icon:'📊', color:'teal'   },
  { value:'copywriter',           label:'Copywriter',           desc:'Writes captions, ads, emails and copy',     icon:'✍️',  color:'amber'  },
  { value:'social_media_manager', label:'Social Media Manager', desc:'Manages social content and scheduling',     icon:'📱', color:'green'  },
  { value:'analytics_specialist', label:'Analytics Specialist', desc:'Owns data, reports and ClarityScore™',      icon:'📈', color:'blue'   },
  { value:'content_creator',      label:'Content Creator',      desc:'Produces content assets for the brand',     icon:'🎬', color:'orange' },
  { value:'graphic_designer',     label:'Graphic Designer',     desc:'Creates visual assets and designs',         icon:'🖌️', color:'pink'  },
  { value:'community_manager',    label:'Community Manager',    desc:'Manages brand community and engagement',    icon:'💬', color:'teal'   },
  { value:'contributor',          label:'Contributor',          desc:'General contributor to this account',       icon:'👤', color:'gray'   },
];

const BADGE_COLORS: Record<string, string> = {
  purple:'bg-purple-500/15 text-purple-300 border-purple-500/25',
  blue:  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  pink:  'bg-pink-500/15 text-pink-300 border-pink-500/25',
  green: 'bg-green-500/15 text-green-300 border-green-500/25',
  teal:  'bg-teal-500/15 text-teal-300 border-teal-500/25',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  orange:'bg-orange-500/15 text-orange-300 border-orange-500/25',
  gray:  'bg-white/5 text-white/50 border-white/10',
};

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const apiFetch = async (path: string, opts?: RequestInit) => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res  = await fetch(`${base}${path}`, {
    ...opts,
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || `Error ${res.status}`);
  return body;
};

// ── Role change dropdown ──────────────────────────────────────
function RoleDropdown({ current, staffId, brandId, onChanged }: { current: string; staffId: string; brandId: string; onChanged: (r: string) => void }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const role = BRAND_ROLES.find(r => r.value === current);

  const change = async (val: string) => {
    if (val === current) { setOpen(false); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/agency/brands/${brandId}/team/${staffId}`, {
        method: 'PATCH', body: JSON.stringify({ role_on_brand: val }),
      });
      onChanged(val);
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); setOpen(false); }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          BADGE_COLORS[role?.color ?? 'gray']
        } hover:opacity-80`}>
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <span>{role?.icon}</span>}
        <span>{role?.label ?? current}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-64 bg-[#12122a] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
            <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest px-3 py-2 border-b border-white/5">Change Role on Brand</p>
            <div className="max-h-64 overflow-y-auto py-1">
              {BRAND_ROLES.map(r => (
                <button key={r.value} onClick={() => change(r.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-all text-left ${r.value === current ? 'bg-purple-500/10' : ''}`}>
                  <span className="text-sm">{r.icon}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${r.value === current ? 'text-purple-300' : 'text-white/70'}`}>{r.label}</p>
                    <p className="text-[10px] text-white/30">{r.desc}</p>
                  </div>
                  {r.value === current && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BrandTeamPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [team, setTeam]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [available, setAvailable] = useState<any[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [selRole, setSelRole]   = useState('account_manager');
  const [adding, setAdding]     = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiFetch(`/api/agency/brands/${brandId}/team`);
      setTeam(res.data?.team ?? []);
    } catch { setTeam([]); }
    finally { setLoading(false); }
  }, [brandId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const openAdd = async () => {
    setShowAdd(true); setSelected(null); setSelRole('account_manager'); setSearch('');
    setLoadingAvail(true);
    try {
      const res: any = await apiFetch(`/api/agency/brands/${brandId}/team/available`);
      setAvailable(res.data?.staff ?? []);
    } catch { setAvailable([]); }
    finally { setLoadingAvail(false); }
  };

  const addMember = async () => {
    if (!selected) return;
    setAdding(true);
    try {
      await apiFetch(`/api/agency/brands/${brandId}/team`, {
        method: 'POST', body: JSON.stringify({ staff_id: selected.id, role_on_brand: selRole }),
      });
      await loadTeam();
      setShowAdd(false); setSelected(null);
    } catch (err: any) { alert(err.message); }
    finally { setAdding(false); }
  };

  const removeMember = async (staffId: string) => {
    if (!confirm('Remove this person from the brand team?')) return;
    setRemoving(staffId);
    try {
      await apiFetch(`/api/agency/brands/${brandId}/team/${staffId}`, { method: 'DELETE' });
      setTeam(p => p.filter(m => m.users?.id !== staffId));
    } catch (err: any) { alert(err.message); }
    finally { setRemoving(null); }
  };

  const updateRoleLocal = (staffId: string, newRole: string) => {
    setTeam(p => p.map(m => m.users?.id === staffId ? { ...m, role_on_brand: newRole } : m));
  };

  const filtered = search
    ? available.filter(s =>
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.role.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
      )
    : available;

  // Role-based display helpers
  const roleInfo = (val: string) => BRAND_ROLES.find(r => r.value === val);

  // Count per role
  const roleCounts = team.reduce((acc: Record<string, number>, m) => {
    acc[m.role_on_brand] = (acc[m.role_on_brand] || 0) + 1;
    return acc;
  }, {});

  const hasAccountManager = team.some(m => m.role_on_brand === 'account_manager');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav />
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Brand
      </Link>

      <PageHeader
        title="Brand Team"
        subtitle={`${team.length} member${team.length !== 1 ? 's' : ''} assigned to this brand`}
        action={
          <button onClick={openAdd}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            <UserPlus className="w-4 h-4" /> Add Member
          </button>
        }
      />

      {/* No account manager warning */}
      {!hasAccountManager && team.length > 0 && (
        <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-white/70">
            <strong className="text-amber-400">No Account Manager assigned</strong> — every brand needs an Account Manager as the primary relationship owner.
          </p>
          <button onClick={openAdd} className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0">Add one →</button>
        </div>
      )}

      {/* Role summary bar */}
      {team.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          {Object.entries(roleCounts).map(([role, count]) => {
            const r = roleInfo(role);
            return (
              <div key={role} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${BADGE_COLORS[r?.color ?? 'gray']}`}>
                <span>{r?.icon}</span>
                <span>{r?.label}</span>
                {(count as number) > 1 && <span className="opacity-60">×{count as number}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Team list */}
      {loading ? <LoadingPage label="Loading team…" /> : team.length === 0 ? (
        <EmptyState icon={Users2} title="No team members assigned"
          description="Assign agency staff to this brand so they can access and work on it."
          action={{ label: 'Add First Member', onClick: openAdd }} />
      ) : (
        <div className="space-y-3">
          {/* Sort: account_manager first */}
          {[...team].sort((a, b) => {
            const order = ['account_manager','brand_manager','creative_director','senior_strategist','strategist'];
            return (order.indexOf(a.role_on_brand) - order.indexOf(b.role_on_brand)) || a.users?.full_name?.localeCompare(b.users?.full_name);
          }).map(m => {
            const u    = m.users;
            const role = roleInfo(m.role_on_brand);
            if (!u) return null;
            return (
              <div key={m.id} className="sabi-card p-5 hover:border-white/10 transition-all group">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-base font-bold text-purple-300 flex-shrink-0">
                    {u.full_name?.[0] ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-white">{u.full_name}</p>
                      {!u.is_active && <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-medium">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-white/40 capitalize">{u.role?.replace(/_/g,' ')} (System Role)</span>
                      {u.email && (
                        <a href={`mailto:${u.email}`} className="text-xs text-white/25 hover:text-purple-400 transition-colors flex items-center gap-1">
                          <Mail className="w-3 h-3" />{u.email}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-white/25 mt-1">
                      Assigned {m.created_at ? new Date(m.created_at).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'}) : '—'}
                    </p>
                  </div>

                  {/* Role on brand — changeable */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div>
                      <p className="text-[10px] text-white/25 mb-1.5 text-right">Role on this brand</p>
                      <RoleDropdown
                        current={m.role_on_brand}
                        staffId={u.id}
                        brandId={brandId}
                        onChanged={r => updateRoleLocal(u.id, r)}
                      />
                    </div>
                    <button onClick={() => removeMember(u.id)} disabled={removing === u.id}
                      className="text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-4">
                      {removing === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add member modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Add Team Member</h3>
                <p className="text-xs text-white/30 mt-0.5">Search and assign a role on this brand</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input className="sabi-input pl-9 text-sm" placeholder="Search by name, role or email…"
                value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>

            {/* Staff list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 mb-4 min-h-0">
              {loadingAvail ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-white/25 text-sm text-center py-8">
                  {available.length === 0 ? 'All staff already assigned to this brand' : 'No staff match your search'}
                </p>
              ) : (
                filtered.map(s => (
                  <button key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      selected?.id === s.id ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/5 hover:border-white/10 hover:bg-white/3'
                    }`}>
                    <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
                      {s.full_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{s.full_name}</p>
                      <p className="text-xs text-white/40 capitalize">{s.role.replace(/_/g,' ')} {s.department ? `· ${s.department}` : ''}</p>
                    </div>
                    {selected?.id === s.id && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                  </button>
                ))
              )}
            </div>

            {/* Role selector — shown when staff is selected */}
            {selected && (
              <div className="border-t border-white/5 pt-4">
                <p className="text-xs text-white/50 mb-3">
                  Assign <strong className="text-white">{selected.full_name}</strong> as:
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4 max-h-52 overflow-y-auto pr-1">
                  {BRAND_ROLES.map(r => (
                    <button key={r.value} onClick={() => setSelRole(r.value)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        selRole === r.value ? 'border-purple-500/50 bg-purple-500/15' : 'border-white/5 hover:border-white/10 hover:bg-white/3'
                      }`}>
                      <span className="text-base mt-0.5 flex-shrink-0">{r.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold leading-none ${selRole === r.value ? 'text-purple-300' : 'text-white/70'}`}>{r.label}</p>
                        <p className="text-[10px] text-white/30 leading-tight mt-1">{r.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={addMember} disabled={adding}
                  className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                  {adding ? <><Loader2 className="w-4 h-4 animate-spin" />Assigning…</> : <><UserPlus className="w-4 h-4" />Add as {roleInfo(selRole)?.label}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
