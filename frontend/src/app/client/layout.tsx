import { AuthGuard, ClientPasswordResetGuard } from '@/components/AuthGuard';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard portalType="client">
      <ClientPasswordResetGuard>
        <div className="min-h-screen bg-[#0d0d1a]">
          {children}
        </div>
      </ClientPasswordResetGuard>
    </AuthGuard>
  );
}
