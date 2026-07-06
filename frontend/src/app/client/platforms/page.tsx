'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, ExternalLink, Loader2 } from 'lucide-react';
import { useClientStore } from '@/lib/store';
import { LoadingPage } from '@/components/ui';

interface Platform {
  id:          string;
  name:        string;
  icon:        string;
  handle?:     string;
  url?:        string | null;
  connected:   boolean;
  color:       string;
  metrics?:    { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[];
  last_updated?: string;
}

// Build platform list from brand social_handles + mock metrics
// In production, real metrics come from Meta Graph API, Google Analytics etc.
function buildPlatforms(brand: any): Platform[] {
  const handles = brand?.social_handles ?? {};

  return [
    {
      id: 'instagram', name: 'Instagram', icon: '📸', color: '#E1306C',
      handle: handles.instagram || null,
      url: handles.instagram ? `https://instagram.com/${handles.instagram.replace('@', '')}` : null,
      connected: !!handles.instagram,
      metrics: [
        { label: 'Followers',       value: '14,230', trend: 'up'   },
        { label: 'Avg. Reach',      value: '3,400',  trend: 'up'   },
        { label: 'Engagement Rate', value: '4.2%',   trend: 'flat' },
        { label: 'Posts This Month',value: '12',     trend: 'up'   },
      ],
      last_updated: '2 hours ago',
    },
    {
      id: 'facebook', name: 'Facebook', icon: '👍', color: '#1877F2',
      handle: handles.facebook || null,
      url: handles.facebook ? `https://facebook.com/${handles.facebook.replace('@', '')}` : null,
      connected: !!handles.facebook,
      metrics: [
        { label: 'Page Likes',      value: '8,901',  trend: 'up'   },
        { label: 'Post Reach',      value: '12,500', trend: 'up'   },
        { label: 'Engagement',      value: '2.8%',   trend: 'down' },
        { label: 'Posts This Month',value: '8',      trend: 'flat' },
      ],
      last_updated: '3 hours ago',
    },
    {
      id: 'twitter', name: 'X (Twitter)', icon: '🐦', color: '#000000',
      handle: handles.twitter || null,
      url: handles.twitter ? `https://x.com/${handles.twitter.replace('@', '')}` : null,
      connected: !!handles.twitter,
      metrics: [
        { label: 'Followers',   value: '5,200', trend: 'up'   },
        { label: 'Impressions', value: '28,000',trend: 'up'   },
        { label: 'Engagements', value: '1,340', trend: 'flat' },
      ],
      last_updated: '4 hours ago',
    },
    {
      id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#010101',
      handle: handles.tiktok || null,
      url: handles.tiktok ? `https://tiktok.com/@${handles.tiktok.replace('@', '')}` : null,
      connected: !!handles.tiktok,
      metrics: [
        { label: 'Followers',   value: '2,100', trend: 'up'   },
        { label: 'Video Views', value: '45,000',trend: 'up'   },
        { label: 'Likes',       value: '8,900', trend: 'up'   },
      ],
      last_updated: '1 hour ago',
    },
    {
      id: 'linkedin', name: 'LinkedIn', icon: '💼', color: '#0077B5',
      handle: handles.linkedin || null,
      url: handles.linkedin ? `https://linkedin.com/company/${handles.linkedin.replace('@', '')}` : null,
      connected: !!handles.linkedin,
      metrics: [
        { label: 'Followers',     value: '1,230', trend: 'up'   },
        { label: 'Post Impressions', value: '6,400', trend: 'flat' },
        { label: 'Engagements',   value: '890',   trend: 'up'   },
      ],
      last_updated: '5 hours ago',
    },
    {
      id: 'google', name: 'Google / Website', icon: '🌐', color: '#4285F4',
      connected: !!brand?.website,
      handle: brand?.website || null,
      url: brand?.website || null,
      metrics: [
        { label: 'Monthly Visitors', value: '4,800',  trend: 'up'   },
        { label: 'Organic Sessions', value: '2,100',  trend: 'up'   },
        { label: 'Bounce Rate',      value: '42%',    trend: 'down' },
        { label: 'Avg. Session',     value: '2m 14s', trend: 'up'   },
      ],
      last_updated: '1 day ago',
    },
  ];
}

function TrendIcon({ trend }: { trend?: 'up' | 'down' | 'flat' }) {
  if (trend === 'up')   return <TrendingUp   className="w-3 h-3 text-green-400" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-400"   />;
  return <Minus className="w-3 h-3 text-white/30" />;
}

export default function ClientPlatformsPage() {
  const { client } = useClientStore();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showAll, setShowAll]     = useState(false);

  useEffect(() => {
    // Build platforms from the brand data we already have in the client store
    // Real metrics would come from the analytics integrations
    const brand = client?.brand ?? {};
    setPlatforms(buildPlatforms(brand));
    setLoading(false);
  }, [client]);

  if (loading) return <LoadingPage label="Loading platforms…" />;

  const connected    = platforms.filter(p => p.connected);
  const notConnected = platforms.filter(p => !p.connected);
  const visible      = showAll ? notConnected : notConnected.slice(0, 2);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Platforms</h1>
        <p className="text-sm text-white/40 mt-1">
          Your brand's digital presence across all channels
        </p>
      </div>

      {/* Note about data freshness */}
      <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mb-6">
        <p className="text-sm text-white/60">
          Metrics shown are representative figures.{' '}
          <span className="text-white font-medium">Live analytics</span> are
          updated by your Cerebre team and included in your monthly reports.
        </p>
      </div>

      {/* Connected platforms */}
      {connected.length > 0 && (
        <>
          <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">
            Active Platforms ({connected.length})
          </h2>
          <div className="space-y-4 mb-8">
            {connected.map(p => (
              <div key={p.id} className="sabi-card p-5">
                {/* Platform header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${p.color}18`, border: `1px solid ${p.color}30` }}>
                      {p.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{p.name}</p>
                      {p.handle && (
                        <p className="text-xs text-white/40">
                          {p.handle.startsWith('http') ? new URL(p.handle).hostname : `@${p.handle.replace('@', '')}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.last_updated && (
                      <p className="text-xs text-white/20 hidden sm:block">
                        Updated {p.last_updated}
                      </p>
                    )}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer"
                        className="text-white/20 hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Metrics grid */}
                {p.metrics && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {p.metrics.map(m => (
                      <div key={m.label} className="bg-white/3 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-white/30">{m.label}</p>
                          <TrendIcon trend={m.trend} />
                        </div>
                        <p className="text-base font-bold text-white">{m.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Not yet connected */}
      {notConnected.length > 0 && (
        <>
          <h2 className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">
            Not Yet Active ({notConnected.length})
          </h2>
          <div className="space-y-2">
            {visible.map(p => (
              <div key={p.id}
                className="flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/2 opacity-50">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: `${p.color}12` }}>
                  {p.icon}
                </div>
                <p className="text-sm text-white/50">{p.name}</p>
                <span className="ml-auto text-xs text-white/20 border border-white/8 rounded-full px-2 py-0.5">
                  Not active
                </span>
              </div>
            ))}
            {notConnected.length > 2 && !showAll && (
              <button onClick={() => setShowAll(true)}
                className="w-full text-xs text-white/25 hover:text-white/50 transition-colors py-2">
                Show {notConnected.length - 2} more…
              </button>
            )}
          </div>
          <p className="text-xs text-white/20 mt-4 text-center">
            Want to add a platform? Contact your Account Manager to expand your digital presence.
          </p>
        </>
      )}

      {/* If brand has no handles at all */}
      {connected.length === 0 && notConnected.length > 0 && (
        <div className="text-center py-10">
          <p className="text-2xl mb-3">📡</p>
          <p className="text-white/40 text-sm">No platforms connected to your brand yet</p>
          <p className="text-white/20 text-xs mt-1">
            Your Cerebre team will add your social handles during the onboarding process.
          </p>
        </div>
      )}
    </div>
  );
}