'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSuperAdminStore } from '@/lib/store';
import { superAdminAuth } from '@/lib/api';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { setAdmin, isAuthenticated, isHydrated } = useSuperAdminStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (isHydrated && isAuthenticated) router.replace('/super-admin/dashboard');
  }, [isHydrated, isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res: any = await superAdminAuth.login(email, password);
      // BUG-008 FIX: Super Admin uses sabi_sa_token (isolated from agency)
      localStorage.setItem('sabi_sa_token', res.data.token);
      setAdmin(res.data.token, res.data.admin);
      router.push('/super-admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Access denied');
    } finally { setLoading(false); }
  };

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-600/15 border border-red-500/20 mb-4">
            <ShieldCheck className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Super Admin Access</h1>
          <p className="text-white/30 text-xs mt-1">Restricted — Cerebre Media Africa</p>
        </div>
        <div className="sabi-card p-7">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Email</label>
              <input type="email" className="sabi-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="sabi-input pr-10" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 hover:bg-red-600/30 transition-colors disabled:opacity-50">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
