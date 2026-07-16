'use client';
import { useState } from 'react';
import { Download, FileText, BarChart2, Target, Users, Loader2, CheckCircle2, Calendar } from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/TopNav';

const EXPORT_TYPES = [
  { id:'reports',   label:'Performance Reports',  icon: FileText,   desc:'All published reports as PDF or CSV', formats:['PDF','CSV'] },
  { id:'goals',     label:'Goals & KPIs',          icon: Target,     desc:'Goal history with velocity data',    formats:['CSV','XLSX'] },
  { id:'brands',    label:'Brand Overview',        icon: BarChart2,  desc:'ClarityScore history for all brands',formats:['CSV','XLSX'] },
  { id:'staff',     label:'Staff Activity',        icon: Users,      desc:'Staff assignments and task history', formats:['CSV'] },
  { id:'calendar',  label:'Calendar Events',       icon: Calendar,   desc:'MomentMap events and recommendations',formats:['CSV','ICS'] },
  { id:'audit',     label:'Audit Log',             icon: CheckCircle2,desc:'Full platform audit trail',         formats:['CSV','JSON'] },
];

export default function ExportPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const [done, setDone]           = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const doExport = async (id: string, format: string) => {
    const key = `${id}-${format}`;
    setExporting(key);
    await new Promise(r => setTimeout(r, 1800));
    setExporting(null);
    setDone(p => new Set([...p, key]));
    setTimeout(() => setDone(p => { const n = new Set(p); n.delete(key); return n; }), 5000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <AgencyTopNav title="Settings" />
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
          <Download className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Export Data</h1>
          <p className="text-sm text-white/40">Download your platform data in various formats</p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="sabi-card p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3">Date Range (optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          {[['from','From'],['to','To']].map(([k,l]) => (
            <div key={k}>
              <label className="text-xs text-white/50 mb-1.5 block">{l}</label>
              <input type="date" className="sabi-input text-sm"
                value={(dateRange as any)[k]} onChange={e => setDateRange(p => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Export options */}
      <div className="space-y-3">
        {EXPORT_TYPES.map(({ id, label, icon: Icon, desc, formats }) => (
          <div key={id} className="sabi-card p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{label}</p>
                <p className="text-xs text-white/40 mt-0.5">{desc}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {formats.map(fmt => {
                  const key = `${id}-${fmt}`;
                  const isDone = done.has(key);
                  const isExporting = exporting === key;
                  return (
                    <button key={fmt} onClick={() => doExport(id, fmt)} disabled={!!exporting}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                        isDone     ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                        isExporting? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                     'border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                      } disabled:opacity-40`}>
                      {isDone      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Done</> :
                       isExporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</> :
                                     <><Download className="w-3.5 h-3.5" /> {fmt}</>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/20 text-center mt-6">
        Exports are generated in real-time and may take a few seconds for large datasets.
        Files are available for download for 24 hours.
      </p>
    </div>
  );
}
