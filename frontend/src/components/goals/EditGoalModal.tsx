import { Edit, Loader2 } from "lucide-react";
import { useState } from "react";
import { goals as goalsApi } from '@/lib/api';

 export  function EditGoalModal({ goal, onClose, onSaved }: {
  goal: any; onClose: () => void; onSaved: (updated: any) => void;
}) {
  const [form, setForm] = useState({
    title:        goal.title        ?? '',
    metric_type:  goal.metric_type  ?? '',
    target_value: String(goal.target_value ?? ''),
    unit:         goal.unit         ?? '',
    description:  goal.description  ?? '',
    deadline:     goal.deadline     ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const METRIC_TYPES = ['revenue', 'followers', 'engagement_rate', 'leads', 'conversions', 'impressions', 'reach', 'clicks', 'views', 'custom'];

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true); setError(null);
    try {
      const res: any = await goalsApi.update(goal.id, {
        brand_id:     goal.brand_id,
        title:        form.title,
        metric_type:  form.metric_type,
        target_value: parseFloat(form.target_value),
        unit:         form.unit || '#',
        description:  form.description || undefined,
        deadline:     form.deadline    || undefined,
      });
      onSaved(res.data?.goal ?? { ...goal, ...form });
    } catch (e: any) {
      setError(e.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="sabi-card w-full max-w-md p-6 space-y-4">

        <div className="flex items-center justify-between">
          <p className="font-semibold text-white">Edit goal</p>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-lg leading-none">&times;</button>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <input className="sabi-input text-sm col-span-2" placeholder="Goal title…"
            value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
          <select className="sabi-input text-sm" value={form.metric_type}
            onChange={e => setForm(p => ({ ...p, metric_type: e.target.value }))}>
            <option className="bg-black" value="">Metric type…</option>
            {METRIC_TYPES.map(m => <option className="bg-black" key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="sabi-input text-sm" type="number" placeholder="Target value"
            value={form.target_value} onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))} />
          <input className="sabi-input text-sm" placeholder="Unit (#)"
            value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} />
          <input className="sabi-input text-sm" type="date"
            value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
        </div>
        <textarea className="sabi-input text-sm w-full" rows={2} placeholder="Description (optional)…"
          value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />

        <div className="flex items-center gap-3 justify-end">
          <button onClick={onClose} className="text-xs text-white/40 hover:text-white transition-colors px-4 py-2">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}