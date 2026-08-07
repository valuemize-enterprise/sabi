'use client';

/**
 * /finance/page.tsx — Finance Overview
 * Sabi Intelligence Suite · Accountant view
 *
 * Accessible by: accountant, super_admin, admin, md
 *
 * Shows:
 *  - 4 summary stat cards (outstanding, received MTD, overdue count, drafts)
 *  - Filter tabs: All | Draft | Sent | Overdue | Paid
 *  - Invoice list with create + send + record payment actions
 *  - Create invoice slide-over drawer (dynamic line items, VAT, live totals)
 *  - Record payment modal
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Send, CheckCircle2, AlertTriangle,
  FileText, Loader2, X, Trash2, RefreshCw, Download,
  DollarSign, Clock, TrendingDown, NotepadText, Wallet, BarChart3,
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { LoadingPage, Badge } from '@/components/ui';
import { AgencyTopNav } from '@/components/internal/TopNav';


// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem { description: string; quantity: string; unit_price: string; }
interface Brand    { id: string; name: string; }
interface Invoice  { id: string; invoice_number: string; brand?: { name: string }; type: string; status: string; total_amount: number; amount_paid: number; due_date: string; issued_date: string; }
interface Summary  { outstanding: number; received_mtd: number; overdue_count: number; drafts_count: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const API  = process.env.NEXT_PUBLIC_API_URL || '';
const tok  = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

async function apiFetch(path: string, init?: RequestInit) {
  const res  = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
  return body;
}

const fmtNGN = (n: number) => {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `₦${Math.round(n / 1_000)}K`;
  return `₦${Number(n).toLocaleString()}`;
};

const STATUS_COLOR: Record<string, string> = {
  draft:     'gray',
  sent:      'blue',
  partial:   'amber',
  paid:      'green',
  overdue:   'red',
  cancelled: 'gray',
};

// ── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ invoice, onClose, onRecorded }: {
  invoice: Invoice; onClose: () => void; onRecorded: () => void;
}) {
  const balance = invoice.total_amount - invoice.amount_paid;
  const [form, setForm] = useState({ amount: String(balance.toFixed(2)), payment_date: new Date().toISOString().slice(0, 10), payment_method: 'bank_transfer', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Enter a valid payment amount'); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/finance/invoices/${invoice.id}/payments`, { method: 'POST', body: JSON.stringify(form) });
      onRecorded();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="sabi-card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white">Record payment</p>
            <p className="text-xs text-white/40 mt-0.5">{invoice.invoice_number} · Balance: {fmtNGN(balance)}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Amount (₦)</label>
            <input type="number" className="sabi-input text-sm w-full" value={form.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Date</label>
            <input type="date" className="sabi-input text-sm w-full" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Method</label>
            <select className="sabi-input text-sm w-full" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
              <option className="bg-black" value="bank_transfer">Bank transfer</option>
              <option className="bg-black" value="cheque">Cheque</option>
              <option className="bg-black" value="cash">Cash</option>
              <option className="bg-black" value="card">Card / POS</option>
              <option className="bg-black" value="other">Other</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Reference (optional)</label>
            <input className="sabi-input text-sm w-full" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="e.g. Bank transfer ref or cheque number" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Notes (optional)</label>
            <input className="sabi-input text-sm w-full" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="text-xs text-white/30 hover:text-white transition-colors px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={saving} className="sabi-btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {saving ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Invoice Drawer ─────────────────────────────────────────────────────

function CreateInvoiceDrawer({ brands, onClose, onCreated }: {
  brands: Brand[]; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({ brand_id: brands[0]?.id || '', type: 'retainer', payment_terms: 'net_30', vat_rate: '0', notes: '' });
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: '1', unit_price: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const addItem  = () => setItems(p => [...p, { description: '', quantity: '1', unit_price: '' }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem  = (i: number, k: keyof LineItem, v: string) =>
    setItems(p => p.map((row, idx) => idx === i ? { ...row, [k]: v } : row));

  const subtotal    = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const vatAmt      = subtotal * (parseFloat(form.vat_rate) || 0);
  const total       = subtotal + vatAmt;

  const submit = async () => {
    if (!form.brand_id) { setError('Select a brand'); return; }
    if (items.some(i => !i.description || !i.unit_price)) { setError('All line items need a description and price'); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch('/api/finance/invoices', {
        method: 'POST',
        body: JSON.stringify({ ...form, vat_rate: parseFloat(form.vat_rate) || 0, line_items: items }),
      });
      onCreated();
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg h-full bg-[#0d0d1a] border-l border-white/10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="font-bold text-white">Create invoice</p>
            <p className="text-xs text-white/40">Draft is saved — send separately when ready</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Brand *</label>
              <select className="sabi-input text-sm w-full" value={form.brand_id} onChange={e => set('brand_id', e.target.value)}>
                {brands.map(b => <option key={b.id} value={b.id} className="bg-black">{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Type</label>
              <select className="sabi-input text-sm w-full" value={form.type} onChange={e => set('type', e.target.value)}>
                <option className="bg-black" value="retainer">Retainer</option>
                <option className="bg-black" value="project">Project</option>
                <option className="bg-black" value="adhoc">Ad hoc</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Payment terms</label>
              <select className="sabi-input text-sm w-full" value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
                <option className="bg-black" value="net_7">Net 7</option>
                <option className="bg-black" value="net_14">Net 14</option>
                <option className="bg-black" value="net_30">Net 30</option>
                <option className="bg-black" value="net_60">Net 60</option>
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Line items *</label>
              <button onClick={addItem} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add line</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_64px_88px_24px] gap-2 items-start">
                  <input className="sabi-input text-xs" placeholder="Description" value={item.description} onChange={e => setItem(i, 'description', e.target.value)} />
                  <input type="number" className="sabi-input text-xs text-center" placeholder="Qty" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                  <input type="number" className="sabi-input text-xs" placeholder="Unit price" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} />
                  <button onClick={() => removeItem(i)} disabled={items.length === 1} className="text-white/20 hover:text-red-400 disabled:opacity-30 mt-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="sabi-card p-3 space-y-1.5">
            <div className="flex justify-between text-xs text-white/40"><span>Subtotal</span><span>{fmtNGN(subtotal)}</span></div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-white/40">VAT</span>
                <select className="bg-transparent border-none text-white/40 text-xs focus:outline-none cursor-pointer" value={form.vat_rate} onChange={e => set('vat_rate', e.target.value)}>
                  <option className="bg-black" value="0">0%</option>
                  <option className="bg-black" value="0.075">7.5%</option>
                </select>
              </div>
              <span className="text-white/40">{fmtNGN(vatAmt)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-1.5"><span>Total</span><span>{fmtNGN(total)}</span></div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Notes (optional)</label>
            <textarea className="sabi-input text-xs w-full" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Payment instructions, bank details, etc." />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex gap-3">
          <button onClick={onClose} className="text-xs text-white/30 hover:text-white px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={saving} className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {saving ? 'Creating…' : 'Save as draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, userRole, onSend, onPay, onRefresh }: {
  invoice: Invoice; userRole: string;
  onSend: () => void; onPay: () => void; onRefresh: () => void;
}) {
  const [acting, setActing] = useState(false);
  const balance = invoice.total_amount - invoice.amount_paid;
  const isFinance = ['accountant','super_admin','admin','md'].includes(userRole);

  const handleSend = async () => {
    if (!confirm('Mark this invoice as sent?')) return;
    setActing(true);
    try { await apiFetch(`/api/finance/invoices/${invoice.id}/send`, { method: 'POST' }); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setActing(false); }
  };

  const downloadPDF = async () => {
    setActing(true);
    try {
      const res  = await fetch(`${API}/api/finance/invoices/${invoice.id}/pdf`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) { alert(e.message); }
    finally { setActing(false); }
  };

  return (
    <div className="sabi-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="font-semibold text-white text-sm">{invoice.invoice_number}</p>
          <Badge label={invoice.status} color={STATUS_COLOR[invoice.status] ?? 'gray'} />
          <span className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5 capitalize">{invoice.type}</span>
        </div>
        <p className="text-xs text-white/40">
          {invoice.brand?.name || '—'} · Due {invoice.due_date}
          {invoice.status === 'overdue' && <span className="text-red-400 ml-2">Overdue</span>}
        </p>
      </div>
      <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
        <div className="text-right">
          <p className="font-bold text-white text-sm">{fmtNGN(invoice.total_amount)}</p>
          {balance > 0 && balance < invoice.total_amount && (
            <p className="text-xs text-amber-400">{fmtNGN(balance)} outstanding</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadPDF} disabled={acting} title="Download PDF" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white border border-white/10 rounded-lg px-2 py-1.5">
            {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
          </button>
          {isFinance && invoice.status === 'draft' && (
            <button onClick={handleSend} disabled={acting} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded-lg px-2 py-1.5">
              {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send
            </button>
          )}
          {isFinance && ['sent','overdue','partial'].includes(invoice.status) && (
            <button onClick={onPay} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 border border-green-500/20 rounded-lg px-2 py-1.5">
              <CheckCircle2 className="w-3 h-3" /> Record payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'draft' | 'sent' | 'overdue' | 'paid';

export default function FinancePage() {
  const router              = useRouter();
  const { user }            = useAgencyStore();
  const [summary,   setSummary]   = useState<Summary | null>(null);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [brands,    setBrands]    = useState<Brand[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<StatusFilter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget,  setPayTarget]  = useState<Invoice | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sumRes, invRes, brRes] = await Promise.all([
        apiFetch('/api/finance/summary'),
        apiFetch('/api/finance/invoices?limit=100'),
        apiFetch('/api/agency/brands?limit=100'),
      ]);
      setSummary(sumRes.summary);
      setInvoices(invRes.invoices || []);
      setBrands(brRes.data?.brands || brRes.brands || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = invoices.filter(inv => filter === 'all' || inv.status === filter);

  const STATS = summary ? [
    { label: 'Outstanding',   value: fmtNGN(summary.outstanding),  icon: DollarSign,  color: 'text-white' },
    { label: 'Received MTD',  value: fmtNGN(summary.received_mtd), icon: TrendingDown, color: 'text-green-400' },
    { label: 'Overdue',       value: summary.overdue_count,         icon: AlertTriangle, color: summary.overdue_count > 0 ? 'text-red-400' : 'text-white' },
    { label: 'Drafts',        value: summary.drafts_count,          icon: NotepadText,  color: 'text-white/40' },
  ] : [];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <AgencyTopNav />
      <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Finance</h1>
          <p className="text-sm text-white/40 mt-0.5">Invoice management and payment tracking</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="sabi-btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Create invoice
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={load} className="text-xs text-white/40 hover:text-white flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Retry</button>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-2 flex-wrap mb-6">
        <Link href="/finance/expenses" className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-colors">
          <Wallet className="w-3.5 h-3.5" /> Expenses
        </Link>
        <Link href="/finance/pnl" className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-colors">
          <BarChart3 className="w-3.5 h-3.5" /> Reports · P&L + VAT
        </Link>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {STATS.map(s => (
            <div key={s.label} className="sabi-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4 text-white/30" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{s.label}</span>
              </div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {(['all','draft','sent','overdue','paid'] as StatusFilter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f ? 'bg-purple-600 border-purple-600 text-white' : 'border-white/10 text-white/40 hover:text-white'
            }`}>
            {f} {f !== 'all' && <span className="opacity-60">{invoices.filter(i => i.status === f).length}</span>}
          </button>
        ))}
        <span className="ml-auto text-xs text-white/20 self-center">{visible.length} invoice{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {loading ? <LoadingPage /> : (
        <div className="space-y-3">
          {visible.length === 0 ? (
            <div className="sabi-card p-10 text-center">
              <FileText className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-sm text-white/40">No invoices {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
              {filter === 'all' && <button onClick={() => setShowCreate(true)} className="mt-4 text-xs text-purple-400 hover:text-purple-300">Create first invoice →</button>}
            </div>
          ) : visible.map(inv => (
            <InvoiceRow key={inv.id} invoice={inv} userRole={user?.role || ''}
              onSend={() => load()} onPay={() => setPayTarget(inv)} onRefresh={load} />
          ))}
        </div>
      )}

      {showCreate && brands.length > 0 && (
        <CreateInvoiceDrawer brands={brands} onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {payTarget && (
        <RecordPaymentModal invoice={payTarget} onClose={() => setPayTarget(null)} onRecorded={load} />
      )}
    </div>
  );
}
