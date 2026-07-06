'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, ChevronRight, Eye } from 'lucide-react';
import { clientPortal } from '@/lib/api';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const TYPE_COLOR: Record<string, string> = { weekly: 'purple', monthly: 'blue', campaign: 'green', custom: 'amber' };

export default function ClientReportsPage() {
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientPortal.reports().then((r: any) => setItems(r.data ?? [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Reports</h1>
        <p className="text-sm text-white/40 mt-1">Performance reports published by your account team</p>
      </div>

      {loading ? <LoadingPage label="Loading reports…" /> : items.length === 0 ? (
        <EmptyState icon={FileText} title="No reports yet" description="Your account team hasn't published a report yet. They'll appear here once available." />
      ) : (
        <div className="space-y-3">
          {items.map((r: any) => (
            <Link key={r.id} href={`/client/reports/${r.id}`}
              className="sabi-card p-5 flex items-center gap-4 hover:border-purple-500/20 transition-all group block">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white group-hover:text-purple-300 transition-colors">{r.title}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {r.period_start && `${r.period_start} → ${r.period_end}`}
                  {r.published_at && ` · Published ${new Date(r.published_at).toLocaleDateString()}`}
                </p>
                {r.narrative && <p className="text-xs text-white/30 mt-1 line-clamp-1">{r.narrative}</p>}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge label={r.type} color={TYPE_COLOR[r.type] ?? 'gray'} />
                {r.clarity_score && <span className="text-sm font-bold text-purple-400">{r.clarity_score}</span>}
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
