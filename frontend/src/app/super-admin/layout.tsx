import { AuthGuard } from '@/components/AuthGuard';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard portalType="super-admin">
      <div className="min-h-screen bg-[#0d0d1a]">
        {children}
      </div>
    </AuthGuard>
  );
}
