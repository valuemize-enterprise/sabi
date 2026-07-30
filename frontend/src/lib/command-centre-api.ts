// ═══════════════════════════════════════════════════════════════════
// command-centre-api.ts
// Typed API client for the Sabi Command Centre Phase 2
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export type DialHealth = 'green' | 'amber' | 'red';

export type DialId =
  | 'task_velocity'
  | 'revenue_health'
  | 'client_satisfaction'
  | 'creative_review'
  | 'staff_performance'
  | 'goal_progress'
  | 'clarity_score'
  | 'pipeline';

export interface DialExpandedRow {
  label: string;
  value: number;
  unit: string;
  sub?: string;
}

export interface Dial {
  id: DialId;
  label: string;
  value: number;
  unit: string;
  display: string;           // formatted display string (e.g. "₦2.4M", "87%", "4.2/5")
  sub: string;               // sub-label (second line)
  sub2?: string;             // optional third line
  delta: number | null;      // % change vs last period (null if not meaningful)
  delta_type?: 'percent' | 'absolute';
  delta_label?: string;      // e.g. "vs 6 weeks ago"
  health: DialHealth;
  sparkline?: number[];      // ordered oldest→newest, up to 6 values
  expanded_data: DialExpandedRow[];
  link_to?: string;          // optional navigation target for "View full →"
  error?: string;  
  raw: {staleCount: number, overdue: number}          // if this dial failed to load
}

export interface WeeklyIntelligenceHeader {
  week_start: string;
  week_end: string;
  collected_this_week: number;
  collected_display: string;
  submission_count: number;
  total_brands: number;
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

// ── API ───────────────────────────────────────────────────────────

export const commandCentreApi = {

  getAllDials: () =>
    apiFetch<{ dials: Dial[]; fetched_at: string }>('/command-centre/dials'),

  getDial: (id: DialId) =>
    apiFetch<{ dial: Dial; fetched_at: string }>(`/command-centre/dials/${id}`),

  getPipelineDial: () =>
    apiFetch<Dial>('/command-centre/pipeline'),

  getWeeklyIntelligenceHeader: () =>
    apiFetch<WeeklyIntelligenceHeader>('/command-centre/weekly-intelligence-header'),
};

// ── Display helpers ───────────────────────────────────────────────

export const HEALTH_COLOURS: Record<DialHealth, { bg: string; border: string; text: string; glow: string; strip: string }> = {
  green: {
    bg:     'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.2)',
    text:   '#10b981',
    glow:   'rgba(16,185,129,0.12)',
    strip:  '#10b981',
  },
  amber: {
    bg:     'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.2)',
    text:   '#f59e0b',
    glow:   'rgba(245,158,11,0.1)',
    strip:  '#f59e0b',
  },
  red: {
    bg:     'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.2)',
    text:   '#ef4444',
    glow:   'rgba(239,68,68,0.1)',
    strip:  '#ef4444',
  },
};

export const DIAL_ICONS: Record<DialId, string> = {
  task_velocity:       '⚡',
  revenue_health:      '💰',
  client_satisfaction: '⭐',
  creative_review:     '🎨',
  staff_performance:   '👥',
  goal_progress:       '🎯',
  clarity_score:       '✦',
  pipeline:            '📡',
};
