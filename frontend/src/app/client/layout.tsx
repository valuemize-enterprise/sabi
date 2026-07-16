'use client';

import { usePathname } from 'next/navigation';
import { ClientAuthGuard } from '@/components/AuthGuard';
import { ClientSidebar }   from '@/components/ClientSidebar';
import { MobileSidebarProvider } from '@/lib/MobileSidebarContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/client/login' || pathname === '/client/set-password';

  if (isAuthPage) return <>{children}</>;

  return (
    <ClientAuthGuard>
      <MobileSidebarProvider>
        <div className="flex min-h-screen bg-[#0d0d1a]">
          <ClientSidebar />
          <main className="flex-1 md:ml-60 min-h-screen overflow-x-hidden">
            {children}
          </main>
        </div>
      </MobileSidebarProvider>
    </ClientAuthGuard>
  );
}
