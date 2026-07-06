'use client';

import { useState } from 'react';
import { Check, Copy, X, AlertTriangle, Shield } from 'lucide-react';

interface CredentialModalProps {
  user: {
    full_name: string;
    email:     string;
    role?:     string;
  };
  tempPassword: string;
  portalUrl?:   string;
  portalLabel?: string;
  onClose:      () => void;
}

/**
 * CredentialModal
 *
 * Shown after creating a staff member or client account.
 * Displays copyable login credentials.
 *
 * Usage:
 *   <CredentialModal
 *     user={{ full_name: 'Amaka Obi', email: 'amaka@brand.com', role: 'account_manager' }}
 *     tempPassword="Sabi8xb2!"
 *     portalUrl="/login"
 *     portalLabel="Internal Portal"
 *     onClose={() => setShowModal(false)}
 *   />
 */
export function CredentialModal({
  user, tempPassword, portalUrl = '/login', portalLabel = 'Internal Portal', onClose,
}: CredentialModalProps) {
  const [copied, setCopied] = useState('');

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2500);
  };

  const CopyRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-mono text-white truncate">{value}</p>
      </div>
      <button onClick={() => copy(value, label)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-purple-400 hover:bg-purple-500/10 transition-all flex-shrink-0">
        {copied === label
          ? <Check className="w-3.5 h-3.5 text-green-400" />
          : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Account created</p>
              <p className="text-xs text-white/35">{user.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400/80 leading-relaxed">
            Share these credentials securely — not over public email or chat. The user must change their password on first login.
          </p>
        </div>

        {/* Credentials */}
        <div className="bg-white/3 rounded-xl p-4 border border-white/6 mb-4">
          <CopyRow label="Email Address" value={user.email} />
          <CopyRow label="Temporary Password" value={tempPassword} />
          <CopyRow label="Login URL" value={`${typeof window !== 'undefined' ? window.location.origin : ''}${portalUrl}`} />
        </div>

        {user.role && (
          <p className="text-xs text-white/25 text-center mb-4">
            Role: <span className="text-white/50 capitalize">{user.role.replace(/_/g, ' ')}</span>
            {' · '}Portal: {portalLabel}
          </p>
        )}

        <button onClick={onClose} className="sabi-btn-primary w-full py-2.5 text-sm">
          Done — Close
        </button>
      </div>
    </div>
  );
}
