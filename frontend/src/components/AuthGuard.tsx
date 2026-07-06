'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAgencyStore, useClientStore } from '@/lib/store';

export function InternalAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated, user } = useAgencyStore();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    if (user?.must_reset_password && pathname !== '/set-password') router.replace('/set-password');
  }, [isHydrated, isAuthenticated, user, pathname, router]);
  if (!isHydrated || !isAuthenticated) return null;
  return <>{children}</>;
}

export function ClientAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isHydrated, client } = useClientStore();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) { router.replace('/client/login'); return; }
    if (client?.must_reset_password && pathname !== '/client/set-password') router.replace('/client/set-password');
  }, [isHydrated, isAuthenticated, client, pathname, router]);
  if (!isHydrated || !isAuthenticated) return null;
  return <>{children}</>;
}

export function RoleGate({ roles, fallback, children }: { roles:string[]; fallback?:React.ReactNode; children:React.ReactNode }) {
  const { user } = useAgencyStore();
  if (!user || !roles.includes(user.role)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
