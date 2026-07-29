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
  staff_profile: StaffProfile[]
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

export interface StaffProfile {
  id: string;
  user_id: string;
  profile_state: string;
  submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;

  surname: string;
  first_name: string;
  middle_name: string;
  date_of_birth: string;
  nationality: string;
  place_of_birth: string | null;
  country_of_birth: string | null;
  state_of_origin: string;
  lga: string;
  hometown: string;
  religion: string;
  marital_status: string;
  date_of_marriage: string | null;
  spouse_name: string | null;
  spouse_nationality: string | null;
  spouse_profession: string | null;

  home_address: string;
  phone: string;
  personal_email: string;

  nok_name: string;
  nok_relationship: string;
  nok_phone: string;
  nok_email: string;
  nok_address: string;

  family_members: {
    name?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  }[];

  secondary_school: {
    address: string;
    to_date: string;
    from_date: string;
    institution_name: string;
    certificate_obtained: string;
  } | null;

  tertiary_education: {
    address: string;
    to_date: string;
    from_date: string;
    institution_name: string;
    certificate_obtained: string;
  }[];

  professional_qualifications: {
    address: string;
    to_date: string;
    from_date: string;
    institution_name: string;
    certificate_obtained: string;
  }[];

  languages: {
    reading: string;
    writing: string;
    language: string;
    speaking: string;
  }[];

  total_years_experience: number;
  has_criminal_record: boolean;
  criminal_record_details: string | null;

  work_history: {
    to_date: string;
    from_date: string;
    organisation: string;
    responsibilities: string;
  }[];

  guarantor_name: string;
  guarantor_relationship: string;
  guarantor_profession: string | null;
  guarantor_company: string;
  guarantor_office_address: string;
  guarantor_phone: string;
  guarantor_email: string;
  guarantor_comments: string | null;
  guarantor_form_acknowledged: boolean;

  declaration_1: boolean;
  declaration_2: boolean;

  digital_signature: string;
  signature_date: string;

  hr_notes: string | null;

  blood_group: string;
  genotype: string;
  allergy_1: string | null;
  allergy_2: string | null;
  medical_conditions: string | null;

  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_address: string;

  created_at: string;
  updated_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

async function authFetch(path: string, init?: RequestInit) {
  try {
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
    if (!res.ok) {
      throw new Error(body?.error || body?.message || `Request failed (${res.status})`);
    }
    return body;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network connection issue. Please check your internet connection and try again.');
    }
    throw error;
  }
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
export const updateRole = (input: {
  userId: string;
  start_date?: string;
  employment_type?: string;
  role_title?: string;
  spark_line?: string;
}) =>
  authFetch(`/api/people/update`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
