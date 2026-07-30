'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, ArrowLeft, Download, RefreshCw,
  AlignLeft, Flag, Calendar, Tag, Users, ClipboardList,
  Sparkles, ExternalLink, X,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useParams } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────
interface Brand { id: string; name: string }
interface ParsedRow { [col: string]: string | number | Date | null }
interface SabiField { key: string; label: string; required: boolean; hint: string; icon: React.ReactNode }
interface ColumnMap { [sabiField: string]: string | null }
interface PreviewRow { idx: number; title: string; description: string | null; assignee_name: string | null; due_date: string | null; priority: string; tags: string; status: 'ready' | 'warning' | 'skip'; issues: string[] }
interface ImportResult { created: number; warnings: number; skipped: number; warnings_detail: { row: number; task: string; issue: string }[]; skipped_detail: { row: number; reason: string }[] }

// ── Sabi fields ───────────────────────────────────────────────────
const SABI_FIELDS: SabiField[] = [
  { key: 'title', label: 'Task title', required: true, hint: 'The name of the task', icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: 'description', label: 'Description', required: false, hint: 'Notes or full task details', icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { key: 'assignee_name', label: 'Assignee', required: false, hint: "Person's name or email", icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'due_date', label: 'Due date', required: false, hint: 'DD/MM/YYYY, MM/DD/YYYY, ISO', icon: <Calendar className="w-3.5 h-3.5" /> },
  { key: 'priority', label: 'Priority', required: false, hint: 'High / Medium / Low', icon: <Flag className="w-3.5 h-3.5" /> },
  { key: 'tags', label: 'Tags', required: false, hint: 'Comma-separated labels', icon: <Tag className="w-3.5 h-3.5" /> },
];

const AUTO_DETECT: Record<string, string[]> = {
  title: ['task', 'task name', 'title', 'name', 'subject', 'item', 'deliverable', 'work item', 'activity'],
  description: ['description', 'notes', 'details', 'note', 'desc', 'body', 'content', 'summary', 'scope'],
  assignee_name: ['assignee', 'owner', 'assigned to', 'assigned', 'person', 'responsible', 'who', 'handled by', 'team member'],
  due_date: ['due date', 'deadline', 'due', 'date', 'delivery date', 'finish date', 'end date', 'target date', 'completion date'],
  priority: ['priority', 'urgency', 'level', 'importance', 'rank', 'severity'],
  tags: ['tags', 'labels', 'category', 'type', 'categories', 'label', 'area'],
};

const PRIORITY_ALIAS_MAP: Record<string, string> = {
  high: 'high', urgent: 'high', critical: 'high', asap: 'high', p0: 'high', p1: 'high',
  medium: 'medium', med: 'medium', normal: 'medium', moderate: 'medium', p2: 'medium',
  low: 'low', minor: 'low', p3: 'low', p4: 'low',
};

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const field of SABI_FIELDS) {
    map[field.key] = null;
    const aliases = AUTO_DETECT[field.key] || [];
    for (const header of headers) {
      if (aliases.includes(header.toLowerCase().trim())) { map[field.key] = header; break; }
    }
  }
  return map;
}

function guessPriority(raw: string | null | undefined): string {
  if (!raw) return 'medium';
  return PRIORITY_ALIAS_MAP[String(raw).toLowerCase().trim()] || 'medium';
}

function parsePreviewDate(raw: string | number | Date | null | undefined): string | null {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const serial = Number(raw);
  if (typeof raw === 'number' && Number.isFinite(serial)) {
    try { const d = new Date(Date.UTC(1900, 0, serial - 1)); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); } catch { return null; }
  }
  const s = String(raw).trim();
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    const date = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  return null;
}

const API = process.env.NEXT_PUBLIC_API_URL || '';
async function authFetch(path: string, init?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

// ── Sub-components ────────────────────────────────────────────────
const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';

function PriorityChip({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    high: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    low: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg[level] || cfg.medium}`}>
      {level}
    </span>
  );
}

function StatCard({ label, value, tone = 'neutral', icon, caption }: { label: string; value: number; tone?: 'success' | 'warning' | 'neutral'; icon?: React.ReactNode; caption?: string }) {
  const valueColor = tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : 'text-gray-900 dark:text-white';
  const barColor = tone === 'success' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700';
  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-4 overflow-hidden">
      <div className={`absolute top-0 left-0 h-full w-0.5 ${barColor}`} />
      <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className={LABEL}>{label}</span></div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      {caption && <p className="text-[11px] text-gray-400 mt-0.5">{caption}</p>}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const steps = [{ n: 1, label: 'Upload' }, { n: 2, label: 'Map columns' }, { n: 3, label: 'Review' }];
  return (
    <div className="flex items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
      {steps.map((s, i) => {
        const done = step > s.n; const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${done ? 'bg-violet-600 text-white' : active ? 'bg-violet-600 text-white ring-4 ring-violet-100 dark:ring-violet-950/50' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.n}
              </div>
              <span className={`text-xs font-semibold hidden sm:inline ${active || done ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-3 bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
                <div className={`absolute inset-y-0 left-0 bg-violet-600 transition-all duration-500 ${done ? 'w-full' : 'w-0'}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════════════════════════

interface ImportTasksModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportTasksModal({ open, onClose }: ImportTasksModalProps) {
  const { id: brandId } = useParams<{ id: string }>();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedBrandName = brands.find(b => b.id === selectedBrand)?.name || '';


  const reset = () => {
    setStep(1); setBrands([]); setSelectedBrand(''); setDragging(false);
    setFileName(null); setRawRows([]); setHeaders([]); setColumnMap({});
    setPreview([]); setImporting(false); setResult(null); setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  useEffect(() => {
    if (!open) return;

    setBrandsLoading(true);

    authFetch("/api/task-import/brands")
      .then((d) => {
        const fetchedBrands = d.brands || [];
        setBrands(fetchedBrands);

        // Set the selected brand ID
        const matchedBrand = fetchedBrands.find(
          (b: any) => String(b.id) === String(brandId) // from params
        );

        if (matchedBrand) {
          setSelectedBrand(matchedBrand.id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setBrandsLoading(false));
  }, [open, brandId]);

  useEffect(() => {
    if (!rawRows.length) return;
    const rows: PreviewRow[] = rawRows.slice(0, 200).map((row, i) => {
      const get = (key: string) => { const col = columnMap[key]; if (!col) return null; const v = row[col]; return v !== null && v !== undefined && v !== '' ? String(v) : null; };
      const title = get('title')?.trim() || '';
      const issues: string[] = [];
      if (!title) issues.push('No title — row will be skipped');
      const dueRaw = get('due_date');
      const due = dueRaw ? parsePreviewDate(dueRaw) : null;
      if (dueRaw && !due) issues.push(`Date "${dueRaw}" not recognised`);
      let status: PreviewRow['status'] = 'ready';
      if (!title) status = 'skip'; else if (issues.length) status = 'warning';
      return { idx: i + 1, title, description: get('description'), assignee_name: get('assignee_name'), due_date: due, priority: guessPriority(get('priority')), tags: get('tags') || '', status, issues };
    });
    setPreview(rows);
  }, [rawRows, columnMap]);

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    try {
      let rows: ParsedRow[] = []; let cols: string[] = [];
      if (ext === 'csv') {
        await new Promise<void>((resolve, reject) => {
          Papa.parse(file, {
            header: true, skipEmptyLines: true, dynamicTyping: false, transformHeader: h => h.trim(),
            complete: (results) => { rows = results.data as ParsedRow[]; cols = results.meta.fields || []; resolve(); },
            error: (err: any) => reject(new Error(err.message))
          });
        });
      } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null, raw: false });
        rows = data; cols = data.length > 0 ? Object.keys(data[0]) : [];
      } else { throw new Error('Unsupported file type. Please upload a CSV, XLSX, or XLS file.'); }
      if (!cols.length || !rows.length) throw new Error('File appears to be empty or has no headers.');
      if (rows.length > 500) throw new Error(`Your file has ${rows.length} rows. Max per import is 500.`);
      setFileName(file.name); setHeaders(cols); setRawRows(rows); setColumnMap(detectColumns(cols));
    } catch (e: any) { setError(e.message || 'Failed to read the file.'); }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0]; if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file);
  };

  const handleImport = async () => {
    if (!selectedBrand) { setError('Please select a brand first.'); return; }
    const readyRows = preview.filter(r => r.status !== 'skip');
    if (!readyRows.length) { setError('No valid tasks to import.'); return; }
    setImporting(true); setError(null);
    const tasks = rawRows.slice(0, 200).map(row => {
      const get = (key: string) => { const col = columnMap[key]; if (!col) return null; const v = row[col]; return v !== null && v !== undefined && v !== '' ? String(v) : null; };
      return { title: get('title'), description: get('description'), assignee_name: get('assignee_name'), due_date: get('due_date'), priority: get('priority'), tags: get('tags') };
    }).filter(t => t.title?.trim());
    try {
      const res = await authFetch('/api/task-import', { method: 'POST', body: JSON.stringify({ brand_id: selectedBrand, tasks }) });
      setResult(res); setStep(3);
    } catch (e: any) { setError(e.message || 'Import failed. Please try again.'); }
    finally { setImporting(false); }
  };



  const readyCount = preview.filter(r => r.status === 'ready').length;
  const warningCount = preview.filter(r => r.status === 'warning').length;
  const skipCount = preview.filter(r => r.status === 'skip').length;
  const totalImportable = readyCount + warningCount;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                Import tasks from spreadsheet
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                CSV, XLSX or XLS · up to 500 rows
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step indicator ──────────────────────────────── */}
        {!result && <StepIndicator step={step} />}

        {/* ── Error banner ────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60 rounded-xl p-3.5 shrink-0">
            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Scrollable body ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── RESULT ──────────────────────────────────── */}
          {result && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mt-4">Import complete</h3>
              <p className="text-sm text-gray-500 mt-1">
                Tasks are live on <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedBrandName}</span>'s board.
              </p>
              <div className="grid grid-cols-3 gap-3 mt-6 text-left">
                <StatCard label="Created" value={result.created} tone="success" />
                <StatCard label="Warnings" value={result.warnings} tone={result.warnings > 0 ? 'warning' : 'neutral'} />
                <StatCard label="Skipped" value={result.skipped} tone="neutral" />
              </div>
              {result.warnings > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-left">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Created without an assignee
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {result.warnings_detail.slice(0, 5).map((w, i) => (
                      <p key={i} className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium text-gray-800 dark:text-gray-200">{w.task}</span> — {w.issue}
                      </p>
                    ))}
                  </div>
                  {result.warnings_detail.length > 5 && (
                    <p className="text-[11px] text-gray-400 mt-2">…and {result.warnings_detail.length - 5} more</p>
                  )}
                </div>
              )}
              <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-left">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span className={LABEL}>Next step</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  All imported tasks start as <span className="font-semibold text-gray-800 dark:text-gray-200">To Do</span>. They only score once a Brand Admin verifies them.
                </p>
              </div>
              <div className="flex gap-2.5 justify-center mt-6">
                <a href={`/brands/${brandId}/tasks`} className="btn-primary flex items-center gap-2">
                  Go to task board <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={reset} className="btn-secondary">Import another file</button>
              </div>
            </div>
          )}

          {/* ── STEP 1: UPLOAD ──────────────────────────── */}
          {!result && step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`rounded-xl p-10 text-center cursor-pointer transition-all select-none border-2 ${dragging ? 'border-violet-400 bg-violet-50/60 dark:bg-violet-950/20'
                  : fileName ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/10'
                    : 'border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 hover:bg-gray-50/60 dark:hover:bg-gray-900/30'
                  }`}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ods" onChange={handleFileInput} className="hidden" />
                {fileName ? (
                  <div className="space-y-2.5">
                    <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto shadow-sm">
                      <FileSpreadsheet className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{fileName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{rawRows.length} rows · {headers.length} columns</p>
                    </div>
                    <p className="text-xs text-violet-600 font-semibold">Click to swap the file</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto border-2 transition-colors ${dragging ? 'border-violet-300 bg-violet-100 dark:bg-violet-900/40' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                      }`}>
                      <Upload className={`w-5 h-5 ${dragging ? 'text-violet-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">
                        {dragging ? 'Drop it here' : 'Drop your file here or click to browse'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">CSV, XLSX, XLS · Max 500 rows</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Need a template?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Download the Sabi import template with column names pre-set.</p>
                </div>
                <button
                  className="btn-secondary flex items-center gap-2 text-xs shrink-0"
                  onClick={() => {
                    const csv = `Task Name,Description,Assignee,Due Date,Priority,Tags\nDesign homepage banner,Create a 1200×628 banner for the product launch,Chioma,15/08/2026,High,design\nWrite Q3 blog post,500-word post summarising quarterly results,Ada,20/08/2026,Medium,content\nSchedule IG posts,Create and schedule 3 promotional posts,,10/08/2026,Low,social\n`;
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                    a.download = 'sabi-task-import-template.csv';
                    a.click();
                  }}
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: MAP COLUMNS ─────────────────────── */}
          {!result && step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <label className={`${LABEL} block mb-2`}>
                  Import into brand <span className="text-red-500">*</span>
                </label>
                {brandsLoading ? (
                  <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ) : brands.length === 0 ? (
                  <p className="text-sm text-red-600">You don't have Brand Admin access to any active brand.</p>
                ) : (
                  <input
                    type="text"
                    value={selectedBrandName}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3.5 py-2.5 text-sm font-medium text-gray-900 dark:text-white"
                  />
                )}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Match columns to Sabi fields</h3>
                  <p className="text-xs text-gray-400 mt-0.5">We've auto-detected what we could — adjust anything that's wrong.</p>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {SABI_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-32 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {field.icon}{field.label}{field.required && <span className="text-red-500">*</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{field.hint}</p>
                      </div>
                      <div className="flex-1">
                        <select
                          value={columnMap[field.key] || ''}
                          onChange={e => setColumnMap(prev => ({ ...prev, [field.key]: e.target.value || null }))}
                          className={`w-full rounded-lg border text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors ${columnMap[field.key]
                            ? 'border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/10 text-gray-900 dark:text-white font-medium'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-400'
                            }`}
                        >
                          <option value="">{field.required ? 'Select column…' : '(skip)'}</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      {columnMap[field.key] && rawRows[0] && (
                        <div className="w-24 shrink-0">
                          <p className="text-[10px] text-gray-400 font-mono truncate bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md" title={String(rawRows[0][columnMap[field.key]!] ?? '—')}>
                            {String(rawRows[0][columnMap[field.key]!] ?? '—').slice(0, 16)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {preview.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Ready" value={readyCount} tone="success" />
                  <StatCard label="Warnings" value={warningCount} tone="warning" />
                  <StatCard label="Will skip" value={skipCount} tone="neutral" />
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: REVIEW ──────────────────────────── */}
          {!result && step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Ready" value={readyCount} tone="success" icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />} />
                <StatCard label="Warnings" value={warningCount} tone="warning" icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />} caption="Created, unassigned" />
                <StatCard label="Skip" value={skipCount} tone="neutral" icon={<XCircle className="w-3.5 h-3.5 text-gray-400" />} caption="No title" />
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Preview</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Importing into <span className="font-semibold text-gray-600 dark:text-gray-300">{selectedBrandName}</span> · first {Math.min(preview.length, 15)} of {rawRows.length} rows
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50/60 dark:bg-gray-900/40">
                        <th className={`text-left px-4 py-2.5 ${LABEL} w-8`}>#</th>
                        <th className={`text-left px-4 py-2.5 ${LABEL}`}>Title</th>
                        <th className={`text-left px-4 py-2.5 ${LABEL}`}>Assignee</th>
                        <th className={`text-left px-4 py-2.5 ${LABEL}`}>Due</th>
                        <th className={`text-left px-4 py-2.5 ${LABEL}`}>Priority</th>
                        <th className={`text-left px-4 py-2.5 ${LABEL} w-8`} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {preview.slice(0, 15).map(row => (
                        <tr key={row.idx} className={`transition-colors ${row.status === 'skip' ? 'opacity-40'
                          : row.status === 'warning' ? 'bg-amber-50/40 dark:bg-amber-950/10'
                            : ''
                          }`}>
                          <td className="px-4 py-2.5 text-gray-400 font-mono">{row.idx}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white max-w-[180px] truncate" title={row.title}>
                            {row.title || <span className="text-red-400 italic font-normal">empty</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">{row.assignee_name || '—'}</td>
                          <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">{row.due_date || '—'}</td>
                          <td className="px-4 py-2.5"><PriorityChip level={row.priority} /></td>
                          <td className="px-4 py-2.5">
                            {row.status === 'ready' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                            {row.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            {row.status === 'skip' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 15 && (
                    <p className="px-4 py-3 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800">
                      …and {rawRows.length - 15} more rows will be imported
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/10 p-4">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                    <p><span className="font-semibold">All imported tasks start as "To Do."</span> They won't score until a Brand Admin verifies them — that's by design.</p>
                    {warningCount > 0 && <p><span className="font-semibold">{warningCount} task{warningCount !== 1 ? 's' : ''} with unresolved assignees</span> will be created unassigned. Assign them manually after import.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        {!result && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50/40 dark:bg-gray-900/20">
            {/* Back */}
            <button
              onClick={() => { if (step === 1) handleClose(); else setStep((step - 1) as 1 | 2 | 3); }}
              disabled={importing}
              className="btn-secondary text-black flex items-center gap-2 disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {/* Next / Import */}
            {step === 1 && (
              <button
                disabled={!fileName}
                onClick={() => setStep(2)}
                className="btn-primary text-black flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button
                disabled={!selectedBrand || !columnMap.title || totalImportable === 0}
                onClick={() => setStep(3)}
                className="btn-primary flex text-black items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Review {totalImportable} task{totalImportable !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button
                disabled={importing || totalImportable === 0}
                onClick={handleImport}
                className="btn-primary text-black flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px] justify-center"
              >
                {importing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</>
                ) : (
                  <>Import {totalImportable} task{totalImportable !== 1 ? 's' : ''}</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}