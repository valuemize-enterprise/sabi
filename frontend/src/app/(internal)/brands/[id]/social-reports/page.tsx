'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Upload, Sparkles, Send, Loader2, X,
  FileText, Brain, TrendingUp, TrendingDown, Minus, Eye, Trash2
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const PLATFORMS = [
  { value:'instagram',      label:'Instagram',         icon:'📸' },
  { value:'facebook',       label:'Facebook',          icon:'👍' },
  { value:'twitter_x',      label:'X (Twitter)',       icon:'🐦' },
  { value:'tiktok',         label:'TikTok',            icon:'🎵' },
  { value:'linkedin',       label:'LinkedIn',          icon:'💼' },
  { value:'youtube',        label:'YouTube',           icon:'▶️' },
  { value:'google_analytics',label:'Google Analytics', icon:'📈' },
  { value:'meta_ads',       label:'Meta Ads',          icon:'📣' },
  { value:'google_ads',     label:'Google Ads',        icon:'🔍' },
  { value:'whatsapp',       label:'WhatsApp',          icon:'💬' },
  { value:'other',          label:'Other',             icon:'📊' },
];

const GRADE_COLOR: Record<string, string> = {
  A:'text-green-400 bg-green-500/15 border-green-500/25',
  B:'text-blue-400 bg-blue-500/15 border-blue-500/25',
  C:'text-amber-400 bg-amber-500/15 border-amber-500/25',
  D:'text-red-400 bg-red-500/15 border-red-500/25',
  F:'text-red-500 bg-red-500/10 border-red-500/20',
};

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000'}${p}`, {
    ...opts, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{}) }
  }).then(async r=>{ const b=await r.json(); if(!r.ok) throw new Error(b.error||b.message); return b; });

const EMPTY = { platform:'instagram', report_period:'', file_url:'', file_name:'' };

export default function SocialReportsPage() {
  const { id: brandId } = useParams<{ id: string }>();
  const [reports, setReports]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyseModal, setAnalyseModal] = useState<string | null>(null);
  const [analyseText, setAnalyseText] = useState('');
  const [publishModal, setPublishModal] = useState<string | null>(null);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    api(`/api/agency/social-reports?brand_id=${brandId}&limit=30`)
      .then((r: any) => setReports(r.data ?? []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [brandId]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setF('file_name', file.name);
    // In production: upload to Supabase Storage, get URL
    // For now: create a local object URL as placeholder
    const objectUrl = URL.createObjectURL(file);
    setF('file_url', objectUrl);
    // If it's a text-readable file, extract text
    if (file.type === 'text/plain' || file.type === 'text/csv') {
      const text = await file.text();
      setExtractedText(text.slice(0, 8000)); // limit to 8k chars
    }
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file_url) { setError('Please select a file'); return; }
    if (!form.platform)  { setError('Please select a platform'); return; }
    setUploading(true); setError('');
    try {
      const res: any = await api('/api/agency/social-reports', {
        method: 'POST',
        body: JSON.stringify({
          brand_id: brandId,
          platform:      form.platform,
          report_period: form.report_period || null,
          file_url:      form.file_url,
          file_name:     form.file_name,
          file_type:     selectedFile?.type?.includes('pdf') ? 'pdf' : selectedFile?.type?.startsWith('image') ? 'image' : 'other',
          extracted_text: extractedText || null,
        }),
      });
      setReports(p => [res.data.report, ...p]);
      setForm({ ...EMPTY }); setSelectedFile(null); setExtractedText(''); setShowForm(false);
    } catch (err: any) { setError(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const analyse = async (id: string) => {
    setAnalyseModal(id);
    setAnalyseText('');
  };

  const confirmAnalyse = async () => {
    if (!analyseText.trim()) return;
    const id = analyseModal;
    setAnalyseModal(null);
    setAnalysing(id);
    try {
      const res: any = await api(`/api/agency/social-reports/${id}/analyse`, {
        method: 'POST', body: JSON.stringify({ extracted_text: analyseText }),
      });
      setReports(p => p.map(r => r.id === id ? { ...r, ...res.data.report, ai_metrics: res.data.insights } : r));
    } catch (err: any) { toast.error(err.message); }
    finally { setAnalysing(null); setAnalyseText(''); }
  };

  const publish = async (id: string) => {
    setPublishModal(id);
  };

  const confirmPublish = async () => {
    const id = publishModal;
    setPublishModal(null);
    setPublishing(id);
    try {
      await api(`/api/agency/social-reports/${id}/publish`, { method: 'PUT' });
      setReports(p => p.map(r => r.id === id ? { ...r, published_to_client: true, status: 'published' } : r));
      toast.success('Report published to client portal');
    } catch (err: any) { toast.error(err.message); }
    finally { setPublishing(null); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <AgencyTopNav title="Social Reports"
        breadcrumb={[{label:'Brands',href:'/brands'},{label:'Brand',href:`/brands/${brandId}`}]}/>

      <Link href={`/brands/${brandId}`} className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Brand
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Social Media Reports</h1>
          <p className="text-sm text-white/40 mt-0.5">Upload platform reports · ARIA analyses them · Client receives AI-powered summaries</p>
        </div>
        <button onClick={() => { setShowForm(true); setError(''); setForm({ ...EMPTY }); }}
          className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Upload className="w-4 h-4"/> Upload Report
        </button>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { n:'1', icon:'📤', title:'Upload',  desc:'Upload PDF, screenshot, or CSV from any platform' },
          { n:'2', icon:'🤖', title:'ARIA Analyses', desc:'AI extracts metrics and writes an executive summary' },
          { n:'3', icon:'📊', title:'Client Sees It', desc:'One click publishes a professional report to the client portal' },
        ].map(s => (
          <div key={s.n} className="sabi-card p-4 text-center">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-sm font-semibold text-white mt-2">{s.title}</p>
            <p className="text-xs text-white/35 mt-1">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Upload modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div><h2 className="text-base font-bold text-white">Upload Report</h2><p className="text-xs text-white/30 mt-0.5">ARIA will analyse it automatically</p></div>
              <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Platform *</label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                  {PLATFORMS.map(p => (
                    <button type="button" key={p.value} onClick={() => setF('platform', p.value)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition-all ${form.platform===p.value?'border-purple-500/50 bg-purple-500/15':'border-white/5 hover:border-white/10'}`}>
                      <span>{p.icon}</span>
                      <span className={form.platform===p.value?'text-purple-300':'text-white/50'}>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Report Period</label>
                <input className="sabi-input text-sm" placeholder="e.g. June 2026, Q2 2026"
                  value={form.report_period} onChange={e => setF('report_period', e.target.value)}/>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1.5 block">File</label>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt" className="sr-only"
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}/>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border border-dashed transition-all ${selectedFile?'border-purple-500/30 bg-purple-500/5':'border-white/10 hover:border-white/20'}`}>
                  <Upload className="w-5 h-5 text-white/30 flex-shrink-0"/>
                  <div className="text-left">
                    <p className="text-sm text-white/60">{selectedFile ? selectedFile.name : 'Click to select PDF, image, or CSV'}</p>
                    <p className="text-xs text-white/25 mt-0.5">Supported: PDF, PNG, JPG, CSV, TXT</p>
                  </div>
                </button>
                <p className="text-xs text-white/20 mt-2">💡 Tip: For best AI analysis, paste the report text when prompted after upload.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={upload} disabled={uploading || !form.file_url}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  {uploading?<><Loader2 className="w-4 h-4 animate-spin"/>Uploading…</>:<><Upload className="w-4 h-4"/>Upload Report</>}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analyse modal */}
      {analyseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div><h2 className="text-base font-bold text-white">Analyse with ARIA</h2><p className="text-xs text-white/30 mt-0.5">Paste the report text or data for AI analysis</p></div>
              <button onClick={() => setAnalyseModal(null)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                className="sabi-input text-sm min-h-[200px] resize-y font-mono"
                placeholder="Paste report text, metrics, or exported data here..."
                value={analyseText}
                onChange={e => setAnalyseText(e.target.value)}
              />
              <div className="flex gap-3">
                <button onClick={confirmAnalyse} disabled={!analyseText.trim()}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50">
                  <Sparkles className="w-4 h-4"/> Analyse
                </button>
                <button onClick={() => setAnalyseModal(null)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish confirmation modal */}
      {publishModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12122a] border border-green-500/20 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div><h2 className="text-base font-bold text-white">Publish Report</h2><p className="text-xs text-white/30 mt-0.5">Make this report visible to the client</p></div>
              <button onClick={() => setPublishModal(null)} className="text-white/30 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-white/50">The client will receive a notification that a new report is available on their portal.</p>
              <div className="flex gap-3">
                <button onClick={confirmPublish}
                  className="sabi-btn-primary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm">
                  <Send className="w-4 h-4"/> Publish
                </button>
                <button onClick={() => setPublishModal(null)} className="px-4 text-sm text-white/40 hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports list */}
      {loading ? <LoadingPage/> : reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports uploaded"
          description="Upload social media reports and ARIA will generate professional client-ready summaries."
          action={{ label:'Upload First Report', onClick:()=>setShowForm(true) }}/>
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const platform = PLATFORMS.find(p => p.value === r.platform);
            const metrics  = r.ai_metrics ?? {};
            const isOpen   = expanded === r.id;
            return (
              <div key={r.id} className="sabi-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl flex-shrink-0">{platform?.icon ?? '📊'}</span>
                      <div>
                        <p className="font-semibold text-white">{platform?.label ?? r.platform}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {r.report_period && <span className="text-xs text-white/40">{r.report_period}</span>}
                          <span className="text-xs text-white/25">{new Date(r.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short'})}</span>
                          <Badge label={r.status} color={r.status==='published'?'green':r.status==='analysed'?'blue':'gray'}/>
                          {r.published_to_client && <Badge label="Client can see" color="green"/>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {metrics.performance_grade && (
                        <span className={`text-xl font-black px-2 py-1 rounded-xl border ${GRADE_COLOR[metrics.performance_grade] ?? GRADE_COLOR.C}`}>
                          {metrics.performance_grade}
                        </span>
                      )}
                    </div>
                  </div>

                  {r.ai_summary && (
                    <div className="mt-4 bg-purple-500/5 border border-purple-500/15 rounded-xl p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Brain className="w-3.5 h-3.5 text-purple-400"/><span className="text-xs text-purple-400 font-medium">ARIA Analysis</span>
                      </div>
                      <p className={`text-sm text-white/60 leading-relaxed ${!isOpen?'line-clamp-3':''}`}>{r.ai_summary}</p>
                    </div>
                  )}

                  {/* Metrics grid */}
                  {metrics.metrics && isOpen && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                      {Object.entries(metrics.metrics).slice(0,4).map(([k,v]:any) => (
                        v?.value != null && (
                          <div key={k} className="bg-white/3 rounded-xl p-3">
                            <p className="text-[10px] text-white/30 capitalize">{k.replace(/_/g,' ')}</p>
                            <p className="text-base font-bold text-white">{v.value}</p>
                            {v.change_pct != null && (
                              <p className={`text-xs flex items-center gap-0.5 ${v.change_pct>0?'text-green-400':'text-red-400'}`}>
                                {v.change_pct>0?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}
                                {v.change_pct>0?'+':''}{v.change_pct}%
                              </p>
                            )}
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4">
                    <button onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5"/>{isOpen?'Collapse':'Expand'}
                    </button>
                    {r.status !== 'analysed' && r.status !== 'published' && (
                      <button onClick={() => analyse(r.id)} disabled={analysing === r.id}
                        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50">
                        {analysing===r.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Sparkles className="w-3.5 h-3.5"/>}
                        {analysing===r.id?'Analysing…':'Analyse with ARIA'}
                      </button>
                    )}
                    {(r.status === 'analysed') && !r.published_to_client && (
                      <button onClick={() => publish(r.id)} disabled={publishing === r.id}
                        className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50">
                        {publishing===r.id?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Send className="w-3.5 h-3.5"/>}
                        {publishing===r.id?'Publishing…':'Publish to Client'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
