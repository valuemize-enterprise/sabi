'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Check, AlertTriangle, X } from 'lucide-react';
import { staff as staffApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';

const ROLES = [
  'ceo','managing_director','account_director','account_manager',
  'senior_strategist','strategist','copywriter','social_media_manager',
  'analytics_specialist','creative_lead',
];

function CredentialCard({ result, onDone }: { result: any; onDone: () => void }) {
  const [copied, setCopied] = useState('');
  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-6 h-6 text-green-400" />
      </div>
      <h3 className="font-bold text-white mb-0.5">Account created!</h3>
      <p className="text-sm text-white/40 mb-4">{result.user?.full_name}</p>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-5 text-left">
        <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Share these credentials securely
        </p>
        {[
          ['Email', result.user?.email],
          ['Temp Password', result.temp_password],
          ['Portal URL', `${process.env.NEXT_PUBLIC_APP_URL || ''}/login`],
        ].map(([label, val]) => (
          <div key={label} className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/30">{label}</p>
              <p className="text-sm font-mono text-white truncate">{val}</p>
            </div>
            <button onClick={() => copy(val as string, label as string)}
              className="text-white/30 hover:text-white transition-colors flex-shrink-0">
              {copied === label ? <Check className="w-4 h-4 text-green-400" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
      <button onClick={onDone}
        className="w-full py-2.5 text-sm bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-all">
        Done — Back to Staff
      </button>
    </div>
  );
}

export default function NewStaffPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', full_name: '', role: '', department: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.full_name || !form.role) { setError('Email, full name, and role are required'); return; }
    setSaving(true); setError('');
    try {
      const res: any = await staffApi.create(form);
      setResult(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to create staff account');
    } finally { setSaving(false); }
  };

  if (result) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <AgencyTopNav title="Staff" subtitle="New member" />
        <div className="sabi-card p-6">
          <CredentialCard result={result} onDone={() => router.push('/internal/staff')} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <AgencyTopNav title="Staff" subtitle="New member" />
      <Link href="/internal/staff" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" />Back to Staff
      </Link>

      <div className="sabi-card p-6">
        <h1 className="text-lg font-bold text-white mb-1">Add Staff Member</h1>
        <p className="text-sm text-white/40 mb-6">Create a new agency staff account. A temporary password will be generated.</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-5">
            <X className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            ['email', 'Email Address *', 'email'],
            ['full_name', 'Full Name *', 'text'],
            ['department', 'Department', 'text'],
          ].map(([k, l, t]) => (
            <div key={k}>
              <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
              <input type={t} className="sabi-input" required={(l as string).includes('*')}
                value={(form as any)[k]}
                onChange={e => setField(k, e.target.value)} />
            </div>
          ))}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Role *</label>
            <select className="sabi-input" required value={form.role}
              onChange={e => setField('role', e.target.value)}>
              <option className='bg-black' value="">Select role…</option>
              {ROLES.map(r => <option key={r} className='bg-black' value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm sabi-btn-primary disabled:opacity-50">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create Staff Account'}
            </button>
            <button type="button" onClick={() => router.push('/internal/staff')}
              className="px-4 py-2.5 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
