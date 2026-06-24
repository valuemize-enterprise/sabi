'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAgencyStore } from '@/lib/store';
import { agencyAuth } from '@/lib/api';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';

export default function SetPasswordPage() {
  const router = useRouter();
  const { user, setAuth, token } = useAgencyStore();
  const [current, setCurrent]   = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8)    { setError('Password must be at least 8 characters'); return; }
    if (newPw !== confirm)   { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await agencyAuth.setPassword(current, newPw);
      if (user && token) setAuth(token, { ...user, must_reset_password: false });
      router.push('/agency/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/20 mb-4">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Set New Password</h1>
          <p className="text-white/40 text-sm mt-1">Your account requires a password change before continuing.</p>
        </div>
        <div className="sabi-card p-7">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Temporary Password</label>
              <input type={showPw ? 'text' : 'password'} className="sabi-input" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Your temporary password" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">New Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="sabi-input pr-10" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Confirm New Password</label>
              <input type={showPw ? 'text' : 'password'} className="sabi-input" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" />
            </div>
            <button type="submit" disabled={loading} className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
