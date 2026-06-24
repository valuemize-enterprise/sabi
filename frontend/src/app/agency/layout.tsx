import { AuthGuard, PasswordResetGuard } from '@/components/AuthGuard';

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard portalType="agency">
      <PasswordResetGuard>
        <div className="min-h-screen bg-[#0d0d1a]">
          {children}
        </div>
      </PasswordResetGuard>
    </AuthGuard>
  );
}
