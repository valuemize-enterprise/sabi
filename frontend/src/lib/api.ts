/**
 * Sabi Intelligence Suite — Frontend API Client
 * A product of Cerebre Media Africa
 *
 * Single source of truth for all API calls.
 * Uses sabi_token (agency) and sabi_client_token (client).
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────
async function sabiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  tokenKey: 'sabi_token' | 'sabi_client_token' | 'sabi_sa_token' = 'sabi_token'
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(tokenKey) : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  // Handle 401 — clear token and redirect to login
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(tokenKey);
      const loginPath = tokenKey === 'sabi_client_token' ? '/client/login'
        : tokenKey === 'sabi_sa_token' ? '/super-admin/login'
        : '/login';
      window.location.href = loginPath;
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function agencyFetch<T>(endpoint: string, options?: RequestInit) {
  return sabiRequest<T>(endpoint, options, 'sabi_token');
}
function clientFetch<T>(endpoint: string, options?: RequestInit) {
  return sabiRequest<T>(endpoint, options, 'sabi_client_token');
}
function saFetch<T>(endpoint: string, options?: RequestInit) {
  return sabiRequest<T>(endpoint, options, 'sabi_sa_token');
}

// ─────────────────────────────────────────────────────────────
// Agency Auth
// ─────────────────────────────────────────────────────────────
export const agencyAuth = {
  login:       (email: string, password: string) =>
    agencyFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me:          () => agencyFetch('/api/auth/me'),
  setPassword: (current_password: string, new_password: string) =>
    agencyFetch('/api/auth/set-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  logout:      () => agencyFetch('/api/auth/logout', { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Client Auth
// ─────────────────────────────────────────────────────────────
export const clientAuth = {
  login:       (email: string, password: string) =>
    clientFetch('/api/client/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me:          () => clientFetch('/api/client/auth/me'),
  setPassword: (current_password: string, new_password: string) =>
    clientFetch('/api/client/auth/set-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  logout:      () => clientFetch('/api/client/auth/logout', { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Super Admin Auth
// ─────────────────────────────────────────────────────────────
export const superAdminAuth = {
  login:  (email: string, password: string) =>
    saFetch('/api/super-admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me:     () => saFetch('/api/super-admin/auth/me'),
  logout: () => saFetch('/api/super-admin/auth/logout', { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Brands
// ─────────────────────────────────────────────────────────────
export const brands = {
  list:   (params?: Record<string, string>) => agencyFetch(`/api/agency/brands?${new URLSearchParams(params)}`),
  get:    (id: string) => agencyFetch(`/api/agency/brands/${id}`),
  create: (body: Record<string, unknown>) =>
    agencyFetch('/api/agency/brands', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) =>
    agencyFetch(`/api/agency/brands/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => agencyFetch(`/api/agency/brands/${id}`, { method: 'DELETE' }),
  refreshClarity: (id: string) =>
    agencyFetch(`/api/agency/brands/${id}/refresh-clarity`, { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Reports
// ─────────────────────────────────────────────────────────────
export const reports = {
  list:             (params?: Record<string, string>) => agencyFetch(`/api/agency/reports?${new URLSearchParams(params)}`),
  get:              (id: string) => agencyFetch(`/api/agency/reports/${id}`),
  create:           (body: Record<string, unknown>) => agencyFetch('/api/agency/reports', { method: 'POST', body: JSON.stringify(body) }),
  update:           (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/reports/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete:           (id: string) => agencyFetch(`/api/agency/reports/${id}`, { method: 'DELETE' }),
  generateNarrative:(id: string) => agencyFetch(`/api/agency/reports/${id}/generate-narrative`, { method: 'POST' }),
  publish:          (id: string) => agencyFetch(`/api/agency/reports/${id}/publish`, { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Goals
// ─────────────────────────────────────────────────────────────
export const goals = {
  list:          (params?: Record<string, string>) => agencyFetch(`/api/agency/goals?${new URLSearchParams(params)}`),
  get:           (id: string) => agencyFetch(`/api/agency/goals/${id}`),
  create:        (body: Record<string, unknown>) => agencyFetch('/api/agency/goals', { method: 'POST', body: JSON.stringify(body) }),
  update:        (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/goals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete:        (id: string) => agencyFetch(`/api/agency/goals/${id}`, { method: 'DELETE' }),
  trackVelocity: (id: string) => agencyFetch(`/api/agency/goals/${id}/track-velocity`, { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Competitors
// ─────────────────────────────────────────────────────────────
export const competitors = {
  list:      (params?: Record<string, string>) => agencyFetch(`/api/agency/competitors?${new URLSearchParams(params)}`),
  get:       (id: string) => agencyFetch(`/api/agency/competitors/${id}`),
  create:    (body: Record<string, unknown>) => agencyFetch('/api/agency/competitors', { method: 'POST', body: JSON.stringify(body) }),
  update:    (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/competitors/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete:    (id: string) => agencyFetch(`/api/agency/competitors/${id}`, { method: 'DELETE' }),
  depthView: (brand_id: string, competitor_ids: string[]) =>
    agencyFetch('/api/agency/competitors/depth-view', { method: 'POST', body: JSON.stringify({ brand_id, competitor_ids }) }),
  pulse:     (id: string) => agencyFetch(`/api/agency/competitors/${id}/pulse`, { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Calendar (MomentMap™)
// ─────────────────────────────────────────────────────────────
export const calendar = {
  list:      (params?: Record<string, string>) => agencyFetch(`/api/agency/calendar?${new URLSearchParams(params)}`),
  create:    (body: Record<string, unknown>) => agencyFetch('/api/agency/calendar', { method: 'POST', body: JSON.stringify(body) }),
  update:    (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/calendar/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete:    (id: string) => agencyFetch(`/api/agency/calendar/${id}`, { method: 'DELETE' }),
  recommend: (brand_id: string, month?: number, year?: number) =>
    agencyFetch('/api/agency/calendar/recommend', { method: 'POST', body: JSON.stringify({ brand_id, month, year }) }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Tasks (Proof of Value™)
// ─────────────────────────────────────────────────────────────
export const tasks = {
  list:     (params?: Record<string, string>) => agencyFetch(`/api/agency/tasks?${new URLSearchParams(params)}`),
  create:   (body: Record<string, unknown>) => agencyFetch('/api/agency/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update:   (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete:   (id: string) => agencyFetch(`/api/agency/tasks/${id}`, { method: 'DELETE' }),
  complete: (id: string, body: Record<string, unknown>) =>
    agencyFetch(`/api/agency/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Staff
// ─────────────────────────────────────────────────────────────
export const staff = {
  list:         (params?: Record<string, string>) => agencyFetch(`/api/agency/staff?${new URLSearchParams(params)}`),
  get:          (id: string) => agencyFetch(`/api/agency/staff/${id}`),
  create:       (body: Record<string, unknown>) => agencyFetch('/api/agency/staff', { method: 'POST', body: JSON.stringify(body) }),
  update:       (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/staff/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deactivate:   (id: string) => agencyFetch(`/api/agency/staff/${id}/deactivate`, { method: 'POST' }),
  assignBrands: (id: string, brand_ids: string[]) =>
    agencyFetch(`/api/agency/staff/${id}/assign-brands`, { method: 'POST', body: JSON.stringify({ brand_ids }) }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Clients
// ─────────────────────────────────────────────────────────────
export const clients = {
  list:          (params?: Record<string, string>) => agencyFetch(`/api/agency/clients?${new URLSearchParams(params)}`),
  get:           (id: string) => agencyFetch(`/api/agency/clients/${id}`),
  create:        (body: Record<string, unknown>) => agencyFetch('/api/agency/clients', { method: 'POST', body: JSON.stringify(body) }),
  update:        (id: string, body: Record<string, unknown>) => agencyFetch(`/api/agency/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deactivate:    (id: string) => agencyFetch(`/api/agency/clients/${id}/deactivate`, { method: 'POST' }),
  resetPassword: (id: string) => agencyFetch(`/api/agency/clients/${id}/reset-password`, { method: 'POST' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — AudienceIQ™ (NEW FEATURE)
// ─────────────────────────────────────────────────────────────
export const audienceIQ = {
  list:     (params?: Record<string, string>) => agencyFetch(`/api/agency/audience?${new URLSearchParams(params)}`),
  get:      (id: string) => agencyFetch(`/api/agency/audience/${id}`),
  generate: (body: Record<string, unknown>) =>
    agencyFetch('/api/agency/audience/generate', { method: 'POST', body: JSON.stringify(body) }),
  update:   (id: string, body: Record<string, unknown>) =>
    agencyFetch(`/api/agency/audience/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete:   (id: string) => agencyFetch(`/api/agency/audience/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────
// Agency — Analytics & Dashboard
// ─────────────────────────────────────────────────────────────
export const analytics = {
  dashboard:      () => agencyFetch('/api/agency/dashboard'),
  overview:       () => agencyFetch('/api/agency/analytics/overview'),
  brand:          (id: string) => agencyFetch(`/api/agency/analytics/brands/${id}`),
  clarityHistory: (brand_id: string) => agencyFetch(`/api/agency/analytics/clarity-history/${brand_id}`),
};

// ─────────────────────────────────────────────────────────────
// Client Portal
// ─────────────────────────────────────────────────────────────
export const clientPortal = {
  dashboard:   () => clientFetch('/api/client/dashboard'),
  reports:     (params?: Record<string, string>) => clientFetch(`/api/client/reports?${new URLSearchParams(params)}`),
  report:      (id: string) => clientFetch(`/api/client/reports/${id}`),
  goals:       () => clientFetch('/api/client/goals'),
  goal:        (id: string) => clientFetch(`/api/client/goals/${id}`),
  competitors: () => clientFetch('/api/client/competitors'),
  askAria: {
    send:        (message: string, session_id?: string) =>
      clientFetch('/api/client/ask/message', { method: 'POST', body: JSON.stringify({ message, session_id }) }),
    sessions:    () => clientFetch('/api/client/ask/sessions'),
    session:     (id: string) => clientFetch(`/api/client/ask/sessions/${id}`),
  },
};

// ─────────────────────────────────────────────────────────────
// Super Admin
// ─────────────────────────────────────────────────────────────
export const superAdmin = {
  dashboard: () => saFetch('/api/super-admin/dashboard'),
  analytics: () => saFetch('/api/super-admin/analytics'),
  users:     (params?: Record<string, string>) => saFetch(`/api/super-admin/users?${new URLSearchParams(params)}`),
  createUser:(body: Record<string, unknown>) => saFetch('/api/super-admin/users', { method: 'POST', body: JSON.stringify(body) }),
  deactivateUser: (id: string) => saFetch(`/api/super-admin/users/${id}/deactivate`, { method: 'PUT' }),
  activateUser:   (id: string) => saFetch(`/api/super-admin/users/${id}/activate`, { method: 'PUT' }),
  resetUserPw:    (id: string) => saFetch(`/api/super-admin/users/${id}/reset-password`, { method: 'PUT' }),
  brands:    (params?: Record<string, string>) => saFetch(`/api/super-admin/brands?${new URLSearchParams(params)}`),
  audit:     (params?: Record<string, string>) => saFetch(`/api/super-admin/audit?${new URLSearchParams(params)}`),
  settings:  () => saFetch('/api/super-admin/settings'),
  setSetting:(key: string, value: unknown) => saFetch(`/api/super-admin/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  emails:    () => saFetch('/api/super-admin/emails'),
};
