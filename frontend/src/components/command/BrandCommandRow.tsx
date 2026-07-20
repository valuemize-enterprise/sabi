'use client';

/**
 * BrandCommandRow — one brand on the Command Center.
 * Healthy rows render collapsed (slim head only); Watch / At Risk
 * rows show all seven domain cells. Clicking the head toggles the
 * inline drawer, which lazy-loads offending records and deep-links
 * into /brands/[id]?tab=… — the two-click rule.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ExternalLink, TrendingUp, TrendingDown, Minus,
  Banknote, Brain, Inbox, CheckSquare, Target, Users, MessageSquare,
} from 'lucide-react';
import type { CommandBrand, BrandDetails } from './types';
import { fetchBrandDetails } from './types';

const STATUS_META = {
  at_risk: { label: 'At Risk',  border: 'border-l-red-600',
             badge: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  watch:   { label: 'Watch',    border: 'border-l-amber-500',
             badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  healthy: { label: 'Healthy',  border: 'border-l-emerald-600',
             badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
} as const;

const stateText = (s: string) =>
  s === 'red' ? 'text-red-600 dark:text-red-400'
  : s === 'amber' ? 'text-amber-600 dark:text-amber-400'
  : s === 'grey' ? 'text-gray-400'
  : 'text-gray-900 dark:text-white';

const fmtNaira = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `₦${Math.round(n / 1_000)}k` : `₦${n}`;

function Trend({ t }: { t: string | null }) {
  if (t === 'up') return <TrendingUp className="w-3 h-3 inline text-emerald-600" />;
  if (t === 'down') return <TrendingDown className="w-3 h-3 inline text-red-600" />;
  return <Minus className="w-3 h-3 inline text-gray-400" />;
}

function Cell({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2.5 border-r border-gray-100 dark:border-gray-800 last:border-r-0 min-w-0">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-xs leading-snug">{children}</div>
    </div>
  );
}

function DrawerList({ title, empty, items, href, render }: {
  title: string; empty: string; href: string;
  items: any[]; render: (i: any) => React.ReactNode;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</span>
        <Link href={href} className="text-[10px] font-bold text-violet-600 hover:text-violet-700 flex items-center gap-0.5">
          Open tab <ExternalLink className="w-2.5 h-2.5" />
        </Link>
      </div>
      {items.length === 0
        ? <p className="text-xs text-gray-400">{empty}</p>
        : <ul className="space-y-1.5">{items.map((i, idx) => (
            <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">{render(i)}</li>
          ))}</ul>}
    </div>
  );
}

export default function BrandCommandRow({ brand }: { brand: CommandBrand }) {
  const meta = STATUS_META[brand.status];
  const collapsedByDefault = brand.status === 'healthy';
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<BrandDetails | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !details) {
      setLoading(true);
      try { setDetails(await fetchBrandDetails(brand.id)); }
      catch { /* drawer shows fallback */ }
      finally { setLoading(false); }
    }
  };

  const showCells = !collapsedByDefault || open;

  return (
    <div className={`card overflow-hidden border-l-4 ${meta.border} mb-2.5`}>
      {/* ── head ── */}
      <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {brand.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">{brand.name}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            {brand.is_new && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">New</span>
            )}
          </div>
          <div className="text-[11px] text-gray-400">
            {brand.team.brand_admin ? `Brand Admin: ${brand.team.brand_admin}` : 'No Brand Admin'}
            {brand.retainer_tier ? ` · ${brand.retainer_tier}` : ''}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
          {brand.reasons.length === 0 ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">All clear</span>
          ) : brand.reasons.slice(0, 3).map((r, i) => (
            <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              r.severity === 'red'
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            }`}>{r.label}</span>
          ))}
          {brand.reasons.length > 3 && (
            <span className="text-[10px] font-bold text-gray-400">+{brand.reasons.length - 3}</span>
          )}
        </div>
        <Link href={`/brands/${brand.id}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}
          className="text-[11px] font-bold text-violet-600 hover:text-violet-700 whitespace-nowrap shrink-0">
          Open →
        </Link>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* ── seven cells ── */}
      {showCells && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 border-t border-gray-100 dark:border-gray-800">
          <Cell icon={Banknote} label="Financial">
            {brand.financial.overdue_amount > 0 ? (
              <><span className={`font-bold ${stateText('red')}`}>{fmtNaira(brand.financial.overdue_amount)} overdue</span>
              <div className="text-gray-400">{brand.financial.overdue_days}d late</div></>
            ) : brand.financial.state === 'grey' ? (
              <span className="text-gray-400">No invoices</span>
            ) : (
              <><span className={`font-bold ${stateText(brand.financial.state)}`}>Current</span>
              <div className="text-gray-400">{fmtNaira(brand.financial.invoiced_mtd)} MTD</div></>
            )}
          </Cell>
          <Cell icon={Brain} label="Strategy">
            {brand.strategy.title ? (
              <><span className="font-bold text-gray-900 dark:text-white truncate block">{brand.strategy.title}</span>
              <div className={brand.strategy.pnl_pending ? stateText('amber') : 'text-gray-400'}>
                {brand.strategy.pnl_pending ? 'P&L pending' : `${brand.strategy.progress_pct}% verified`}
              </div>
              <div className="h-1 mt-1 rounded-full bg-violet-100 dark:bg-violet-950/40 overflow-hidden">
                <div className="h-full bg-violet-600 rounded-full" style={{ width: `${brand.strategy.progress_pct}%` }} />
              </div></>
            ) : <span className={stateText(brand.strategy.state)}>{brand.strategy.state === 'red' ? 'None — briefs open' : 'No active strategy'}</span>}
          </Cell>
          <Cell icon={Inbox} label="Briefs">
            {brand.briefs.open === 0 ? <span className="text-gray-400">None open</span> : (
              <><span className={`font-bold ${stateText(brand.briefs.state)}`}>{brand.briefs.open} open</span>
              {brand.briefs.unclassified > 0 && (
                <div className={stateText(brand.briefs.oldest_unclassified_hours > 48 ? 'red' : 'amber')}>
                  {brand.briefs.unclassified} unclassified · {brand.briefs.oldest_unclassified_hours}h
                </div>
              )}</>
            )}
          </Cell>
          <Cell icon={CheckSquare} label="Tasks">
            <span className="font-bold text-gray-900 dark:text-white">{brand.tasks.verified_week} / {brand.tasks.due_week} wk</span>
            {(brand.tasks.overdue > 0 || brand.tasks.unverified_5d > 0) && (
              <div className={stateText(brand.tasks.state)}>
                {brand.tasks.overdue > 0 && `${brand.tasks.overdue} overdue`}
                {brand.tasks.overdue > 0 && brand.tasks.unverified_5d > 0 && ' · '}
                {brand.tasks.unverified_5d > 0 && `${brand.tasks.unverified_5d} unverified 5d+`}
              </div>
            )}
          </Cell>
          <Cell icon={Target} label="Goals">
            {brand.goals.on_track + brand.goals.at_risk + brand.goals.achieved === 0 ? (
              <span className={stateText('amber')}>No goals set</span>
            ) : (
              <><span className={`font-bold ${stateText(brand.goals.state)}`}>{brand.goals.on_track} on track</span>
              <div className="text-gray-400">
                {brand.goals.at_risk > 0 && <span className={stateText('red')}>{brand.goals.at_risk} at risk </span>}
                <Trend t={brand.goals.velocity} />
              </div></>
            )}
          </Cell>
          <Cell icon={Users} label="Team">
            <span className={`font-bold ${stateText(brand.team.state)}`}>{brand.team.assigned} assigned</span>
            <div className="text-gray-400">
              {brand.team.on_leave > 0 && `${brand.team.on_leave} on leave · `}
              {brand.team.score_band ? `Band ${brand.team.score_band}` : '—'}
            </div>
          </Cell>
          <Cell icon={MessageSquare} label="Satisfaction">
            {brand.satisfaction.rating == null ? (
              <span className={stateText(brand.satisfaction.state)}>Not rated</span>
            ) : (
              <><span className={`font-bold ${stateText(brand.satisfaction.state)}`}>{brand.satisfaction.rating} / 5</span>{' '}
              <Trend t={brand.satisfaction.trend} />
              <div className={brand.satisfaction.weeks_silent >= 2 ? stateText('amber') : 'text-gray-400'}>
                {brand.satisfaction.weeks_silent >= 1 ? `Silent ${brand.satisfaction.weeks_silent} wk${brand.satisfaction.weeks_silent > 1 ? 's' : ''}` : 'Recent'}
              </div></>
            )}
          </Cell>
        </div>
      )}

      {/* ── drawer: offending records, two clicks to the fix ── */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30 p-3">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
            </div>
          ) : details ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <DrawerList title="Overdue tasks" empty="None 🎉" href={`/brands/${brand.id}?tab=tasks`}
                items={details.overdue_tasks}
                render={(t) => <><b>{t.title}</b> — {t.assignee} · <span className="text-red-600 font-semibold">{t.days_overdue}d late</span></>} />
              <DrawerList title="Awaiting verification" empty="Queue clear" href={`/brands/${brand.id}?tab=tasks`}
                items={details.unverified_tasks}
                render={(t) => <><b>{t.title}</b> — {t.assignee} · {t.days_waiting}d waiting</>} />
              <DrawerList title="Unclassified briefs" empty="All classified" href={`/brands/${brand.id}?tab=briefs`}
                items={details.unclassified_briefs}
                render={(b) => <><b>{b.title}</b> · {b.hours_old}h old</>} />
              <DrawerList title="Money & goals" empty="Nothing overdue" href={`/brands/${brand.id}?tab=financials`}
                items={[...details.overdue_invoices.map(i => ({ kind: 'inv', ...i })),
                        ...details.goals_at_risk.map(g => ({ kind: 'goal', ...g }))]}
                render={(x) => x.kind === 'inv'
                  ? <><b>{x.reference}</b> {x.amount} · <span className="text-red-600 font-semibold">{x.days_overdue}d overdue</span></>
                  : <><b>{x.title}</b> · <span className="text-amber-600 font-semibold">goal at risk</span></>} />
            </div>
          ) : (
            <p className="text-xs text-gray-400">Couldn&rsquo;t load details — use the Open link above.</p>
          )}
        </div>
      )}
    </div>
  );
}
