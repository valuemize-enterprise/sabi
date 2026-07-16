'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { brands as brandsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage } from '@/components/ui';

export default function BrandSettingsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const router = useRouter();
  const [brand, setBrand]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [form, setForm]       = useState<any>({});

  useEffect(() => {
    brandsApi.get(brandId).then((r: any) => { setBrand(r.data.brand); setForm(r.data.brand); }).finally(() => setLoading(false));
  }, [brandId]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setSaved(false);
    try { await brandsApi.update(brandId, form); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    catch {} finally { setSaving(false); }
  };

  const deleteBrand = async () => {
    if (!confirm(`Permanently delete "${brand?.name}"? This cannot be undone.`)) return;
    await brandsApi.delete(brandId);
    toast.success(`"${brand?.name}" has been permanently deleted.`);
    router.push('/dashboard');
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <AgencyTopNav />
      <button
  type="button"
  onClick={() => router.back()}
  className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"
>
  <ArrowLeft className="w-3.5 h-3.5" /> Back
</button>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-purple-400" />
        </div>
        <div><h1 className="text-xl font-bold text-white">{brand?.name} — Settings</h1><p className="text-sm text-white/40">Edit brand configuration</p></div>
      </div>

      {saved && <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-400 text-sm mb-6">✓ Changes saved successfully</div>}

      <form onSubmit={save} className="space-y-5">
        <div className="sabi-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white/60">Brand Details</h2>
          {[['name','Brand Name'],['industry','Industry'],['website','Website'],['description','Description']].map(([k,l]) => (
            <div key={k}>
              <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
              {k === 'description' ? (
                <textarea className="sabi-input resize-none" rows={3} value={form[k]??''} onChange={e => set(k, e.target.value)} />
              ) : <input className="sabi-input" value={form[k]??''} onChange={e => set(k, e.target.value)} />}
            </div>
          ))}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Status</label>
            <select className="sabi-input" value={form.status??'active'} onChange={e => set('status', e.target.value)}>
              <option className='bg-black' value="active">Active</option>
              <option className='bg-black' value="inactive">Inactive</option>
              <option className='bg-black' value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        <button type="submit" disabled={saving} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : 'Save Changes'}
        </button>
      </form>

      <div className="mt-8 sabi-card p-6 border-red-500/20">
        <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-red-400" /><h3 className="text-sm font-semibold text-red-400">Danger Zone</h3></div>
        <p className="text-sm text-white/40 mb-4">Deleting this brand removes all associated reports, goals, tasks, and client accounts. This cannot be undone.</p>
        <button onClick={deleteBrand} className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all">
          <Trash2 className="w-4 h-4" /> Delete Brand
        </button>
      </div>
    </div>
  );
}
