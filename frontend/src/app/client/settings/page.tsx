'use client';
import { useState } from 'react';
import { Settings, User, Lock, Bell, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { TabBar } from '@/components/ui';

export default function ClientSettingsPage() {
  const { client } = useClientStore();
  const [tab, setTab]     = useState('profile');
  const [saved, setSaved] = useState(false);
  const [form, setForm]   = useState({
    full_name: client?.full_name ?? '',
    email:     client?.email ?? '',
    job_title: client?.job_title ?? '',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({ reports: true, scores: true, goals: true, moments: false });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 900));
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-7">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Settings className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm text-white/40">Manage your account preferences</p>
        </div>
      </div>

      <TabBar tabs={[{ id:'profile',label:'Profile'},{ id:'password',label:'Password'},{ id:'notifications',label:'Notifications'}]} active={tab} onChange={setTab} />

      {saved && <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-400 text-sm mb-5"><Check className="w-4 h-4" />Changes saved</div>}

      {tab === 'profile' && (
        <form onSubmit={save} className="sabi-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white/70 mb-2">Account Details</h2>
          {[['full_name','Full Name'],['email','Email Address'],['phone','Phone Number'],['job_title','Job Title']].map(([k,l]) => (
            <div key={k}>
              <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
              <input className="sabi-input" value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <button type="submit" disabled={saving} className="sabi-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : 'Save Profile'}
          </button>
        </form>
      )}

      {tab === 'password' && (
        <form onSubmit={save} className="sabi-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white/70 mb-2">Change Password</h2>
          {[['current','Current Password'],['newPw','New Password'],['confirm','Confirm New Password']].map(([k,l]) => (
            <div key={k}>
              <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className="sabi-input pr-10"
                  value={(pwForm as any)[k]} onChange={e => setPwForm(f => ({ ...f, [k]: e.target.value }))} />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <button type="submit" disabled={saving} className="sabi-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : 'Update Password'}
          </button>
        </form>
      )}

      {tab === 'notifications' && (
        <div className="sabi-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white/70 mb-2">Notification Preferences</h2>
          {[['reports','New Reports Published'],['scores','ClarityScore™ Updates'],['goals','Goal Progress Milestones'],['moments','MomentMap™ Reminders']].map(([k,l]) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm text-white">{l}</p>
                <p className="text-xs text-white/30">Receive email alerts</p>
              </div>
              <button onClick={() => setNotifPrefs(p => ({ ...p, [k]: !(p as any)[k] }))}
                className={`w-11 h-6 rounded-full relative transition-all ${(notifPrefs as any)[k] ? 'bg-purple-600' : 'bg-white/10'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${(notifPrefs as any)[k] ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          ))}
          <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            className="sabi-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm mt-2">
            Save Preferences
          </button>
        </div>
      )}
    </div>
  );
}
