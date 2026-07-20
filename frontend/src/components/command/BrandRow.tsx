'use client';

import { useState } from 'react';
import type { CommandBrand, BrandDetails } from './types';
import { fetchBrandDetails } from './types';

const STATUS_LABEL: Record<string, string> = { at_risk: 'At Risk', watch: 'Watch', healthy: 'Healthy' };
const LOGO_COLORS = ['#7C5CFA', '#2D8577', '#C4872A', '#3A3D8F', '#B5892E'];
const logoColor = (name: string) => LOGO_COLORS[name.charCodeAt(0) % LOGO_COLORS.length];

const fmtNaira = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `₦${Math.round(n / 1_000)}k` : `₦${n}`;

const dotClass = (s: string) => (s === 'red' ? 'red' : s === 'amber' ? 'amber' : s === 'grey' ? 'grey' : 'green');

const DIALS: [keyof CommandBrand, string][] = [
  ['financial', 'Financial'], ['strategy', 'Strategy'], ['briefs', 'Briefs'],
  ['tasks', 'Tasks'], ['goals', 'Goals'], ['team', 'Team'], ['satisfaction', 'Satisfaction'],
];

function DialCell({ label, brand, field }: { label: string; brand: CommandBrand; field: keyof CommandBrand }) {
  const d: any = (brand as any)[field];
  let value = '—', meta = '';
  if (field === 'financial') {
    value = d.overdue_amount > 0 ? `${fmtNaira(d.overdue_amount)} overdue` : d.state === 'grey' ? 'No invoices' : 'Current';
    meta = d.overdue_amount > 0 ? `${d.overdue_days}d late` : `${fmtNaira(d.invoiced_mtd)} MTD`;
  } else if (field === 'strategy') {
    value = d.title || (d.state === 'red' ? 'None — briefs open' : 'No active strategy');
    meta = d.pnl_pending ? 'P&L pending' : d.title ? `${d.progress_pct}% verified` : '';
  } else if (field === 'briefs') {
    value = d.open === 0 ? 'None open' : `${d.open} open`;
    meta = d.unclassified > 0 ? `${d.unclassified} unclassified · ${d.oldest_unclassified_hours}h` : '';
  } else if (field === 'tasks') {
    value = `${d.verified_week} / ${d.due_week} wk`;
    meta = [d.overdue > 0 && `${d.overdue} overdue`, d.unverified_5d > 0 && `${d.unverified_5d} unverified 5d+`].filter(Boolean).join(' · ');
  } else if (field === 'goals') {
    const none = d.on_track + d.at_risk + d.achieved === 0;
    value = none ? 'No goals set' : `${d.on_track} on track`;
    meta = d.at_risk > 0 ? `${d.at_risk} at risk` : '';
  } else if (field === 'team') {
    value = `${d.assigned} assigned`;
    meta = [d.on_leave > 0 && `${d.on_leave} on leave`, d.score_band && `Band ${d.score_band}`].filter(Boolean).join(' · ');
  } else if (field === 'satisfaction') {
    value = d.rating == null ? 'Not rated' : `${d.rating} / 5`;
    meta = d.weeks_silent >= 1 ? `Silent ${d.weeks_silent}w` : 'Recent';
  }
  return (
    <div className="cc-dial">
      <h6><span className={`cc-dot ${dotClass(d.state)}`} />{label}</h6>
      <div className="v">{value}</div>
      {meta && <div className="m">{meta}</div>}
      {field === 'strategy' && d.title && (
        <div className="cc-bar"><i style={{ width: `${d.progress_pct}%` }} /></div>
      )}
    </div>
  );
}

function SignalLog({ details }: { details: BrandDetails | null }) {
  if (!details) {
    return (
      <div className="cc-log">
        <div className="cc-log-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="cc-skel" style={{ height: 70 }} />)}
        </div>
      </div>
    );
  }
  const brandId = (details as any).__brandId || '';
  const cols = [
    { title: 'Overdue tasks', href: `tasks`, items: details.overdue_tasks.map(t => `${t.title} — ${t.assignee} · ${t.days_overdue}d late`) },
    { title: 'Awaiting verification', href: `tasks`, items: details.unverified_tasks.map(t => `${t.title} — ${t.assignee} · ${t.days_waiting}d waiting`) },
    { title: 'Unclassified briefs', href: `briefs`, items: details.unclassified_briefs.map(b => `${b.title} · ${b.hours_old}h old`) },
    { title: 'Money & goals', href: `financials`, items: [
      ...details.overdue_invoices.map(i => `${i.reference} ${i.amount} · ${i.days_overdue}d overdue`),
      ...details.goals_at_risk.map(g => `${g.title} · at risk`),
    ] },
  ];
  return (
    <div className="cc-log">
      <div className="cc-log-grid">
        {cols.map((c) => (
          <div key={c.title} className="cc-log-col">
            <h6>{c.title} <a href={`/brands/${brandId}?tab=${c.href}`}>open →</a></h6>
            {c.items.length === 0
              ? <div className="cc-log-empty">clear</div>
              : c.items.slice(0, 4).map((line, i) => <div key={i} className="cc-log-item">{line}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BrandRow({ brand }: { brand: CommandBrand }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<BrandDetails | null>(null);
  const collapsedByDefault = brand.status === 'healthy';

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !details) {
      try {
        const d = await fetchBrandDetails(brand.id);
        setDetails({ ...d, __brandId: brand.id } as any);
      } catch { /* signal log shows skeleton→nothing gracefully */ }
    }
  };

  const showDials = !collapsedByDefault || open;

  return (
    <div className={`cc-row ${open ? 'open' : ''}`}>
      <button className="cc-row-head" onClick={toggle}>
        <div className={`cc-tick ${brand.status.replace('at_risk', 'risk')}`} />
        <div className="cc-logo" style={{ background: logoColor(brand.name) }}>{brand.name.charAt(0)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="cc-rname">
            <b>{brand.name}</b>
            <span className={`cc-status-pill ${brand.status.replace('at_risk', 'risk')}`}>{STATUS_LABEL[brand.status]}</span>
            {brand.is_new && <span className="cc-status-pill" style={{ background: 'rgba(124,92,250,.15)', color: '#B4A3FF' }}>New</span>}
          </div>
          <div className="cc-rsub">{brand.team.brand_admin || 'No Brand Admin'}{brand.retainer_tier ? ` · ${brand.retainer_tier}` : ''}</div>
        </div>
        <div className="cc-reasons">
          {brand.reasons.length === 0
            ? <span className="cc-reason clear">All clear</span>
            : brand.reasons.slice(0, 3).map((r, i) => (
              <span key={i} className={`cc-reason ${r.severity === 'red' ? 'red' : 'amber'}`}>{r.label}</span>
            ))}
          {brand.reasons.length > 3 && <span className="cc-reason clear">+{brand.reasons.length - 3}</span>}
        </div>
        <a href={`/brands/${brand.id}`} onClick={(e) => e.stopPropagation()} className="cc-openlink">
          Open
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </a>
        <svg className="cc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {showDials && (
        <div className="cc-dials">
          {DIALS.map(([field, label]) => <DialCell key={field as string} label={label} brand={brand} field={field} />)}
        </div>
      )}
      {open && <SignalLog details={details} />}
    </div>
  );
}
