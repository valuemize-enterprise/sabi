/**
 * SABI Authentication Stores
 *
 * BUG-001 FIX: Changed cm_token → sabi_token
 * BUG-003 FIX: Removed undefined authApi import
 * BUG-005 FIX: Added isHydrated flag and onRehydrateStorage
 * BUG-006 FIX: Added setAuth(), clearAuth(), setClient()
 * BUG-007 FIX: Client uses sabi_client_token (separate key)
 * BUG-008 FIX: Super Admin uses sabi_sa_token (separate key)
 * BUG-014 FIX: Each store has unique persist key
 */

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────
interface AgencyUser {
  id:                 string;
  email:              string;
  full_name:          string;
  role:               string;
  department?:        string;
  avatar_url?:        string;
  must_reset_password?: boolean;
}

interface ClientUser {
  id:                 string;
  email:              string;
  full_name:          string;
  brand_id:           string;
  job_title?:         string;
  avatar_url?:        string;
  must_reset_password?: boolean;
  brand?: {
    name:         string;
    logo_url?:    string;
    primary_color?: string;
    industry?:    string;
  };
}

interface SuperAdmin {
  id:        string;
  email:     string;
  full_name: string;
  role:      string;
}

// ── Agency Auth Store ─────────────────────────────────────────
interface AgencyAuthState {
  token:        string | null;
  user:         AgencyUser | null;
  isHydrated:   boolean;
  isAuthenticated: boolean;
  setAuth:      (token: string, user: AgencyUser) => void;
  clearAuth:    () => void;
  _finishHydration: (token: string | null) => void;
}

export const useAgencyStore = create<AgencyAuthState>()(
  persist(
    (set) => ({
      token:           null,
      user:            null,
      isHydrated:      false,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sabi_token');
        }
        set({ token: null, user: null, isAuthenticated: false });
      },
      _finishHydration: (token) => {
        if (typeof window !== 'undefined') {
          const realToken = localStorage.getItem('sabi_token');
          if (token && !realToken) {
            set({ token: null, user: null, isHydrated: true, isAuthenticated: false });
            try { localStorage.removeItem('sabi-auth'); } catch {}
            return;
          }
        }
        set({ isHydrated: true, isAuthenticated: !!token });
        if (token && typeof window !== 'undefined') {
          localStorage.setItem('sabi_token', token);
        }
      },
    }),
    {
      name:    'sabi-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._finishHydration(state.token);
        }
      },
    }
  )
);

// ── Client Auth Store ─────────────────────────────────────────
interface ClientAuthState {
  token:        string | null;
  client:       ClientUser | null;
  isHydrated:   boolean;
  isAuthenticated: boolean;
  setClient:    (token: string, client: ClientUser) => void;
  clearClient:  () => void;
  _finishHydration: (token: string | null) => void;
}

export const useClientStore = create<ClientAuthState>()(
  persist(
    (set) => ({
      token:           null,
      client:          null,
      isHydrated:      false,
      isAuthenticated: false,
      setClient: (token, client) => set({ token, client, isAuthenticated: true }),
      clearClient: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sabi_client_token');
          localStorage.removeItem('sabi_client_info');
        }
        set({ token: null, client: null, isAuthenticated: false });
      },
      _finishHydration: (token) => {
        if (typeof window !== 'undefined') {
          const realToken = localStorage.getItem('sabi_client_token');
          if (token && !realToken) {
            set({ token: null, client: null, isHydrated: true, isAuthenticated: false });
            try { localStorage.removeItem('sabi-client-auth'); } catch {}
            return;
          }
        }
        set({ isHydrated: true, isAuthenticated: !!token });
        if (token && typeof window !== 'undefined') {
          localStorage.setItem('sabi_client_token', token);
        }
      },
    }),
    {
      name:    'sabi-client-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, client: state.client }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._finishHydration(state.token);
        }
      },
    }
  )
);

// ── Super Admin Auth Store ────────────────────────────────────
interface SuperAdminAuthState {
  token:        string | null;
  admin:        SuperAdmin | null;
  isHydrated:   boolean;
  isAuthenticated: boolean;
  setAdmin:     (token: string, admin: SuperAdmin) => void;
  clearAdmin:   () => void;
  _finishHydration: (token: string | null) => void;
}

export const useSuperAdminStore = create<SuperAdminAuthState>()(
  persist(
    (set) => ({
      token:           null,
      admin:           null,
      isHydrated:      false,
      isAuthenticated: false,
      setAdmin: (token, admin) => set({ token, admin, isAuthenticated: true }),
      clearAdmin: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sabi_sa_token');
        }
        set({ token: null, admin: null, isAuthenticated: false });
      },
      _finishHydration: (token) => {
        if (typeof window !== 'undefined') {
          const realToken = localStorage.getItem('sabi_sa_token');
          if (token && !realToken) {
            set({ token: null, admin: null, isHydrated: true, isAuthenticated: false });
            try { localStorage.removeItem('sabi-sa-auth'); } catch {}
            return;
          }
        }
        set({ isHydrated: true, isAuthenticated: !!token });
        if (token && typeof window !== 'undefined') {
          localStorage.setItem('sabi_sa_token', token);
        }
      },
    }),
    {
      name:    'sabi-sa-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, admin: state.admin }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._finishHydration(state.token);
        }
      },
    }
  )
);
