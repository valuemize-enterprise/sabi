'use client';

/**
 * /tasks/import — Task Import Wizard
 * Sabi Intelligence Suite · Brand Admin feature
 *
 * Step 1 · Upload   — drop or browse for CSV / Excel
 * Step 2 · Map      — pair your columns to Sabi fields; pick brand
 * Step 3 · Review   — preview rows, see warnings, click Import
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, ArrowLeft, Download, RefreshCw,
  Rows3, Users, Calendar, Tag, AlignLeft, Flag,
  ClipboardList, Sparkles, ExternalLink,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────

interface Brand { id: string; name: string }

interface ParsedRow  { [col: string]: string | number | Date | null }

interface SabiField {
  key:      string;
  label:    string;
  required: boolean;
  hint:     string;
  icon:     React.ReactNode;
}

interface ColumnMap  { [sabiField: string]: string | null }

interface PreviewRow {
  idx:           number;
  title:         string;
  description:   string | null;
  assignee_name: string | null;
  due_date:      string | null;
  priority:      string;
  tags:          string;
  status:        'ready' | 'warning' | 'skip';
  issues:        string[];
}

interface ImportResult {
  created:         number;
  warnings:        number;
  skipped:         number;
  warnings_detail: { row: number; task: string; issue: string }[];
  skipped_detail:  { row: number; reason: string }[];
}

// ── Sabi field definitions ────────────────────────────────────────

const SABI_FIELDS: SabiField[] = [
  { key: 'title',         label: 'Task title',  required: true,  hint: 'The name of the task',          icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: 'description',   label: 'Description', required: false, hint: 'Notes or full task details',    icon: <AlignLeft     className="w-3.5 h-3.5" /> },
  { key: 'assignee_name', label: 'Assignee',    required: false, hint: 'Person\'s name or email',       icon: <Users         className="w-3.5 h-3.5" /> },
  { key: 'due_date',      label: 'Due date',    required: false, hint: 'DD/MM/YYYY, MM/DD/YYYY, ISO',   icon: <Calendar      className="w-3.5 h-3.5" /> },
  { key: 'priority',      label: 'Priority',    required: false, hint: 'High / Medium / Low',           icon: <Flag          className="w-3.5 h-3.5" /> },
  { key: 'tags',          label: 'Tags',        required: false, hint: 'Comma-separated labels',        icon: <Tag           className="w-3.5 h-3.5" /> },
];

// ── Auto-detect column names ──────────────────────────────────────
// Maps common spreadsheet headers to Sabi field keys.

const AUTO_DETECT: Record<string, string[]> = {
  title:         ['task', 'task name', 'title', 'name', 'subject', 'item', 'deliverable', 'work item', 'activity'],
  description:   ['description', 'notes', 'details', 'note', 'desc', 'body', 'content', 'summary', 'scope'],
  assignee_name: ['assignee', 'owner', 'assigned to', 'assigned', 'person', 'responsible', 'who', 'handled by', 'team member'],
  due_date:      ['due date', 'deadline', 'due', 'date', 'delivery date', 'finish date', 'end date', 'target date', 'completion date'],
  priority:      ['priority', 'urgency', 'level', 'importance', 'rank', 'severity'],
  tags:          ['tags', 'labels', 'category', 'type', 'categories', 'label', 'area'],
};

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const field of SABI_FIELDS) {
    map[field.key] = null;
    const aliases = AUTO_DETECT[field.key] || [];
    for (const header of headers) {
      if (aliases.includes(header.toLowerCase().trim())) {
        map[field.key] = header;
        break;
      }
    }
  }
  return map;
}

// ── Priority display ──────────────────────────────────────────────

const PRIORITY_ALIAS_MAP: Record<string, string> = {
  high: 'high', urgent: 'high', critical: 'high', asap: 'high', p0: 'high', p1: 'high',
  medium: 'medium', med: 'medium', normal: 'medium', moderate: 'medium', p2: 'medium',
  low: 'low', minor: 'low', p3: 'low', p4: 'low',
};

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

// ── API ───────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || '';

async function authFetch(path: string, init?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

// ── Priority chip ─────────────────────────────────────────────────

function PriorityChip({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    high:   'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    low:    'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cfg[level] || cfg.medium}`}>
      {level}
    </span>
  );
}

// ── Step indicator ────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { n: 1, label: 'Upload file'   },
    { n: 2, label: 'Map columns'   },
    { n: 3, label: 'Review & import' },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
              s.n < step  ? 'bg-violet-600 border-violet-600 text-white'
              : s.n === step ? 'bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/40'
              : 'border-gray-200 dark:border-gray-700 text-gray-400 bg-white dark:bg-gray-900'
            }`}>
              {s.n < step ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-[11px] font-semibold mt-1.5 whitespace-nowrap ${
              s.n <= step ? 'text-violet-600' : 'text-gray-400'
            }`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-16 sm:w-28 mx-1 mb-5 transition-all ${
              s.n < step ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function ImportTasksPage() {
  const [step,          setStep]          = useState<1 | 2 | 3>(1);
  const [brands,        setBrands]        = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [dragging,      setDragging]      = useState(false);
  const [fileName,      setFileName]      = useState<string | null>(null);
  const [rawRows,       setRawRows]       = useState<ParsedRow[]>([]);
  const [headers,       setHeaders]       = useState<string[]>([]);
  const [columnMap,     setColumnMap]     = useState<ColumnMap>({});
  const [preview,       setPreview]       = useState<PreviewRow[]>([]);
  const [importing,     setImporting]     = useState(false);
  const [result,        setResult]        = useState<ImportResult | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch brands on mount
  useEffect(() => {
    authFetch('/api/task-import/brands')
      .then(d => {
        setBrands(d.brands || []);
        if ((d.brands || []).length === 1) setSelectedBrand(d.brands[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setBrandsLoading(false));
  }, []);

  // Rebuild preview whenever mapping changes
  useEffect(() => {
    if (!rawRows.length) return;
    const rows: PreviewRow[] = rawRows.slice(0, 200).map((row, i) => {
      const get = (key: string) => {
        const col = columnMap[key];
        if (!col) return null;
        const v = row[col];
        return v !== null && v !== undefined && v !== '' ? String(v) : null;
      };

      const title    = get('title')?.trim() || '';
      const issues: string[] = [];

      if (!title) issues.push('No title — row will be skipped');

      const assignee = get('assignee_name');
      const dueRaw   = get('due_date');
      const due      = dueRaw ? parsePreviewDate(dueRaw) : null;
      if (dueRaw && !due) issues.push(`Date "${dueRaw}" not recognised`);

      let status: PreviewRow['status'] = 'ready';
      if (!title)    status = 'skip';
      else if (issues.length) status = 'warning';

      return {
        idx:           i + 1,
        title,
        description:   get('description'),
        assignee_name: get('assignee_name'),
        due_date:      due,
        priority:      guessPriority(get('priority')),
        tags:          get('tags') || '',
        status,
        issues,
      };
    });
    setPreview(rows);
  }, [rawRows, columnMap]);

  // ── File parsing ─────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      let rows: ParsedRow[] = [];
      let cols: string[]    = [];

      if (ext === 'csv') {
        await new Promise<void>((resolve, reject) => {
          Papa.parse(file, {
            header:          true,
            skipEmptyLines:  true,
            dynamicTyping:   false,
            transformHeader: h => h.trim(),
            complete: (results) => {
              rows = results.data as ParsedRow[];
              cols = results.meta.fields || [];
              resolve();
            },
            error: (err: any) => reject(new Error(err.message)),
          });
        });
      } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
        const buf   = await file.arrayBuffer();
        const wb    = XLSX.read(buf, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data  = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null, raw: false });
        rows = data;
        cols = data.length > 0 ? Object.keys(data[0]) : [];
      } else {
        throw new Error('Unsupported file type. Please upload a CSV, XLSX, or XLS file.');
      }

      if (!cols.length || !rows.length) throw new Error('File appears to be empty or has no headers.');
      if (rows.length > 500) throw new Error(`Your file has ${rows.length} rows. The maximum per import is 500. Please split it into batches.`);

      setFileName(file.name);
      setHeaders(cols);
      setRawRows(rows);
      setColumnMap(detectColumns(cols));
    } catch (e: any) {
      setError(e.message || 'Failed to read the file.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // ── Import ────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!selectedBrand) { setError('Please select a brand first.'); return; }

    const readyRows = preview.filter(r => r.status !== 'skip');
    if (!readyRows.length) { setError('No valid tasks to import.'); return; }

    setImporting(true);
    setError(null);

    const tasks = rawRows.slice(0, 200)
      .map((row) => {
        const get = (key: string) => {
          const col = columnMap[key];
          if (!col) return null;
          const v = row[col];
          return v !== null && v !== undefined && v !== '' ? String(v) : null;
        };
        return {
          title:         get('title'),
          description:   get('description'),
          assignee_name: get('assignee_name'),
          due_date:      get('due_date'),
          priority:      get('priority'),
          tags:          get('tags'),
        };
      })
      .filter(t => t.title && t.title.trim());

    try {
      const res = await authFetch('/api/task-import', {
        method: 'POST',
        body:   JSON.stringify({ brand_id: selectedBrand, tasks }),
      });
      setResult(res);
      setStep(3);
    } catch (e: any) {
      setError(e.message || 'Import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // ── Derived stats ─────────────────────────────────────────────

  const readyCount   = preview.filter(r => r.status === 'ready').length;
  const warningCount = preview.filter(r => r.status === 'warning').length;
  const skipCount    = preview.filter(r => r.status === 'skip').length;
  const totalImportable = readyCount + warningCount;

  const selectedBrandName = brands.find(b => b.id === selectedBrand)?.name || '';

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  // ── Success screen ────────────────────────────────────────────
  if (result) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Import complete
            </h1>
            <p className="text-sm text-gray-500">
              Tasks are live on <strong>{selectedBrandName}</strong>'s board and ready for the pipeline.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left">
            <div className="card p-4 border-emerald-200 dark:border-emerald-900">
              <div className="text-2xl font-bold text-emerald-600">{result.created}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">Created</div>
            </div>
            <div className={`card p-4 ${result.warnings > 0 ? 'border-amber-200 dark:border-amber-900' : ''}`}>
              <div className={`text-2xl font-bold ${result.warnings > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{result.warnings}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">Warnings</div>
            </div>
            <div className="card p-4">
              <div className="text-2xl font-bold text-gray-400">{result.skipped}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">Skipped</div>
            </div>
          </div>

          {result.warnings > 0 && (
            <div className="card p-4 text-left border-amber-200 dark:border-amber-900 space-y-2">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                ⚠ Tasks created without an assignee
              </p>
              {result.warnings_detail.slice(0, 5).map((w, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">"{w.task}"</span> — {w.issue}
                </p>
              ))}
              {result.warnings_detail.length > 5 && (
                <p className="text-xs text-gray-400">…and {result.warnings_detail.length - 5} more</p>
              )}
            </div>
          )}

          <div className="card p-4 text-left bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Next step</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              All imported tasks start as <strong>To Do</strong>. Move them through the board as work progresses — tasks only score once a Brand Admin verifies them.
            </p>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <a href={`/brands/${selectedBrand}/tasks`} className="btn-primary">
              Go to task board <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => { setResult(null); setStep(1); setFileName(null); setRawRows([]); setHeaders([]); setColumnMap({}); setPreview([]); }}
              className="btn-secondary"
            >
              Import another file
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard wrapper ─────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <a href="/tasks" className="btn-secondary p-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Rows3 className="w-5 h-5 text-violet-600" />
            Import tasks from spreadsheet
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Bring your existing task sheet into Sabi in three steps. Supports CSV, XLSX, and XLS.
          </p>
        </div>
      </div>

      <StepIndicator step={result ? 3 : (step === 3 && !result ? 2 : step)} />

      {error && (
        <div className="card p-4 mb-5 border-red-200 dark:border-red-900 flex items-start gap-3">
          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── STEP 1: UPLOAD ── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`card p-10 text-center cursor-pointer transition-all select-none ${
              dragging
                ? 'border-2 border-violet-400 bg-violet-50 dark:bg-violet-950/30 shadow-lg shadow-violet-100 dark:shadow-none'
                : 'border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 hover:bg-gray-50 dark:hover:bg-gray-900/50'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.ods"
              onChange={handleFileInput}
              className="hidden"
            />
            {fileName ? (
              <div className="space-y-3">
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{fileName}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {rawRows.length} rows detected · {headers.length} columns
                  </p>
                </div>
                <p className="text-xs text-violet-600 font-semibold">Click to swap the file</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto transition-colors ${
                  dragging ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Upload className={`w-7 h-7 transition-colors ${dragging ? 'text-violet-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {dragging ? 'Drop it here' : 'Drop your file here or click to browse'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">CSV, XLSX, XLS · Max 500 rows</p>
                </div>
              </div>
            )}
          </div>

          {/* Download template */}
          <div className="card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Need a template?</p>
              <p className="text-xs text-gray-400 mt-0.5">Download the Sabi import template with the right column names pre-set.</p>
            </div>
            <a
              href="/sample-import-template.csv"
              download="sabi-task-import-template.csv"
              className="btn-secondary text-xs shrink-0"
              onClick={e => {
                e.preventDefault();
                const csv = `Task Name,Description,Assignee,Due Date,Priority,Tags\nDesign homepage banner,Create a 1200×628 banner for the product launch,Chioma,15/08/2026,High,design\nWrite Q3 blog post,500-word post summarising quarterly results,Ada,20/08/2026,Medium,content\nSchedule IG posts,Create and schedule 3 promotional posts,,10/08/2026,Low,social\n`;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                a.download = 'sabi-task-import-template.csv';
                a.click();
              }}
            >
              <Download className="w-3.5 h-3.5" /> Template
            </a>
          </div>

          <div className="flex justify-end">
            <button
              disabled={!fileName}
              onClick={() => setStep(2)}
              className="btn-primary disabled:opacity-40 text-white disabled:cursor-not-allowed"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: MAP COLUMNS ── */}
      {step === 2 && (
        <div className="space-y-5">

          {/* Brand selector */}
          <div className="card p-5">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Import into brand <span className="text-red-500">*</span>
            </label>
            {brandsLoading ? (
              <div className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ) : brands.length === 0 ? (
              <p className="text-sm text-red-600">You don't have Brand Admin access to any active brand.</p>
            ) : (
              <select
                value={selectedBrand}
                onChange={e => setSelectedBrand(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-900 dark:text-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select a brand…</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Column mapper */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Match your columns to Sabi fields</h2>
              <p className="text-xs text-gray-400 mt-0.5">We've auto-detected what we could. Adjust anything that's wrong.</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {SABI_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-4 px-5 py-3.5">
                  {/* Sabi field */}
                  <div className="w-36 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {field.icon}
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{field.hint}</p>
                  </div>

                  {/* Dropdown */}
                  <div className="flex-1">
                    <select
                      value={columnMap[field.key] || ''}
                      onChange={e => setColumnMap(prev => ({ ...prev, [field.key]: e.target.value || null }))}
                      className={`w-full rounded-xl border text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                        columnMap[field.key]
                          ? field.required
                            ? 'border-violet-300 bg-violet-50 dark:bg-violet-950/20 dark:border-violet-700 text-gray-900 dark:text-white font-semibold'
                            : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 text-gray-900 dark:text-white'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-400'
                      }`}
                    >
                      <option value="">{field.required ? 'Select column…' : '(skip)'}</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sample value */}
                  {columnMap[field.key] && rawRows[0] && (
                    <div className="w-32 shrink-0">
                      <p className="text-[10px] text-gray-400 font-mono truncate" title={String(rawRows[0][columnMap[field.key]!] ?? '—')}>
                        e.g. "{String(rawRows[0][columnMap[field.key]!] ?? '—').slice(0, 20)}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Live stats */}
          {preview.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center border-emerald-200 dark:border-emerald-900">
                <div className="text-xl font-bold text-emerald-600">{readyCount}</div>
                <div className="text-[10px] font-semibold uppercase text-gray-400">Ready</div>
              </div>
              <div className="card p-3 text-center border-amber-200 dark:border-amber-900">
                <div className="text-xl font-bold text-amber-600">{warningCount}</div>
                <div className="text-[10px] font-semibold uppercase text-gray-400">Warnings</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-xl font-bold text-gray-400">{skipCount}</div>
                <div className="text-[10px] font-semibold uppercase text-gray-400">Will skip</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="btn-secondary text-white">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              disabled={!selectedBrand || !columnMap.title || totalImportable === 0}
              onClick={() => setStep(3)}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              Review {totalImportable} task{totalImportable !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW & IMPORT ── */}
      {step === 3 && !result && (
        <div className="space-y-5">

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4 border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ready</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">{readyCount}</div>
            </div>
            <div className="card p-4 border-amber-200 dark:border-amber-900">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Warnings</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
              <p className="text-[10px] text-gray-400 mt-0.5">Created, unassigned</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Skip</span>
              </div>
              <div className="text-2xl font-bold text-gray-400">{skipCount}</div>
              <p className="text-[10px] text-gray-400 mt-0.5">No title</p>
            </div>
          </div>

          {/* Preview table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Preview</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Importing into <strong>{selectedBrandName}</strong> · showing first {Math.min(preview.length, 15)} of {rawRows.length} rows
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50">
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Title</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Assignee</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Due</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Priority</th>
                    <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {preview.slice(0, 15).map(row => (
                    <tr key={row.idx} className={`transition-colors ${
                      row.status === 'skip'    ? 'bg-red-50/40 dark:bg-red-950/10 opacity-50'
                      : row.status === 'warning' ? 'bg-amber-50/40 dark:bg-amber-950/10'
                      : ''
                    }`}>
                      <td className="px-4 py-2.5 text-gray-400 font-mono">{row.idx}</td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white max-w-[180px] truncate" title={row.title}>
                        {row.title || <span className="text-red-400 italic">empty</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 max-w-[120px] truncate">{row.assignee_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono whitespace-nowrap">{row.due_date || '—'}</td>
                      <td className="px-4 py-2.5"><PriorityChip level={row.priority} /></td>
                      <td className="px-4 py-2.5">
                        {row.status === 'ready'   && <CheckCircle2  className="w-3.5 h-3.5 text-emerald-500" />}
                        {row.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500"   />}
                        {row.status === 'skip'    && <XCircle       className="w-3.5 h-3.5 text-red-400"     />}
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

          {/* Info note */}
          <div className="card p-4 bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900">
            <div className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
                <p><strong>All imported tasks start as "To Do."</strong> They won't score until a Brand Admin verifies them through the normal flow — that's by design, not a limitation.</p>
                {warningCount > 0 && <p><strong>{warningCount} task{warningCount !== 1 ? 's' : ''} with unresolved assignees</strong> will be created unassigned. You can assign them manually after import.</p>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between ">
            <button onClick={() => setStep(2)} disabled={importing} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              disabled={importing || totalImportable === 0}
              onClick={handleImport}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px]"
            >
              {importing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</>
              ) : (
                <>Import {totalImportable} task{totalImportable !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
