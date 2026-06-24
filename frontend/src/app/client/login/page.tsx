'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClientStore } from '@/lib/store';
import { clientAuth } from '@/lib/api';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ClientLoginPage() {
  const router  = useRouter();
  const { setClient, isAuthenticated, isHydrated } = useClientStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (isHydrated && isAuthenticated) router.replace('/client/dashboard');
  }, [isHydrated, isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res: any = await clientAuth.login(email, password);
      // BUG-007 FIX: client uses sabi_client_token (not sabi_token)
      localStorage.setItem('sabi_client_token', res.data.token);
      localStorage.setItem('sabi_client_info', JSON.stringify(res.data.client));
      setClient(res.data.token, res.data.client);
      router.push(res.data.client.must_reset_password ? '/client/set-password' : '/client/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <span className="text-2xl font-black sabi-gradient-text">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Sabi Intelligence Suite</h1>
          <p className="text-white/40 text-sm mt-1">Client Portal</p>
        </div>
        <div className="sabi-card p-8">
          <h2 className="text-white font-semibold text-lg mb-1">Welcome back</h2>
          <p className="text-white/40 text-sm mb-6">Sign in to view your brand intelligence</p>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Email Address</label>
              <input type="email" className="sabi-input" placeholder="you@yourbrand.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="sabi-input pr-10" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs text-white/30 mt-6">Agency staff? <a href="/login" className="text-purple-400 hover:text-purple-300">Agency Portal →</a></p>
        </div>
      </div>
    </div>
  );
}
