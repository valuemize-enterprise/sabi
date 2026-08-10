'use client';

import { Edit, Loader2, Target, Brain } from 'lucide-react';
import { useState } from 'react';
import { goals as goalsApi, goalGeneratorApi } from '@/lib/api';

const METRIC_TYPES = [
  'revenue', 'followers', 'engagement_rate', 'leads', 'conversions',
  'impressions', 'reach', 'clicks', 'views', 'custom',
];

const STATUSES = ['active', 'paused', 'achieved', 'missed'];

const iS = 'sabi-input text-sm w-full';

export function EditGoalModal({ goal, onClose, onSaved, isAiGoal = false }: {
  goal: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
  isAiGoal?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  // ── Manual goal form state ──────────────────────────────────────
  const [manual, setManual] = useState({
    title:        goal.title        ?? '',
    metric_type:  goal.metric_type  ?? '',
    target_value: String(goal.target_value ?? ''),
    unit:         goal.unit         ?? '',
    description:  goal.description  ?? '',
    deadline:     goal.deadline     ?? '',
  });

  // ── AI / OKR form state ─────────────────────────────────────────
  const [okr, setOkr] = useState({
    title:       goal.objective    || goal.title || '',
    description: goal.description  ?? '',
    status:      goal.status       ?? 'active',
    quarter:     goal.quarter      ?? '',
    // Key result current values for progress updates
    key_results: Array.isArray(goal.key_results)
      ? goal.key_results.map((kr: any) => ({
          id:            kr.id,
          title:         kr.title,
          current_value: String(kr.current_value ?? '0'),
          target_value:  kr.target_value,
          unit:          kr.unit,
        }))
      : [],
  });

  // ── Save ─────────────────────────────────────────────────────────

  const saveManual = async () => {
    if (!manual.title.trim()) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        brand_id:     goal.brand_id,
        title:        manual.title,
        metric_type:  manual.metric_type,
        target_value: parseFloat(manual.target_value),
        unit:         manual.unit || '#',
        description:  manual.description || undefined,
        deadline:     manual.deadline    || undefined,
      };
      const res: any = await goalsApi.update(goal.id, payload);
      onSaved(res.data?.goal ?? { ...goal, ...manual });
    } catch (e: any) {
      setError(e.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const saveOkr = async () => {
    if (!okr.title.trim()) return;
    setSaving(true); setError(null);
    try {
      const payload = {
        brand_id:    goal.brand_id,
        objective:   okr.title,
        title:       okr.title,
        description: okr.description || undefined,
        status:      okr.status,
        quarter:     okr.quarter     || undefined,
        key_results: okr.key_results.map((kr: any) => ({
          id:            kr.id,
          current_value: parseFloat(kr.current_value) || 0,
        })),
      };
      const res: any = await goalGeneratorApi.updateGoal(goal.id, payload);
      onSaved(res.data?.goal ?? { ...goal, objective: okr.title, ...okr });
    } catch (e: any) {
      setError(e.message || 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="sabi-card w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isAiGoal
              ? <Brain className="w-4 h-4 text-purple-400 flex-shrink-0" />
              : <Target className="w-4 h-4 text-purple-400 flex-shrink-0" />
            }
            <div>
              <p className="font-semibold text-white text-sm">
                {isAiGoal ? 'Edit OKR / AI Goal' : 'Edit Goal'}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {isAiGoal
                  ? 'Update the objective, status, and key result progress'
                  : 'Update title, metric, and target'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-lg leading-none flex-shrink-0">&times;</button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ── MANUAL GOAL FORM ──────────────────────────────────── */}
        {!isAiGoal && (
          <div className="space-y-3">
            <input
              className={iS}
              placeholder="Goal title…"
              value={manual.title}
              onChange={e => setManual(p => ({ ...p, title: e.target.value }))}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="sabi-input text-sm"
                value={manual.metric_type}
                onChange={e => setManual(p => ({ ...p, metric_type: e.target.value }))}
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
                value={manual.target_value}
                onChange={e => setManual(p => ({ ...p, target_value: e.target.value }))}
              />
              <input
                className="sabi-input text-sm"
                placeholder="Unit (#)"
                value={manual.unit}
                onChange={e => setManual(p => ({ ...p, unit: e.target.value }))}
              />
              <input
                className="sabi-input text-sm"
                type="date"
                value={manual.deadline}
                onChange={e => setManual(p => ({ ...p, deadline: e.target.value }))}
              />
            </div>
            <textarea
              className="sabi-input text-sm w-full"
              rows={2}
              placeholder="Description (optional)…"
              value={manual.description}
              onChange={e => setManual(p => ({ ...p, description: e.target.value }))}
            />
          </div>
        )}

        {/* ── AI / OKR FORM ─────────────────────────────────────── */}
        {isAiGoal && (
          <div className="space-y-4">

            {/* Objective */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">
                Objective
              </label>
              <textarea
                className="sabi-input text-sm w-full"
                rows={2}
                placeholder="Objective statement…"
                value={okr.title}
                onChange={e => setOkr(p => ({ ...p, title: e.target.value }))}
                autoFocus
              />
            </div>

            {/* Status + Quarter */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">
                  Status
                </label>
                <select
                  className="sabi-input text-sm"
                  value={okr.status}
                  onChange={e => setOkr(p => ({ ...p, status: e.target.value }))}
                >
                  {STATUSES.map(s => (
                    <option className="bg-black" key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">
                  Quarter
                </label>
                <input
                  className="sabi-input text-sm"
                  placeholder="e.g. Q3 2026"
                  value={okr.quarter}
                  onChange={e => setOkr(p => ({ ...p, quarter: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5 block">
                Notes (optional)
              </label>
              <textarea
                className="sabi-input text-sm w-full"
                rows={2}
                placeholder="Context or notes about this objective…"
                value={okr.description}
                onChange={e => setOkr(p => ({ ...p, description: e.target.value }))}
              />
            </div>

            {/* Key result progress updates */}
            {okr.key_results.length > 0 && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2 block">
                  Key Result Progress
                </label>
                <div className="space-y-2">
                  {okr.key_results.map((kr : any, idx: number) => {
                    const pct = Math.min(100, Math.round(
                      (parseFloat(kr.current_value) / Math.max(kr.target_value, 1)) * 100
                    ));
                    return (
                      <div
                        key={kr.id}
                        className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-2"
                      >
                        <p className="text-xs text-white/70 leading-snug">{kr.title}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="w-full bg-white/8 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-purple-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-white/40 w-7 text-right flex-shrink-0">{pct}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            className="sabi-input text-sm flex-1"
                            type="number"
                            placeholder="Current value"
                            value={kr.current_value}
                            onChange={e => {
                              const updated = [...okr.key_results];
                              updated[idx] = { ...updated[idx], current_value: e.target.value };
                              setOkr(p => ({ ...p, key_results: updated }));
                            }}
                          />
                          <span className="text-xs text-white/30 flex-shrink-0">
                            / {kr.target_value} {kr.unit}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI notice */}
            <div className="flex items-start gap-2 bg-purple-500/5 border border-purple-500/15 rounded-lg px-3 py-2.5">
              <Brain className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-white/40 leading-relaxed">
                This goal was generated by ARIA. You can update status, progress, and notes.
                To restructure the objective or key results, delete this goal and regenerate.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white transition-colors px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={isAiGoal ? saveOkr : saveManual}
            disabled={saving}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            {saving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Edit className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}