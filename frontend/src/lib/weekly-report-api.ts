// ═══════════════════════════════════════════════════════════════════
// weekly-report-api.ts
// Typed API client for the Sabi Weekly Intelligence Report
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export type ReportSection = 'payment' | 'achievements' | 'todos' | 'goals' | 'social' | 'pipeline' | 'general';

export type EntryStatus = 'not_started' | 'draft' | 'submitted';

export interface WeekRange {
  week_start: string;  // YYYY-MM-DD
  week_end: string;
}

export interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  created_at: string;
  updated_at: string;
  total_brands?: number;
  submitted_count?: number;
}

export interface ReportEntry {
  id: string;
  report_id: string;
  brand_id: string;
  brand_name: string;
  brand_admin_id: string;
  brand_admin_name: string;
  brand_admin_email?: string;
  logo_url?: string;
  week_start?: string;
  week_end?: string;

  // ARIA drafts
  aria_draft_payment?: string;
  aria_draft_achievements?: string;
  aria_draft_todos?: string;
  aria_draft_goals?: string;
  aria_draft_social?: string;
  aria_draft_pipeline?: string;

  // Edited versions (what was submitted)
  edited_payment?: string;
  edited_achievements?: string;
  edited_todos?: string;
  edited_goals?: string;
  edited_social?: string;
  edited_pipeline?: string;

  // Metadata
  aria_generated_at?: string;
  is_submitted: boolean;
  submitted_at?: string;
  brand_admin_notes?: string;

  // From consolidated view
  unresolved_comment_count?: number;
  flagged_count?: number;

  // With comments
  comments?: ReportComment[];

  created_at: string;
  updated_at: string;
}

export interface ReportComment {
  id: string;
  entry_id: string;
  section: ReportSection;
  author_id: string;
  author_name: string;
  author_role: string;
  comment: string;
  flagged: boolean;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface BrandStatus {
  id: string;
  name: string;
  logo_url?: string;
  brand_admin_id: string;
  brand_admin_name?: string;
  entry_id?: string;
  is_submitted?: boolean;
  submitted_at?: string;
  aria_generated_at?: string;
  status: EntryStatus;
}

export interface SubmissionSummary {
  total: number;
  submitted: number;
  draft: number;
  not_started: number;
}

export interface ConsolidatedView {
  report: WeeklyReport | null;
  entries: ReportEntry[];
  submission_summary: SubmissionSummary;
}

// ── Fetch helper ──────────────────────────────────────────────────

const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('sabi_token') || sessionStorage.getItem('sabi_token')
    : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'API error');
  return data as T;
}

// ── API Functions ─────────────────────────────────────────────────

export const weeklyReportApi = {

  getCurrentWeek: () =>
    apiFetch<WeekRange>('/api/weekly-report/current-week'),

  getHistory: () =>
    apiFetch<{ reports: WeeklyReport[] }>('/api/weekly-report/history'),

  getStatus: () =>
    apiFetch<{ total: number; submitted: number; week_start: string }>('/api/weekly-report/status'),

  getBrands: (week_start?: string) =>
    apiFetch<{ brands: BrandStatus[]; week_start: string }>(
      `/api/weekly-report/brands${week_start ? `?week_start=${week_start}` : ''}`
    ),

  getEntry: (brand_id: string, week_start?: string, brand_admin_id?: string) => {
    const params = new URLSearchParams({ brand_id });
    if (week_start) params.set('week_start', week_start);
    if (brand_admin_id) params.set('brand_admin_id', brand_admin_id);
    return apiFetch<{ entry: ReportEntry; report: WeeklyReport }>(`/api/weekly-report/entry?${params}`);
  },

  generateDrafts: (entry_id: string) =>
    apiFetch<{ entry: ReportEntry; message: string }>(
      `/api/weekly-report/entry/${entry_id}/generate`,
      { method: 'POST' }
    ),

  updateEntry: (entry_id: string, sections: Partial<Pick<ReportEntry,
    'edited_payment' | 'edited_achievements' | 'edited_todos' |
    'edited_goals' | 'edited_social' | 'edited_pipeline' | 'brand_admin_notes'
  >>) =>
    apiFetch<{ entry: ReportEntry }>(
      `/api/weekly-report/entry/${entry_id}`,
      { method: 'PATCH', body: JSON.stringify(sections) }
    ),

  submitEntry: (entry_id: string) =>
    apiFetch<{ entry: ReportEntry; message: string }>(
      `/api/weekly-report/entry/${entry_id}/submit`,
      { method: 'POST' }
    ),

  getConsolidated: (week_start?: string) =>
    apiFetch<ConsolidatedView>(
      `/api/weekly-report/consolidated${week_start ? `?week_start=${week_start}` : ''}`
    ),

  generateMDSummary: (week_start?: string, pipeline_analytics?: object) =>
    apiFetch<{ summary: string; week_start: string }>(
      `/api/weekly-report/consolidated/aria-summary${week_start ? `?week_start=${week_start}` : ''}`,
      { method: 'POST', body: JSON.stringify({ pipeline_analytics }) }
    ),

  addComment: (entry_id: string, section: ReportSection, comment: string, flagged = false) =>
    apiFetch<{ comment: ReportComment }>(
      `/api/weekly-report/entry/${entry_id}/comment`,
      { method: 'POST', body: JSON.stringify({ section, comment, flagged }) }
    ),

  resolveComment: (comment_id: string) =>
    apiFetch<{ comment: ReportComment }>(
      `/api/weekly-report/comment/${comment_id}/resolve`,
      { method: 'PATCH' }
    ),
};

// ── Display helpers ───────────────────────────────────────────────

export const SECTION_LABELS: Record<ReportSection, string> = {
  payment:      'Payment & Briefs',
  achievements: 'Achievements',
  todos:        'To-dos & Next Steps',
  goals:        'Goal Status',
  social:       'Social & Analytics',
  pipeline:     'New Business Pipeline',
  general:      'General',
};

export const SECTION_ICONS: Record<ReportSection, string> = {
  payment:      '💰',
  achievements: '✅',
  todos:        '📋',
  goals:        '🎯',
  social:       '📊',
  pipeline:     '📡',
  general:      '💬',
};

export const STATUS_COLOURS: Record<EntryStatus, { bg: string; text: string; border: string; label: string }> = {
  not_started: { bg: 'rgba(100,116,139,0.1)', text: '#64748b', border: 'rgba(100,116,139,0.2)', label: 'Not started' },
  draft:       { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)', label: 'Draft' },
  submitted:   { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', border: 'rgba(16,185,129,0.25)', label: 'Submitted ✓' },
};

export const formatWeekLabel = (week_start: string, week_end: string) => {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(week_start)} – ${fmt(week_end)}`;
};
