// ═══════════════════════════════════════════════════════════════════
// agency-goals-api.ts
// Typed API client for the Sabi Agency Goals Framework
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export type GoalHealth = 'green' | 'amber' | 'red';

export type GoalCategoryId =
  | 'new_business'
  | 'revenue'
  | 'client_health'
  | 'delivery'
  | 'people_perf'
  | 'hr_workforce';

export interface GoalMetric {
  label:   string;
  current: number;
  target:  number | null;
  unit:    string;
  pct:     number | null;
  display: string;         // pre-formatted display string
  sub?:    string;         // secondary label
  alert?:  boolean;        // true = show warning styling
}

export interface GoalCategory {
  id:          GoalCategoryId;
  label:       string;
  icon:        string;
  health:      GoalHealth;
  primary:     GoalMetric;
  secondaries: GoalMetric[];
  error?:      string;
  raw?:        Record<string, number>;
}

export interface GoalPulseItem {
  id:      GoalCategoryId;
  label:   string;
  icon:    string;
  health:  GoalHealth;
  display: string;
  sub:     string;
  pct:     number | null;
  error:   string | null;
}

export interface WeekVsGoalItem {
  id:      GoalCategoryId;
  label:   string;
  icon:    string;
  health:  GoalHealth;
  current: string;
  target:  string | null;
  pct:     number | null;
  note:    string | null;
}

export interface GoalTarget {
  id?:          string;
  category:     GoalCategoryId;
  title:        string;
  target_value: number;
  unit:         string;
  period_label: string;
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

export const agencyGoalsApi = {

  getAll: () =>
    apiFetch<{ categories: GoalCategory[]; year: number; fetched_at: string }>(
      '/agency-goals'
    ),

  getPulse: () =>
    apiFetch<{ pulse: GoalPulseItem[]; fetched_at: string }>(
      '/agency-goals/pulse'
    ),

  getWeekVsGoal: () =>
    apiFetch<{ deltas: WeekVsGoalItem[]; fetched_at: string }>(
      '/agency-goals/week-vs-goal'
    ),

  getTargets: () =>
    apiFetch<{ targets: Record<string, GoalTarget[]> }>(
      '/agency-goals/targets'
    ),

  getCategory: (id: GoalCategoryId) =>
    apiFetch<{ category: GoalCategory; fetched_at: string }>(
      `/agency-goals/${id}`
    ),

  upsertTarget: (target: GoalTarget) =>
    apiFetch<{ target: GoalTarget }>('/agency-goals/targets', {
      method: 'POST',
      body:   JSON.stringify(target),
    }),
};

// ── Display helpers ───────────────────────────────────────────────

export const HEALTH_CONFIG: Record<GoalHealth, {
  bg: string; border: string; text: string; strip: string; label: string;
}> = {
  green: {
    bg:     'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.2)',
    text:   '#10b981',
    strip:  '#10b981',
    label:  'On Track',
  },
  amber: {
    bg:     'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.2)',
    text:   '#f59e0b',
    strip:  '#f59e0b',
    label:  'Needs Attention',
  },
  red: {
    bg:     'rgba(239,68,68,0.07)',
    border: 'rgba(239,68,68,0.2)',
    text:   '#ef4444',
    strip:  '#ef4444',
    label:  'At Risk',
  },
};

export const CATEGORY_DESCRIPTIONS: Record<GoalCategoryId, string> = {
  new_business:  'Deals onboarded, retainer revenue generated, and active pitch activity.',
  revenue:       'Total invoices collected against the annual target and collection rate.',
  client_health: 'Average client satisfaction ratings and ClarityScore™ across all brands.',
  delivery:      'On-time task verification rate and creative review queue health.',
  people_perf:   'Agency average score, at-risk staff tracking, and contribution activity.',
  hr_workforce:  'Staff retention, vacancy fill rate, and upcoming internship completions.',
};
