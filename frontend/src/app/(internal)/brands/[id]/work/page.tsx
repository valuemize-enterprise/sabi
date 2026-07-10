'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, PenLine, Plus, X, Check, Loader2,
  Clock, Target, Paperclip, FileText,
} from 'lucide-react';
import { workLogs, goals as goalsApi } from '@/lib/api';
import { useAgencyStore } from '@/lib/store';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const CATEGORIES = [
  { value: 'strategy', label: 'Strategy & Planning', icon: '📊' },
  { value: 'content_copy', label: 'Copywriting & Content', icon: '✍️' },
  { value: 'design', label: 'Design & Creative', icon: '🎨' },
  { value: 'social_media', label: 'Social Media', icon: '📱' },
  { value: 'analytics', label: 'Analytics & Reporting', icon: '📈' },
  { value: 'video', label: 'Video & Photography', icon: '🎬' },
  { value: 'community', label: 'Community Management', icon: '💬' },
  { value: 'client_comms', label: 'Client Communication', icon: '📧' },
  { value: 'ads', label: 'Paid Advertising', icon: '📣' },
  { value: 'seo', label: 'SEO & Digital', icon: '🔍' },
  { value: 'other', label: 'Other', icon: '📌' },
];

const catInfo = (v: string) => CATEGORIES.find(c => c.value === v);

const EMPTY_FORM = { category: '', title: '', description: '', goal_id: '', hours: '' };

export default function BrandWorkPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const { user } = useAgencyStore();

  const [logs, setLogs] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');
  const router = useRouter();

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    Promise.all([
      workLogs.list({ brand_id: brandId, limit: '100' }),
      goalsApi.list({ brand_id: brandId, status: 'active', limit: '20' }),
    ])
      .then(([wr, gr]: any) => { setLogs(wr.data ?? []); setGoals(gr.data ?? []); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [brandId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category) { setError('Please select a work type'); return; }
    if (!form.title) { setError('Please describe what you did'); return; }
    setSaving(true); setError('');
    try {
      const res: any = await workLogs.create({
        brand_id: brandId,
        category: form.category,
        title: form.title,
        description: form.description || null,
        goal_id: form.goal_id || null,
        hours: parseFloat(form.hours) || 0,
      });
      setLogs(p => [res.data, ...p]);
      setForm({ ...EMPTY_FORM }); setFiles([]); setShowForm(false);
    } catch (err: any) { setError(err.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ── Filter by period ─────────────────────────────────────────
  const now = new Date();
  const visible = logs.filter(l => {
    if (period === 'week') return (now.getTime() - new Date(l.created_at).getTime()) < 7 * 86400000;
    if (period === 'month') {
      const d = new Date(l.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalHours = visible.reduce((s, l) => s + (l.hours ?? 0), 0);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Work Log</h1>
          <p className="text-sm text-white/40 mt-0.5">
            {visible.length} entr{visible.length !== 1 ? 'ies' : 'y'} · {totalHours.toFixed(1)}h logged
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setForm({ ...EMPTY_FORM }); }}
          className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="w-4 h-4" /> Log Work
        </button>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 w-fit mb-6">
        {(['week', 'month', 'all'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-all ${period === p ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
              }`}>
            {p === 'all' ? 'All Time' : `This ${p.charAt(0).toUpperCase() + p.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Log work modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-white">Log Work</h2>
                <p className="text-xs text-white/30 mt-0.5">
                  This entry will feed into the client's monthly report
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            <form onSubmit={save} className="space-y-4">
              {/* Work type */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Work Type *</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.value} onClick={() => setF('category', c.value)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${form.category === c.value
                          ? 'border-purple-500/50 bg-purple-500/15'
                          : 'border-white/5 hover:border-white/10'
                        }`}>
                      <span className="text-base flex-shrink-0">{c.icon}</span>
                      <span className={`text-xs font-medium ${form.category === c.value ? 'text-purple-300' : 'text-white/60'}`}>
                        {c.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* What did you do */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">What did you do? *</label>
                <input className="sabi-input" required
                  placeholder="e.g. Wrote 5 Instagram captions for the Independence Day campaign"
                  value={form.title} onChange={e => setF('title', e.target.value)} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">
                  More detail <span className="text-white/20">(optional)</span>
                </label>
                <textarea className="sabi-input resize-none" rows={2}
                  placeholder="Outcomes, metrics, context…"
                  value={form.description} onChange={e => setF('description', e.target.value)} />
              </div>

              {/* Goal + hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">
                    Linked Goal <span className="text-white/20">(optional)</span>
                  </label>
                  <select className="sabi-input text-sm" value={form.goal_id} onChange={e => setF('goal_id', e.target.value)}>
                    <option className="bg-black" value="">No goal</option>
                    {goals.map((g: any) => <option className="bg-black" key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Hours Spent</label>
                  <input type="number" min="0" max="24" step="0.5" className="sabi-input text-sm"
                    placeholder="e.g. 2.5"
                    value={form.hours} onChange={e => setF('hours', e.target.value)} />
                </div>
              </div>

              {/* File attachment */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">
                  Attach Evidence <span className="text-white/20">(optional)</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border border-dashed cursor-pointer transition-all ${files.length ? 'border-purple-500/30 bg-purple-500/5' : 'border-white/10 hover:border-white/20'
                  }`}>
                  <Paperclip className="w-4 h-4 text-white/30 flex-shrink-0" />
                  <span className="text-sm text-white/40">
                    {files.length ? `${files.length} file${files.length !== 1 ? 's' : ''} selected` : 'Click to attach files'}
                  </span>
                  <input type="file" multiple className="sr-only"
                    onChange={e => setFiles(Array.from(e.target.files ?? []))} />
                </label>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 mt-1.5 text-xs text-white/40">
                    <FileText className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    {f.name}
                    <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}
                      className="text-white/20 hover:text-red-400 ml-auto transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving || !form.category || !form.title}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Check className="w-4 h-4" />Log Work</>}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 text-sm text-white/40 hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Work list */}
      {loading ? <LoadingPage label="Loading work log…" /> : visible.length === 0 ? (
        <EmptyState icon={PenLine} title={period === 'week' ? 'No work logged this week' : 'No entries yet'}
          description="Log your contributions to this brand so they appear in client reports."
          action={{ label: 'Log First Entry', onClick: () => setShowForm(true) }} />
      ) : (
        <div className="space-y-3">
          {visible.map((l, i) => {
            const cat = catInfo(l.category);
            return (
              <div key={l.id ?? i} className="sabi-card p-4 hover:border-white/10 transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5 flex-shrink-0">{cat?.icon ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white leading-snug">{l.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {cat && <Badge label={cat.label} color="purple" />}
                      {l.goals?.title && (
                        <span className="text-xs text-green-400/70 flex items-center gap-1">
                          <Target className="w-3 h-3" /> {l.goals.title}
                        </span>
                      )}
                      {(l.hours ?? 0) > 0 && (
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{l.hours}h
                        </span>
                      )}
                      <span className="text-xs text-white/20">
                        {new Date(l.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {l.description && (
                      <p className="text-xs text-white/35 mt-1.5 leading-relaxed">{l.description}</p>
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