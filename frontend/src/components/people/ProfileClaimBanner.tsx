'use client';

import { useState } from 'react';
import { publishMyProfile, regenerateProfile } from './types';
import '@/styles/people-theme.css';

export default function ProfileClaimBanner({ userId, state, hasPhoto, hasBio, onChanged }: {
  userId: string; state: string; hasPhoto: boolean; hasBio: boolean; onChanged: () => void;
}) {
  const [busy, setBusy] = useState<'publish' | 'regen' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (state !== 'draft') return null;

  const checks: [string, boolean][] = [['Bio reviewed', hasBio], ['Photo added', hasPhoto]];
  const done = checks.filter(([, ok]) => ok).length;

  const run = async (kind: 'publish' | 'regen') => {
    setBusy(kind); setErr(null);
    try {
      if (kind === 'publish') await publishMyProfile(); else await regenerateProfile(userId);
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="pp-scope" style={{ borderRadius: 16, marginBottom: 18 }}>
      <div className="pp-dr-section" style={{ margin: 16, borderColor: 'var(--gold-soft)', background: '#FDFAF0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <b style={{ fontFamily: 'var(--display)', fontSize: 14 }}>Your draft is ready — nothing goes live until you publish</b>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--soft)' }}>{done}/{checks.length} ready</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {checks.map(([label, ok]) => (
            <span key={label} className="pp-ribbon" style={{ background: ok ? 'var(--moss-soft)' : 'var(--paper)', color: ok ? 'var(--moss)' : 'var(--soft)' }}>
              {ok ? '✓' : '○'} {label}
            </span>
          ))}
          <span className="pp-ribbon" style={{ background: 'var(--volt-soft)', color: 'var(--volt)' }}>🔒 Role, title & start date sync from HR</span>
        </div>
        {err && <p style={{ fontSize: 12, color: 'var(--ember)', marginBottom: 8 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="pp-btn pp-btn-gold" onClick={() => run('publish')} disabled={busy !== null}>
            {busy === 'publish' ? 'Publishing…' : '🚀 Publish my profile'}
          </button>
          <button className="pp-btn pp-btn-ghost" onClick={() => run('regen')} disabled={busy !== null}>
            ↻ Regenerate with ARIA
          </button>
        </div>
      </div>
    </div>
  );
}
