'use client';

/**
 * /brands/[Id]/financials/page.tsx — Brand Financials
 * Sabi Intelligence Suite
 *
 * Accessible from the brand overview sub-pages nav (already linked via "financials" href).
 * Shows per-brand financial summary + invoice list + create + record payment.
 * Visible to: accountant, admin, md, super_admin, brand_admin (scoped to this brand).
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, FileText, CheckCircle2, AlertTriangle,
  Send, Loader2, X, Trash2, TrendingDown, DollarSign,
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { LoadingPage, Badge } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string; invoice_number: string; status: string;
  amount: number; amount_paid: number; due_date: string; issued_date: string;
  reference: string; invoice_type: string;
}
interface BrandSummary {
  state: string; overdue_amount: number; overdue_days: number;
  invoiced_mtd: number; overdue_invoices: any[];
}
interface LineItem { description: string; quantity: string; unit_price: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || '';
const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

async function apiFetch(path: string, init?: RequestInit) {
  const res  = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers || {}) }, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
  return body;
}

const fmtNGN = (n: number) => n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `₦${Math.round(n / 1_000)}K` : `₦${Number(n).toLocaleString()}`;

const STATUS_COLOR: Record<string, string> = { draft: 'gray', sent: 'blue', partial: 'amber', paid: 'green', overdue: 'red', cancelled: 'gray' };

// ── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ invoice, onClose, onRecorded }: { invoice: Invoice; onClose: () => void; onRecorded: () => void; }) {
  const balance = invoice.amount - invoice.amount_paid;
  const [form, setForm] = useState({ amount: String(balance.toFixed(2)), payment_date: new Date().toISOString().slice(0, 10), payment_method: 'bank_transfer', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const submit = async () => {
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/finance/invoices/${invoice.id}/payments`, { method: 'POST', body: JSON.stringify(form) });
      onRecorded(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="sabi-card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="font-bold text-white">Record payment</p><p className="text-xs text-white/40">{invoice.invoice_number} · Balance: {fmtNGN(balance)}</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-white/30" /></button>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Amount (₦)</label><input type="number" className="sabi-input text-sm w-full" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Date</label><input type="date" className="sabi-input text-sm w-full" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} /></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Method</label>
            <select className="sabi-input text-sm w-full" value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
              {['bank_transfer','cheque','cash','card','other'].map(m => <option key={m} className="bg-black" value={m}>{m.replace('_',' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Reference (optional)</label><input className="sabi-input text-sm w-full" value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} /></div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="text-xs text-white/30 px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={saving} className="sabi-btn-primary text-sm flex items-center gap-2">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {saving ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Invoice Drawer (scoped to brand) ───────────────────────────────────

function CreateInvoiceDrawer({ brandId, brandName, onClose, onCreated }: { brandId: string; brandName: string; onClose: () => void; onCreated: () => void; }) {
  const [form, setForm]   = useState({ type: 'retainer', payment_terms: 'net_30', vat_rate: '0', notes: '' });
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: '1', unit_price: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const addItem    = () => setItems(p => [...p, { description: '', quantity: '1', unit_price: '' }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const setItem    = (i: number, k: keyof LineItem, v: string) => setItems(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0);
  const vatAmt   = subtotal * (parseFloat(form.vat_rate) || 0);
  const total    = subtotal + vatAmt;

  const submit = async () => {
    if (items.some(i => !i.description || !i.unit_price)) { setError('All line items need a description and price'); return; }
    setSaving(true); setError(null);
    try {
      await apiFetch('/api/finance/invoices', { method: 'POST', body: JSON.stringify({ ...form, brand_id: brandId, vat_rate: parseFloat(form.vat_rate) || 0, line_items: items }) });
      onCreated(); onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg h-full bg-[#0d0d1a] border-l border-white/10 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div><p className="font-bold text-white">Create invoice</p><p className="text-xs text-white/40">{brandName}</p></div>
          <button onClick={onClose}><X className="w-5 h-5 text-white/30" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Type</label>
              <select className="sabi-input text-sm w-full" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option className="bg-black" value="retainer">Retainer</option>
                <option className="bg-black" value="project">Project</option>
                <option className="bg-black" value="adhoc">Ad hoc</option>
              </select>
            </div>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-white/30 block mb-1">Payment terms</label>
              <select className="sabi-input text-sm w-full" value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}>
                {['net_7','net_14','net_30','net_60'].map(t => <option key={t} className="bg-black" value={t}>{t.replace('_',' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/30">Line items *</label>
              <button onClick={addItem} className="text-xs text-purple-400 flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_56px_80px_20px] gap-2">
                  <input className="sabi-input text-xs" placeholder="Description" value={item.description} onChange={e => setItem(i, 'description', e.target.value)} />
                  <input type="number" className="sabi-input text-xs text-center" placeholder="Qty" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                  <input type="number" className="sabi-input text-xs" placeholder="Price" value={item.unit_price} onChange={e => setItem(i, 'unit_price', e.target.value)} />
                  <button onClick={() => removeItem(i)} disabled={items.length === 1} className="text-white/20 hover:text-red-400 disabled:opacity-30 mt-2"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="sabi-card p-3 space-y-1.5">
            <div className="flex justify-between text-xs text-white/40"><span>Subtotal</span><span>{fmtNGN(subtotal)}</span></div>
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>VAT <select className="bg-transparent text-white/40 text-xs" value={form.vat_rate} onChange={e => setForm(p => ({ ...p, vat_rate: e.target.value }))}><option className="bg-black" value="0">0%</option><option className="bg-black" value="0.075">7.5%</option></select></span>
              <span>{fmtNGN(vatAmt)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white border-t border-white/10 pt-1.5"><span>Total</span><span>{fmtNGN(total)}</span></div>
          </div>
          <textarea className="sabi-input text-xs w-full" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notes, bank details, etc." />
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex gap-3">
          <button onClick={onClose} className="text-xs text-white/30 px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={saving} className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {saving ? 'Creating…' : 'Save as draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BrandFinancialsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const router                   = useRouter();
  const { user }                 = useAgencyStore();
  const [brand,    setBrand]     = useState<any>(null);
  const [summary,  setSummary]   = useState<BrandSummary | null>(null);
  const [invoices, setInvoices]  = useState<Invoice[]>([]);
  const [loading,  setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [payTarget,  setPayTarget]  = useState<Invoice | null>(null);
  const [error,    setError]     = useState<string | null>(null);
  const [acting,   setActing]    = useState<string | null>(null);

  const isFinance = ['accountant','super_admin','admin','md'].includes(user?.role || '');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [brandRes, sumRes, invRes] = await Promise.all([
        apiFetch(`/api/agency/brands/${brandId}`),
        apiFetch(`/api/finance/brands/${brandId}/summary`),
        apiFetch(`/api/finance/invoices?brand_id=${brandId}&limit=50`),
      ]);
      setBrand(brandRes.data?.brand || brandRes.brand);
      setSummary(sumRes.data?.summary);
      setInvoices(invRes.data?.invoices || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (invoiceId: string) => {
    if (!confirm('Mark this invoice as sent to the client?')) return;
    setActing(invoiceId);
    try { await apiFetch(`/api/finance/invoices/${invoiceId}/send`, { method: 'POST' }); load(); }
    catch (e: any) { setError(e.message); }
    finally { setActing(null); }
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">{brand?.name || 'Brand'} · Financials</h1>
          <p className="text-sm text-white/40 mt-0.5">Invoices, payments, and outstanding balance</p>
        </div>
        {isFinance && (
          <button onClick={() => setShowCreate(true)} className="sabi-btn-primary p-2 flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Create invoice
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Status',        value: summary.state.toUpperCase(),         color: summary.state === 'red' ? 'text-red-400' : summary.state === 'green' ? 'text-green-400' : summary.state === 'amber' ? 'text-amber-400' : 'text-white/40' },
            { label: 'Overdue',       value: fmtNGN(summary.overdue_amount),      color: summary.overdue_amount > 0 ? 'text-red-400' : 'text-white/40' },
            { label: 'Invoiced MTD',  value: fmtNGN(summary.invoiced_mtd),        color: 'text-white' },
            { label: 'Total invoices',value: invoices.length,                     color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="sabi-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1">{s.label}</div>
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Overdue alert */}
      {summary && summary.overdue_amount > 0 && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">
            <strong>{fmtNGN(summary.overdue_amount)}</strong> overdue — {summary.overdue_days} day{summary.overdue_days !== 1 ? 's' : ''} since oldest unpaid invoice
          </p>
        </div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="sabi-card p-10 text-center">
          <FileText className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-sm text-white/40 mb-4">No invoices yet for this brand</p>
          {isFinance && <button onClick={() => setShowCreate(true)} className="sabi-btn-primary text-sm p-2">Create first invoice</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => {
            const balance = inv.amount - inv.amount_paid;
            return (
              <div key={inv.id} className="sabi-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-white text-sm">{inv.reference}</p>
                    <Badge label={inv.status} color={STATUS_COLOR[inv.status] ?? 'gray'} />
                    <span className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5 capitalize">{inv.invoice_type}</span>
                  </div>
                  <p className="text-xs text-white/40">Issued {inv.issued_date} · Due {inv.due_date}</p>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{fmtNGN(inv.amount)}</p>
                    {balance > 0 && balance < inv.amount && <p className="text-xs text-amber-400">{fmtNGN(balance)} left</p>}
                    {inv.status === 'paid' && <p className="text-xs text-green-400">Fully paid</p>}
                  </div>
                  {isFinance && (
                    <div className="flex gap-2">
                      {inv.status === 'draft' && (
                        <button onClick={() => handleSend(inv.id)} disabled={acting === inv.id} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded-lg px-2 py-1.5">
                          {acting === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Send
                        </button>
                      )}
                      {['sent','overdue','partial'].includes(inv.status) && (
                        <button onClick={() => setPayTarget(inv)} className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-500/20 rounded-lg px-2 py-1.5">
                          <CheckCircle2 className="w-3 h-3" /> Pay
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && brand && (
        <CreateInvoiceDrawer brandId={brandId} brandName={brand.name} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {payTarget && (
        <RecordPaymentModal invoice={payTarget} onClose={() => setPayTarget(null)} onRecorded={load} />
      )}
    </div>
  );
}
