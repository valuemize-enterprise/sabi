'use client';

import Link from 'next/link';
import { Bell, ChevronLeft, Menu } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { useMobileSidebar } from '@/lib/MobileSidebarContext';

interface TopNavProps {
  title?:    string;
  subtitle?: string;
  back?:     { href: string; label: string };
}

export function TopNav({ title, subtitle, back }: TopNavProps) {
  const { user } = useAgencyStore();
  const pathname  = usePathname();
  const { toggle } = useMobileSidebar();

  return (
    <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-[#0d0d1a]/80 backdrop-blur-sm sticky top-0 z-30">
      {/* Left: hamburger + breadcrumb / title */}
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={toggle} className="md:hidden text-white/50 hover:text-white p-1 -ml-1">
          <Menu className="w-5 h-5" />
        </button>
        {back && (
          <Link href={back.href}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white transition-colors flex-shrink-0">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{back.label}</span>
          </Link>
        )}
        {back && title && <span className="text-white/15 text-sm">/</span>}
        {title && (
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
            {subtitle && <p className="text-xs text-white/35 truncate hidden sm:block">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <Link href="/notifications"
          className="relative w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/35 hover:text-white hover:bg-white/8 transition-all">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-500" />
        </Link>
        <div className="w-7 h-7 rounded-full bg-purple-500/25 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
          {user?.full_name?.[0]?.toUpperCase() ?? '?'}
        </div>
      </div>
    </header>
  );
}

export const AgencyTopNav = TopNav;

export default TopNav;
