'use client';

import { LucideIcon, Loader2 } from 'lucide-react';

// ── StatCard ─────────────────────────────────────────────────
export function StatCard({
  label, value, icon: Icon, color = 'purple', trend, sub
}: {
  label: string; value: string | number;
  icon?: LucideIcon; color?: string;
  trend?: { value: number; label: string };
  sub?: string;
}) {
  const colors: Record<string, string> = {
    purple: 'text-purple-400 bg-purple-500/10',
    blue:   'text-blue-400 bg-blue-500/10',
    green:  'text-green-400 bg-green-500/10',
    amber:  'text-amber-400 bg-amber-500/10',
    red:    'text-red-400 bg-red-500/10',
    teal:   'text-teal-400 bg-teal-500/10',
  };
  return (
    <div className="sabi-card p-5 hover:border-white/10 transition-all">
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        {trend && (
          <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40 mt-1">{label}</p>
      {sub && <p className="text-xs text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────
export function Badge({ label, color = 'purple' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    green:  'bg-green-500/10 text-green-400 border-green-500/20',
    amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red:    'bg-red-500/10 text-red-400 border-red-500/20',
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    gray:   'bg-white/5 text-white/40 border-white/10',
  };
  return (
    <span className={`inline-flex capitalize items-center text-xs px-2 py-0.5 rounded-full border font-medium ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

// ── EmptyState ───────────────────────────────────────────────
export function EmptyState({
  icon: Icon, title, description, action
}: {
  icon?: LucideIcon; title: string; description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-white/20" />
        </div>
      )}
      <p className="text-white/60 font-medium mb-1">{title}</p>
      {description && <p className="text-sm text-white/30 max-w-xs">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="sabi-btn-primary mt-5 px-5 py-2 text-sm">
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── LoadingPage ───────────────────────────────────────────────
export function LoadingPage({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        <p className="text-sm text-white/30">{label}</p>
      </div>
    </div>
  );
}

// ── PageHeader ───────────────────────────────────────────────
export function PageHeader({
  title, subtitle, action
}: {
  title: string; subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-7">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── TabBar ───────────────────────────────────────────────────
export function TabBar({
  tabs, active, onChange
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 w-fit mb-6">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${
            active === t.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-white/40 hover:text-white'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
