// ═══════════════════════════════════════════════════════════════════
// pipeline-api.ts
// Typed API client for the Sabi New Business Pipeline
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export type PipelineStage =
  | 'identified'
  | 'in_progress'
  | 'proposal_sent'
  | 'under_review'
  | 'negotiating'
  | 'won'
  | 'lost_paused'
  | 'introduction'
  | 'proposal'
  | 'pitch'
  | 'second_pitch'
  | 'decision'
  | 'agreement'
  | 'onboarded';

export type ServiceType = 'digital' | 'pr' | 'strategy' | 'activation' | 'experiential';

export type ServiceScope =
  | 'brand_strategy'
  | 'digital'
  | 'social'
  | 'content'
  | 'pr'
  | 'creative'
  | 'media'
  | 'activation'
  | 'experiential';

export type Industry =
  | 'finance'
  | 'retail'
  | 'fmcg'
  | 'real_estate'
  | 'technology'
  | 'healthcare'
  | 'education'
  | 'hospitality'
  | 'fashion'
  | 'other';

export type DealType = 'retainer' | 'campaign' | 'project';

export type OpportunitySource =
  | 'inbound'
  | 'outreach'
  | 'rfp'
  | 'referral'
  | 'existing_relationship';

export type LostReason =
  | 'budget_constraints'
  | 'went_with_competitor'
  | 'scope_too_broad'
  | 'timing_not_right'
  | 'no_budget_at_this_time'
  | 'other';

export type Staleness = 'green' | 'amber' | 'red';

export interface Opportunity {
  id: string;
  company_name: string;
  deal_title: string;
  description?: string;
  service_types: ServiceType[];
  service_scope?: ServiceScope[];
  source?: OpportunitySource;
  stage: PipelineStage;
  stage_changed_at: string;
  days_in_stage: number;
  staleness: Staleness;
  deal_type?: DealType;
  industry?: Industry;
  contact_name?: string;
  contact_position?: string;
  contact_email?: string;
  contact_phone?: string;
  retainer_monthly_amount?: number;
  retainer_duration_months?: number;
  campaign_total_amount?: number;
  estimated_value?: number;
  date_briefed?: string;
  client_deadline?: string;
  agency_deadline?: string;
  lead_ba_id?: string;
  lead_ba_name?: string;
  lead_ba_email?: string;
  accountable_team_text?: string;
  notes?: string;
  latest_note?: string;
  notes_count: number;
  lost_reason?: LostReason;
  lost_notes?: string;
  converted_brand_id?: string;
  converted_brand_name?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Only on detail view:
  stage_history?: StageHistoryEntry[];
  weekly_notes?: WeeklyNote[];
}

export interface StageHistoryEntry {
  id: string;
  opportunity_id: string;
  from_stage?: PipelineStage;
  to_stage: PipelineStage;
  changed_by?: string;
  changed_by_name?: string;
  changed_at: string;
  change_notes?: string;
}

export interface WeeklyNote {
  id: string;
  opportunity_id: string;
  week_start: string;
  notes?: string;
  aria_draft?: string;
  added_by?: string;
  added_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineAnalytics {
  active_count: number;
  total_pipeline_value: number;
  avg_deal_size: number;
  by_stage: { stage: PipelineStage; count: number; value: number }[];
  win_rate_pct: number;
  won_count: number;
  closed_count: number;
  avg_days_to_close: number | null;
  staleness: { green: number; amber: number; red: number };
  weighted_forecast: number;
}

export interface StalenessAlert {
  id: string;
  company_name: string;
  deal_title: string;
  stage: PipelineStage;
  lead_ba_name?: string;
  days_in_stage: number;
  staleness: Staleness;
  alert_message: string;
  last_note_week?: string;
}

export interface CreateOpportunityPayload {
  company_name: string;
  deal_title: string;
  description?: string;
  service_types?: ServiceType[];
  source?: OpportunitySource;
  stage?: PipelineStage;
  estimated_value?: number;
  date_briefed?: string;
  client_deadline?: string;
  agency_deadline?: string;
  lead_ba_id?: string;
  accountable_team_text?: string;
  notes?: string;
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

export const pipelineApi = {

  // ── Opportunities ──────────────────────────────────────────────

  list: (params: {
    stage?: PipelineStage;
    lead_ba_id?: string;
    service_type?: ServiceType;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
  } = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return apiFetch<{ opportunities: Opportunity[]; count: number }>(
      `/api/pipeline/opportunities${qs ? `?${qs}` : ''}`
    );
  },

  getById: (id: string) =>
    apiFetch<{ opportunity: Opportunity }>(`/api/pipeline/opportunities/${id}`),

  create: (payload: CreateOpportunityPayload) =>
    apiFetch<{ opportunity: Opportunity }>('/api/pipeline/opportunities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: Partial<CreateOpportunityPayload>) =>
    apiFetch<{ opportunity: Opportunity }>(`/api/pipeline/opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  changeStage: (id: string, payload: {
    stage: PipelineStage;
    change_notes?: string;
    lost_reason?: LostReason;
    lost_notes?: string;
    converted_brand_id?: string;
  }) =>
    apiFetch<{ opportunity: Opportunity; message: string }>(
      `/api/pipeline/opportunities/${id}/stage`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/api/pipeline/opportunities/${id}`, { method: 'DELETE' }),

  // ── Weekly Notes ───────────────────────────────────────────────

  getNotes: (id: string) =>
    apiFetch<{ notes: WeeklyNote[] }>(`/api/pipeline/opportunities/${id}/notes`),

  saveNote: (id: string, payload: { notes: string; week_start?: string }) =>
    apiFetch<{ note: WeeklyNote }>(`/api/pipeline/opportunities/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAriaDraft: (id: string, week_start?: string) =>
    apiFetch<{ note: WeeklyNote; aria_draft: string }>(
      `/api/pipeline/opportunities/${id}/notes/aria-draft`,
      { method: 'POST', body: JSON.stringify({ week_start }) }
    ),

  // ── Analytics ──────────────────────────────────────────────────

  getAnalytics: () =>
    apiFetch<{ analytics: PipelineAnalytics }>('/api/pipeline/analytics'),

  getAlerts: () =>
    apiFetch<{ alerts: StalenessAlert[]; count: number }>('/api/pipeline/alerts'),

  getMomentum: () =>
    apiFetch<{ commentary: string; forecast_note: string | null; analytics: PipelineAnalytics }>(
      '/api/pipeline/momentum'
    ),
};

// ── Display helpers ───────────────────────────────────────────────

export const STAGE_LABELS: Record<PipelineStage, string> = {
  identified: 'Identified',
  in_progress: 'In Progress',
  proposal_sent: 'Proposal Sent',
  under_review: 'Under Review',
  negotiating: 'Negotiating',
  won: 'Won',
  lost_paused: 'Lost / Paused',
  introduction: 'Introduction',
  proposal: 'Proposal',
  pitch: 'Pitch',
  second_pitch: 'Second Pitch',
  decision: 'Decision',
  agreement: 'Agreement',
  onboarded: 'Onboarded',
};

export const STAGE_ORDER: PipelineStage[] = [
  'identified',
  'in_progress',
  'proposal_sent',
  'under_review',
  'negotiating',
  'won',
  'lost_paused',
  'introduction',
  'proposal',
  'pitch',
  'second_pitch',
  'decision',
  'agreement',
  'onboarded',
];

export const STAGE_COLOURS: Record<PipelineStage, { bg: string; text: string; border: string }> = {
  identified:    { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
  in_progress:   { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  proposal_sent: { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc', border: 'rgba(168,85,247,0.25)' },
  under_review:  { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  negotiating:   { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  won:           { bg: 'rgba(52,211,153,0.15)',  text: '#10b981', border: 'rgba(16,185,129,0.4)' },
  lost_paused:   { bg: 'rgba(239,68,68,0.08)',   text: '#f87171', border: 'rgba(239,68,68,0.2)' },
  introduction: { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: 'rgba(148,163,184,0.25)' },
  proposal:     { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  pitch:        { bg: 'rgba(168,85,247,0.12)',  text: '#c084fc', border: 'rgba(168,85,247,0.25)' },
  second_pitch: { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  decision:     { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  agreement:    { bg: 'rgba(52,211,153,0.15)',  text: '#10b981', border: 'rgba(16,185,129,0.4)' },
  onboarded:    { bg: 'rgba(20,184,166,0.12)',  text: '#2dd4bf', border: 'rgba(20,184,166,0.35)' },
};

export const STALENESS_COLOURS: Record<Staleness, string> = {
  green: '#10b981',
  amber: '#f59e0b',
  red:   '#ef4444',
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  digital:      'Digital',
  pr:           'PR',
  strategy:     'Strategy',
  activation:   'Activation',
  experiential: 'Experiential',
};

export const SERVICE_SCOPE_LABELS: Record<ServiceScope, string> = {
  brand_strategy: 'Brand Strategy',
  digital:        'Digital',
  social:         'Social',
  content:        'Content',
  pr:             'PR',
  creative:       'Creative',
  media:          'Media',
  activation:     'Activation',
  experiential:   'Experiential',
};

export const INDUSTRY_LABELS: Record<Industry, string> = {
  finance:      'Finance',
  retail:       'Retail',
  fmcg:         'FMCG',
  real_estate:  'Real Estate',
  technology:   'Technology',
  healthcare:   'Healthcare',
  education:    'Education',
  hospitality:  'Hospitality',
  fashion:      'Fashion',
  other:        'Other',
};

export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  retainer: 'Retainer',
  campaign: 'Campaign',
  project:  'Project',
};

export const SOURCE_LABELS: Record<OpportunitySource, string> = {
  inbound:              'Inbound',
  outreach:             'Outreach',
  rfp:                  'RFP',
  referral:             'Referral',
  existing_relationship:'Existing Relationship',
};

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  budget_constraints:    'Budget Constraints',
  went_with_competitor:  'Went with Competitor',
  scope_too_broad:       'Scope Too Broad',
  timing_not_right:      'Timing Not Right',
  no_budget_at_this_time:'No Budget at This Time',
  other:                 'Other',
};

export const formatNaira = (value?: number | null): string => {
  if (value == null) return '—';
  return `₦${Number(value).toLocaleString('en-NG')}`;
};
