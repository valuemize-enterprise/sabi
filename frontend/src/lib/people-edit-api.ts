// ═══════════════════════════════════════════════════════════════════
// people-edit-api.ts
// Typed client for all Phase C People OS endpoints
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export type EmploymentStatus =
  | 'active' | 'probation' | 'on_leave'
  | 'suspended' | 'resigned' | 'terminated';

export type EmploymentCategory = 'core' | 'intern';

export type InternshipType = 'nysc' | 'siwes' | 'other';

export type DisciplinaryType =
  | 'verbal_warning' | 'written_warning' | 'pip'
  | 'suspension' | 'dismissal';

export type SupportStaffRole =
  | 'driver' | 'receptionist' | 'cleaner'
  | 'security' | 'facility' | 'other';

export type VacancyStatus = 'open' | 'filled' | 'cancelled';

export interface ChangeHistoryEntry {
  id:          string;
  field_name:  string;
  old_value:   string | null;
  new_value:   string;
  reason:      string | null;
  tier:        1 | 2 | 3;
  changed_at:  string;
  changed_by_user: { id: string; full_name: string; role: string };
}

export interface DisciplinaryEntry {
  id:           string;
  type:         DisciplinaryType;
  date_issued:  string;
  description:  string;
  outcome:      string | null;
  is_resolved:  boolean;
  resolved_at:  string | null;
  created_at:   string;
  created_by_user: { id: string; full_name: string };
}

export interface SupportStaff {
  id:               string;
  full_name:        string;
  phone_number:     string | null;
  role_type:        SupportStaffRole;
  role_description: string | null;
  department:       string | null;
  date_of_birth:    string | null;
  start_date:       string | null;
  status:           'active' | 'inactive' | 'exited';
  notes:            string | null;
  created_at:       string;
}

export interface Vacancy {
  id:           string;
  role_name:    string;
  department:   string | null;
  description:  string | null;
  date_opened:  string;
  date_filled:  string | null;
  status:       VacancyStatus;
  created_at:   string;
}

export interface AlertsData {
  internships:  Array<{ id: string; full_name: string; internship_type: string; internship_end_date: string; days_remaining: number }>;
  probations:   Array<{ id: string; full_name: string; probation_end: string; days_remaining: number }>;
  contracts:    Array<{ id: string; full_name: string; contract_end_date: string; days_remaining: number }>;
  disciplinary: Array<{ id: string; type: string; date_issued: string; users: { full_name: string } }>;
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

export const peopleEditApi = {

  // Field edit
  updateField: (recordId: string, fieldName: string, newValue: unknown, reason?: string) =>
    apiFetch<{ record: Record<string, unknown> }>(`/people/${recordId}/field`, {
      method: 'PATCH',
      body:   JSON.stringify({ field_name: fieldName, new_value: newValue, reason }),
    }),

  updateInternship: (recordId: string, payload: {
    employment_category: EmploymentCategory;
    internship_type?: InternshipType;
    internship_duration?: number;
    internship_start_date?: string;
    internship_end_date?: string;
  }) =>
    apiFetch<{ record: Record<string, unknown> }>(`/api/people/${recordId}/internship`, {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    }),

  // History
  getHistory: (recordId: string) =>
    apiFetch<{ history: ChangeHistoryEntry[] }>(`/api/people/${recordId}/history`),

  // Disciplinary
  getDisciplinary: (userId: string) =>
    apiFetch<{ disciplinary: DisciplinaryEntry[] }>(`/api/people/${userId}/disciplinary`),

  addDisciplinary: (userId: string, payload: {
    type: DisciplinaryType; date_issued: string; description: string; outcome?: string;
  }) =>
    apiFetch<{ entry: DisciplinaryEntry }>(`/api/people/${userId}/disciplinary`, {
      method: 'POST', body: JSON.stringify(payload),
    }),

  resolveDisciplinary: (entryId: string, outcome: string) =>
    apiFetch<{ entry: DisciplinaryEntry }>(`/api/people/disciplinary/${entryId}/resolve`, {
      method: 'PATCH', body: JSON.stringify({ outcome }),
    }),

  // Support staff
  getSupportStaff: () =>
    apiFetch<{ staff: SupportStaff[] }>('/api/people/support-staff'),

  createSupportStaff: (payload: Omit<SupportStaff, 'id' | 'created_at'>) =>
    apiFetch<{ staff: SupportStaff }>('/api/people/support-staff', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  updateSupportStaff: (id: string, payload: Partial<SupportStaff>) =>
    apiFetch<{ staff: SupportStaff }>(`/api/people/support-staff/${id}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    }),

  // Vacancies
  getVacancies: () =>
    apiFetch<{ vacancies: Vacancy[] }>('/api/people/vacancies'),

  createVacancy: (payload: { role_name: string; department?: string; description?: string }) =>
    apiFetch<{ vacancy: Vacancy }>('/api/people/vacancies', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  updateVacancy: (id: string, payload: Partial<Vacancy>) =>
    apiFetch<{ vacancy: Vacancy }>(`/api/people/vacancies/${id}`, {
      method: 'PATCH', body: JSON.stringify(payload),
    }),

  // Alerts
  getAlerts: () =>
    apiFetch<AlertsData>('/api/people/alerts'),

  runSweep: () =>
    apiFetch<Record<string, unknown>>('/api/people/run-sweep', { method: 'POST' }),
};

// ── Display helpers ───────────────────────────────────────────────

export const STATUS_LABELS: Record<EmploymentStatus, string> = {
  active:     'Active',
  probation:  'Probation',
  on_leave:   'On Leave',
  suspended:  'Suspended',
  resigned:   'Resigned',
  terminated: 'Terminated',
};

export const STATUS_COLOURS: Record<EmploymentStatus, { bg: string; text: string; border: string }> = {
  active:     { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', border: 'rgba(16,185,129,0.25)' },
  probation:  { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  on_leave:   { bg: 'rgba(59,130,246,0.1)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  suspended:  { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  resigned:   { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
  terminated: { bg: 'rgba(31,31,31,0.5)',    text: '#64748b', border: '#374151' },
};

export const DISC_TYPE_LABELS: Record<DisciplinaryType, string> = {
  verbal_warning:  'Verbal Warning',
  written_warning: 'Written Warning',
  pip:             'Performance Improvement Plan',
  suspension:      'Suspension',
  dismissal:       'Dismissal',
};

export const DISC_TYPE_COLOURS: Record<DisciplinaryType, string> = {
  verbal_warning:  '#f59e0b',
  written_warning: '#f97316',
  pip:             '#6366f1',
  suspension:      '#ef4444',
  dismissal:       '#7f1d1d',
};

export const FIELD_LABELS: Record<string, string> = {
  display_name:        'Display Name',
  role_key:            'Role',
  role_title:          'Title',
  department:          'Department',
  start_date:          'Start Date',
  spark_line:          'Bio',
  work_phone:          'Work Phone',
  employment_type:     'Employment Type',
  employment_status:   'Employment Status',
  employment_category: 'Category',
  probation_end:       'Probation End Date',
  contract_end_date:   'Contract End Date',
  line_manager_id:     'Line Manager',
  personal_email:      'Personal Email',
  personal_phone:      'Personal Phone',
  date_of_birth:       'Date of Birth',
  emergency_contact:   'Emergency Contact',
  emergency_contact_phone:   'Emergency Contact Phone',
  comp_band:           'Salary Band',
  hr_notes:            'HR Notes',
  tp_cohort:           'Tomorrow\'s People Cohort',
};
