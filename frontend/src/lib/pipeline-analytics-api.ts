// ═══════════════════════════════════════════════════════════════════
// pipeline-analytics-api.ts
// Typed client for Phase G — Revenue Waterfall + Smart Follow-Up
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export interface WaterfallMonth {
  key:       string;        // 'YYYY-MM'
  label:     string;        // 'Aug 2026'
  confirmed: number;        // ₦ — high probability revenue
  probable:  number;        // ₦ — medium probability
  possible:  number;        // ₦ — low probability
  total:     number;        // ₦ — weighted sum
}

export interface WaterfallData {
  months:          WaterfallMonth[];
  monthly_target:  number | null;  // from agency_targets
  annual_target:   number | null;
  summary: {
    total_confirmed:  number;
    total_probable:   number;
    total_possible:   number;
    total_weighted:   number;
    peak_month:       string;
    peak_value:       number;
  };
  computed_at: string;
}

export interface FollowUpEmailDraft {
  subject: string;
  body:    string;
}

export interface FollowUpDrafts {
  email:    FollowUpEmailDraft | null;
  whatsapp: string | null;
  linkedin: string | null;
}

export interface FollowUpResult {
  drafts:               FollowUpDrafts;
  opportunity_context:  {
    company_name:  string;
    contact_name:  string | null;
    stage:         string;
    days_in_stage: number | null;
    threshold:     number | null;
  };
  is_stale:      boolean;
  days_in_stage: number | null;
  generated_at:  string;
}

export interface StalenessCheck {
  opportunity_id: string;
  company_name:   string;
  stage:          string;
  days_in_stage:  number | null;
  threshold:      number | null;
  is_stale:       boolean;
  has_contact:    boolean;
}

export interface StaleDeal {
  id:            string;
  company_name:  string;
  stage:         string;
  days_stale:    number;
  threshold:     number;
  contact_name?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────

const getHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('sabi_token') || sessionStorage.getItem('sabi_token')
    : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init, headers: { ...getHeaders(), ...(init.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'API error');
  return data as T;
}

// ── API ───────────────────────────────────────────────────────────

export const pipelineAnalyticsApi = {

  // Revenue Waterfall (leadership only)
  getWaterfall: (months = 6) =>
    apiFetch<WaterfallData>(`/api/pipeline-analytics/waterfall?months=${months}`),

  // Stale deals
  getStaleDeals: () =>
    apiFetch<{ stale_deals: StaleDeal[] }>('/api/pipeline-analytics/stale'),

  // Generate ARIA follow-up drafts (may take 2-4 seconds)
  generateFollowUp: (opportunityId: string) =>
    apiFetch<FollowUpResult>('/api/pipeline-analytics/follow-up-draft', {
      method: 'POST',
      body:   JSON.stringify({ opportunityId }),
    }),

  // Quick staleness check (no ARIA call)
  checkStaleness: (opportunityId: string) =>
    apiFetch<StalenessCheck>(`/pipeline-analytics/follow-up-check/${opportunityId}`),
};

// ── Display helpers ───────────────────────────────────────────────

/** Format ₦ value compactly (e.g. ₦2.4M, ₦850K) */
export const fmtNairaCompact = (v: number): string => {
  if (v === 0) return '₦0';
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `₦${(v / 1_000).toFixed(0)}K`;
  return `₦${v.toLocaleString('en-NG')}`;
};

/** Full ₦ format */
export const fmtNaira = (v: number): string =>
  `₦${v.toLocaleString('en-NG')}`;

/** Layer colours matching Sabi design */
export const LAYER_COLOURS = {
  confirmed: { fill: '#10b981', label: 'Confirmed',  badge: 'rgba(16,185,129,0.15)' },
  probable:  { fill: '#f59e0b', label: 'Probable',   badge: 'rgba(245,158,11,0.15)' },
  possible:  { fill: '#475569', label: 'Possible',   badge: 'rgba(71,85,105,0.15)'  },
};
