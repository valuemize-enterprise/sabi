'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Users2, ChevronRight, ChevronLeft,
  Loader2, Plus, X, Check, Search, UserPlus
} from 'lucide-react';
import { brands as brandsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';

// ── Constants ─────────────────────────────────────────────────
const INDUSTRIES = [
  'FMCG','Fintech','Retail','Telecoms','Real Estate','Healthcare',
  'Education','Media & Entertainment','Fashion & Beauty','Food & Beverage',
  'Logistics','Agriculture','Oil & Gas','NGO / Non-Profit','Technology',
  'Hospitality','Insurance','Banking','E-commerce','Other',
];

const COLORS = [
  '#6d28d9','#2563eb','#0891b2','#059669','#d97706',
  '#dc2626','#7c3aed','#db2777','#ea580c','#65a30d',
];

const BRAND_ROLES: { value: string; label: string; desc: string; icon: string }[] = [
  { value:'account_manager',      label:'Account Manager',      desc:'Overall client relationship owner',          icon:'👔' },
  { value:'brand_manager',        label:'Brand Manager',        desc:'Day-to-day brand stewardship',               icon:'🎯' },
  { value:'creative_director',    label:'Creative Director',    desc:'Oversees all creative output for this brand', icon:'🎨' },
  { value:'senior_strategist',    label:'Senior Strategist',    desc:'Leads marketing strategy and planning',       icon:'🧠' },
  { value:'strategist',           label:'Strategist',           desc:'Develops and executes campaign strategies',   icon:'📊' },
  { value:'copywriter',           label:'Copywriter',           desc:'Writes captions, ads, emails and copy',       icon:'✍️'  },
  { value:'social_media_manager', label:'Social Media Manager', desc:'Manages social content and scheduling',       icon:'📱' },
  { value:'analytics_specialist', label:'Analytics Specialist', desc:'Owns data, reports and ClarityScore™',        icon:'📈' },
  { value:'content_creator',      label:'Content Creator',      desc:'Produces content assets for the brand',       icon:'🎬' },
  { value:'art_director',     label:'Art Director',     desc:'Creates visual assets and designs',           icon:'🖌️' },
  { value:'community_manager',    label:'Community Manager',    desc:'Manages brand community and engagement',      icon:'💬' },
  { value:'contributor',          label:'Contributor',          desc:'General contributor to this brand account',   icon:'👤' },
];

const ROLE_COLOR: Record<string, string> = {
  account_manager:'purple', brand_manager:'blue', creative_director:'pink',
  senior_strategist:'green', strategist:'teal', copywriter:'amber',
  social_media_manager:'green', analytics_specialist:'blue',
  content_creator:'orange', art_director:'pink', community_manager:'teal', contributor:'gray',
};

// ── Token helper ──────────────────────────────────────────────
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

interface AssignedMember {
  staff_id:     string;
  role_on_brand: string;
  user:          any; // full staff object
}

export default function NewBrandPage() {
  const router = useRouter();
  const [step, setStep]     = useState(1); // 1 = brand details, 2 = team assignment
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [createdBrandId, setCreatedBrandId] = useState<string | null>(null);

  // Step 1 form
  const [form, setForm] = useState({
    name: '', industry: '', description: '', website: '', primary_color: '#6d28d9',
    social_handles: { instagram:'', twitter:'', facebook:'', linkedin:'', tiktok:'' },
  });

  // Step 2 team
  const [allStaff, setAllStaff]     = useState<any[]>([]);
  const [assigned, setAssigned]     = useState<AssignedMember[]>([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [selectedRole, setSelectedRole]   = useState('account_manager');
  const [assigning, setAssigning]         = useState(false);

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setSocial = (k: string, v: string) => setForm(f => ({ ...f, social_handles: { ...f.social_handles, [k]: v } }));

  // ── Step 1: Create brand ─────────────────────────────────
  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.industry) { setError('Brand name and industry are required'); return; }
    setSaving(true); setError('');
    try {
      const res: any = await brandsApi.create(form);
      const brandId  = res.data.brand.id;
      setCreatedBrandId(brandId);

      // Load all staff for team assignment
      setLoadingStaff(true);
      const sRes: any = await apiFetch('/api/agency/staff?limit=100');
      setAllStaff(sRes.data ?? []);
      setLoadingStaff(false);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to create brand');
    } finally { setSaving(false); }
  };

  // ── Step 2: Assign a staff member ────────────────────────
  const assignMember = async () => {
    setError('');
    if (!selectedStaff || !createdBrandId) return;
    // Check not already assigned
    if (assigned.some(a => a.staff_id === selectedStaff.id)) {
      setShowPicker(false); return;
    }
    setAssigning(true);
    try {
      await apiFetch(`/api/agency/brands/${createdBrandId}/team`, {
        method: 'POST',
        body: JSON.stringify({ staff_id: selectedStaff.id, role_on_brand: selectedRole }),
      });
      setAssigned(p => [...p, { staff_id: selectedStaff.id, role_on_brand: selectedRole, user: selectedStaff }]);
      setShowPicker(false);
      setSelectedStaff(null);
      setSelectedRole('account_manager');
      setPickerSearch('');
    } catch (err: any) { setError(err.message); }
    finally { setAssigning(false); }
  };

  const removeAssigned = async (staffId: string) => {
    if (!createdBrandId) return;
    try {
      await apiFetch(`/api/agency/brands/${createdBrandId}/team/${staffId}`, { method: 'DELETE' });
      setAssigned(p => p.filter(a => a.staff_id !== staffId));
    } catch {}
  };

  const finish = () => router.push(`/brands/${createdBrandId}`);

  const roleInfo = (val: string) => BRAND_ROLES.find(r => r.value === val);
  const availableStaff = allStaff.filter(s =>
    !assigned.some(a => a.staff_id === s.id) &&
    (s.full_name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
     s.role.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <AgencyTopNav />
      <Link href="/clients" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-6 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients
      </Link>

      {/* Progress indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[
          { n:1, label:'Brand Details'   },
          { n:2, label:'Assign Team'     },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              step === n ? 'bg-purple-600/20 border border-purple-500/30 text-purple-300' :
              step > n  ? 'text-green-400' : 'text-white/25'
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                step > n  ? 'bg-green-500 text-white' :
                step === n? 'bg-purple-600 text-white' : 'bg-white/10 text-white/30'
              }`}>
                {step > n ? <Check className="w-3 h-3" /> : n}
              </div>
              <span className="text-sm font-medium">{label}</span>
            </div>
            {i < 1 && <ChevronRight className="w-4 h-4 text-white/20 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-6">{error}</div>
      )}

      {/* ── STEP 1: Brand Details ── */}
      {step === 1 && (
        <form onSubmit={handleCreateBrand} className="space-y-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Create New Brand</h1>
              <p className="text-sm text-white/40">Step 1 of 2 — Brand information</p>
            </div>
          </div>

          {/* Core fields */}
          <div className="sabi-card p-6 space-y-4">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Brand Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-white/50 mb-1.5 block">Brand Name *</label>
                <input className="sabi-input text-base font-medium" placeholder="e.g. Flutterwave, Dangote, Jumia"
                  value={form.name} onChange={e => setField('name', e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Industry *</label>
                <select className="sabi-input" value={form.industry} onChange={e => setField('industry', e.target.value)} required>
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(i => <option className="bg-[#12122a]" key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Website</label>
                <input className="sabi-input" placeholder="https://yourbrand.com"
                  value={form.website} onChange={e => setField('website', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-white/50 mb-1.5 block">Description</label>
                <textarea className="sabi-input resize-none" rows={2}
                  placeholder="What does this brand do? Who are their target audience in Nigeria?"
                  value={form.description} onChange={e => setField('description', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Brand color */}
          <div className="sabi-card p-6">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Brand Colour</h2>
            <div className="flex items-center gap-2.5 flex-wrap">
              {COLORS.map(c => (
                <button type="button" key={c} onClick={() => setField('primary_color', c)}
                  className={`w-8 h-8 rounded-full transition-all ${form.primary_color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0d1a] scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={form.primary_color}
                onChange={e => setField('primary_color', e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent" />
              <span className="text-xs text-white/30 ml-1">or custom</span>
            </div>
          </div>

          {/* Social handles */}
          <div className="sabi-card p-6">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Social Handles <span className="text-white/20 font-normal">(optional)</span></h2>
            <div className="grid grid-cols-2 gap-3">
              {(['instagram','twitter','facebook','linkedin','tiktok'] as const).map(p => (
                <div key={p}>
                  <label className="text-xs text-white/40 mb-1 block capitalize">{p}</label>
                  <input className="sabi-input text-sm" placeholder={`@${p}handle`}
                    value={form.social_handles[p]} onChange={e => setSocial(p, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating Brand…</> : <>Create Brand & Assign Team <ChevronRight className="w-4 h-4" /></>}
          </button>
        </form>
      )}

      {/* ── STEP 2: Team Assignment ── */}
      {step === 2 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Users2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Assign Your Team</h1>
              <p className="text-sm text-white/40">Step 2 of 2 — Pick who works on <strong className="text-white">{form.name}</strong></p>
            </div>
          </div>

          {/* Assigned members list */}
          <div className="sabi-card p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">Team Members</h2>
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">{assigned.length}</span>
              </div>
              <button onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                <UserPlus className="w-3.5 h-3.5" /> Add Member
              </button>
            </div>

            {assigned.length === 0 ? (
              <div className="border-2 border-dashed border-white/5 rounded-xl py-10 text-center">
                <Users2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-sm text-white/30">No team members yet</p>
                <p className="text-xs text-white/20 mt-1">Add at least an Account Manager</p>
              <button onClick={() => { setError(''); setShowPicker(true); }}
                  className="mt-4 sabi-btn-primary px-4 py-2 text-sm flex items-center gap-1.5 mx-auto">
                  <Plus className="w-3.5 h-3.5" /> Add First Member
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {assigned.map(a => {
                  const role = roleInfo(a.role_on_brand);
                  return (
                    <div key={a.staff_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 group">
                      <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
                        {a.user.full_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{a.user.full_name}</p>
                        <p className="text-xs text-white/40 capitalize">{a.user.role.replace(/_/g,' ')}</p>
                      </div>
                      {/* Role on brand badge */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/15">
                        <span className="text-sm">{role?.icon}</span>
                        <span className="text-xs text-purple-300 font-medium">{role?.label}</span>
                      </div>
                      <button onClick={() => removeAssigned(a.staff_id)}
                        className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Staff picker modal */}
          {showPicker && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-white">Add Team Member</h3>
                  <button onClick={() => { setShowPicker(false); setSelectedStaff(null); }} className="text-white/30 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Staff search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input className="sabi-input pl-9 text-sm" placeholder="Search staff by name or role…"
                    value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus />
                </div>

                {/* Staff list */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 min-h-0">
                  {loadingStaff ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
                  ) : availableStaff.length === 0 ? (
                    <p className="text-white/25 text-sm text-center py-8">
                      {allStaff.length === 0 ? 'No staff found — create staff accounts first' : 'All staff already assigned'}
                    </p>
                  ) : (
                    availableStaff.map(s => (
                      <button key={s.id} onClick={() => setSelectedStaff(selectedStaff?.id === s.id ? null : s)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          selectedStaff?.id === s.id ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/5 hover:border-white/10 hover:bg-white/3'
                        }`}>
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                          {s.full_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{s.full_name}</p>
                          <p className="text-xs text-white/40 capitalize">{s.role.replace(/_/g,' ')} {s.department ? `· ${s.department}` : ''}</p>
                        </div>
                        {selectedStaff?.id === s.id && <Check className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                      </button>
                    ))
                  )}
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs mb-3">{error}</div>
                )}
                {/* Role picker — shown once staff is selected */}
                {selectedStaff && (
                  <div className="border-t border-white/5 pt-4">
                    <p className="text-xs text-white/50 mb-3">
                      Assign <strong className="text-white">{selectedStaff.full_name}</strong> as:
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-4 max-h-48 overflow-y-auto">
                      {BRAND_ROLES.map(r => (
                        <button key={r.value} onClick={() => setSelectedRole(r.value)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            selectedRole === r.value ? 'border-purple-500/50 bg-purple-500/15' : 'border-white/5 hover:border-white/10 hover:bg-white/3'
                          }`}>
                          <span className="text-base mt-0.5 flex-shrink-0">{r.icon}</span>
                          <div>
                            <p className={`text-xs font-semibold ${selectedRole === r.value ? 'text-purple-300' : 'text-white/70'}`}>{r.label}</p>
                            <p className="text-[10px] text-white/30 leading-tight mt-0.5">{r.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button onClick={assignMember} disabled={assigning}
                      className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                      {assigning ? <><Loader2 className="w-4 h-4 animate-spin" />Assigning…</> : <>Assign as {roleInfo(selectedRole)?.label} <Check className="w-4 h-4" /></>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button onClick={finish}
              className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-3 text-base">
              <Check className="w-5 h-5" /> Done — View Brand
            </button>
            <button onClick={finish}
              className="px-5 py-3 text-sm text-white/40 hover:text-white transition-colors">
              Skip for now
            </button>
          </div>
          <p className="text-xs text-white/20 text-center mt-3">
            You can always add or change team members later from the brand's Team page
          </p>
        </div>
      )}
    </div>
  );
}
