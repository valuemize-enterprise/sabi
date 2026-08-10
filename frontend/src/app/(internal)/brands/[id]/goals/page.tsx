'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Target, Plus, Brain, Loader2, AlertCircle, Edit, Trash2 } from 'lucide-react';
import { goals as goalsApi, goalGeneratorApi } from '@/lib/api';
import { LoadingPage, EmptyState, Badge, PageHeader } from '@/components/ui';
import { useAgencyStore } from '@/lib/store';
import GoalGeneratorPanel       from '@/components/goals/GoalGeneratorPanel';
import GoalChangeRequestModal   from '@/components/goals/GoalChangeRequestModal';
import { EditGoalModal }        from '@/components/goals/EditGoalModal';
import { DeleteGoalModal }      from '@/components/goals/DeleteGoalModal';

// ── Constants ─────────────────────────────────────────────────────

const METRIC_TYPES = [
  'revenue', 'followers', 'engagement_rate', 'leads', 'conversions',
  'impressions', 'reach', 'clicks', 'views', 'custom',
];

const STATUS_COLOR: Record<string, string> = {
  active: 'purple', achieved: 'green', missed: 'red', paused: 'gray',
};

const FORM_EMPTY = {
  title: '', metric_type: '', target_value: '', unit: '', description: '', deadline: '',
};

// ── Helpers ───────────────────────────────────────────────────────

const isAiGoal = (g: any): boolean =>
  Boolean(g.is_ai_generated || g.framework === 'OKR');

// ── Component ─────────────────────────────────────────────────────

export default function BrandGoalsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const { user }        = useAgencyStore();
  const router          = useRouter();

  const [items,   setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [brand,   setBrand]   = useState<any>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(FORM_EMPTY);
  const [saving,   setSaving]   = useState(false);

  // Velocity
  const [tracking, setTracking] = useState<string | null>(null);

  // Modals
  const [editTarget,         setEditTarget]         = useState<any>(null);
  const [deleteTarget,       setDeleteTarget]       = useState<any>(null);
  const [changeRequestOpen,  setChangeRequestOpen]  = useState(false);
  const [selectedGoal,       setSelectedGoal]       = useState<any>(null);
  const [changeRequestType,  setChangeRequestType]  = useState<'edit' | 'delete'>('edit');

  // ── Data loading ────────────────────────────────────────────────

  const refetch = useCallback(() => {
    setError(null);
    setLoading(true);
    Promise.all([
      goalGeneratorApi.getBrandGoals(brandId).then((r: any) => r.goals  ?? []),
      goalsApi.list({ brand_id: brandId, limit: '50' }).then((r: any)  => r.data ?? []),
    ])
      .then(([aiGoals, manualGoals]) => {
        const aiIds        = new Set(aiGoals.map((g: any) => g.id));
        const uniqueManual = manualGoals.filter((g: any) => !aiIds.has(g.id));
        setItems([...aiGoals, ...uniqueManual]);
      })
      .catch((e: any) => setError(e.message || 'Failed to load goals'))
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => {
    refetch();
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agency/brands/${brandId}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('sabi_token')}` } }
    )
      .then(r => r.json())
      .then(d => setBrand(d.data?.brand ?? d.brand ?? null))
      .catch(() => {});
  }, [brandId, refetch]);

  // ── Create goal ─────────────────────────────────────────────────

  const create = async () => {
    if (!form.title.trim() || !form.metric_type || !form.target_value) return;
    setSaving(true); setError(null);
    try {
      const res: any = await goalsApi.create({
        brand_id:     brandId,
        title:        form.title,
        metric_type:  form.metric_type,
        target_value: parseFloat(form.target_value),
        unit:         form.unit || '#',
        description:  form.description  || undefined,
        deadline:     form.deadline     || undefined,
      });
      setItems(prev => [res.data?.goal ?? res.goal, ...prev]);
      setForm(FORM_EMPTY);
      setShowForm(false);
    } catch (e: any) {
      setError(e.message || 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

  // ── Velocity tracker ────────────────────────────────────────────

  const trackVelocity = async (id: string) => {
    setTracking(id); setError(null);
    try {
      const res: any = await goalsApi.trackVelocity(id);
      setItems(prev => prev.map(g =>
        g.id === id ? { ...g, velocity_score: res.data.velocityScore, velocity_data: res.data } : g
      ));
    } catch (e: any) {
      setError(e.message || 'Failed to track velocity');
    } finally {
      setTracking(null);
    }
  };

  // ── Edit / Delete routing ────────────────────────────────────────

  const handleEdit = (goal: any) => {
    if (goal.locked && user?.role !== 'super_admin') {
      setSelectedGoal(goal);
      setChangeRequestType('edit');
      setChangeRequestOpen(true);
    } else {
      setEditTarget(goal);
    }
  };

  const handleDelete = (goal: any) => {
    if (goal.locked && user?.role !== 'super_admin') {
      setSelectedGoal(goal);
      setChangeRequestType('delete');
      setChangeRequestOpen(true);
    } else {
      setDeleteTarget(goal);
    }
  };

  // Calls the correct API based on which table the goal lives in
  const confirmDelete = async (goal: any) => {
    try {
      if (isAiGoal(goal)) {
        await goalGeneratorApi.deleteGoal(goal.id);   // brand_goals table
      } else {
        await goalsApi.delete(goal.id);               // goals table
      }
      // Success — remove from list and close modal
      setItems(prev => prev.filter(g => g.id !== goal.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message || 'Failed to delete goal');
      setDeleteTarget(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <PageHeader
        title="Goals"
        subtitle="KPIs and performance targets for this brand"
        action={
          <div className="flex items-center gap-3">
            <button
              className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4" /> Add Goal
            </button>
            {brand && user && (
              <GoalGeneratorPanel
                brandId={brand.id}
                brandName={brand.name}
                onGoalsSaved={refetch}
                userRole={user.role}
              />
            )}
          </div>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400/50 hover:text-red-300 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Inline create form */}
      {showForm && (
        <div className="sabi-card p-5 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="sabi-input text-sm col-span-2"
              placeholder="Goal title…"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              autoFocus
            />
            <select
              className="sabi-input text-sm"
              value={form.metric_type}
              onChange={e => setForm(p => ({ ...p, metric_type: e.target.value }))}
            >
              <option className="bg-black" value="">Metric type…</option>
              {METRIC_TYPES.map(m => (
                <option className="bg-black" key={m} value={m}>{m.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <input
              className="sabi-input text-sm"
              type="number"
              placeholder="Target value"
              value={form.target_value}
              onChange={e => setForm(p => ({ ...p, target_value: e.target.value }))}
            />
            <input
              className="sabi-input text-sm"
              placeholder="Unit (#)"
              value={form.unit}
              onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
            />
            <input
              className="sabi-input text-sm"
              type="date"
              value={form.deadline}
              onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
            />
          </div>
          <textarea
            className="sabi-input text-sm w-full"
            rows={2}
            placeholder="Description (optional)…"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => { setShowForm(false); setForm(FORM_EMPTY); }}
              className="text-xs text-white/30 hover:text-white transition-colors px-3"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving}
              className="sabi-btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create Goal
            </button>
          </div>
        </div>
      )}

      {/* Goal list */}
      {loading ? (
        <LoadingPage />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set goals for this brand to track performance and power VelocityTracker™."
        />
      ) : (
        <div className="space-y-4">
          {items.map(g => {
            const ai          = isAiGoal(g);
            const pct         = g.current_progress
              ?? Math.min(100, Math.round((g.current_value / Math.max(g.target_value, 1)) * 100));
            const vel         = g.velocity_data;
            const displayTitle = ai ? (g.objective || g.title) : g.title;

            return (
              <div key={g.id} className="sabi-card p-5">

                {/* Header */}
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-white">{displayTitle}</p>
                      <Badge label={g.status} color={STATUS_COLOR[g.status] ?? 'gray'} />
                      {ai && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded px-1.5 py-0.5">
                          OKR · ARIA
                        </span>
                      )}
                      {g.quarter && (
                        <span className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">
                          {g.quarter}
                        </span>
                      )}
                      {g.locked && <Badge label="locked" color="amber" />}
                    </div>

                    {!ai && (
                      <p className="text-xs text-white/40">
                        {g.metric_type} · Target: {g.target_value} {g.unit}
                        {g.deadline ? ` · Due: ${g.deadline}` : ''}
                      </p>
                    )}
                    {ai && g.source_insight && (
                      <p className="text-xs text-white/30 mt-0.5 italic">"{g.source_insight}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {g.locked && user?.role !== 'super_admin' ? (
                      <>
                        <button
                          onClick={() => handleEdit(g)}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded-lg border border-blue-500/20 hover:bg-blue-500/10"
                        >
                          <Edit className="w-3.5 h-3.5" /> Request Edit
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Request Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(g)}
                          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(g)}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </>
                    )}

                    {!ai && (
                      <button
                        onClick={() => trackVelocity(g.id)}
                        disabled={tracking === g.id}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                      >
                        {tracking === g.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Brain className="w-3.5 h-3.5" />}
                        {tracking === g.id ? 'Analysing…' : 'Track Velocity'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex-1">
                    {!ai && (
                      <div className="flex justify-between text-xs text-white/40 mb-1.5">
                        <span>{g.current_value} {g.unit}</span>
                        <span>Target: {g.target_value}</span>
                      </div>
                    )}
                    <div className="w-full bg-white/8 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-purple-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-xl font-black flex-shrink-0 ${pct >= 100 ? 'text-green-400' : 'text-white'}`}>
                    {pct}%
                  </span>
                </div>

                {/* OKR key results */}
                {ai && Array.isArray(g.key_results) && g.key_results.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/20 mb-2">Key results</p>
                    {g.key_results.map((kr: any) => {
                      const krPct = Math.min(100, Math.round((kr.current_value / Math.max(kr.target_value, 1)) * 100));
                      return (
                        <div key={kr.id} className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60 flex-shrink-0" />
                          <p className="text-xs text-white/60 flex-1 truncate">{kr.title}</p>
                          <span className="text-[10px] text-white/30 whitespace-nowrap flex-shrink-0">
                            {kr.current_value} / {kr.target_value} {kr.unit}
                          </span>
                          <div className="w-16 bg-white/8 rounded-full h-1 flex-shrink-0">
                            <div
                              className={`h-1 rounded-full ${krPct >= 100 ? 'bg-green-500' : krPct >= 60 ? 'bg-purple-500' : 'bg-amber-500'}`}
                              style={{ width: `${krPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/40 w-7 text-right flex-shrink-0">{krPct}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Velocity output */}
                {vel && (
                  <div className={`mt-3 text-xs flex items-center gap-2 px-3 py-2 rounded-lg ${
                    vel.trajectoryLabel === 'On Track' || vel.trajectoryLabel === 'Accelerating'
                      ? 'bg-green-500/5 text-green-400'
                      : 'bg-red-500/5 text-red-400'
                  }`}>
                    <Brain className="w-3.5 h-3.5 flex-shrink-0" />
                    <strong>{vel.trajectoryLabel}</strong>
                    {vel.recommendation && (
                      <span className="text-white/40 ml-1">— {vel.recommendation}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}

      {changeRequestOpen && selectedGoal && (
        <GoalChangeRequestModal
          goal={selectedGoal}
          requestType={changeRequestType}
          onClose={() => setChangeRequestOpen(false)}
          onRequestSent={() => {
            setChangeRequestOpen(false);
            alert('Request sent to Super Admin for approval');
          }}
        />
      )}

      {deleteTarget && (
        <DeleteGoalModal
          goal={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => confirmDelete(deleteTarget)}
        />
      )}

      {editTarget && (
        <EditGoalModal
          goal={editTarget}
          isAiGoal={isAiGoal(editTarget)}
          onClose={() => setEditTarget(null)}
          onSaved={(updated: any) => {
            setItems(prev => prev.map(g => g.id === updated.id ? updated : g));
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
