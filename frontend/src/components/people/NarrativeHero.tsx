'use client';

import type { RegistryPayload, InsightsPayload } from './types';

/** "Today: 2 out, 1 draft waiting, 1 birthday" — built from real numbers, not hardcoded. */
export default function NarrativeHero({ data, insights }: { data: RegistryPayload; insights: InsightsPayload | null }) {
  const today = new Date();
  const dayLabel = today.toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' });

  const parts: React.ReactNode[] = [];
  if (data.stats.on_leave_now > 0) {
    parts.push(<span key="leave"><span className="num warn">{data.stats.on_leave_now} {data.stats.on_leave_now === 1 ? 'person is' : 'people are'}</span> out this week</span>);
  }
  if (data.stats.drafts_unclaimed > 0) {
    parts.push(<span key="draft"><span className="num warn">{data.stats.drafts_unclaimed} profile draft{data.stats.drafts_unclaimed !== 1 ? 's' : ''}</span> {data.stats.drafts_unclaimed === 1 ? 'is' : 'are'} still waiting for a click</span>);
  }
  const anniv = insights?.upcoming_anniversaries?.find(a => sameDay(a.date, today));
  const bday = insights?.upcoming_birthdays?.find(b => b.day === today.toLocaleDateString('en-NG', { day: 'numeric', month: 'long' }));
  if (anniv) parts.push(<span key="anniv">it&rsquo;s <span className="num gold">{anniv.name.split(' ')[0]}&rsquo;s anniversary</span> — say something nice 🎉</span>);
  if (bday) parts.push(<span key="bday"><span className="num gold">{bday.name.split(' ')[0]}&rsquo;s birthday</span> is today 🎂</span>);

  const sentence = parts.length === 0
    ? <>Everything&rsquo;s quiet. <span className="num" style={{ color: 'var(--moss)' }}>No open items</span> need your attention today.</>
    : joinWithCommas(parts);

  return (
    <div className="pp-hero">
      <div className="pp-hero-eyebrow">Today at Cerebre · {dayLabel}</div>
      <div className="pp-hero-line">{sentence}</div>
      <div className="pp-hero-mini">
        <div className="pp-hm"><b>{data.stats.active}</b><span>active</span></div>
        <div className="pp-hm"><b style={{ color: data.stats.on_probation ? 'var(--gold)' : undefined }}>{data.stats.on_probation}</b><span>on probation</span></div>
        <div className="pp-hm"><b style={{ color: data.stats.docs_expiring ? 'var(--ember)' : undefined }}>{data.stats.docs_expiring}</b><span>docs expiring</span></div>
        {insights && <div className="pp-hm"><b>{insights.avg_tenure_years} yrs</b><span>avg tenure</span></div>}
      </div>
    </div>
  );
}

function sameDay(iso: string, today: Date) {
  const d = new Date(iso);
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}
function joinWithCommas(parts: React.ReactNode[]): React.ReactNode {
  return parts.map((p, i) => (
    <span key={i}>{i > 0 && (i === parts.length - 1 ? ', and ' : ', ')}{p}</span>
  ));
}
