'use client';

import { useState, useEffect } from 'react';
import { Settings, Loader2, Check, AlertTriangle, Brain, Zap, Shield, Bell, Globe } from 'lucide-react';
import { superAdmin } from '@/lib/api';

// ── Setting definition ────────────────────────────────────────
interface SettingDef {
  key:      string;
  label:    string;
  desc:     string;
  type:     'text' | 'number' | 'toggle' | 'select';
  options?: string[];
  danger?:  boolean;
}

const SECTIONS: { id: string; label: string; icon: any; color: string; settings: SettingDef[] }[] = [
  {
    id:'platform', label:'Platform', icon:Globe, color:'blue',
    settings: [
      { key:'platform_name',       label:'Platform Display Name',        desc:'Shown in client-facing emails and portal header.',             type:'text'   },
      { key:'support_email',       label:'Support Email',                 desc:'Used in footer and help pages for client contact.',            type:'text'   },
      { key:'platform_timezone',   label:'Default Timezone',             desc:'Used for report scheduling and MomentMap™ dates.',             type:'select', options:['Africa/Lagos','UTC','Africa/Nairobi','Africa/Accra'] },
      { key:'maintenance_mode',    label:'Maintenance Mode',             desc:'Show maintenance page to all client portal users.',            type:'toggle', danger:true },
      { key:'allow_registrations', label:'Allow Self-Registration',      desc:'Let staff sign up without an invite (use with caution).',      type:'toggle', danger:true },
    ],
  },
  {
    id:'aria', label:'ARIA Engine', icon:Brain, color:'purple',
    settings: [
      { key:'aria_model',          label:'AI Model',                     desc:'Anthropic model used for all ARIA features. Do not change unless you have confirmed billing.',            type:'select', options:['claude-sonnet-4-6','claude-haiku-4-5-20251001'] },
      { key:'aria_max_tokens',     label:'Max Tokens per Response',      desc:'Higher values = longer responses, higher cost. Default: 2048.',type:'number' },
      { key:'aria_temperature',    label:'Response Temperature (0–1)',   desc:'Lower = more deterministic. 0.7 is recommended for ARIA.',     type:'number' },
      { key:'aria_enabled',        label:'Enable ARIA Features',         desc:'Master switch. Disabling stops all AI-generated content.',     type:'toggle' },
      { key:'aria_client_chat',    label:'Client Portal Ask ARIA',       desc:'Allow clients to access the Ask ARIA chat interface.',         type:'toggle' },
    ],
  },
  {
    id:'scoring', label:'ClarityScore™', icon:Zap, color:'amber',
    settings: [
      { key:'clarity_auto_refresh', label:'Auto-Refresh Scores',         desc:'Automatically recalculate ClarityScore™ on a schedule.',      type:'toggle' },
      { key:'clarity_refresh_hours',label:'Refresh Interval (hours)',    desc:'How often auto-refresh runs. Minimum: 12 hours.',              type:'number' },
      { key:'clarity_notify_client',label:'Notify Clients on Score Change', desc:'Send email when ClarityScore™ changes by 50+ points.',    type:'toggle' },
    ],
  },
  {
    id:'security', label:'Security', icon:Shield, color:'red',
    settings: [
      { key:'session_timeout_hours', label:'Session Timeout (hours)',    desc:'Inactive users are logged out after this period.',            type:'number' },
      { key:'max_login_attempts',    label:'Max Login Attempts',         desc:'Accounts are locked after this many failed attempts.',        type:'number' },
      { key:'require_pw_reset_days', label:'Force Password Reset (days)',desc:'Staff must reset password every N days. 0 = disabled.',      type:'number' },
      { key:'audit_retention_days',  label:'Audit Log Retention (days)', desc:'Logs older than this are archived. Minimum: 90 days.',       type:'number' },
    ],
  },
  {
    id:'notifications', label:'Notifications', icon:Bell, color:'green',
    settings: [
      { key:'weekly_digest_enabled', label:'Weekly Digest Email',        desc:'Send weekly brand performance summary to staff.',             type:'toggle' },
      { key:'goal_risk_alerts',      label:'Goal At-Risk Alerts',        desc:'Email staff when VelocityTracker™ flags a goal as at risk.', type:'toggle' },
      { key:'report_publish_notify', label:'Report Published Alerts',    desc:'Email clients when a new report is published for their brand.',type:'toggle'},
    ],
  },
];

const SECTION_COLORS: Record<string,string> = {
  blue:'text-blue-400 bg-blue-500/10', purple:'text-purple-400 bg-purple-500/10',
  amber:'text-amber-400 bg-amber-500/10', red:'text-red-400 bg-red-500/10', green:'text-green-400 bg-green-500/10',
};

export default function SuperAdminSettingsPage() {
  const [values, setValues]     = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [saved, setSaved]       = useState<Set<string>>(new Set());
  const [error, setError]       = useState('');
  const [activeSection, setActiveSection] = useState('platform');

  useEffect(() => {
    superAdmin.settings().then((r: any) => {
      const map: Record<string, any> = {};
      (r.data?.settings ?? []).forEach((s: any) => {
        try { map[s.key] = JSON.parse(s.value ?? 'null'); } catch { map[s.key] = s.value; }
      });
      setValues(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key: string, value: any) => {
    setSaving(key); setError('');
    try {
      await superAdmin.setSetting(key, value);
      setValues(p => ({ ...p, [key]: value }));
      setSaved(p => new Set([...p, key]));
      setTimeout(() => setSaved(p => { const n = new Set(p); n.delete(key); return n; }), 2500);
    } catch (e: any) {
      setError(`Failed to save "${key}": ${e.message}`);
    } finally { setSaving(null); }
  };

  const renderControl = (s: SettingDef) => {
    const val = values[s.key];
    const isSaving = saving === s.key;
    const isSaved  = saved.has(s.key);

    if (s.type === 'toggle') return (
      <div className="flex items-center gap-3">
        {isSaved && <Check className="w-4 h-4 text-green-400 flex-shrink-0" />}
        <button onClick={() => saveSetting(s.key, !val)} disabled={!!saving}
          className={`w-12 h-6 rounded-full relative transition-all ${val ? 'bg-purple-600' : 'bg-white/10'} disabled:opacity-50`}>
          {isSaving ? (
            <span className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-3 h-3 animate-spin text-white" /></span>
          ) : (
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${val ? 'left-7' : 'left-1'}`} />
          )}
        </button>
      </div>
    );

    if (s.type === 'select') return (
      <div className="flex items-center gap-2">
        <select className="sabi-input text-sm w-48"
          value={val ?? ''}
          onChange={e => saveSetting(s.key, e.target.value)}>
          {s.options?.map(o => <option key={o} className='bg-black' value={o}>{o}</option>)}
        </select>
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
        {isSaved  && <Check className="w-4 h-4 text-green-400" />}
      </div>
    );

    return (
      <div className="flex items-center gap-2">
        <input type={s.type === 'number' ? 'number' : 'text'}
          className="sabi-input text-sm w-48"
          defaultValue={val ?? ''}
          onBlur={e => {
            const v = s.type === 'number' ? Number(e.target.value) : e.target.value;
            if (String(v) !== String(val)) saveSetting(s.key, v);
          }} />
        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
        {isSaved  && <Check className="w-4 h-4 text-green-400" />}
      </div>
    );
  };

  const section = SECTIONS.find(s => s.id === activeSection)!;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-red-400/60 font-semibold uppercase tracking-widest mb-1">Platform Configuration</p>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/30 text-sm mt-1">Changes save immediately and are logged in the audit trail</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-6">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-44 flex-shrink-0">
          <div className="space-y-1">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                    activeSection===s.id ? 'bg-red-600/20 text-red-300 border border-red-500/20' : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${activeSection===s.id?'text-red-400':'text-white/25'}`} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings panel */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${SECTION_COLORS[section.color]}`}>
                  <section.icon className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-white">{section.label}</h2>
              </div>
              <div className="space-y-3">
                {section.settings.map(s => (
                  <div key={s.key}
                    className={`sabi-card p-5 ${s.danger ? 'border-red-500/15' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{s.label}</p>
                          {s.danger && (
                            <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-medium">CAUTION</span>
                          )}
                        </div>
                        <p className="text-xs text-white/35 mt-1 leading-relaxed">{s.desc}</p>
                        <p className="text-[10px] text-white/20 mt-1 font-mono">{s.key}</p>
                      </div>
                      <div className="flex-shrink-0 pt-1">
                        {renderControl(s)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
