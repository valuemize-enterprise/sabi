'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Sparkles, Send, Loader2, BarChart2 } from 'lucide-react';
import { reports as reportsApi } from '@/lib/api';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { LoadingPage, Badge } from '@/components/ui';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    reportsApi.get(id).then((r: any) => setReport(r.data.report)).finally(() => setLoading(false));
  }, [id]);

  const generateNarrative = async () => {
    setGenerating(true);
    try {
      const res: any = await reportsApi.generateNarrative(id);
      setReport((p: any) => ({ ...p, narrative: res.data.narrative }));
    } catch {} finally { setGenerating(false); }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const res: any = await reportsApi.publish(id);
      setReport((p: any) => ({ ...p, status: 'published', published_at: res.data.report.published_at }));
    } catch {} finally { setPublishing(false); }
  };

  if (loading) return <LoadingPage label="Loading report…"/>;
  if (!report) return <div className="p-6 text-white/40">Report not found</div>;

  const metrics = report.metrics || {};
  const brand   = report.brands;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <AgencyTopNav/>
      <Link href="/reports" className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5"/> Back to Reports
      </Link>

      {/* Header */}
      <div className="sabi-card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-400"/>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{report.title}</h1>
              <p className="text-sm text-white/40 mt-0.5">
                {brand?.name} · {report.period_start} → {report.period_end}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge label={report.type} color="blue"/>
                <Badge label={report.status} color={report.status==='published'?'green':'gray'}/>
                {report.clarity_score && <span className="text-xs text-purple-400 font-bold">ClarityScore: {report.clarity_score}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!report.narrative && (
              <button onClick={generateNarrative} disabled={generating} className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-lg hover:bg-purple-600/30 transition-all disabled:opacity-50">
                {generating?<><Loader2 className="w-4 h-4 animate-spin"/>Generating…</>:<><Sparkles className="w-4 h-4"/>Generate Narrative</>}
              </button>
            )}
            {report.status==='draft' && (
              <button onClick={publish} disabled={publishing} className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600/20 border border-green-500/30 text-green-300 rounded-lg hover:bg-green-600/30 transition-all disabled:opacity-50">
                {publishing?<><Loader2 className="w-4 h-4 animate-spin"/>Publishing…</>:<><Send className="w-4 h-4"/>Publish</>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      {Object.keys(metrics).length > 0 && (
        <div className="sabi-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4"><BarChart2 className="w-4 h-4 text-purple-400"/><h2 className="text-sm font-semibold text-white">Key Metrics</h2></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics).map(([k, v]) => (
              <div key={k} className="bg-white/3 rounded-xl p-4 border border-white/5">
                <p className="text-xs text-white/40 capitalize mb-1">{k.replace(/_/g,' ')}</p>
                <p className="text-xl font-bold text-white">{String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative */}
      {report.narrative && (
        <div className="sabi-card p-6 mb-6">
          <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-purple-400"/><h2 className="text-sm font-semibold text-white">NarrativeAI™</h2><span className="text-xs text-purple-400/60 ml-1">Generated by ARIA</span></div>
          <div className="prose prose-invert max-w-none">
            {report.narrative.split('\n\n').map((p: string, i: number) => (
              <p key={i} className="text-white/70 leading-relaxed mb-4 last:mb-0">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Content sections */}
      {report.content && Object.keys(report.content).length > 0 && (
        <div className="sabi-card p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Report Content</h2>
          <pre className="text-xs text-white/50 overflow-auto">{JSON.stringify(report.content, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
