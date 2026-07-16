'use client';

import Link from 'next/link';
import { Bell, ChevronRight, Menu } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { usePathname } from 'next/navigation';
import { useMobileSidebar } from '@/lib/MobileSidebarContext';

interface TopNavProps {
  title?:    string;
  subtitle?: string;
  breadcrumb?: { label: string; href: string }[];
}

export function TopNav({ title, subtitle, breadcrumb }: TopNavProps) {
  const { user } = useAgencyStore();
  const pathname  = usePathname();
  const { toggle } = useMobileSidebar();

  return (
    <header className="h-14 flex items-center justify-between mb-6 px-0">
      {/* Left: hamburger + breadcrumb + title */}
      <div className="min-w-0 flex items-center gap-3">
        <button onClick={toggle} className="md:hidden text-white/50 hover:text-white p-1 -ml-1">
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1">
              {breadcrumb.map((b, i) => (
                <span key={b.href} className="flex items-center gap-1.5">
                  <Link href={b.href} className="text-xs text-white/30 hover:text-white transition-colors">{b.label}</Link>
                  {i < breadcrumb.length - 1 && <ChevronRight className="w-3 h-3 text-white/15" />}
                </span>
              ))}
            </div>
          )}
          {title    && <h1 className="text-base font-semibold text-white leading-none">{title}</h1>}
          {subtitle && <p className="text-xs text-white/35 mt-0.5 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      {/* Right: notifications + user chip */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link href="/notifications"
          className="w-8 h-8 rounded-lg bg-white/4 border border-white/6 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-purple-500" />
        </Link>

        <div className="flex items-center gap-2 pl-2 border-l border-white/8">
          <div className="w-7 h-7 rounded-full bg-purple-500/25 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-white leading-none">{user?.full_name?.split(' ')[0]}</p>
            <p className="text-[10px] text-white/30 mt-0.5 capitalize leading-none">
              {user?.role === 'super_admin' ? 'Super Admin' : user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

export const AgencyTopNav = TopNav;
