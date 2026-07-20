/**
 * Command Center — shared types + API client.
 * Swap `authFetch` for your existing api.ts helper if you prefer
 * (see docs/PATCHES.md §3) — the response shapes stay identical.
 */

export interface ReasonChip { domain: string; severity: 'red' | 'amber'; label: string; }

export interface CommandBrand {
  id: string; name: string; retainer_tier: string | null;
  is_new: boolean;
  status: 'at_risk' | 'watch' | 'healthy';
  reasons: ReasonChip[];
  financial: { state: string; overdue_amount: number; overdue_days: number; invoiced_mtd: number; expected_mtd: number };
  strategy: { state: string; title: string | null; progress_pct: number; pnl_pending: boolean };
  briefs: { state: string; open: number; unclassified: number; oldest_unclassified_hours: number };
  tasks: { state: string; verified_week: number; due_week: number; overdue: number; unverified_5d: number };
  goals: { state: string; on_track: number; at_risk: number; achieved: number; velocity: string | null };
  team: { state: string; assigned: number; on_leave: number; brand_admin: string | null; score_band: string | null };
  satisfaction: { state: string; rating: number | null; trend: string | null; weeks_silent: number };
}

export interface CommandPayload {
  success: boolean;
  scope: 'full' | 'my_brands';
  computed_at: string;
  summary: {
    brands: number; at_risk: number; watch: number; healthy: number;
    expected_revenue_mtd: number; avg_satisfaction: number | null;
  };
  brands: CommandBrand[];
}

export interface BrandDetails {
  overdue_tasks: { id: string; title: string; assignee: string; days_overdue: number }[];
  unverified_tasks: { id: string; title: string; assignee: string; days_waiting: number }[];
  unclassified_briefs: { id: string; title: string; hours_old: number }[];
  overdue_invoices: { id: string; reference: string; amount: string; days_overdue: number }[];
  goals_at_risk: { id: string; title: string }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

async function authFetch(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
  const res = await fetch(`${API}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export const fetchCommand = (): Promise<CommandPayload> =>
  authFetch('/api/agency/command');

export const fetchBrandDetails = (brandId: string): Promise<BrandDetails> =>
  authFetch(`/api/agency/command/${brandId}/details`).then((r) => r.details);
