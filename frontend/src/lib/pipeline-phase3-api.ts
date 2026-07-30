// ═══════════════════════════════════════════════════════════════════
// pipeline-phase3-api.ts
// Typed API client for Phase 3: Conversion + Intelligence
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export interface ConversionConfig {
  brand_name: string;
  brand_description?: string;
  retainer_amount?: number;
  onboarding_date?: string;
  create_invoice?: boolean;
}

export interface ConversionResult {
  message: string;
  brand: {
    id: string;
    name: string;
    description?: string;
    created_at: string;
  };
  brief: {
    id: string;
    title: string;
    description?: string;
  } | null;
  invoice: {
    id: string;
    title: string;
    amount: number;
    status: string;
  } | null;
  opportunity: {
    id: string;
    company_name: string;
    converted_brand_id: string;
  };
  team_assigned: number;
}

export interface ConversionStatus {
  converted: boolean;
  conversion: {
    brand_id: string;
    brand_name: string;
    converted_at: string;
  } | null;
}

export interface WinSourcePattern {
  source: string;
  win_count: number;
  avg_days_to_close: number;
  total_value: number;
}

export interface WinServicePattern {
  service_type: string;
  win_count: number;
  avg_days_to_close: number;
}

export interface WinPatterns {
  period: string;
  total_wins: number;
  total_value: number;
  overall_avg_days_to_close: number | null;
  by_source: WinSourcePattern[];
  by_service_type: WinServicePattern[];
  velocity_by_stage: { stage: string; avg_days: number }[];
  fastest_source: { source: string; avg_days: number } | null;
  slowest_source: { source: string; avg_days: number } | null;
  aria_narrative?: string | null;
}

export interface LossReasonRow {
  reason: string;
  label: string;
  count: number;
  value_lost: number;
  prev_quarter_count: number;
  change: number;
}

export interface LossPatterns {
  this_quarter: LossReasonRow[];
  total_lost_this_quarter: number;
  total_lost_all_time: number;
  total_value_lost_all_time: number;
  dominant_reason: {
    reason: string;
    label: string;
    count: number;
    pct_of_losses: number;
  } | null;
  aria_narrative?: string | null;
}

export interface ForecastStage {
  stage: string;
  deal_count: number;
  raw_value: number;
  weight_pct: number;
  weighted_value: number;
  has_value_count: number;
}

export interface ConversionForecast {
  stages: ForecastStage[];
  total_active_deals: number;
  total_raw_pipeline: number;
  total_weighted_forecast: number;
  high_confidence_value: number;
  note: string;
  aria_narrative?: string | null;
}

export interface QuarterRow {
  quarter: string;
  won: number;
  lost: number;
  total: number;
  win_rate: number | null;
  won_value: number;
}

export interface IntelligenceReport {
  win_patterns: WinPatterns;
  loss_patterns: LossPatterns;
  forecast: ConversionForecast;
  quarter_summary: QuarterRow[];
  generated_at: string;
}

export interface ConvertedOpportunity {
  id: string;
  company_name: string;
  deal_title: string;
  estimated_value?: number;
  converted_brand_id: string;
  brand_name: string;
  lead_ba_name?: string;
  won_date?: string;
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

export const pipelinePhase3Api = {

  // ── Conversion ─────────────────────────────────────────────────

  getConversionStatus: (opportunityId: string) =>
    apiFetch<ConversionStatus>(`/pipeline/opportunities/${opportunityId}/conversion-status`),

  convert: (opportunityId: string, config: ConversionConfig) =>
    apiFetch<ConversionResult>(`/pipeline/opportunities/${opportunityId}/convert`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  listConverted: () =>
    apiFetch<{ conversions: ConvertedOpportunity[] }>('/pipeline/converted'),

  // ── Intelligence ───────────────────────────────────────────────

  getFullReport: () =>
    apiFetch<IntelligenceReport>('/pipeline/intelligence'),

  getWinPatterns: () =>
    apiFetch<WinPatterns>('/pipeline/intelligence/win-patterns'),

  getLossPatterns: () =>
    apiFetch<LossPatterns>('/pipeline/intelligence/loss-patterns'),

  getForecast: () =>
    apiFetch<ConversionForecast>('/pipeline/intelligence/forecast'),

  getQuarterSummary: () =>
    apiFetch<{ quarters: QuarterRow[] }>('/pipeline/intelligence/quarter-summary'),
};

// ── Display helpers ───────────────────────────────────────────────

export const SOURCE_DISPLAY: Record<string, string> = {
  inbound:               'Inbound',
  outreach:              'Outreach',
  rfp:                   'RFP',
  referral:              'Referral',
  existing_relationship: 'Existing Relationship',
  Unknown:               'Unknown',
};

export const SERVICE_DISPLAY: Record<string, string> = {
  digital:      'Digital',
  pr:           'PR',
  strategy:     'Strategy',
  activation:   'Activation',
  experiential: 'Experiential',
};

export const STAGE_DISPLAY: Record<string, string> = {
  identified:    'Identified',
  in_progress:   'In Progress',
  proposal_sent: 'Proposal Sent',
  under_review:  'Under Review',
  negotiating:   'Negotiating',
};

export const LOSS_REASON_COLOURS: Record<string, string> = {
  budget_constraints:    '#ef4444',
  went_with_competitor:  '#f97316',
  scope_too_broad:       '#f59e0b',
  timing_not_right:      '#eab308',
  no_budget_at_this_time:'#84cc16',
  other:                 '#64748b',
  not_recorded:          '#374151',
};

export const formatNaira = (v?: number | null): string =>
  v == null ? '—' : `₦${Number(v).toLocaleString('en-NG')}`;
