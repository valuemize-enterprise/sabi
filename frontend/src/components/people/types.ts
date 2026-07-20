/** People OS — shared types + API client. Swap authFetch for your api.ts if preferred. */

export interface PersonRow {
  id: string; user_id: string; display_name: string; role_key: string;
  role_title: string; department: string | null; start_date: string;
  spark_line: string | null;
  // Tier 2 (present for hr/super_admin/md/admin callers)
  employment_type?: string; tp_cohort?: string | null; probation_end?: string | null;
  onboarding?: Record<string, boolean>; status?: string;
  // computed
  profile_state: 'none' | 'draft' | 'published';
  profile_draft_days: number | null;
  on_leave_now: boolean; probation_active: boolean; docs_expiring: number;
}

export interface RegistryPayload {
  success: boolean;
  people: PersonRow[];
  stats: {
    active: number; onboarding: number; on_probation: number;
    on_leave_now: number; docs_expiring: number; drafts_unclaimed: number;
  };
}

export interface PersonFilePayload {
  success: boolean;
  record: Record<string, any>;
  profile: { state: string; generated_at?: string; published_at?: string; generation_version?: number };
  leave_history: { id: string; leave_type: string; start_date: string; end_date: string; status: string; decision_note: string | null }[];
  documents: { id: string; doc_type: string; label: string; expiry_date: string | null; created_at: string }[] | null;
  performance: {
    rolling_avg: number | null;
    low_ratings: { rating: number; note: string; created_at: string }[];
    recognition: { title: string; points: number; created_at: string }[];
    disputes: { reason: string; status: string; created_at: string }[];
  };
}

export interface LeaveRequestRow {
  id: string; user_id: string; leave_type: string; start_date: string;
  end_date: string; note: string | null; status: string;
  user?: { full_name: string };
}

export interface InsightsPayload {
  headcount: number; by_role: Record<string, number>; by_type: Record<string, number>;
  avg_tenure_years: number; exited_total: number;
  upcoming_anniversaries: { name: string; date: string }[];
  upcoming_birthdays: { name: string; day: string }[];
}

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

export const getRegistry = (): Promise<RegistryPayload> => authFetch('/api/people/registry');
export const getPersonFile = (userId: string): Promise<PersonFilePayload> => authFetch(`/api/people/${userId}/file`);
export const getInsights = (): Promise<{ insights: InsightsPayload }> => authFetch('/api/people/insights');
export const createPerson = (input: Record<string, any>) =>
  authFetch('/api/people', { method: 'POST', body: JSON.stringify(input) });
export const updatePerson = (userId: string, patch: Record<string, any>) =>
  authFetch(`/api/people/${userId}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const offboardPerson = (userId: string) =>
  authFetch(`/api/people/${userId}/offboard`, { method: 'POST', body: JSON.stringify({}) });
export const regenerateProfile = (userId: string) =>
  authFetch(`/api/people/${userId}/regenerate`, { method: 'POST', body: JSON.stringify({}) });
export const publishMyProfile = () =>
  authFetch('/api/people/me/publish', { method: 'POST', body: JSON.stringify({}) });
export const getPendingLeave = (): Promise<{ requests: LeaveRequestRow[] }> => authFetch('/api/leave/pending');
export const requestLeave = (input: Record<string, any>) =>
  authFetch('/api/leave/request', { method: 'POST', body: JSON.stringify(input) });
export const decideLeave = (id: string, approve: boolean, note?: string) =>
  authFetch(`/api/leave/${id}/decide`, { method: 'POST', body: JSON.stringify({ approve, note }) });
export const addDocument = (userId: string, input: Record<string, any>) =>
  authFetch(`/api/people/${userId}/documents`, { method: 'POST', body: JSON.stringify(input) });
