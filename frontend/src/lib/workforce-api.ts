// ═══════════════════════════════════════════════════════════════════
// workforce-api.ts
// Typed client for Phase D — Workforce Snapshot + Leave
// ═══════════════════════════════════════════════════════════════════

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Types ─────────────────────────────────────────────────────────

export interface WidgetDetail {
  label: string;
  count: number | null;
  sub?:  string;
}

export interface WorkforceWidget {
  id:       'headcount' | 'birthdays' | 'leave' | 'vacancies';
  icon:     string;
  label:    string;
  primary:  number;
  unit:     string;
  detail:   WidgetDetail[];
  href:     string;
  error?:   string;
  // leave-specific
  pending?:       number;
  // birthday-specific
  upcoming?:      number;
  // vacancy-specific
  filledThisYear?: number;
}

export interface WorkforceSnapshot {
  widgets:    WorkforceWidget[];
  fetched_at: string;
}

export type LeaveType = 'Annual' | 'Sick' | 'Compassionate' | 'Study' | 'Other';

export interface LeaveRequest {
  id:          string;
  user_id:     string;
  leave_type:  LeaveType;
  start_date:  string;
  end_date:    string;
  days_count:  number;
  reason:      string | null;
  status:      'pending' | 'approved' | 'declined';
  created_at:  string;
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

export const workforceApi = {

  getSnapshot: () =>
    apiFetch<WorkforceSnapshot>('/workforce/snapshot'),

  // Leave requests
  submitLeave: (payload: {
    leave_type:  LeaveType;
    start_date:  string;
    end_date:    string;
    days_count:  number;
    reason?:     string;
  }) =>
    apiFetch<{ leave: LeaveRequest }>('/api/leave/request', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }),

  getMyLeave: () =>
    apiFetch<{ requests: LeaveRequest[] }>('/api/leave/my-requests'),

  // Leadership: approve or decline
  updateLeaveStatus: (id: string, status: 'approved' | 'declined') =>
    apiFetch<{ leave: LeaveRequest }>(`/api/leave/${id}/status`, {
      method: 'PATCH',
      body:   JSON.stringify({ status }),
    }),
};

// ── Display helpers ───────────────────────────────────────────────

export const LEAVE_TYPES: LeaveType[] = [
  'Annual', 'Sick', 'Compassionate', 'Study', 'Other',
];

export const LEAVE_STATUS_COLOURS = {
  pending:  { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  approved: { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', border: 'rgba(16,185,129,0.25)' },
  declined: { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

// Count business days between two date strings
export const countBusinessDays = (startStr: string, endStr: string): number => {
  const start  = new Date(startStr);
  const end    = new Date(endStr);
  let count    = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};
