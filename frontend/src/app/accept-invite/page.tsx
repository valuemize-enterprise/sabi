'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Check, Shield, AlertTriangle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token');

  const [invite, setInvite]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  // Validate token on load
  useEffect(() => {
    if (!token) { setError('Invalid invitation link.'); setLoading(false); return; }
    fetch(`${API}/api/auth/invite/${token}`)
      .then(r => r.json())
      .then(res => {
        if (!res.success) throw new Error(res.error || 'Invalid or expired invitation');
        setInvite(res.data);
        setFullName(res.data.full_name || '');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }

    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/invite/accept`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password, full_name: fullName, phone }),
      });
      const body = await res.json();
      if (!body.success) throw new Error(body.error || 'Failed to create account');
      setDone(true);
      setTimeout(() => router.replace(invite.invite_type === 'client' ? '/client/login' : '/login'), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const strength = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const strengthScore = strength.filter(Boolean).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strengthScore];
  const strengthColor = ['','text-red-400','text-amber-400','text-blue-400','text-green-400'][strengthScore];

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4">
            <span className="text-2xl font-black text-purple-300">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">Sabi Intelligence Suite</h1>
          <p className="text-white/35 text-sm mt-1">Cerebre Media Africa</p>
        </div>

        {loading ? (
          <div className="text-center"><Loader2 className="w-6 h-6 text-purple-400 animate-spin mx-auto" /></div>
        ) : error && !invite ? (
          <div className="sabi-card p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Invalid Invitation</h2>
            <p className="text-white/50 text-sm">{error}</p>
            <p className="text-white/25 text-xs mt-3">Contact your administrator to resend the invitation.</p>
          </div>
        ) : done ? (
          <div className="sabi-card p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Account Created!</h2>
            <p className="text-white/50 text-sm">Redirecting you to the login page…</p>
          </div>
        ) : invite ? (
          <div className="sabi-card p-7">
            {/* Invite context */}
            <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <p className="text-sm font-medium text-white">You've been invited to Sabi</p>
              </div>
              <p className="text-xs text-white/50">
                {invite.invite_type === 'client'
                  ? `Access the client portal for ${invite.brand_name ?? 'your brand'}`
                  : `Join as ${invite.role?.replace(/_/g, ' ')} on the Cerebre team`}
              </p>
              <p className="text-xs text-white/30 mt-1">{invite.email}</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Full Name *</label>
                <input className="sabi-input" required
                  placeholder="Your full name"
                  value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">
                  Phone <span className="text-white/20">(optional)</span>
                </label>
                <input className="sabi-input" placeholder="+234 800 000 0000"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Set Password *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} className="sabi-input pr-10" required
                    placeholder="Choose a strong password"
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex gap-1 flex-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < strengthScore ? (strengthScore === 1 ? 'bg-red-500' : strengthScore === 2 ? 'bg-amber-500' : strengthScore === 3 ? 'bg-blue-500' : 'bg-green-500') : 'bg-white/10'}`} />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${strengthColor}`}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Confirm Password *</label>
                <input type={showPw ? 'text' : 'password'} className="sabi-input" required
                  placeholder="Repeat your password"
                  value={confirm} onChange={e => setConfirm(e.target.value)} />
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                )}
                {confirm && password === confirm && password.length >= 8 && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Passwords match</p>
                )}
              </div>

              <button type="submit" disabled={submitting || password !== confirm || password.length < 8}
                className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2 disabled:opacity-40">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</>
                  : 'Create Account & Sign In →'}
              </button>
            </form>

            <p className="text-center text-xs text-white/20 mt-5">
              This invitation expires{' '}
              {new Date(invite.expires_at).toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' })}.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
