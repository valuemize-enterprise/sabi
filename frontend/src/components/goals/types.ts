// ── Core types ─────────────────────────────────────────────────────────────────

export interface KeyResult {
  id:            string;
  title:         string;
  metric:        string;
  current_value: number;
  target_value:  number;
  unit:          string;
  due_date:      string;
  status:        'not_started' | 'on_track' | 'at_risk' | 'achieved';
}

export interface BrandGoal {
  id:                  string;
  brand_id:            string;
  framework:           'OKR' | 'SMART';
  title:               string;
  objective:           string;
  key_results:         KeyResult[];
  quarter:             string;
  due_date:            string | null;
  status:              'on_track' | 'at_risk' | 'achieved' | 'paused';
  confidence_score:    number | null;
  current_progress:    number;
  is_ai_generated:     boolean;
  source_document_id:  string | null;
  source_insight:      string | null;
  locked:              boolean;
  created_by:          string;
  last_edited_by:      string | null;
  created_at:          string;
  updated_at:          string;
  source_document?:    { file_name: string; document_type: string } | null;
  creator?:            { full_name: string } | null;
}

export interface GeneratedKeyResult {
  id:            string;
  title:         string;
  metric:        string;
  current_value: number;
  target_value:  number;
  unit:          string;
  due_date:      string;
  status:        'not_started';
}

export interface GeneratedGoal {
  objective:          string;
  framework:          'OKR' | 'SMART';
  quarter:            string;
  confidence_score:   number;
  source_insight:     string;
  is_duplicate_risk:  boolean;
  duplicate_of:       string | null;
  key_results:        GeneratedKeyResult[];
  selected:           boolean; // controlled in review UI
}

export interface GenerationResult {
  brief_intelligence:  string;
  document_type:       string;
  recommended_quarter: string;
  source_document_id:  string | null;
  goals:               GeneratedGoal[];
  parse_warnings:      { file: string; error: string }[];
}

export interface GoalChangeRequest {
  id:                    string;
  goal_id:               string;
  brand_id:              string;
  requester_id:          string;
  request_type:          'edit' | 'delete';
  reason:                string;
  proposed_objective:    string | null;
  proposed_key_results:  KeyResult[] | null;
  status:                'pending' | 'approved' | 'denied';
  decided_by:            string | null;
  decided_at:            string | null;
  denial_reason:         string | null;
  created_at:            string;
  requester?:            { full_name: string; email: string };
  goal?:                 { objective: string; title: string };
}

// ── API helpers ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || '';

async function authFetch(path: string, init?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
  const res   = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

// ── Goal generator API ─────────────────────────────────────────────────────────

export const goalGeneratorApi = {
  /** Upload documents and generate OKR goals (returns result for review, does NOT save) */
  generate(brandId: string, files: File[]): Promise<GenerationResult & { success: boolean }> {
    const form = new FormData();
    form.append('brand_id', brandId);
    files.forEach(f => form.append('documents', f));
    return authFetch('/api/goals/generate', { method: 'POST', body: form });
  },

  /** Save approved goals after the review step */
  saveGoals(brandId: string, goals: GeneratedGoal[], sourceDocumentId: string | null) {
    return authFetch('/api/goals/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ brand_id: brandId, goals, source_document_id: sourceDocumentId }),
    });
  },

  /** Get all goals for a brand */
  getGoals(brandId: string): Promise<{ goals: BrandGoal[] }> {
    return authFetch(`/api/goals/${brandId}`);
  },

  /** Super Admin: direct edit */
  editGoal(goalId: string, updates: Partial<Pick<BrandGoal, 'objective' | 'key_results' | 'quarter' | 'due_date' | 'status'>>) {
    return authFetch(`/api/goals/${goalId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(updates),
    });
  },

  /** Super Admin: direct delete */
  deleteGoal(goalId: string) {
    return authFetch(`/api/goals/${goalId}`, { method: 'DELETE' });
  },

  /** Update one key result's current value (progress tracking) */
  updateKR(goalId: string, krId: string, currentValue: number) {
    return authFetch(`/api/goals/${goalId}/kr`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ kr_id: krId, current_value: currentValue }),
    });
  },

  /** Brand Admin: submit edit/delete change request */
  submitChangeRequest(goalId: string, requestType: 'edit' | 'delete', reason: string, proposedChanges?: Partial<BrandGoal>) {
    return authFetch(`/api/goals/${goalId}/change-request`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ request_type: requestType, reason, proposed_changes: proposedChanges }),
    });
  },

  /** Super Admin: get pending change requests for a brand */
  getPendingRequests(brandId: string): Promise<{ requests: GoalChangeRequest[] }> {
    return authFetch(`/api/goals/change-requests/${brandId}`);
  },

  /** Brand Admin: get my own requests */
  getMyRequests(): Promise<{ requests: GoalChangeRequest[] }> {
    return authFetch('/api/goals/change-requests/mine');
  },

  /** Super Admin: approve or deny a change request */
  decideRequest(requestId: string, approve: boolean, denialReason?: string) {
    return authFetch(`/api/goals/change-requests/${requestId}/decide`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ approve, denial_reason: denialReason }),
    });
  },
};
