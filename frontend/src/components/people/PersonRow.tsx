'use client';

import StampAvatar from './StampAvatar';
import type { PersonRow as PersonRowType } from './types';

export default function PersonRow({ p, onOpen }: { p: PersonRowType; onOpen: () => void }) {
  return (
    <button className="pp-stamp-row" onClick={onOpen}>
      <StampAvatar name={p.display_name} size={42} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="pp-p-name">{p.display_name}</div>
        <div className="pp-p-sub">
          {p.role_title}{p.employment_type ? ` · ${p.employment_type.replace('_', '-')}` : ''}
          {p.tp_cohort ? ` · TP ${p.tp_cohort}` : ''} · Joined {new Date(p.start_date).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {p.profile_state === 'draft' && <span className="pp-ribbon pp-rib-draft">Draft · {p.profile_draft_days}d</span>}
        {p.profile_state === 'published' && <span className="pp-ribbon pp-rib-live">Profile live</span>}
        {p.probation_active && <span className="pp-ribbon pp-rib-probation">Probation</span>}
        {p.on_leave_now && <span className="pp-ribbon pp-rib-leave">On leave</span>}
        {p.docs_expiring > 0 && <span className="pp-ribbon" style={{ background: 'var(--ember-soft)', color: 'var(--ember)' }}>{p.docs_expiring} doc</span>}
      </div>
    </button>
  );
}
