/**
 * AuthGuard — Client-Side Route Protection
 *
 * BUG-002 FIX: Replaces the broken middleware.ts auth check.
 * This component wraps all protected layouts and handles redirects.
 * It runs in the browser, so it can safely read localStorage.
 *
 * Usage in layout.tsx:
 *   <AuthGuard portalType="agency">
 *     {children}
 *   </AuthGuard>
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgencyStore, useClientStore, useSuperAdminStore } from '@/lib/store';

interface AuthGuardProps {
  children: React.ReactNode;
  portalType: 'agency' | 'client' | 'super-admin';
}

export function AuthGuard({ children, portalType }: AuthGuardProps) {
  const router = useRouter();

  const agency     = useAgencyStore();
  const client     = useClientStore();
  const superAdmin = useSuperAdminStore();

  useEffect(() => {
    // Wait for Zustand hydration before checking auth
    const store = portalType === 'agency' ? agency
      : portalType === 'client' ? client
      : superAdmin;

    if (!store.isHydrated) return;

    if (!store.isAuthenticated) {
      const loginPath = portalType === 'agency' ? '/login'
        : portalType === 'client' ? '/client/login'
        : '/super-admin/login';
      router.replace(loginPath);
    }
  }, [
    portalType,
    agency.isHydrated, agency.isAuthenticated,
    client.isHydrated, client.isAuthenticated,
    superAdmin.isHydrated, superAdmin.isAuthenticated,
    router,
  ]);

  const store = portalType === 'agency' ? agency
    : portalType === 'client' ? client
    : superAdmin;

  // Show nothing while hydrating or redirecting
  if (!store.isHydrated || !store.isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Loading Sabi...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ── Must-Reset-Password Guard ─────────────────────────────────
export function PasswordResetGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated } = useAgencyStore();

  useEffect(() => {
    if (isHydrated && user?.must_reset_password) {
      router.replace('/set-password');
    }
  }, [isHydrated, user, router]);

  return <>{children}</>;
}

// ── Client Must-Reset-Password Guard ─────────────────────────
export function ClientPasswordResetGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { client, isHydrated } = useClientStore();

  useEffect(() => {
    if (isHydrated && client?.must_reset_password) {
      router.replace('/client/set-password');
    }
  }, [isHydrated, client, router]);

  return <>{children}</>;
}
