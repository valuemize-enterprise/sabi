'use client';

/**
 * GoalGeneratorPanel — AI-powered OKR goal generator
 * Sabi Intelligence Suite · Brand Goal Section
 *
 * Drop this component into the brand goals page header:
 *
 *   <GoalGeneratorPanel brandId={brand.id} onGoalsSaved={refetchGoals} />
 *
 * It renders a "Generate with AI" button that opens a right-side drawer.
 * On mobile it becomes a full-screen bottom sheet.
 *
 * Step 1 → Upload documents (PDF, DOCX, XLSX, JPEG, PNG)
 * Step 2 → AI processing with animated progress stages
 * Step 3 → Review & edit generated OKRs before saving
 * Done   → Drawer closes; onGoalsSaved() fires to refresh the list
 */

import { useCallback, useRef, useState } from 'react';
import {
  Sparkles, X, Upload, FileText, FileSpreadsheet, Image,
  ChevronRight, ChevronDown, ChevronUp, ArrowLeft,
  Check, AlertTriangle, RefreshCw, Info, Trash2, Plus,
} from 'lucide-react';
import { goalGeneratorApi, type GeneratedGoal, type GenerationResult } from './types';

// ── Styles (kept as inline objects for zero build-system dependencies) ─────────

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)',
    zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
  },
  drawer: {
    width: '100%', maxWidth: 680, height: '100dvh',
    background: 'var(--surface-2, #fff)',
    borderLeft: '0.5px solid var(--border, #E5E7EB)',
    display: 'flex', flexDirection: 'column' as const,
    overflowY: 'auto' as const,
  },
  header: {
    padding: '18px 20px 16px',
    borderBottom: '0.5px solid var(--border, #E5E7EB)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    position: 'sticky' as const, top: 0,
    background: 'var(--surface-2, #fff)', zIndex: 10,
  },
  body:    { flex: 1, padding: '20px 20px 32px', overflowY: 'auto' as const },
  card:    { background: 'var(--surface-2, #fff)', border: '0.5px solid var(--border, #E5E7EB)', borderRadius: 12 },
  btnPrim: { background: '#5B21B6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500 as const, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit' },
  btnSec:  { background: 'var(--surface-2, #fff)', color: 'var(--text-primary, #111827)', border: '0.5px solid var(--border-strong, #D1D5DB)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit' },
  input:   { width: '100%', border: '0.5px solid var(--border, #E5E7EB)', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: 'var(--surface-2, #fff)', color: 'var(--text-primary, #111827)', fontFamily: 'inherit' },
  label:   { fontSize: 10, fontWeight: 600 as const, color: 'var(--text-muted, #9CA3AF)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 },
};

// ── File type icon ────────────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return <Image size={14} color="#5B21B6" />;
  if (['xlsx', 'xls'].includes(ext)) return <FileSpreadsheet size={14} color="#059669" />;
  return <FileText size={14} color="#374151" />;
}

// ── Processing animation ──────────────────────────────────────────────────────

const STAGES = [
  'Reading your documents…',
  'Extracting brand objectives…',
  'Building OKR frameworks…',
  'Checking for goal conflicts…',
  'Finalising goals…',
];

function ProcessingStep({ stage }: { stage: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ width: 64, height: 64, background: '#EDE9FE', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <Sparkles size={28} color="#5B21B6" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary, #111827)', marginBottom: 8 }}>ARIA is analysing your documents</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #6B7280)', marginBottom: 28 }}>{STAGES[stage]}</div>

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
        {STAGES.map((_, i) => (
          <div key={i} style={{
            width: i <= stage ? 20 : 8, height: 8, borderRadius: 4,
            background: i < stage ? '#5B21B6' : i === stage ? '#7C3AED' : '#E5E7EB',
            transition: 'all 0.4s',
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 320, margin: '0 auto', ...S.card, padding: '14px 16px', background: '#EDE9FE', borderColor: '#C4B5FD' }}>
        <div style={{ fontSize: 12, color: '#4C1D95', lineHeight: 1.6 }}>
          ARIA reads your brief, identifies the client's strategic priorities, and structures them as OKRs — Objectives with 2-5 measurable Key Results each.
        </div>
      </div>
    </div>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const [bg, cl, label] =
    score >= 80 ? ['#ECFDF5', '#059669', 'High confidence'] :
    score >= 60 ? ['#FFFBEB', '#D97706', 'Medium confidence'] :
                  ['#FFF5F5', '#DC2626', 'Low — review carefully'];
  return (
    <span style={{ background: bg, color: cl, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {score}% · {label}
    </span>
  );
}

// ── Editable key result row ───────────────────────────────────────────────────

function KRRow({ kr, onChange, onRemove }: {
  kr: GeneratedGoal['key_results'][number];
  onChange: (field: string, value: string | number) => void;
  onRemove: () => void;
}) {
  const progress = Math.min(Math.round((kr.current_value / Math.max(kr.target_value, 1)) * 100), 100);
  return (
    <div style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border, #F3F4F6)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#5B21B6', marginTop: 7, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          value={kr.title}
          onChange={e => onChange('title', e.target.value)}
          style={{ ...S.input, fontSize: 13, fontWeight: 500, marginBottom: 6, border: 'none', padding: '0', background: 'transparent', outline: 'none' }}
          placeholder="Key result title…"
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="number" value={kr.current_value} onChange={e => onChange('current_value', Number(e.target.value))}
            style={{ ...S.input, width: 72, padding: '4px 7px', fontSize: 12 }} placeholder="Current" />
          <span style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>→</span>
          <input type="number" value={kr.target_value} onChange={e => onChange('target_value', Number(e.target.value))}
            style={{ ...S.input, width: 72, padding: '4px 7px', fontSize: 12 }} placeholder="Target" />
          <input value={kr.unit} onChange={e => onChange('unit', e.target.value)}
            style={{ ...S.input, width: 80, padding: '4px 7px', fontSize: 12 }} placeholder="unit" />
          <input type="date" value={kr.due_date} onChange={e => onChange('due_date', e.target.value)}
            style={{ ...S.input, width: 130, padding: '4px 7px', fontSize: 12 }} />
        </div>
        {/* Mini progress bar */}
        <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2, marginTop: 8 }}>
          <div style={{ height: 3, width: `${progress}%`, background: '#5B21B6', borderRadius: 2 }} />
        </div>
      </div>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', flexShrink: 0 }} aria-label="Remove key result">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Objective card in review step ─────────────────────────────────────────────

function ObjectiveCard({ goal, index, onChange, onToggle }: {
  goal: GeneratedGoal;
  index: number;
  onChange: (updated: GeneratedGoal) => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const updateKR = (krIdx: number, field: string, value: string | number) => {
    const krs = [...goal.key_results];
    krs[krIdx] = { ...krs[krIdx], [field]: value };
    onChange({ ...goal, key_results: krs });
  };

  const removeKR = (krIdx: number) => {
    onChange({ ...goal, key_results: goal.key_results.filter((_, i) => i !== krIdx) });
  };

  const addKR = () => {
    onChange({
      ...goal, key_results: [...goal.key_results, {
        id: String(Date.now()), title: '', metric: '', current_value: 0,
        target_value: 100, unit: '%', due_date: '', status: 'not_started',
      }],
    });
  };

  return (
    <div style={{
      ...S.card, overflow: 'hidden', marginBottom: 12,
      opacity: goal.selected ? 1 : 0.5,
      border: goal.selected ? '0.5px solid #C4B5FD' : '0.5px solid var(--border, #E5E7EB)',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: expanded ? '0.5px solid var(--border, #F3F4F6)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          {/* Select toggle */}
          <button onClick={onToggle} style={{
            width: 18, height: 18, borderRadius: 4, border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 1,
            background: goal.selected ? '#5B21B6' : '#F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} aria-label={goal.selected ? 'Deselect goal' : 'Select goal'}>
            {goal.selected && <Check size={11} color="#fff" strokeWidth={3} />}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Objective {index + 1}</span>
              <span style={{ fontSize: 10, background: '#EDE9FE', color: '#5B21B6', padding: '1px 6px', borderRadius: 4 }}>{goal.quarter}</span>
              <ConfidenceBadge score={goal.confidence_score} />
              {goal.is_duplicate_risk && (
                <span style={{ fontSize: 10, background: '#FFF5F5', color: '#DC2626', padding: '1px 6px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertTriangle size={9} /> Similar goal exists
                </span>
              )}
            </div>
            <input
              value={goal.objective}
              onChange={e => onChange({ ...goal, objective: e.target.value })}
              style={{ ...S.input, fontSize: 14, fontWeight: 500, border: 'none', padding: '0', background: 'transparent', outline: 'none' }}
              placeholder="Objective…"
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted, #9CA3AF)', marginTop: 4 }}>
              💡 {goal.source_insight}
            </div>
          </div>

          <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px', flexShrink: 0 }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Key results */}
      {expanded && (
        <>
          <div style={{ padding: '6px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, #9CA3AF)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Key results · {goal.key_results.length}
            </span>
            <button onClick={addKR} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5B21B6', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
              <Plus size={12} /> Add KR
            </button>
          </div>
          {goal.key_results.map((kr, ki) => (
            <KRRow key={kr.id} kr={kr}
              onChange={(f, v) => updateKR(ki, f, v)}
              onRemove={() => removeKR(ki)} />
          ))}
          {goal.key_results.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted, #9CA3AF)', textAlign: 'center' }}>
              No key results. Add at least one to track progress.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  brandId:      string;
  brandName?:   string;
  onGoalsSaved: () => void;
  /** Pass 'brand_admin' | 'super_admin' | etc. — used to gate permission flows */
  userRole?:    string;
}

type Step = 'upload' | 'processing' | 'review' | 'success';

export default function GoalGeneratorPanel({ brandId, brandName = 'Brand', onGoalsSaved, userRole }: Props) {
  const [open,           setOpen]           = useState(false);
  const [step,           setStep]           = useState<Step>('upload');
  const [files,          setFiles]          = useState<File[]>([]);
  const [dragging,       setDragging]       = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [result,         setResult]         = useState<GenerationResult | null>(null);
  const [goals,          setGoals]          = useState<GeneratedGoal[]>([]);
  const [saving,         setSaving]         = useState(false);
  const [savedCount,     setSavedCount]     = useState(0);
  const [error,          setError]          = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageTimer = useRef<NodeJS.Timeout | null>(null);

  const reset = () => {
    setStep('upload'); setFiles([]); setResult(null); setGoals([]);
    setError(null); setProcessingStage(0); setSaving(false); setSavedCount(0);
    if (stageTimer.current) clearInterval(stageTimer.current);
  };

  const close = () => { setOpen(false); setTimeout(reset, 300); };

  // ── File handling ──────────────────────────────────────────────────────────
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return ['pdf','docx','xlsx','xls','jpg','jpeg','png'].includes(ext);
    });
    setFiles(prev => {
      const combined = [...prev, ...arr];
      return combined.slice(0, 5); // max 5 files
    });
    setError(null);
  }, []);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  // ── Generate ───────────────────────────────────────────────────────────────
  const generate = async () => {
    if (files.length === 0) { setError('Upload at least one document first.'); return; }
    setError(null);
    setStep('processing');
    setProcessingStage(0);

    // Animate through processing stages (visual — actual API may finish early or late)
    let stage = 0;
    stageTimer.current = setInterval(() => {
      stage = Math.min(stage + 1, STAGES.length - 2);
      setProcessingStage(stage);
    }, 2000);

    try {
      const res = await goalGeneratorApi.generate(brandId, files);
      if (stageTimer.current) clearInterval(stageTimer.current);
      setProcessingStage(STAGES.length - 1);
      setResult(res);
      setGoals(res.goals.map(g => ({ ...g, selected: true })));
      setTimeout(() => setStep('review'), 600);
    } catch (err: any) {
      if (stageTimer.current) clearInterval(stageTimer.current);
      setError(err.message || 'Generation failed. Please try again.');
      setStep('upload');
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    const selected = goals.filter(g => g.selected);
    if (selected.length === 0) { setError('Select at least one goal to save.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await goalGeneratorApi.saveGoals(brandId, selected, result?.source_document_id || null);
      setSavedCount(res.created || selected.length);
      setStep('success');
      onGoalsSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = goals.filter(g => g.selected).length;

  // ── TRIGGER BUTTON (renders in-page, not in the overlay) ──────────────────
  const TriggerButton = (
    <button onClick={() => setOpen(true)} style={{ ...S.btnPrim, fontSize: 13 }}>
      <Sparkles size={14} /> Upload goals
    </button>
  );

  // ── OVERLAY + DRAWER ──────────────────────────────────────────────────────
  const Drawer = open ? (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div style={S.drawer} role="dialog" aria-modal="true" aria-label="Upload goals">

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Sparkles size={16} color="#5B21B6" />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #111827)' }}>Upload goals</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>
              {brandName} · Upload a brief, deck, or contact report
            </div>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #9CA3AF)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* Error banner */}
          {error && (
            <div style={{ ...S.card, padding: '11px 14px', marginBottom: 16, background: '#FFF5F5', borderColor: '#FECACA', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: '#DC2626' }}>{error}</span>
            </div>
          )}

          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: dragging ? '1.5px dashed #7C3AED' : '1.5px dashed var(--border-strong, #D1D5DB)',
                  background: dragging ? '#F5F3FF' : 'var(--surface-1, #F9FAFB)',
                  borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
                  onChange={e => { if (e.target.files) addFiles(e.target.files); }} style={{ display: 'none' }} />
                <div style={{ width: 48, height: 48, background: '#EDE9FE', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Upload size={22} color={dragging ? '#5B21B6' : '#7C3AED'} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary, #111827)', marginBottom: 4 }}>
                  {dragging ? 'Drop files here' : 'Drop files here or click to browse'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>
                  PDF · DOCX · XLSX · JPEG · PNG · Up to 5 files, 20 MB each
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div style={{ ...S.card, overflow: 'hidden' }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < files.length - 1 ? '0.5px solid var(--border, #F3F4F6)' : 'none' }}>
                      <FileIcon name={f.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #111827)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #9CA3AF)' }}>{(f.size / 1024).toFixed(0)} KB</div>
                      </div>
                      <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* What to upload hint */}
              <div style={{ ...S.card, padding: '12px 14px', background: '#EDE9FE', borderColor: '#C4B5FD' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>What to upload</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[
                    ['Client brief', 'Scope, objectives, deliverables'],
                    ['Strategy deck', 'Quarterly or annual brand strategy'],
                    ['Contact report', 'Meeting notes and agreed action points'],
                    ['WhatsApp screenshot', 'Client voice note transcript or message'],
                  ].map(([title, sub]) => (
                    <div key={title} style={{ display: 'flex', gap: 8 }}>
                      <Check size={11} color="#5B21B6" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: '#374151' }}><strong>{title}</strong> — {sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={generate} disabled={files.length === 0}
                  style={{ ...S.btnPrim, opacity: files.length === 0 ? 0.38 : 1, cursor: files.length === 0 ? 'not-allowed' : 'pointer' }}>
                  Analyse & generate goals <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: PROCESSING ── */}
          {step === 'processing' && <ProcessingStep stage={processingStage} />}

          {/* ── STEP 3: REVIEW ── */}
          {step === 'review' && result && (
            <div>
              {/* Brief intelligence */}
              {result.brief_intelligence && (
                <div style={{ ...S.card, padding: '14px 16px', marginBottom: 16, background: 'var(--surface-1, #F9FAFB)' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Sparkles size={14} color="#5B21B6" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Brief intelligence</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary, #6B7280)', lineHeight: 1.6 }}>{result.brief_intelligence}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate warning */}
              {goals.some(g => g.is_duplicate_risk) && (
                <div style={{ ...S.card, padding: '11px 14px', marginBottom: 14, background: '#FFFBEB', borderColor: '#FDE68A', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    <strong style={{ color: '#374151' }}>One or more goals may overlap</strong> with existing active goals. Review them before saving or deselect to skip.
                  </div>
                </div>
              )}

              {/* Selection count */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)' }}>
                  {selectedCount} of {goals.length} goal{goals.length !== 1 ? 's' : ''} selected
                </span>
                <button onClick={() => setGoals(g => g.map(x => ({ ...x, selected: selectedCount < g.length })))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#5B21B6', fontFamily: 'inherit' }}>
                  {selectedCount < goals.length ? 'Select all' : 'Deselect all'}
                </button>
              </div>

              {/* Objective cards */}
              {goals.map((goal, i) => (
                <ObjectiveCard key={i} goal={goal} index={i}
                  onChange={updated => setGoals(g => g.map((x, xi) => xi === i ? updated : x))}
                  onToggle={() => setGoals(g => g.map((x, xi) => xi === i ? { ...x, selected: !x.selected } : x))}
                />
              ))}

              {/* Footer note */}
              <div style={{ ...S.card, padding: '12px 14px', background: '#F9FAFB', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Info size={13} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #9CA3AF)', lineHeight: 1.6 }}>
                    Goals are locked on creation. Brand Admins can update key result progress anytime, but editing the objective or key results requires Super Admin approval.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setStep('upload')} style={S.btnSec}>
                  <ArrowLeft size={14} /> Back
                </button>
                <button onClick={save} disabled={saving || selectedCount === 0}
                  style={{ ...S.btnPrim, minWidth: 160, justifyContent: 'center', opacity: (saving || selectedCount === 0) ? 0.38 : 1, cursor: (saving || selectedCount === 0) ? 'not-allowed' : 'pointer' }}>
                  {saving
                    ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
                    : <>Save {selectedCount} goal{selectedCount !== 1 ? 's' : ''}</>}
                </button>
              </div>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ width: 64, height: 64, background: '#ECFDF5', border: '0.5px solid #A7F3D0', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Check size={30} color="#059669" strokeWidth={2.5} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #111827)', marginBottom: 8 }}>
                {savedCount} OKR goal{savedCount !== 1 ? 's' : ''} added
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #6B7280)', marginBottom: 28 }}>
                Goals are now live in the {brandName} goal section. Brand Admins can update key result progress from the goal cards. To edit an objective, submit a change request to the Super Admin.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={close} style={S.btnPrim}>Done</button>
                <button onClick={() => { reset(); }} style={S.btnSec}>Generate more</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ) : null;

  return (
    <>
      {TriggerButton}
      {Drawer}
    </>
  );
}
