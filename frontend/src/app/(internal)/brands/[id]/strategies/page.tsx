'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Lightbulb, Plus, X, Loader2,
    Pencil, Trash2, Check, ChevronRight, Calendar, Target
} from 'lucide-react';
import { strategies as strategiesApi, goals as goalsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';
import { useBrandPermissions } from '@/lib/permissions';

// ── Constants ─────────────────────────────────────────────────
const STRATEGY_TYPES = [
    { value: 'content', label: 'Content Strategy', icon: '✍️', desc: 'Content plan, calendar, messaging' },
    { value: 'social', label: 'Social Media', icon: '📱', desc: 'Platform strategy and engagement plan' },
    { value: 'paid', label: 'Paid Advertising', icon: '📣', desc: 'Meta Ads, Google, TikTok strategy' },
    { value: 'seo', label: 'SEO & Digital', icon: '🔍', desc: 'Search visibility and traffic plan' },
    { value: 'email', label: 'Email Marketing', icon: '📧', desc: 'Email campaigns and flows' },
    { value: 'brand', label: 'Brand Strategy', icon: '🎯', desc: 'Positioning, voice, visual identity' },
    { value: 'campaign', label: 'Campaign', icon: '🚀', desc: 'Specific campaign or product launch' },
    { value: 'quarterly', label: 'Quarterly Plan', icon: '📊', desc: '90-day strategic roadmap' },
    { value: 'annual', label: 'Annual Strategy', icon: '🗓️', desc: 'Full year marketing plan' },
    { value: 'other', label: 'Other', icon: '📌', desc: 'Custom strategy type' },
];

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed', 'archived'];
const STATUS_COLOR: Record<string, string> = {
    draft: 'gray', active: 'green', paused: 'amber', completed: 'blue', archived: 'gray',
};
const TYPE_ICON: Record<string, string> = Object.fromEntries(STRATEGY_TYPES.map(t => [t.value, t.icon]));
const TYPE_LABEL: Record<string, string> = Object.fromEntries(STRATEGY_TYPES.map(t => [t.value, t.label]));

// ── Empty form ────────────────────────────────────────────────
const EMPTY_FORM = {
    title: '', type: 'campaign', description: '',
    start_date: '', end_date: '', budget: '', status: 'draft',
};

export default function BrandStrategiesPage() {
    const { id: brandId } = useParams<{ id: string }>();

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [statusChanging, setStatusChanging] = useState<string | null>(null);
      const perms           = useBrandPermissions(brandId);

    const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

    useEffect(() => {
        Promise.all([
            strategiesApi.list({ brand_id: brandId, limit: '50' }),
            goalsApi.list({ brand_id: brandId, status: 'active', limit: '20' }),
        ])
            .then(([sr, gr]: any) => {
                setItems(sr.data ?? []);
                setGoals(gr.data ?? []);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [brandId]);

    const openCreate = () => {
        setEditId(null);
        setForm({ ...EMPTY_FORM });
        setError('');
        setShowModal(true);
    };

    const openEdit = (s: any) => {
        setEditId(s.id);
        setForm({
            title: s.title ?? '',
            type: s.type ?? 'campaign',
            description: s.description ?? '',
            start_date: s.start_date ?? '',
            end_date: s.end_date ?? '',
            budget: s.budget ? String(s.budget) : '',
            status: s.status ?? 'draft',
        });
        setError('');
        setShowModal(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title) { setError('Title is required'); return; }
        setSaving(true); setError('');
        try {
            const body = {
                brand_id: brandId,
                title: form.title,
                type: form.type,
                description: form.description || null,
                start_date: form.start_date || null,
                end_date: form.end_date || null,
                budget: form.budget ? parseFloat(form.budget) : null,
                status: form.status,
            };

            if (editId) {
                const res: any = await strategiesApi.update(editId, body);
                const updated = res.data?.strategy ?? res.data;
                setItems(p => p.map(s => s.id === editId ? { ...s, ...updated } : s));
            } else {
                const res: any = await strategiesApi.create(body);
                const created = res.data?.strategy ?? res.data;
                setItems(p => [created, ...p]);
            }
            setShowModal(false);
        } catch (err: any) {
            setError(err.message || 'Failed to save strategy');
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (id: string, status: string) => {
        setStatusChanging(id);
        try {
            await strategiesApi.update(id, { status });
            setItems(p => p.map(s => s.id === id ? { ...s, status } : s));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setStatusChanging(null);
        }
    };

    const del = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
        setDeleting(id);
        try {
            await strategiesApi.delete(id);
            setItems(p => p.filter(s => s.id !== id));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
           {perms.canAssignStaff && ( <AgencyTopNav
                title="Strategies"
                subtitle="Campaign and marketing strategies"
                breadcrumb={[{ label: 'Brands', href: '/brands' }, { label: 'Brand', href: `/brands/${brandId}` }]}
            />)}

            <Link href={`/brands/${brandId}`}
                className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Brand
            </Link>

            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h1 className="text-xl font-bold text-white">Strategies</h1>
                    <p className="text-sm text-white/40 mt-0.5">
                        {items.length} strateg{items.length !== 1 ? 'ies' : 'y'}
                    </p>
                </div>
                <button onClick={openCreate}
                    className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                    <Plus className="w-4 h-4" /> New Strategy
                </button>
            </div>

            {/* Active goals context banner */}
            {goals.length > 0 && (
                <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-purple-500/6 border border-purple-500/15">
                    <Target className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <p className="text-xs text-white/50">
                        <span className="text-white font-medium">{goals.length} active goal{goals.length !== 1 ? 's' : ''}</span> for this brand —
                        you can link strategies to these goals when editing
                    </p>
                </div>
            )}

            {error && !showModal && (
                <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
                    <span className="text-sm text-red-300">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto text-red-400/50 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-base font-bold text-white">{editId ? 'Edit Strategy' : 'New Strategy'}</h2>
                                <p className="text-xs text-white/30 mt-0.5">
                                    {editId ? 'Update the strategy details' : 'Add a campaign or marketing strategy to this brand'}
                                </p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
                                {error}
                            </div>
                        )}

                        <form onSubmit={save} className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block">Strategy Title *</label>
                                <input className="sabi-input" required
                                    placeholder="e.g. FiberOne Q3 Instagram Growth Strategy"
                                    value={form.title} onChange={e => setF('title', e.target.value)} />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block">Strategy Type *</label>
                                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                                    {STRATEGY_TYPES.map(t => (
                                        <button type="button" key={t.value}
                                            onClick={() => setF('type', t.value)}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${form.type === t.value
                                                    ? 'border-purple-500/50 bg-purple-500/15'
                                                    : 'border-white/5 hover:border-white/10 hover:bg-white/3'
                                                }`}>
                                            <span className="text-base mt-0.5 flex-shrink-0">{t.icon}</span>
                                            <div className="min-w-0">
                                                <p className={`text-xs font-semibold leading-none ${form.type === t.value ? 'text-purple-300' : 'text-white/60'}`}>
                                                    {t.label}
                                                </p>
                                                <p className="text-[10px] text-white/25 mt-1 leading-tight">{t.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block">
                                    Description <span className="text-white/20">(optional)</span>
                                </label>
                                <textarea className="sabi-input resize-none" rows={3}
                                    placeholder="Objectives, key messages, channels, tactics…"
                                    value={form.description} onChange={e => setF('description', e.target.value)} />
                            </div>

                            {/* Dates + Budget */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-white/50 mb-1.5 block">Start Date</label>
                                    <input type="date" className="sabi-input text-sm"
                                        value={form.start_date} onChange={e => setF('start_date', e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 mb-1.5 block">End Date</label>
                                    <input type="date" className="sabi-input text-sm"
                                        value={form.end_date} onChange={e => setF('end_date', e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-white/50 mb-1.5 block">
                                    Budget (₦) <span className="text-white/20">(optional)</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className="sabi-input text-sm"
                                    placeholder="e.g. 500000"
                                    value={form.budget}
                                    onChange={e => setF('budget', e.target.value)}
                                />
                            </div>

                            {/* Status (edit only) */}
                            {editId && (
                                <div>
                                    <label className="text-xs text-white/50 mb-1.5 block">Status</label>
                                    <select className="sabi-input text-sm" value={form.status} onChange={e => setF('status', e.target.value)}>
                                        {STATUS_OPTIONS.map(s => <option className='bg-black'
                                         key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <button type="submit" disabled={saving}
                                    className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                                    {saving
                                        ? <><Loader2 className="w-4 h-4 animate-spin" />{editId ? 'Saving…' : 'Creating…'}</>
                                        : <><Check className="w-4 h-4" />{editId ? 'Save Changes' : 'Create Strategy'}</>}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="px-4 text-sm text-white/40 hover:text-white transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? <LoadingPage label="Loading strategies…" /> : items.length === 0 ? (
                <EmptyState icon={Lightbulb} title="No strategies yet"
                    description="Add campaign strategies, content plans, and quarterly roadmaps for this brand."
                    action={{ label: 'Create First Strategy', onClick: openCreate }} />
            ) : (
                <div className="space-y-3">
                    {items.map(s => (
                        <div key={s.id} className="sabi-card p-5 hover:border-white/10 transition-all group">
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className="w-11 h-11 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xl flex-shrink-0">
                                    {TYPE_ICON[s.type] ?? '📌'}
                                </div>

                                <div className="flex-1 min-w-0">
                                    {/* Title + badges */}
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-white">{s.title}</p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge label={TYPE_LABEL[s.type] ?? s.type} color="green" />
                                                <Badge label={s.status} color={STATUS_COLOR[s.status] ?? 'gray'} />
                                                {s.budget && (
                                                    <span className="text-xs text-white/30">
                                                        Budget: ₦{Number(s.budget).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status changer */}
                                        <select
                                            className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/50 hover:text-white cursor-pointer transition-all flex-shrink-0"
                                            value={s.status}
                                            onChange={e => changeStatus(s.id, e.target.value)}
                                            disabled={statusChanging === s.id}>
                                            {STATUS_OPTIONS.map(o => (
                                                <option className="bg-black" key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Description */}
                                    {s.description && (
                                        <p className="text-sm text-white/40 mt-2 leading-relaxed line-clamp-2">
                                            {s.description}
                                        </p>
                                    )}

                                    {/* Dates */}
                                    {(s.start_date || s.end_date) && (
                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-white/25">
                                            <Calendar className="w-3 h-3" />
                                            {s.start_date && <span>{s.start_date}</span>}
                                            {s.start_date && s.end_date && <span>→</span>}
                                            {s.end_date && <span>{s.end_date}</span>}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-3 mt-3">
                                        <button onClick={() => openEdit(s)}
                                            className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white transition-colors">
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button onClick={() => del(s.id, s.title)} disabled={deleting === s.id}
                                            className="flex items-center gap-1.5 text-xs text-red-400/40 hover:text-red-400 transition-colors disabled:opacity-40 ml-auto">
                                            {deleting === s.id
                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}