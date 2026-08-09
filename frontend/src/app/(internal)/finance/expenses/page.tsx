'use client';
/**
 * /finance/expenses/page.tsx — Expense Tracker
 * Record agency overhead and brand-specific costs.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, AlertTriangle, Receipt } from 'lucide-react';
import { useAgencyStore } from '@/lib/store';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
async function apiFetch(path: string, init?: RequestInit) {
  const res  = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}`, ...(init?.headers||{}) }, cache: 'no-store' });
  const body = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

const naira = (n: number) => `₦${Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:0})}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'2-digit'});

const CATEGORIES = ['software','rent','contractor','ad_spend','travel','salaries','utilities','equipment','marketing','legal','other'];

const CAT_COLORS: Record<string, string> = {
  software:'bg-blue-500/10 text-blue-400', rent:'bg-amber-500/10 text-amber-400',
  contractor:'bg-purple-500/10 text-purple-400', ad_spend:'bg-pink-500/10 text-pink-400',
  travel:'bg-teal-500/10 text-teal-400', salaries:'bg-green-500/10 text-green-400',
  utilities:'bg-gray-500/10 text-gray-400', equipment:'bg-orange-500/10 text-orange-400',
  marketing:'bg-red-500/10 text-red-400', legal:'bg-indigo-500/10 text-indigo-400',
  other:'bg-white/5 text-white/40',
};

interface Expense {
  id: string; brand_id: string | null; category: string; description: string;
  amount: number; date: string; billable_to_client: boolean; notes: string | null;
  brand?: { name: string } | null; recorder?: { full_name: string } | null;
}

interface Brand { id: string; name: string }

const FINANCE_ROLES = new Set(['super_admin','admin','md','accountant']);

export default function ExpensesPage() {
  const router = useRouter();
  const { user } = useAgencyStore();
  const [expenses,  setExpenses]  = useState<Expense[]>([]);
  const [brands,    setBrands]    = useState<Brand[]>([]);
  const [summary,   setSummary]   = useState<Record<string,number>>({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string|null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editTarget,setEditTarget]= useState<Expense|null>(null);
  const [filters,   setFilters]   = useState({ brand_id:'', category:'', overhead_only:'' });
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({ brand_id:'', category:'', description:'', amount:'', date:today, billable_to_client:false, notes:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user && !FINANCE_ROLES.has(user.role)) router.replace('/dashboard'); }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
      const [expRes, brandRes, sumRes] = await Promise.all([
        apiFetch(`/api/finance/expenses?${params}&limit=60`),
        apiFetch('/api/finance/brands'),
        apiFetch('/api/finance/expenses/summary'),
      ]);
      setExpenses(expRes.expenses||[]);
      setBrands(brandRes.data?.brands||[]);
      setSummary(sumRes.summary?.by_category||{});
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ brand_id:'', category:'', description:'', amount:'', date:today, billable_to_client:false, notes:'' }); setEditTarget(null); setShowForm(true); };
  const openEdit = (e: Expense) => { setForm({ brand_id:e.brand_id||'', category:e.category, description:e.description, amount:String(e.amount), date:e.date, billable_to_client:e.billable_to_client, notes:e.notes||'' }); setEditTarget(e); setShowForm(true); };

  const save = async () => {
    if (!form.category || !form.description || !form.amount) return setError('Category, description and amount are required');
    setSaving(true); setError(null);
    try {
      const body = { ...form, brand_id: form.brand_id||null, amount: parseFloat(form.amount) };
      if (editTarget) {
        const res = await apiFetch(`/api/finance/expenses/${editTarget.id}`, { method:'PUT', body:JSON.stringify(body) });
        setExpenses(p => p.map(e => e.id===editTarget.id ? res.expense : e));
      } else {
        const res = await apiFetch('/api/finance/expenses', { method:'POST', body:JSON.stringify(body) });
        setExpenses(p => [res.expense, ...p]);
      }
      setShowForm(false); setEditTarget(null);
    } catch(e:any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await apiFetch(`/api/finance/expenses/${id}`, { method:'DELETE' });
      setExpenses(p => p.filter(e => e.id!==id));
    } catch(e:any) { setError(e.message); }
  };

  const totalShown = expenses.reduce((s,e) => s+Number(e.amount), 0);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={()=>router.back()} className="flex items-center gap-2 text-xs text-white/30 hover:text-white transition-colors"><ArrowLeft className="w-3.5 h-3.5"/>Finance</button>
        <span className="text-white/10">/</span>
        <h1 className="text-xl font-bold text-white">Expenses</h1>
        <button onClick={openNew} className="ml-auto sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm"><Plus className="w-4 h-4"/>Add expense</button>
      </div>

      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5"><AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0"/><p className="text-sm text-red-300 flex-1">{error}</p><button onClick={()=>setError(null)} className="text-red-400/50 text-lg">&times;</button></div>}

      {/* Category summary */}
      {Object.keys(summary).length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
          {Object.entries(summary).sort(([,a],[,b])=>b-a).slice(0,5).map(([cat,amt])=>(
            <div key={cat} className="sabi-card p-3 text-center">
              <p className="text-sm font-bold text-white">{naira(amt)}</p>
              <p className={`text-[10px] px-1.5 py-0.5 rounded mt-1 ${CAT_COLORS[cat]||'text-white/30'}`}>{cat.replace(/_/g,' ')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={filters.brand_id} onChange={e=>setFilters(p=>({...p,brand_id:e.target.value}))} className="sabi-input text-xs">
          <option className="bg-black" value="">All brands</option>
          {brands.map(b=><option className="bg-black" key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))} className="sabi-input text-xs">
          <option className="bg-black" value="">All categories</option>
          {CATEGORIES.map(c=><option className="bg-black" key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-white/40 sabi-card px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={filters.overhead_only==='true'} onChange={e=>setFilters(p=>({...p,overhead_only:e.target.checked?'true':''}))}/>
          Overhead only
        </label>
        <div className="ml-auto flex items-center gap-2 text-sm text-white/40">
          Showing <span className="text-white font-semibold">{naira(totalShown)}</span>
        </div>
      </div>

      {/* Table */}
      {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 text-purple-400 animate-spin"/></div>
      : expenses.length===0 ? (
        <div className="text-center py-16"><Receipt className="w-10 h-10 text-white/10 mx-auto mb-3"/><p className="text-sm text-white/30">No expenses recorded yet</p><button onClick={openNew} className="sabi-btn-primary mt-4 text-sm px-4 py-2">Add first expense</button></div>
      ) : (
        <div className="sabi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              {['Date','Description','Category','Brand','Amount','Billable',''].map(h=><th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-white/30">{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map(e=>(
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="px-4 py-3 text-white/40 text-xs font-mono">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">{e.description}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded ${CAT_COLORS[e.category]||'text-white/30'}`}>{e.category.replace(/_/g,' ')}</span></td>
                  <td className="px-4 py-3 text-white/40 text-xs">{e.brand?.name||<span className="text-white/20">Overhead</span>}</td>
                  <td className="px-4 py-3 font-semibold text-white">{naira(e.amount)}</td>
                  <td className="px-4 py-3">{e.billable_to_client?<span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">Billable</span>:'—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>openEdit(e)} className="text-white/20 hover:text-white transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>del(e.id)} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="sabi-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><p className="font-semibold text-white">{editTarget?'Edit expense':'New expense'}</p><button onClick={()=>setShowForm(false)} className="text-white/30 hover:text-white text-lg">&times;</button></div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-white/40 mb-1.5">Description *</label>
                <input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="sabi-input text-sm w-full" placeholder="e.g. Adobe Creative Cloud subscription"/>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Category *</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} className="sabi-input text-sm w-full">
                  <option className="bg-black" value="">Select…</option>
                  {CATEGORIES.map(c=><option className="bg-black" key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Amount (₦) *</label>
                <input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="sabi-input text-sm w-full" placeholder="0"/>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Date</label>
                <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="sabi-input text-sm w-full"/>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Brand (optional)</label>
                <select value={form.brand_id} onChange={e=>setForm(p=>({...p,brand_id:e.target.value}))} className="sabi-input text-sm w-full">
                  <option className="bg-black" value="">Agency overhead</option>
                  {brands.map(b=><option className="bg-black" key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs text-white/40 cursor-pointer">
                  <input type="checkbox" checked={form.billable_to_client} onChange={e=>setForm(p=>({...p,billable_to_client:e.target.checked}))}/>
                  Billable to client (can be recharged on future invoice)
                </label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setShowForm(false)} className="text-xs text-white/30 hover:text-white px-4 py-2">Cancel</button>
              <button onClick={save} disabled={saving} className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                {saving?<><Loader2 className="w-3.5 h-3.5 animate-spin"/>Saving…</>:<>{editTarget?'Save changes':'Add expense'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
