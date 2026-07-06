'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { clientAuth } from '@/lib/api';

export default function ClientSetPasswordPage() {
  const router = useRouter();
  const { client, token, setClient } = useClientStore();
  const [current, setCurrent]   = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPw.length < 8)  { setError('New password must be at least 8 characters'); return; }
    if (newPw !== confirm)  { setError('Passwords do not match'); return; }
    if (newPw === current)  { setError('New password must be different from your current password'); return; }

    setLoading(true);
    try {
      await clientAuth.setPassword(current, newPw);
      setSuccess(true);
      // Update local store to clear must_reset_password flag
      if (token && client) {
        setClient(token, { ...client, must_reset_password: false });
      }
      setTimeout(() => router.replace('/client/dashboard'), 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please check your current password.');
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Password updated!</h2>
        <p className="text-white/40 text-sm">Redirecting to your dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/20 mb-4">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Set Your Password</h1>
          <p className="text-white/40 text-sm mt-2">
            {client?.full_name ? `Welcome, ${client.full_name.split(' ')[0]}.` : 'Welcome.'}{' '}
            Please set a new password to access your brand dashboard.
          </p>
        </div>

        <div className="sabi-card p-7">
          {/* Brand badge */}
          {client?.brand && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300">
                {client.brand.name?.[0] ?? 'B'}
              </div>
              <div>
                <p className="text-xs text-white/30">Accessing portal for</p>
                <p className="text-sm font-medium text-white">{client.brand.name}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              ['current', 'Temporary Password (from your invite)', 'Your temporary password'],
              ['newPw',   'New Password',                          'Min. 8 characters'],
              ['confirm', 'Confirm New Password',                  'Repeat your new password'],
            ].map(([key, label, placeholder]) => (
              <div key={key}>
                <label className="text-xs text-white/50 mb-1.5 block">{label}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="sabi-input pr-10"
                    placeholder={placeholder}
                    value={key === 'current' ? current : key === 'newPw' ? newPw : confirm}
                    onChange={e => {
                      if (key === 'current') setCurrent(e.target.value);
                      else if (key === 'newPw') setNewPw(e.target.value);
                      else setConfirm(e.target.value);
                    }}
                    required
                  />
                  {key === 'confirm' && (
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Password strength hints */}
            <div className="grid grid-cols-2 gap-2">
              {[
                [newPw.length >= 8,                   '8+ characters'],
                [/[A-Z]/.test(newPw),                 'Uppercase letter'],
                [/[0-9]/.test(newPw),                 'Number'],
                [newPw === confirm && newPw.length > 0,'Passwords match'],
              ].map(([met, label]) => (
                <div key={String(label)} className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-400' : 'text-white/25'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${met ? 'bg-green-400' : 'bg-white/15'}`} />
                  {label}
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading}
              className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Setting password…</> : 'Set New Password & Continue →'}
            </button>
          </form>

          <p className="text-center text-xs text-white/20 mt-5">
            Need help? Contact your account team at <span className="text-purple-400">hello@cerebre.media</span>
          </p>
        </div>
      </div>
    </div>
  );
}
