'use client';

import { useMemo, useState } from 'react';
import { requestLeave } from './types';

const TYPES = [
  { key: 'annual', label: 'Annual', emoji: '🏖️' },
  { key: 'sick', label: 'Sick', emoji: '🤒' },
  { key: 'personal', label: 'Personal', emoji: '🗓️' },
];

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

export default function RequestLeaveForm({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [type, setType] = useState('annual');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const nights = useMemo(() => daysBetween(start, end), [start, end]);
  const valid = start && end && nights > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true); setErr(null);
    try {
      await requestLeave({ leave_type: type, start_date: start, end_date: end, note: note || undefined });
      setSent(true);
      setTimeout(onSent, 1200);
    } catch (e: any) { setErr(e.message || 'Could not send the request'); }
    finally { setBusy(false); }
  };

  return (
    <div className="pp-wiz-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-wiz-modal" style={{ maxWidth: 420 }} role="dialog" aria-modal="true">
        {sent ? (
          <div className="pp-success">
            <div className="pp-success-stamp">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div className="pp-wiz-step-title">Request sent</div>
            <p className="pp-wiz-step-sub">Your Brand Admin will get this instantly — you&rsquo;ll hear back by email either way.</p>
          </div>
        ) : (
          <>
            <div className="pp-wiz-head">
              <div className="pp-wiz-title-row">
                <div className="pp-wiz-title">Request leave</div>
                <button className="pp-wiz-close" onClick={onClose} aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="pp-wiz-body" style={{ padding: '10px 26px 20px' }}>
              {err && <div className="pp-wiz-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                {err}
              </div>}
              <div className="pp-field">
                <label>Type</label>
                <div className="pp-segmented">
                  {TYPES.map(t => (
                    <button key={t.key} type="button" className={`pp-seg-btn ${type === t.key ? 'sel' : ''}`} onClick={() => setType(t.key)}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pp-field-row">
                <div className="pp-field"><label>From</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div className="pp-field"><label>To</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              </div>
              {nights > 0 && (
                <div className="pp-field-hint" style={{ marginTop: -8, marginBottom: 14 }}>
                  {nights} day{nights !== 1 ? 's' : ''} — excluded from your scoring average automatically once approved.
                </div>
              )}
              <div className="pp-field">
                <label>Note (optional)</label>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything your Brand Admin should know" />
              </div>
            </div>
            <div className="pp-wiz-foot">
              <div style={{ flex: 1 }} />
              <button className="pp-btn pp-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="pp-btn pp-btn-primary" onClick={submit} disabled={!valid || busy}>
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
