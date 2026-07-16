'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Check, Loader2, Edit3, Trash2, Lock, ListChecks, ChevronRight } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const ROLES = [
  'account_manager','brand_manager','senior_strategist','strategist',
  'creative_lead','copywriter','social_media_manager','analytics_specialist',
  'client_success','content_creator','graphic_designer','community_manager',
];

const ROLE_LABELS: Record<string,string> = {
  account_manager:'Account Manager', brand_manager:'Brand Manager',
  senior_strategist:'Senior Strategist', strategist:'Strategist',
  creative_lead:'Creative Lead', copywriter:'Copywriter',
  social_media_manager:'Social Media Manager', analytics_specialist:'Analytics Specialist',
  client_success:'Client Success', content_creator:'Content Creator',
  graphic_designer:'Graphic Designer', community_manager:'Community Manager',
};

export default function CoreFunctionsPage() {
  const [grouped, setGrouped] = useState<Record<string,any[]>>({});
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(ROLES[0]);
  const [newFunction, setNewFunction] = useState('');
  const [newMeasurable, setNewMeasurable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const load = () => {
    api('/api/agency/core-functions').then((r: any) => {
      setGrouped(r.data?.grouped ?? {});
      setCanEdit(!!r.data?.canEdit);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addFunction = async () => {
    if (!newFunction.trim()) return;
    setSaving(true);
    try {
      await api('/api/agency/core-functions', {
        method: 'POST',
        body: JSON.stringify({
          role: activeRole, function_text: newFunction.trim(),
          is_measurable: newMeasurable,
          sort_order: (grouped[activeRole]?.length ?? 0) + 1,
        }),
      });
      setNewFunction(''); setNewMeasurable(false);
      load();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    try {
      await api(`/api/agency/core-functions/${id}`, { method:'PATCH', body:JSON.stringify({ function_text: editText.trim() }) });
      setEditingId(null);
      load();
    } catch (err: any) { alert(err.message); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this core function?')) return;
    try {
      await api(`/api/agency/core-functions/${id}`, { method:'DELETE' });
      load();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <LoadingPage label="Loading core functions…"/>;

  if (!canEdit) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <AgencyTopNav title="Core Functions"/>
        <div className="sabi-card p-10 text-center">
          <Lock className="w-8 h-8 text-white/15 mx-auto mb-3"/>
          <p className="text-white/40 text-sm">Only the Super Admin and Managing Director can edit core functions.</p>
          <p className="text-white/25 text-xs mt-1">You can view what's expected of your role on your profile page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Core Functions" subtitle="Define what's expected of each role — this is what contribution claims are measured against"/>

      <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-4 mb-6">
        <p className="text-sm text-white/60">
          <strong className="text-white">Why this matters:</strong> When a staff member claims they've contributed something extra,
          the verifier compares it against this list. If it's already a core function, it's not "extra" — it's just the job.
          Keep these specific and, where possible, measurable.
        </p>
      </div>

      {/* Role tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        {ROLES.map(r => (
          <button key={r} onClick={() => setActiveRole(r)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
              activeRole === r ? 'bg-purple-600 text-white' : 'bg-white/3 text-white/40 hover:text-white border border-white/5'
            }`}>
            {ROLE_LABELS[r]}
            {grouped[r]?.length > 0 && <span className="text-[10px] opacity-60">({grouped[r].length})</span>}
          </button>
        ))}
      </div>

      {/* Functions for active role */}
      <div className="sabi-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="w-4 h-4 text-purple-400"/>
          <h2 className="text-sm font-semibold text-white">{ROLE_LABELS[activeRole]} — Core Functions</h2>
        </div>

        <div className="space-y-2 mb-4">
          {(grouped[activeRole] ?? []).map(f => (
            <div key={f.id} className="flex items-start gap-3 p-3 bg-white/3 border border-white/6 rounded-xl group">
              {editingId === f.id ? (
                <>
                  <input className="sabi-input flex-1 text-sm" value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(f.id); }} autoFocus/>
                  <button onClick={() => saveEdit(f.id)} className="text-green-400 hover:text-green-300 transition-colors flex-shrink-0"><Check className="w-4 h-4"/></button>
                  <button onClick={() => setEditingId(null)} className="text-white/30 hover:text-white transition-colors flex-shrink-0"><X className="w-4 h-4"/></button>
                </>
              ) : (
                <>
                  <span className="text-purple-400 flex-shrink-0"><ChevronRight/></span>
                  <span className="text-sm text-white/65 flex-1">{f.function_text}</span>
                  {f.is_measurable && <span className="text-[10px] text-blue-400 border border-blue-500/25 rounded px-1.5 py-0.5 flex-shrink-0">Measurable</span>}
                  <button onClick={() => { setEditingId(f.id); setEditText(f.function_text); }}
                    className="text-white/15 hover:text-purple-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"><Edit3 className="w-3.5 h-3.5"/></button>
                  <button onClick={() => remove(f.id)}
                    className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5"/></button>
                </>
              )}
            </div>
          ))}
          {(!grouped[activeRole] || grouped[activeRole].length === 0) && (
            <p className="text-sm text-white/20 text-center py-6">No core functions defined for this role yet.</p>
          )}
        </div>

        {/* Add new */}
        <div className="border-t border-white/5 pt-4">
          <div className="flex gap-2 mb-2">
            <input className="sabi-input flex-1 text-sm" placeholder="e.g. Publish minimum 5 posts per week per assigned brand"
              value={newFunction} onChange={e => setNewFunction(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addFunction(); }}/>
            <button onClick={addFunction} disabled={saving || !newFunction.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all disabled:opacity-40 flex-shrink-0">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Plus className="w-3.5 h-3.5"/>} Add
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
            <input type="checkbox" checked={newMeasurable} onChange={e => setNewMeasurable(e.target.checked)} className="rounded"/>
            This function has a measurable target (a number the system could eventually track automatically)
          </label>
        </div>
      </div>
    </div>
  );
}
