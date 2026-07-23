'use client';

import { useMemo, useState } from 'react';
import { requestLeave } from './people/types';


const TYPES = [
  { key: 'annual', label: 'Annual', emoji: '🏖️' },
  { key: 'sick', label: 'Sick', emoji: '🤒' },
  { key: 'personal', label: 'Personal', emoji: '🗓️' },
];

// Flip to false once leave requests go live.
const COMING_SOON = true;

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

export default function StaffRequestLeave({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
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
    setBusy(true);
    setErr(null);
    try {
      await requestLeave({ leave_type: type, start_date: start, end_date: end, note: note || undefined });
      setSent(true);
      setTimeout(onSent, 1200);
    } catch (e: any) {
      setErr(e.message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[420px] rounded-2xl bg-white shadow-2xl"
      >
        {COMING_SOON ? (
          <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">Leave requests, coming soon</div>
              <p className="mx-auto mt-2 max-w-[280px] text-sm text-gray-500">
                We&rsquo;re polishing this feature so approvals and tracking feel effortless. Check back shortly.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Got it
            </button>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="text-lg font-semibold text-gray-900">Request sent</div>
            <p className="text-sm text-gray-500">
              Your Brand Admin will get this instantly — you&rsquo;ll hear back by email either way.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="text-base font-semibold text-gray-900">Request leave</div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {err && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  {err}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Type</label>
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setType(t.key)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                        type === t.key
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">From</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-medium text-gray-600">To</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              </div>

              {nights > 0 && (
                <p className="-mt-2 text-xs text-gray-500">
                  {nights} day{nights !== 1 ? 's' : ''} — excluded from your scoring average automatically once approved.
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">Note (optional)</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything your Brand Admin should know"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!valid || busy}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}