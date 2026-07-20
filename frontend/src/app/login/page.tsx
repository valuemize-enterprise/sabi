'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgencyStore } from '@/lib/store';
import { agencyAuth } from '@/lib/api';
import { ChevronRight, Eye, EyeOff, Loader2, Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated, isHydrated } = useAgencyStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (isHydrated && isAuthenticated) router.replace('/dashboard'); }, [isHydrated, isAuthenticated, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res: any = await agencyAuth.login(email, password);
      localStorage.setItem('sabi_token', res.data.token);
      setAuth(res.data.token, res.data.user);
      const LANDING: Record<string, string> = {
        super_admin: '/command',
        admin: '/command',
        md: '/command',
        hr: '/people',
      };
      const dest = res.data.user.must_reset_password ? '/set-password' : (LANDING[res.data.user.role] ?? '/dashboard');
      router.push(dest);
    } catch (err: any) { setError(err.message || 'Invalid credentials'); }
    finally { setLoading(false); }
  };

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <span className="text-2xl font-black text-purple-300">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">Sabi Intelligence Suite</h1>
          <p className="text-white/35 text-sm mt-1">Cerebre Media Africa — Internal Portal</p>
        </div>
        <div className="sabi-card p-7">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Email Address</label>
              <input type="email" className="sabi-input" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Password</label>
              <div className="relative">
                <input type={showPw?'text':'password'} className="sabi-input pr-10" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin"/>Signing in…</> : 'Sign In'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-white/5  text-center ">
            <p className="text-xs text-white/25 flex items-center justify-center gap-2">Client? <a href="/client/login" className="text-purple-400 hover:text-purple-300 flex justify-center items-center gap-1">Client Portal <ChevronRight className="w-3 h-3"/></a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
