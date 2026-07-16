'use client';

import { useState, useEffect } from 'react';
import { Mail, Eye, X, Zap, Clock, Search } from 'lucide-react';
import { superAdmin } from '@/lib/api';

interface Template {
  id:      string;
  name:    string;
  trigger: string;
}

const TRIGGER_COLOR: Record<string, string> = {
  'User creation':               'blue',
  'Client creation':             'blue',
  'Password reset':              'amber',
  'Scheduled weekly':            'purple',
  'Report published':            'green',
  'Goal status = achieved':      'green',
  'Velocity score < 30':         'red',
  'Score recalculation':         'purple',
  'Task created with assignee':  'blue',
  'Competitor pulse scan':       'teal',
  '7 days before event':         'amber',
  'System event':                'red',
  'Day 1 after creation':        'green',
  'Day 3 after creation':        'green',
  'Profile generation complete': 'purple',
  'Narrative generated':         'purple',
  'Scheduled monthly':           'blue',
};

function Badge({ label, color='gray' }: { label:string; color?:string }) {
  const c: Record<string,string> = {
    gray:'bg-white/5 text-white/40', green:'bg-green-500/10 text-green-400 border border-green-500/20',
    blue:'bg-blue-500/10 text-blue-400 border border-blue-500/20', red:'bg-red-500/10 text-red-400 border border-red-500/20',
    amber:'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    purple:'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    teal:'bg-teal-500/10 text-teal-400 border border-teal-500/20',
  };
  return <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${c[color]??c.gray}`}>{label}</span>;
}

const PREVIEW_HTML: Record<string, string> = {
  'welcome-staff': `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(109,40,217,0.3)">
      <div style="background:linear-gradient(135deg,#4c1d95,#6d28d9);padding:32px;text-align:center">
        <div style="width:48px;height:48px;background:rgba(255,255,255,0.15);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px">
          <span style="font-size:20px;font-weight:900;color:#fff">S</span>
        </div>
        <h1 style="margin:0;font-size:22px;font-weight:800">Welcome to Sabi</h1>
        <p style="margin:8px 0 0;opacity:0.7;font-size:14px">Cerebre Media Africa Intelligence Suite</p>
      </div>
      <div style="padding:32px">
        <p style="color:rgba(255,255,255,0.8);line-height:1.7">Hi <strong>{{full_name}}</strong>,</p>
        <p style="color:rgba(255,255,255,0.6);line-height:1.7">Your staff account on Sabi Intelligence Suite has been created. Use the credentials below to log in for the first time.</p>
        <div style="background:rgba(109,40,217,0.15);border:1px solid rgba(109,40,217,0.3);border-radius:12px;padding:20px;margin:20px 0">
          <p style="margin:0 0 8px;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px">Your Credentials</p>
          <p style="margin:4px 0;color:#fff">Email: <strong>{{email}}</strong></p>
          <p style="margin:4px 0;color:#fff">Temp Password: <strong>{{temp_password}}</strong></p>
        </div>
        <p style="color:rgba(255,255,255,0.5);font-size:13px">You will be required to set a new password on first login.</p>
        <a href="{{login_url}}" style="display:block;background:linear-gradient(135deg,#6d28d9,#8b5cf6);color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:20px">Log In to Sabi →</a>
      </div>
      <div style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center">
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2)">© Cerebre Media Africa · Sabi Intelligence Suite</p>
      </div>
    </div>`,
  'report-published': `
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:16px;overflow:hidden;border:1px solid rgba(16,185,129,0.3)">
      <div style="background:linear-gradient(135deg,#065f46,#10b981);padding:32px;text-align:center">
        <h1 style="margin:0;font-size:20px;font-weight:800">📊 New Report Available</h1>
        <p style="margin:8px 0 0;opacity:0.8;font-size:14px">{{brand_name}} · Performance Report</p>
      </div>
      <div style="padding:32px">
        <p style="color:rgba(255,255,255,0.8)">Hi <strong>{{client_name}}</strong>,</p>
        <p style="color:rgba(255,255,255,0.6);line-height:1.7">Your latest performance report has been published by your account team. It covers the period <strong>{{period}}</strong> and includes NarrativeAI™ insights from ARIA.</p>
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px;margin:20px 0">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5)">ClarityScore™ this period</p>
          <p style="margin:4px 0 0;font-size:28px;font-weight:900;color:#10b981">{{clarity_score}}</p>
        </div>
        <a href="{{report_url}}" style="display:block;background:#10b981;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px">View Report →</a>
      </div>
    </div>`,
};

export default function SuperAdminEmailsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [preview, setPreview]     = useState<Template | null>(null);

  useEffect(() => {
    superAdmin.emails().then((r: any) => setTemplates(r.data?.templates ?? [])).finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.trigger.toLowerCase().includes(search.toLowerCase()))
    : templates;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-xs text-red-400/60 font-semibold uppercase tracking-widest mb-1">Communication</p>
        <h1 className="text-2xl font-bold text-white">Email Templates</h1>
        <p className="text-white/30 text-sm mt-1">{templates.length} automated email templates — all trigger-based, no manual sending</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input className="sabi-input pl-9 text-sm" placeholder="Search templates…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl w-full max-w-xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div>
                <p className="font-bold text-white">{preview.name}</p>
                <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1.5">
                  <Zap className="w-3 h-3" /> Trigger: {preview.trigger}
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="text-white/30 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              {PREVIEW_HTML[preview.id] ? (
                <div dangerouslySetInnerHTML={{ __html: PREVIEW_HTML[preview.id] }} />
              ) : (
                <div className="text-center py-12">
                  <Mail className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">Preview not available for this template.</p>
                  <p className="text-white/20 text-xs mt-1">Templates are stored as HTML files in <code className="text-purple-400">/backend/src/emails/</code></p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/5 flex items-center justify-between">
              <p className="text-xs text-white/25">Variables: <code className="text-purple-400">{'{{full_name}}'}</code>, <code className="text-purple-400">{'{{email}}'}</code>, <code className="text-purple-400">{'{{brand_name}}'}</code> etc.</p>
              <button onClick={() => setPreview(null)} className="text-xs text-white/40 hover:text-white transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Templates grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(t => (
            <div key={t.id} className="sabi-card p-4 hover:border-white/10 transition-all group">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white leading-snug">{t.name}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <Clock className="w-3 h-3" />
                      <span>{t.trigger}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setPreview(t)}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-purple-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-white/20 text-sm">No templates match your search</div>
      )}

      <div className="mt-8 sabi-card p-5 border-white/5">
        <p className="text-xs text-white/30 leading-relaxed">
          <span className="text-white/50 font-medium">How templates work: </span>
          All emails are triggered automatically by platform events — no manual sending. Templates are stored as HTML files in <code className="text-purple-400 text-[11px]">/backend/src/emails/</code> and sent via <strong className="text-white/50">Resend</strong> using the <code className="text-purple-400 text-[11px]">RESEND_API_KEY</code> environment variable.
          To customise a template, edit the corresponding HTML file and redeploy.
        </p>
      </div>
    </div>
  );
}
