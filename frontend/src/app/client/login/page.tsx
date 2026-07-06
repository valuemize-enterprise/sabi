'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClientStore } from '@/lib/store';
import { clientAuth } from '@/lib/api';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ClientLoginPage() {
  const router = useRouter();
  const { setClient, isAuthenticated, isHydrated } = useClientStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (isHydrated && isAuthenticated) router.replace('/client/dashboard'); }, [isHydrated, isAuthenticated, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res: any = await clientAuth.login(email, password);
      localStorage.setItem('sabi_client_token', res.data.token);
      setClient(res.data.token, res.data.client);
      router.push(res.data.client.must_reset_password ? '/client/set-password' : '/client/dashboard');
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
          <h1 className="text-xl font-bold text-white">Client Portal</h1>
          <p className="text-white/35 text-sm mt-1">Your brand intelligence dashboard</p>
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
                <button type="button" onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading?<><Loader2 className="w-4 h-4 animate-spin"/>Signing in…</>:'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs text-white/20 mt-5">Need access? Contact your Cerebre account team.</p>
        </div>
      </div>
    </div>
  );
}
