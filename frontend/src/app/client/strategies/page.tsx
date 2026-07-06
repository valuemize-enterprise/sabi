'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, Calendar, Clock, Target, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { Badge, LoadingPage, EmptyState } from '@/components/ui';

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  content:   { label: 'Content Strategy',  icon: '✍️',  color: 'amber'  },
  social:    { label: 'Social Media',       icon: '📱',  color: 'green'  },
  paid:      { label: 'Paid Advertising',   icon: '📣',  color: 'purple' },
  seo:       { label: 'SEO & Digital',      icon: '🔍',  color: 'blue'   },
  email:     { label: 'Email Marketing',    icon: '📧',  color: 'blue'   },
  brand:     { label: 'Brand Strategy',     icon: '🎯',  color: 'pink'   },
  campaign:  { label: 'Campaign',           icon: '🚀',  color: 'purple' },
  quarterly: { label: 'Quarterly Plan',     icon: '📊',  color: 'teal'   },
  annual:    { label: 'Annual Strategy',    icon: '🗓️',  color: 'green'  },
  other:     { label: 'Other',              icon: '📌',  color: 'gray'   },
};

const STATUS_COLOR: Record<string, string> = {
  draft:'gray', active:'green', paused:'amber', completed:'blue', archived:'gray',
};

// Demo data shown until real data arrives
const DEMO: any[] = [
  {
    id: 'd1', title: 'Q3 Instagram Growth Strategy', type: 'social', status: 'active',
    description: 'A 90-day plan to grow our Instagram following by 30% through Reels-first content, community engagement, and weekly master-class stories.',
    start_date: '2026-07-01', end_date: '2026-09-30', budget: 450000,
  },
  {
    id: 'd2', title: 'Eid Campaign — "Celebrate With Us"', type: 'campaign', status: 'completed',
    description: 'Multi-channel campaign across Instagram, WhatsApp, and Meta Ads targeting the Eid shopping window. Creative theme: warmth, family, and gifting.',
    start_date: '2026-03-01', end_date: '2026-03-25', budget: 800000,
  },
  {
    id: 'd3', title: 'Full-Year Brand Voice Document', type: 'brand', status: 'active',
    description: 'Defines tone of voice, key messages, audience personas, and do/don\'t guidelines for all brand communications across every channel.',
    start_date: '2026-01-01', end_date: '2026-12-31', budget: null,
  },
];

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;

export default function ClientStrategiesPage() {
  const { client } = useClientStore();
  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [isDemoData, setIsDemoData] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agency/strategies?brand_id=${client?.brand_id}&status=active&limit=20`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
      .then(r => r.json())
      .then((res: any) => {
        const data = res.data ?? [];
        if (data.length > 0) { setItems(data); setIsDemoData(false); }
        else { setItems(DEMO); setIsDemoData(true); }
      })
      .catch(() => { setItems(DEMO); setIsDemoData(true); })
      .finally(() => setLoading(false));
  }, [client?.brand_id]);

  const toggle = (id: string) => setExpanded(p => p === id ? null : id);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <LoadingPage label="Loading strategies…" />;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Strategies</h1>
        <p className="text-sm text-white/40 mt-1">
          Marketing strategies and campaign plans for{' '}
          <span className="text-white">{client?.brand?.name ?? 'your brand'}</span>
        </p>
      </div>

      {isDemoData && (
        <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/60">
            <span className="text-white font-medium">Illustrative examples</span> — your team's
            live strategies will appear here once published.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No strategies published yet"
          description="Your Cerebre team will publish active strategies here for you to review." />
      ) : (
        <div className="space-y-3">
          {items.map(s => {
            const meta = TYPE_META[s.type] ?? { label: s.type, icon: '📌', color: 'gray' };
            const isOpen = expanded === s.id;

            return (
              <div key={s.id} className="sabi-card overflow-hidden transition-all">
                {/* Header — always visible */}
                <button onClick={() => toggle(s.id)}
                  className="w-full flex items-start gap-4 p-5 text-left hover:bg-white/2 transition-all">
                  <div className="text-2xl mt-0.5 flex-shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <p className="font-semibold text-white">{s.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge label={meta.label} color={meta.color} />
                        <Badge label={s.status}   color={STATUS_COLOR[s.status] ?? 'gray'} />
                      </div>
                    </div>
                    {/* Date / budget summary */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {s.start_date && (
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(s.start_date)}
                          {s.end_date && <> → {formatDate(s.end_date)}</>}
                        </span>
                      )}
                      {s.budget && (
                        <span className="text-xs text-white/30">
                          Budget: ₦{Number(s.budget).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-white/20 flex-shrink-0 mt-1" />
                    : <ChevronDown className="w-4 h-4 text-white/20 flex-shrink-0 mt-1" />}
                </button>

                {/* Expanded detail */}
                {isOpen && s.description && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4">
                    <p className="text-sm text-white/60 leading-relaxed">{s.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/15 text-center mt-8">
        Strategies are created and managed by your Cerebre team. Contact your Account Manager to discuss.
      </p>
    </div>
  );
}