'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAgencyStore } from '@/lib/store';
import { agencyAuth } from '@/lib/api';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function AgencyLoginPage() {
  const router  = useRouter();
  const { setAuth, isAuthenticated, isHydrated } = useAgencyStore();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (isHydrated && isAuthenticated) router.replace('/agency/dashboard');
  }, [isHydrated, isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Enter your email and password'); return; }
    setLoading(true); setError('');
    try {
      const res: any = await agencyAuth.login(email, password);
      // BUG-001 FIX: write to correct key
      localStorage.setItem('sabi_token', res.data.token);
      setAuth(res.data.token, res.data.user);
      router.push(res.data.user.must_reset_password ? '/set-password' : '/agency/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  };

  if (!isHydrated) return null;

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <span className="text-2xl font-black sabi-gradient-text">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Sabi Intelligence Suite</h1>
          <p className="text-white/40 text-sm mt-1">A product of Cerebre Media Africa</p>
        </div>

        {/* Card */}
        <div className="sabi-card p-8">
          <h2 className="text-white font-semibold text-lg mb-1">Agency Portal</h2>
          <p className="text-white/40 text-sm mb-6">Sign in with your Cerebre staff credentials</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Email Address</label>
              <input
                type="email" autoComplete="email"
                className="sabi-input" placeholder="you@cerebre.media"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="sabi-input pr-10" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="sabi-btn-primary w-full flex items-center justify-center gap-2 mt-2 py-3">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 text-center">
            <p className="text-xs text-white/30">Client?{' '}
              <a href="/client/login" className="text-purple-400 hover:text-purple-300 transition-colors">Access Client Portal →</a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          © {new Date().getFullYear()} Cerebre Media Africa. All rights reserved.
        </p>
      </div>
    </div>
  );
}
