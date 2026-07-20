'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, FileText, Brain,
  Calendar, Bell, ClipboardList, Settings, LogOut,
  Briefcase, PenLine, BarChart3, Mail, Shield,
  ChevronDown, ChevronRight,
  DollarSign,
  Activity,
  ListChecks, Lock, Trophy, Target, Palette, X, Command
} from 'lucide-react';
import { useState } from 'react';
import { useAgencyStore } from '@/lib/store';
import { useMobileSidebar } from '@/lib/MobileSidebarContext';

const ADMIN_ROLES = ['super_admin','ceo','managing_director','creative_director','strategy_director','account_director','brand_admin','hr'];
const isAdmin = (role: string) => ADMIN_ROLES.includes(role);
const isSA    = (role: string) => role === 'super_admin';

const SHARED_NAV = [
  { href:'/dashboard',      label:'Dashboard',     icon:LayoutDashboard },
  { href:'/ask',            label:'Ask ARIA',      icon:Brain, badge:'AI' },
  { href:'/notifications',  label:'Notifications', icon:Bell  },
];

const ADMIN_NAV = [
  { href: '/command',  label: 'Command',  icon: Command,       roles: ['super_admin','admin','md','brand_admin'] },
  { href: '/brands',   label: 'Brands',   icon: Building2      },
  { href: '/staff',    label: 'Staff',     icon: Users          },
  { href: '/finance',  label: 'Finance',   icon: DollarSign     },
  { href: '/reports',  label: 'Reports',   icon: FileText       },
  { href: '/calendar', label: 'Calendar',  icon: Calendar       },
  { href: '/contribution-claims', label: 'Claims', icon: ListChecks },
  { href: '/creative-review', label: 'Creative Review', icon: Palette, roles: ['super_admin','managing_director','creative_director'] },
  { href: '/my-score', label: 'My Score', icon: BarChart3 },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/audit',    label: 'Audit Log', icon: ClipboardList  },
  { href: '/pulse',    label: 'Pulse', icon: Activity  },
  { href: '/people',   label: 'People', icon: Users, roles: ['super_admin','admin','md','hr'] },
];

const SA_NAV = [
  { href:'/analytics', label:'Analytics', icon:BarChart3 },
];

const STAFF_NAV = [
  { href:'/my-brands', label:'My Brands', icon:Building2 },
  { href:'/my-work',   label:'My Work',   icon:PenLine   },
  { href:'/contribution-claims', label:'Claims', icon:ListChecks },
  { href:'/my-score', label:'My Score', icon:BarChart3 },
  { href:'/leaderboard', label: 'Leaderboard', icon:Trophy },
  { href:'/my-profile',   label:'My Profile',   icon:Mail   },
];

const SETTINGS_SUB = [
  { href:'/settings/users',    label:'Users & Access', saOnly:true  },
  { href:'/settings/platform', label:'Platform',       saOnly:true  },
  { href:'/settings/emails',   label:'Email Templates',saOnly:true  },
  { href:'/settings/agency-targets', label:'Agency Targets', roles:['super_admin','managing_director'] },
  { href:'/settings/api-keys', label:'API Keys',       saOnly:false },
  { href:'/settings/export',   label:'Export Data',    saOnly:false },
  { href:'/my-profile',   label:'My Profile',    saOnly:false },
];

export function InternalSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, clearAuth } = useAgencyStore();
  const role     = user?.role ?? '';
  const admin    = isAdmin(role);
  const sa       = isSA(role);
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith('/settings'));
  const { open, close } = useMobileSidebar();

  const active = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const logout = () => {
    localStorage.removeItem('sabi_token');
    clearAuth();
    router.replace('/login');
  };

  const PULSE_ROLES = ['super_admin', 'managing_director', 'ceo'];

  const NavLink = ({ href, label, icon: Icon, badge, locked }: { href:string; label:string; icon:any; badge?:string; locked?:boolean }) => (
    <Link href={href}
      onClick={close}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group ${
        active(href)
          ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20'
          : 'text-white/50 hover:text-white hover:bg-white/5'
      }`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${active(href) ? 'text-purple-400' : 'text-white/30 group-hover:text-white/60'}`} />
      <span className="flex-1 leading-none">{label}</span>
      {badge && <span className="text-[9px] bg-purple-500/20 text-purple-400 font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
      {locked && <Lock className="w-3 h-3 text-white/15 flex-shrink-0"/>}
    </Link>
  );

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-purple-600/25 border border-purple-500/30 flex items-center justify-center">
          <span className="text-sm font-black text-purple-300">S</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Sabi</p>
          <p className="text-[10px] text-white/25 mt-0.5">Intelligence Suite</p>
        </div>
        {sa && (
          <div className="ml-auto">
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/20">
              <Shield className="w-2.5 h-2.5 text-red-400" />
              <span className="text-[9px] text-red-400 font-bold">SA</span>
            </div>
          </div>
        )}
        <button onClick={close} className="ml-auto md:hidden text-white/40 hover:text-white p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {SHARED_NAV.map(n => <NavLink key={n.href} {...n} />)}

        {admin && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-[10px] text-white/20 font-semibold uppercase tracking-widest px-3">Management</p>
            </div>
            {ADMIN_NAV.filter(n => !n.roles || n.roles.includes(role)).map(n => <NavLink key={n.href} {...n} locked={n.href === '/pulse' && !PULSE_ROLES.includes(role)} />)}
            {SA_NAV.map(n => sa ? <NavLink key={n.href} {...n} /> : null)}
          </>
        )}

        {!admin && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-[10px] text-white/20 font-semibold uppercase tracking-widest px-3">My Work</p>
            </div>
            {STAFF_NAV.map(n => <NavLink key={n.href} {...n} />)}
          </>
        )}

        {admin && (
          <div className="pt-2">
            <button onClick={() => setSettingsOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all">
              <Settings className="w-4 h-4 text-white/25" />
              <span className="flex-1 text-left">Settings</span>
              {settingsOpen
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {settingsOpen && (
              <div className="ml-4 pl-3 border-l border-white/5 mt-1 space-y-0.5">
                {SETTINGS_SUB.filter(s => (!s.saOnly || sa) && (!s.roles || s.roles.includes(role))).map(s => (
                  <Link key={s.href} href={s.href}
                    onClick={close}
                    className={`block px-3 py-1.5 text-xs rounded-lg transition-all ${
                      pathname === s.href
                        ? 'text-purple-400 bg-purple-500/10'
                        : 'text-white/35 hover:text-white hover:bg-white/5'
                    }`}>
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/4 transition-all group">
          <div className="w-8 h-8 rounded-full bg-purple-500/25 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
            <p className="text-[10px] text-white/30 capitalize truncate">
              {role === 'super_admin' ? 'Super Admin' : role?.replace(/_/g, ' ')}
            </p>
          </div>
          <button onClick={logout} title="Sign out"
            className="text-white/15 hover:text-red-400 transition-colors p-1 flex-shrink-0">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible */}
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
