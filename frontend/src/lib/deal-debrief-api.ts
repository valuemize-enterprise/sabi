// ═══════════════════════════════════════════════════════════════════
// deal-debrief-api.ts
// Typed client for Phase H — Win/Loss Debrief + Pitch Archive
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export type DebriefOutcome = 'won' | 'lost';

export interface Debrief {
  id:              string;
  opportunity_id:  string;
  outcome:         DebriefOutcome;
  deciding_factor: string;
  competitor_name: string | null;
  pitch_again:     boolean | null;
  what_worked:     string | null;
  what_failed:     string | null;
  notes:           string | null;
  debrief_by:      string;
  created_at:      string;
  debriefer?: { id: string; full_name: string; role: string } | null;
}

export interface DebriefPayload {
  opportunityId:    string;
  outcome:          DebriefOutcome;
  deciding_factor:  string;
  competitor_name?: string;
  pitch_again?:     boolean;
  what_worked?:     string;
  what_failed?:     string;
  notes?:           string;
}

export interface PitchArchiveEntry {
  id:            string;
  company_name:  string;
  stage:         string;
  industry:      string | null;
  service_scope: string[] | null;
  deal_type:     string | null;
  deck_url:      string;
  outcome:       'won' | 'lost' | 'in_progress';
  created_at:    string;
  business_bringer?: { id: string; full_name: string } | null;
}

export interface QuarterlyInsight {
  factor?:       string;
  objection?:    string;
  competitor?:   string;
  industry?:     string;
  count?:        number;
  appearances?:  number;
  won?:          number;
  lost?:         number;
  insight?:      string;
  note?:         string;
  industries?:   string[];
}

export interface QuarterlyInsightsResult {
  quarter:       string;
  debrief_count: number;
  won_count?:    number;
  lost_count?:   number;
  insights: {
    win_rate?:            string;
    win_rate_pct?:        number;
    top_win_factors?:     QuarterlyInsight[];
    top_objections?:      QuarterlyInsight[];
    competitor_patterns?: QuarterlyInsight[];
    industry_performance?:QuarterlyInsight[];
    deck_impact?:         string;
    top_recommendations?: string[];
    aria_summary?:        string;
  } | null;
  message?:      string;
  generated_at?: string;
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

export const debriefApi = {

  createDebrief: (payload: DebriefPayload) =>
    apiFetch<{ debrief: Debrief; opportunity: unknown }>('/debriefs', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }),

  getByOpportunity: (opportunityId: string) =>
    apiFetch<{ debrief: Debrief | null }>(`/debriefs/opportunity/${opportunityId}`),

  getArchive: (params?: { outcome?: string; industry?: string; quarter?: string }) => {
    const q = new URLSearchParams();
    if (params?.outcome)  q.set('outcome',  params.outcome);
    if (params?.industry) q.set('industry', params.industry);
    if (params?.quarter)  q.set('quarter',  params.quarter);
    return apiFetch<{ debriefs: Debrief[] }>(`/debriefs?${q}`);
  },

  generateInsights: () =>
    apiFetch<QuarterlyInsightsResult>('/debriefs/quarterly-insights', { method: 'POST' }),

  getPitchArchive: (params?: { outcome?: string; industry?: string; service_scope?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.outcome)       q.set('outcome',       params.outcome);
    if (params?.industry)      q.set('industry',      params.industry);
    if (params?.service_scope) q.set('service_scope', params.service_scope);
    if (params?.search)        q.set('search',        params.search);
    return apiFetch<{ entries: PitchArchiveEntry[]; count: number }>(`/debriefs/pitch-archive?${q}`);
  },

  getDeckUrl: (opportunityId: string) =>
    apiFetch<{ deck_url: string | null }>(`/debriefs/deck/${opportunityId}`),
};

// ── Form option constants ─────────────────────────────────────────

export const WIN_DECIDING_FACTORS = [
  { value: 'relationship',       label: 'Existing relationship / trust' },
  { value: 'portfolio',          label: 'Portfolio quality' },
  { value: 'price',              label: 'Best price offered' },
  { value: 'speed',              label: 'Speed of response' },
  { value: 'unique_approach',    label: 'Unique creative approach' },
  { value: 'referral',           label: 'Referral from another client' },
  { value: 'reputation',         label: 'Cerebre reputation / brand' },
  { value: 'other',              label: 'Other' },
];

export const LOSS_OBJECTIONS = [
  { value: 'price_too_high',       label: 'Price was too high' },
  { value: 'competitor_won',       label: 'Competitor had stronger offering' },
  { value: 'relationship_gap',     label: 'Competitor had existing relationship' },
  { value: 'no_expertise',         label: 'Lack of expertise in their category' },
  { value: 'timeline_mismatch',    label: 'Timeline or scope mismatch' },
  { value: 'budget_cut',           label: 'Budget was cut or frozen' },
  { value: 'changed_priorities',   label: 'Client changed priorities' },
  { value: 'internal_hire',        label: 'They hired in-house instead' },
  { value: 'other',                label: 'Other' },
];
