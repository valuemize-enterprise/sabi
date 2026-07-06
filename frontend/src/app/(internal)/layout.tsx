import { InternalAuthGuard } from '@/components/AuthGuard';
import { InternalSidebar }   from '@/components/InternalSidebar';

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <InternalAuthGuard>
      <div className="flex min-h-screen bg-[#0d0d1a]">
        <InternalSidebar />
        <main className="flex-1 ml-60 min-h-screen overflow-x-hidden">
          {children}
        </main>
      </div>
    </InternalAuthGuard>
  );
}
