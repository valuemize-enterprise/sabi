'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Check, Edit3, Plus, X,
  TrendingUp, AlertCircle, FileText, Calendar, Lock
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

const STATUS_META: Record<string,{label:string;color:string}> = {
  expected: { label:'Expected', color:'gray'  },
  invoiced: { label:'Invoiced', color:'blue'  },
  paid:     { label:'Paid',     color:'green' },
  overdue:  { label:'Overdue',  color:'red'   },
  cancelled:{ label:'Cancelled',color:'gray'  },
};

const fmt = (n: number) => `₦${Number(n||0).toLocaleString('en-NG')}`;

export default function BrandFinancialsPage() {
  const { id: brandId } = useParams<{ id: string }>();

  const [financials, setFinancials] = useState<any>(null);
  const [invoices, setInvoices]     = useState<any[]>([]);
  const [paidHistory, setPaidHistory] = useState<any[]>([]);
  const [canEdit, setCanEdit]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [editingScope, setEditingScope] = useState(false);
  const [scopeForm, setScopeForm]   = useState({ retainer_amount:'', billing_cycle:'monthly', billing_day:'1', retainer_scope:'', scope_agreed_date:'' });
  const [saving, setSaving]         = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ invoice_type:'retainer', amount:'', due_date:'', reference:'' });
  const [error, setError]           = useState('');

  const load = () => {
    api(`/api/agency/brands/${brandId}/financials`).then((r: any) => {
      setFinancials(r.data?.financials ?? null);
      setInvoices(r.data?.invoices ?? []);
      setPaidHistory(r.data?.paidHistory ?? []);
      setCanEdit(!!r.data?.canEdit);
      if (r.data?.financials) {
        setScopeForm({
          retainer_amount: String(r.data.financials.retainer_amount ?? ''),
          billing_cycle: r.data.financials.billing_cycle ?? 'monthly',
          billing_day: String(r.data.financials.billing_day ?? '1'),
          retainer_scope: r.data.financials.retainer_scope ?? '',
          scope_agreed_date: r.data.financials.scope_agreed_date ?? '',
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, [brandId]);

  const saveScope = async () => {
    const amt = Number(scopeForm.retainer_amount);
    if (!scopeForm.retainer_amount || isNaN(amt) || amt <= 0) { setError('Retainer amount must be a positive number'); return; }
    const day = Number(scopeForm.billing_day);
    if (isNaN(day) || day < 1 || day > 28) { setError('Billing day must be between 1 and 28'); return; }
    if (!scopeForm.retainer_scope.trim() || scopeForm.retainer_scope.trim().length < 10) { setError('Documented scope is required (at least 10 characters)'); return; }
    setSaving(true); setError('');
    try {
      await api(`/api/agency/brands/${brandId}/financials`, { method:'PATCH', body:JSON.stringify(scopeForm) });
      setEditingScope(false);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const createInvoice = async () => {
    const amt = Number(invoiceForm.amount);
    if (!invoiceForm.amount || isNaN(amt) || amt <= 0) { setError('Amount must be a positive number'); return; }
    if (!invoiceForm.due_date) { setError('Due date is required'); return; }
    if (invoiceForm.due_date < new Date().toISOString().slice(0,10)) { setError('Due date cannot be in the past'); return; }
    setSaving(true); setError('');
    try {
      await api(`/api/agency/brands/${brandId}/financials/invoices`, { method:'POST', body:JSON.stringify(invoiceForm) });
      setShowInvoiceForm(false);
      setInvoiceForm({ invoice_type:'retainer', amount:'', due_date:'', reference:'' });
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      await api(`/api/agency/financials/invoices/${invoiceId}`, { method:'PATCH', body:JSON.stringify({ status }) });
      load();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) return <LoadingPage label="Loading financials…"/>;

  const totalPaid = paidHistory.reduce((s,p)=>s+Number(p.amount),0);
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const expectedInvoices = invoices.filter(i => i.status === 'expected' || i.status === 'invoiced');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Financials" breadcrumb={[{label:'Brands',href:'/brands'},{label:'Brand',href:`/brands/${brandId}`}]}/>
      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Financials</h1>
          <p className="text-sm text-white/40 mt-0.5">Retainer, scope, and invoice history</p>
        </div>
        {!canEdit && (
          <span className="flex items-center gap-1.5 text-xs text-white/30 border border-white/10 rounded-lg px-3 py-1.5">
            <Lock className="w-3 h-3"/> View only
          </span>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="sabi-card p-4">
          <p className="text-xs text-white/30 mb-1">Monthly Retainer</p>
          <p className="text-xl font-black text-white">{fmt(financials?.retainer_amount ?? 0)}</p>
        </div>
        <div className="sabi-card p-4">
          <p className="text-xs text-white/30 mb-1">Paid (Last 6mo)</p>
          <p className="text-xl font-black text-green-400">{fmt(totalPaid)}</p>
        </div>
        <div className={`sabi-card p-4 ${overdueInvoices.length > 0 ? 'border-red-500/25' : ''}`}>
          <p className="text-xs text-white/30 mb-1">Overdue</p>
          <p className={`text-xl font-black ${overdueInvoices.length > 0 ? 'text-red-400' : 'text-white/30'}`}>{overdueInvoices.length}</p>
        </div>
      </div>

      {/* Retainer & Scope */}
      <div className="sabi-card p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Retainer & Documented Scope</h2>
          {canEdit && !editingScope && (
            <button onClick={() => setEditingScope(true)} className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors">
              <Edit3 className="w-3.5 h-3.5"/> Edit
            </button>
          )}
        </div>

        {editingScope ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Retainer Amount (₦)</label>
                <input type="number" className="sabi-input text-sm" value={scopeForm.retainer_amount}
                  onChange={e => setScopeForm(p=>({...p,retainer_amount:e.target.value}))}/>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Billing Cycle</label>
                <select className="sabi-input text-sm" value={scopeForm.billing_cycle}
                  onChange={e => setScopeForm(p=>({...p,billing_cycle:e.target.value}))}>
                  <option className='bg-black' value="monthly">Monthly</option>
                  <option className='bg-black' value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Billing Day</label>
                <input type="number" min="1" max="28" className="sabi-input text-sm" value={scopeForm.billing_day}
                  onChange={e => setScopeForm(p=>({...p,billing_day:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">
                Documented Retainer Scope <span className="text-amber-400/70">— what's included in BAU</span>
              </label>
              <textarea className="sabi-input resize-none" rows={5}
                placeholder="e.g. 20 social media posts/month across Instagram & Facebook, community management, monthly performance report, up to 2 rounds of design revisions per post..."
                value={scopeForm.retainer_scope} onChange={e => setScopeForm(p=>({...p,retainer_scope:e.target.value}))}/>
              <p className="text-xs text-amber-400/60 mt-1.5">
                ⚠️ This scope is what admins reference when classifying briefs as Retainer vs New Project. Keep it accurate and current.
              </p>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Scope Agreed Date</label>
              <input type="date" className="sabi-input text-sm w-48" value={scopeForm.scope_agreed_date}
                onChange={e => setScopeForm(p=>({...p,scope_agreed_date:e.target.value}))}/>
            </div>
            <div className="flex gap-2">
              <button onClick={saveScope} disabled={saving} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} Save
              </button>
              <button onClick={() => setEditingScope(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div>
            {financials?.retainer_scope ? (
              <>
                <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{financials.retainer_scope}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
                  <span>{financials.billing_cycle === 'monthly' ? 'Billed monthly' : 'Billed quarterly'} on day {financials.billing_day}</span>
                  {financials.scope_agreed_date && <span>Agreed {financials.scope_agreed_date}</span>}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/25 italic">
                No scope documented yet. {canEdit ? 'Add one so brief classification decisions are consistent.' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Overdue alert */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-start gap-3 p-4 mb-5 rounded-xl bg-red-500/8 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-medium text-white">{overdueInvoices.length} overdue invoice{overdueInvoices.length!==1?'s':''}</p>
            <p className="text-xs text-white/40 mt-0.5">Total: {fmt(overdueInvoices.reduce((s,i)=>s+Number(i.amount),0))}</p>
          </div>
        </div>
      )}

      {/* Invoices */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Invoices</h2>
        {canEdit && (
          <button onClick={() => setShowInvoiceForm(true)} className="flex items-center gap-1.5 text-xs text-purple-400 border border-purple-500/20 rounded-lg px-3 py-1.5 hover:bg-purple-500/8 transition-all">
            <Plus className="w-3.5 h-3.5"/> Add Invoice
          </button>
        )}
      </div>

      {showInvoiceForm && (
        <div className="sabi-card p-5 mb-4 border-purple-500/20">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Type</label>
              <select className="sabi-input text-sm" value={invoiceForm.invoice_type} onChange={e=>setInvoiceForm(p=>({...p,invoice_type:e.target.value}))}>
                <option className='bg-black' value="retainer">Retainer</option>
                <option className='bg-black' value="project">Project</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Amount (₦)</label>
              <input type="number" className="sabi-input text-sm" value={invoiceForm.amount} onChange={e=>setInvoiceForm(p=>({...p,amount:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Due Date</label>
              <input type="date" className="sabi-input text-sm" value={invoiceForm.due_date} onChange={e=>setInvoiceForm(p=>({...p,due_date:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Reference</label>
              <input className="sabi-input text-sm" placeholder="Invoice #" value={invoiceForm.reference} onChange={e=>setInvoiceForm(p=>({...p,reference:e.target.value}))}/>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createInvoice} disabled={saving} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>} Create
            </button>
            <button onClick={() => setShowInvoiceForm(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Invoices appear here once created manually or generated from approved project briefs."/>
      ) : (
        <div className="sabi-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Type','Amount','Due Date','Reference','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-white/30 font-medium uppercase tracking-wider first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv,i) => {
                const sm = STATUS_META[inv.status] ?? STATUS_META.expected;
                return (
                  <tr key={inv.id} className={`border-b border-white/3 ${i%2===0?'':'bg-white/1'}`}>
                    <td className="px-4 py-3 pl-5 text-sm text-white/70 capitalize">{inv.invoice_type}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{fmt(inv.amount)}</td>
                    <td className="px-4 py-3 text-xs text-white/40">{inv.due_date}</td>
                    <td className="px-4 py-3 text-xs text-white/30">{inv.reference || '—'}</td>
                    <td className="px-4 py-3 pr-5">
                      {canEdit ? (
                        <select value={inv.status} onChange={e => updateInvoiceStatus(inv.id, e.target.value)}
                          className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/60 cursor-pointer">
                          {Object.entries(STATUS_META).map(([v,m]) => <option className='bg-black' key={v} value={v}>{m.label}</option>)}
                        </select>
                      ) : (
                        <Badge label={sm.label} color={sm.color}/>
                      )}
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
