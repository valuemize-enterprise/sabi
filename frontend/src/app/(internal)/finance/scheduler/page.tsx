'use client';

/**
 * /finance/scheduler/page.tsx — Auto-Invoice Scheduler Log
 * Shows retainer auto-drafts and brief-completion invoice triggers.
 * Brand admins can also trigger brief-completion invoices manually here.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertTriangle, Minus, RefreshCw, Loader2, Calendar } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

async function apiFetch(path: string, init?: RequestInit) {
  const res  = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

interface LogEntry {
  id: string; brand_id: string; trigger_type: string; status: string;
  skip_reason: string | null; error_msg: string | null; triggered_at: string;
  invoice?: { invoice_number: string; type: string; total_amount: number } | null;
  brand?: { name: string } | null;
}

const STATUS_CFG: Record<string, [string, React.ReactNode]> = {
  success: ['text-green-400 bg-green-500/10 border-green-500/20', <CheckCircle2 className="w-3 h-3" />],
  skipped: ['text-white/30 bg-white/5 border-white/10',          <Minus        className="w-3 h-3" />],
  error:   ['text-red-400 bg-red-500/10 border-red-500/20',      <AlertTriangle className="w-3 h-3" />],
};

const TRIGGER_LABELS: Record<string, string> = {
  retainer_schedule: 'Retainer schedule',
  brief_completion:  'Brief completed',
  manual:            'Manual trigger',
};

const FINANCE_ROLES = new Set(['super_admin', 'admin', 'md', 'accountant']);

export default function SchedulerPage() {
  const router    = useRouter();
  const { user }  = useAgencyStore();
  const [log,     setLog]     = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/finance/scheduler/log');
      setLog(res.log || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user && !FINANCE_ROLES.has(user.role)) router.replace('/dashboard');
    load();
  }, [user, router, load]);

  const runRetainers = async () => {
    setRunning(true); setError(null); setSuccess(null);
    try {
      const res = await apiFetch('/api/finance/scheduler/run-retainers', { method: 'POST' });
      setSuccess(res.message || 'Retainer run complete');
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setRunning(false); }
  };

  const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Finance
        </button>
        <span className="text-white/10">/</span>
        <h1 className="text-xl font-bold text-white">Auto-invoice scheduler</h1>
      </div>

      {/* Info card */}
      <div className="sabi-card p-4 mb-5 border-purple-500/20 bg-purple-500/5">
        <div className="flex items-start gap-3">
          <Calendar className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/60 leading-relaxed">
            The scheduler runs daily at <strong className="text-white/80">7 AM</strong> and auto-drafts retainer invoices for brands whose
            billing day matches today. It also fires when a brief is marked delivered.
            The accountant reviews and sends each draft — nothing goes to clients automatically.
          </div>
        </div>
      </div>

      {/* Banners */}
      {error   && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4"><AlertTriangle className="w-4 h-4 text-red-400"/><p className="text-sm text-red-300 flex-1">{error}</p><button onClick={() => setError(null)} className="text-red-400/50 text-lg">&times;</button></div>}
      {success && <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4"><CheckCircle2 className="w-4 h-4 text-green-400"/><p className="text-sm text-green-300 flex-1">{success}</p><button onClick={() => setSuccess(null)} className="text-green-400/50 text-lg">&times;</button></div>}

      {/* Actions */}
      <div className="flex gap-3 mb-5">
        <button onClick={runRetainers} disabled={running}
          className="flex items-center gap-2 text-sm sabi-btn-primary px-4 py-2 disabled:opacity-50">
          {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</> : <><RefreshCw className="w-3.5 h-3.5" /> Run retainers now</>}
        </button>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh log
        </button>
      </div>

      {/* Log table */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
      ) : log.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">No scheduler activity yet. Run retainers above to test.</div>
      ) : (
        <div className="sabi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {['Brand', 'Trigger', 'Invoice', 'Status', 'Time'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {log.map(entry => {
                const [statusCls, statusIcon] = STATUS_CFG[entry.status] || STATUS_CFG.skipped;
                return (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/2">
                    <td className="px-4 py-3 text-white font-medium">{entry.brand?.name || '—'}</td>
                    <td className="px-4 py-3 text-white/40 text-xs">{TRIGGER_LABELS[entry.trigger_type] || entry.trigger_type}</td>
                    <td className="px-4 py-3">
                      {entry.invoice ? (
                        <div>
                          <span className="font-mono text-xs text-purple-400">{entry.invoice.invoice_number}</span>
                          <span className="text-xs text-white/30 ml-2">{naira(entry.invoice.total_amount)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/20">{entry.skip_reason || entry.error_msg || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusCls}`}>
                        {statusIcon} {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/30 text-xs">
                      {new Date(entry.triggered_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
