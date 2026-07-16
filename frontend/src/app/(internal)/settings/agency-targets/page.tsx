'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Lock, Target, Calendar, RefreshCw } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const CURRENT_YEAR = new Date().getFullYear();

export default function AgencyTargetsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [targets, setTargets] = useState<any>(null);
  const [form, setForm] = useState({
    monthly_retainer_revenue_target:'', quarterly_project_revenue_target:'',
    active_brands_target:'', avg_client_satisfaction_target:'',
    goal_achievement_rate_target:'', staff_retention_target:'', notes:'',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = (y: number) => {
    setLoading(true);
    api(`/api/agency/targets?year=${y}`).then((r: any) => {
      const t = r.data?.targets;
      setTargets(t);
      if (t) {
        setForm({
          monthly_retainer_revenue_target: String(t.monthly_retainer_revenue_target ?? ''),
          quarterly_project_revenue_target: String(t.quarterly_project_revenue_target ?? ''),
          active_brands_target: String(t.active_brands_target ?? ''),
          avg_client_satisfaction_target: String(t.avg_client_satisfaction_target ?? ''),
          goal_achievement_rate_target: String(t.goal_achievement_rate_target ?? ''),
          staff_retention_target: String(t.staff_retention_target ?? ''),
          notes: t.notes ?? '',
        });
      } else {
        setForm({ monthly_retainer_revenue_target:'', quarterly_project_revenue_target:'', active_brands_target:'', avg_client_satisfaction_target:'4.0', goal_achievement_rate_target:'70', staff_retention_target:'85', notes:'' });
      }
    }).catch(err => { if (err.message?.includes('403')) setForbidden(true); }).finally(() => setLoading(false));
  };

  useEffect(() => load(year), [year]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const payload = {
        monthly_retainer_revenue_target: parseFloat(form.monthly_retainer_revenue_target) || 0,
        quarterly_project_revenue_target: parseFloat(form.quarterly_project_revenue_target) || 0,
        active_brands_target: parseInt(form.active_brands_target) || 0,
        avg_client_satisfaction_target: parseFloat(form.avg_client_satisfaction_target) || 4.0,
        goal_achievement_rate_target: parseInt(form.goal_achievement_rate_target) || 70,
        staff_retention_target: parseInt(form.staff_retention_target) || 85,
        notes: form.notes,
      };

      if (targets) {
        await api(`/api/agency/targets/${year}`, { method:'PATCH', body: JSON.stringify(payload) });
      } else {
        await api('/api/agency/targets', { method:'POST', body: JSON.stringify({ year, ...payload }) });
      }
      setSaved(true);
      load(year);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const markMidyearReview = async () => {
    try {
      await api(`/api/agency/targets/${year}/midyear-review`, { method:'PUT' });
      load(year);
    } catch (err: any) { alert(err.message); }
  };

  if (forbidden) return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="Agency Targets"/>
      <div className="sabi-card p-10 text-center">
        <Lock className="w-8 h-8 text-white/15 mx-auto mb-3"/>
        <p className="text-white/40 text-sm">Only the Super Admin and Managing Director can set agency-level targets.</p>
      </div>
    </div>
  );

  if (loading) return <LoadingPage label="Loading targets…"/>;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <AgencyTopNav title="Agency Targets" subtitle="Set once per year — reviewed mid-year in April"/>

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="w-4 h-4 text-white/30"/>
        <select className="sabi-input w-32 text-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
          {[CURRENT_YEAR-1, CURRENT_YEAR, CURRENT_YEAR+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {targets?.midyear_reviewed_at ? (
          <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3"/>Mid-year reviewed {new Date(targets.midyear_reviewed_at).toLocaleDateString()}</span>
        ) : targets && (
          <button onClick={markMidyearReview} className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3"/> Mark Mid-Year Review Complete
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}

      <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-4 mb-6">
        <p className="text-sm text-white/60">
          <strong className="text-white">Five numbers, checked weekly.</strong> These targets power the traffic-light indicators on the MD Weekly Pulse dashboard.
        </p>
      </div>

      <div className="sabi-card p-6 space-y-5">
        <div>
          <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-blue-400"/>Monthly Retainer Revenue Target (₦)</label>
          <input type="number" className="sabi-input" value={form.monthly_retainer_revenue_target}
            onChange={e => setForm(p=>({...p,monthly_retainer_revenue_target:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-purple-400"/>Quarterly Project Revenue Target (₦)</label>
          <input type="number" className="sabi-input" value={form.quarterly_project_revenue_target}
            onChange={e => setForm(p=>({...p,quarterly_project_revenue_target:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-green-400"/>Active Brands Target</label>
          <input type="number" className="sabi-input" value={form.active_brands_target}
            onChange={e => setForm(p=>({...p,active_brands_target:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-amber-400"/>Average Client Satisfaction Target (out of 5)</label>
          <input type="number" step="0.1" min="1" max="5" className="sabi-input" value={form.avg_client_satisfaction_target}
            onChange={e => setForm(p=>({...p,avg_client_satisfaction_target:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-teal-400"/>Goal Achievement Rate Target (%)</label>
          <input type="number" min="0" max="100" className="sabi-input" value={form.goal_achievement_rate_target}
            onChange={e => setForm(p=>({...p,goal_achievement_rate_target:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-rose-400"/>Staff Retention Target (%)</label>
          <input type="number" min="0" max="100" className="sabi-input" value={form.staff_retention_target}
            onChange={e => setForm(p=>({...p,staff_retention_target:e.target.value}))}/>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Notes</label>
          <textarea className="sabi-input resize-none" rows={3} value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}/>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 text-base mt-6 disabled:opacity-50">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : saved ? <><Check className="w-4 h-4"/>Saved!</> : `Save Targets for ${year}`}
      </button>
    </div>
  );
}
