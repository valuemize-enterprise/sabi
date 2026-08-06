// ═══════════════════════════════════════════════════════════════════
// book-of-deals-api.ts
// Typed client for Phase F — Book of Deals
// ═══════════════════════════════════════════════════════════════════

import type { Opportunity, PipelineStage, DealType, ServiceScope, Industry }
  from '@/lib/pipeline-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export interface MyStats {
  total_pitched:     number;
  total_won:         number;
  active_pipeline:   number;
  conversion_rate:   number;     // percentage 0–100
  avg_close_days:    number | null;
  attributed_revenue: number;
}

export interface PursuitEntry {
  rank:      number;
  id:        string;
  full_name: string;
  role:      string;
  companies: string[];
  // converted ranking
  converted_count?: number;
  // active ranking
  active_count?: number;
  stages?:       string[];
  // fastest ranking
  avg_close_days?: number;
  closed_count?:   number;
}

export interface PursuitBoard {
  period:    'quarter' | 'year';
  since:     string;
  converted: PursuitEntry[];
  active:    PursuitEntry[];
  fastest:   PursuitEntry[];
}

export interface AgencyProgress {
  onboarded_this_year:  number;
  client_target:        number;
  client_pct:           number | null;
  revenue_this_year:    number;
  revenue_target:       number;
  revenue_pct:          number | null;
  active_pipeline:      number;
  year:                 number;
}

export interface WidgetData {
  top_chasers:  { full_name: string; deal_count: number }[];
  total_active: number;
}

export interface LogDealPayload {
  company_name:      string;
  contact_name?:     string;
  contact_position?: string;
  contact_email?:    string;
  contact_phone?:    string;
  deal_type?:        DealType;
  service_scope?:    ServiceScope[];
  industry?:         Industry;
  stage?:            PipelineStage;
  estimated_value?:  number;
  retainer_monthly_amount?:  number;
  retainer_start_date?:      string;
  retainer_duration_months?: number;
  campaign_name?:         string;
  campaign_goals?:        string;
  campaign_start_date?:   string;
  campaign_end_date?:     string;
  campaign_total_amount?: number;
  deck_url?:    string;
  notes?:       string;
  account_manager_id?: string;
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

export const bookOfDealsApi = {

  getMyDeals:    () =>
    apiFetch<{ deals: Opportunity[] }>('/api/book-of-deals/my-deals'),

  getMyStats:    () =>
    apiFetch<{ stats: MyStats }>('/api/book-of-deals/my-stats'),

  logDeal:       (payload: LogDealPayload) =>
    apiFetch<{ opportunity: Opportunity; message: string }>('/book-of-deals/log', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }),

  getFullBook:   (params?: { stage?: string; deal_type?: string; bringer_id?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.stage)      q.set('stage',      params.stage);
    if (params?.deal_type)  q.set('deal_type',  params.deal_type);
    if (params?.bringer_id) q.set('bringer_id', params.bringer_id);
    if (params?.search)     q.set('search',     params.search);
    return apiFetch<{ deals: Opportunity[] }>(`/book-of-deals/full?${q}`);
  },

  getPursuitBoard: (period: 'quarter' | 'year' = 'quarter') =>
    apiFetch<PursuitBoard>(`/api/book-of-deals/pursuit-board?period=${period}`),

  getWidget:     () =>
    apiFetch<WidgetData>('/api/book-of-deals/widget'),

  getAgencyProgress: () =>
    apiFetch<AgencyProgress>('/api/book-of-deals/agency-progress'),

  toggleAccess:  (userId: string, grant: boolean) =>
    apiFetch<{ user: unknown; message: string }>(`/api/book-of-deals/access/${userId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ grant }),
    }),
};

// ── Display helpers ───────────────────────────────────────────────

export const fmtNaira = (v: number | null | undefined): string =>
  v != null ? `₦${Number(v).toLocaleString('en-NG')}` : '—';

export const dealDisplayValue = (deal: Partial<Opportunity>): string => {
  if (deal.deal_type === 'retainer' && deal.retainer_monthly_amount) {
    return `${fmtNaira(deal.retainer_monthly_amount)}/mo`;
  }
  if (deal.deal_type === 'campaign' && deal.campaign_total_amount) {
    return fmtNaira(deal.campaign_total_amount);
  }
  if (deal.estimated_value) return fmtNaira(deal.estimated_value);
  return 'Value TBD';
};

export const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export const LEAD_SOURCES = [
  { value: 'referral',             label: 'Referral' },
  { value: 'cold_outreach',        label: 'Cold Outreach' },
  { value: 'inbound',              label: 'Inbound Enquiry' },
  { value: 'event',                label: 'Event / Conference' },
  { value: 'existing_relationship',label: 'Existing Relationship' },
  { value: 'other',                label: 'Other' },
];
