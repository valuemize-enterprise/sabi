'use client';

/**
 * dashboard/page.tsx
 * Routes to the correct dashboard variant based on system role.
 * Admin/SA → full platform dashboard (existing)
 * Staff → strategy-first staff dashboard (new)
 */

import { useAgencyStore } from '@/lib/store';
import { isGlobalAdmin }  from '@/lib/permissions';
import StaffDashboard     from './staff-dashboard';
import AdminDashboard     from './admin-dashboard';

export default function DashboardPage() {
  const { user } = useAgencyStore();
  if (isGlobalAdmin(user?.role)) return <AdminDashboard />;
  return <StaffDashboard />;
}
