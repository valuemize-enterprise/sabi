'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClientStore } from '@/lib/store';
import { useMobileSidebar } from '@/lib/MobileSidebarContext';
import {
  LayoutDashboard, Brain, FileText, Target, Users2, BarChart3,
  Calendar, Trophy, MessageCircle, Bell, Settings, HelpCircle,
  Swords, Lightbulb, Star, LogOut, Smartphone,
  Paperclip,
  CheckSquare,
  ClipboardList,
  Palette, X
} from 'lucide-react';

const nav = [
  { href: '/client/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
    { href: '/client/briefs',          label: 'Briefs',            icon: ClipboardList },
  { href: '/client/ask',           label: 'Ask ARIA',        icon: Brain, badge: 'AI' },
  { href: '/client/reports',       label: 'Reports',         icon: FileText },
  { href: '/client/goals',         label: 'Goals',           icon: Target },
  { href: '/client/strategies',    label: 'Strategies',      icon: Lightbulb },
  { href: '/client/competitors',   label: 'Competitors',     icon: Swords },
  { href: '/client/identity',      label: 'Brand Identity',  icon: Palette },
  { href: '/client/platforms',     label: 'Platforms',       icon: Smartphone },
  { href: '/client/deliverables', label: 'Deliverables', icon: Paperclip },
  { href: '/client/moments',       label: 'MomentMap™',      icon: Calendar },
  { href: '/client/value',         label: 'Proof of Value',  icon: Trophy },
  { href: '/client/team',          label: 'Our Team',        icon: Users2 },
  { href: '/client/notifications', label: 'Notifications',   icon: Bell },
  { href: '/client/satisfaction',  label: 'Satisfaction',    icon: Star },
  { href: '/client/settings',      label: 'Settings',        icon: Settings },
  { href: '/client/tasks',       label: 'Work Done',     icon: CheckSquare },
  { href: '/client/help',          label: 'Help',            icon: HelpCircle },
];

export function ClientSidebar() {
  const pathname = usePathname();
  const { client, clearClient } = useClientStore();
  const brand = client?.brand;
  const { open, close } = useMobileSidebar();

  const sidebarContent = (
    <>
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <div className="w-9 h-9 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
          {brand?.name?.[0] ?? 'B'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate">{brand?.name ?? 'Your Brand'}</p>
          <p className="text-[10px] text-white/30 truncate">Powered by Cerebre</p>
        </div>
        <button onClick={close} className="md:hidden text-white/40 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon, badge }) => {
          const active = href === '/client/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href}
              onClick={close}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group ${
                active ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20' : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-purple-400' : 'text-white/30 group-hover:text-white/60'}`} />
              <span className="flex-1">{label}</span>
              {badge && <span className="text-[9px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300">
            {client?.full_name?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{client?.full_name}</p>
            <p className="text-[10px] text-white/30 truncate">{client?.job_title ?? 'Client'}</p>
          </div>
          <button onClick={() => { localStorage.removeItem('sabi_client_token'); clearClient(); }}
            className="text-white/20 hover:text-red-400 transition-colors p-1">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 bg-[#0a0a18] border-r border-white/5 flex-col z-40">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[#0a0a18] border-r border-white/5 flex flex-col animate-slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
