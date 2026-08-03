'use client';

/**
 * /brands/[Id]/connect/page.tsx
 * Platform Connections — Connect Instagram, Facebook, and other platforms
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle,
  Unlink, ExternalLink, Clock, Users, Eye, TrendingUp, Zap,
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Connection {
  id:              string;
  platform:        string;
  account_id:      string;
  account_name:    string;
  account_picture: string | null;
  token_expiry:    string | null;
  last_synced_at:  string | null;
  sync_error:      string | null;
  is_active:       boolean;
  metadata:        Record<string, any>;
  connected_at:    string;
}

interface Analytics {
  instagram?: { metrics: Record<string, number>; metric_date: string };
  facebook?:  { metrics: Record<string, number>; metric_date: string };
}

// ── Platform catalogue (what can be connected) ────────────────────────────────

const PLATFORMS = [
  {
    id:       'meta',
    label:    'Instagram + Facebook',
    covers:   ['instagram', 'facebook'],
    icon:     '📱',
    color:    'from-purple-600 to-pink-500',
    bg:       'bg-purple-500/10',
    border:   'border-purple-500/20',
    iconBg:   'bg-gradient-to-br from-purple-600 to-pink-500',
    desc:     'Connect your Meta Business account to pull Instagram and Facebook analytics automatically.',
    scope:    'Followers, reach, impressions, engagement — updated daily',
  },
  {
    id:       'google_analytics',
    label:    'Google Analytics',
    covers:   ['google_analytics'],
    icon:     '📊',
    color:    'from-blue-500 to-cyan-400',
    bg:       'bg-blue-500/10',
    border:   'border-blue-500/20',
    iconBg:   'bg-gradient-to-br from-blue-500 to-cyan-400',
    desc:     'Pull website traffic, sessions, and conversion data directly from GA4.',
    scope:    'Sessions, bounce rate, conversions — coming soon',
    comingSoon: true,
  },
  {
    id:       'tiktok',
    label:    'TikTok',
    covers:   ['tiktok'],
    icon:     '🎵',
    color:    'from-gray-800 to-gray-600',
    bg:       'bg-white/5',
    border:   'border-white/10',
    iconBg:   'bg-gray-800',
    desc:     'Connect TikTok for Business to track video views and follower growth.',
    scope:    'Views, followers, engagement — coming soon',
    comingSoon: true,
  },
];

// ── API helpers ───────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || '';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;

async function apiFetch(path: string, init?: RequestInit) {
  const res  = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="sabi-card p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-purple-400" />
      </div>
      <div>
        <p className="text-xs text-white/30">{label}</p>
        <p className="text-sm font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}

// ── Instagram analytics panel ─────────────────────────────────────────────────

function InstagramPanel({ data }: { data: { metrics: Record<string, number>; metric_date: string } }) {
  const m = data.metrics;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">
        Instagram · last synced {data.metric_date}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Followers"     value={m.followers     ?? 0} icon={Users}      />
        <StatCard label="Reach (wk)"    value={m.reach         ?? 0} icon={Eye}        />
        <StatCard label="Impressions"   value={m.impressions   ?? 0} icon={TrendingUp} />
        <StatCard label="Engage rate"   value={`${m.engagement_rate ?? 0}%`} icon={Zap} />
      </div>
    </div>
  );
}

// ── Facebook analytics panel ──────────────────────────────────────────────────

function FacebookPanel({ data }: { data: { metrics: Record<string, number>; metric_date: string } }) {
  const m = data.metrics;
  return (
    <div className="mt-3 space-y-3">
      <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider">
        Facebook · last synced {data.metric_date}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Page fans"     value={m.page_fans           ?? 0} icon={Users}      />
        <StatCard label="Reach (wk)"    value={m.page_reach          ?? 0} icon={Eye}        />
        <StatCard label="Impressions"   value={m.page_impressions    ?? 0} icon={TrendingUp} />
        <StatCard label="Engaged"       value={m.page_engaged_users  ?? 0} icon={Zap}        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const { Id: brandId }   = useParams<{ Id: string }>();
  const searchParams       = useSearchParams();
  const router             = useRouter();
  const { user }           = useAgencyStore();

  const [connections, setConnections]   = useState<Connection[]>([]);
  const [analytics,   setAnalytics]     = useState<Analytics>({});
  const [loading,     setLoading]       = useState(true);
  const [syncing,     setSyncing]       = useState(false);
  const [connecting,  setConnecting]    = useState<string | null>(null);
  const [error,       setError]         = useState<string | null>(null);
  const [successMsg,  setSuccessMsg]    = useState<string | null>(null);

  // Handle OAuth callback result from URL params
  useEffect(() => {
    const connectSuccess = searchParams.get('connect_success');
    const connectError   = searchParams.get('connect_error');
    const count          = searchParams.get('count');

    if (connectSuccess) {
      setSuccessMsg(`${count || 'Your'} platform${Number(count) !== 1 ? 's' : ''} connected successfully. Analytics will appear shortly.`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (connectError) {
      setError(decodeURIComponent(connectError));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [connRes, analyticsRes] = await Promise.all([
        apiFetch(`/api/platforms/${brandId}/connections`),
        apiFetch(`/api/platforms/${brandId}/analytics`),
      ]);
      setConnections(connRes.connections || []);
      setAnalytics(analyticsRes.analytics || {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  // ── Connect Meta ───────────────────────────────────────────────────────────
  const connectMeta = async () => {
    setConnecting('meta'); setError(null);
    try {
      const res = await apiFetch(`/api/platforms/${brandId}/connect/meta`);
      // Redirect the browser to Meta's OAuth page
      window.location.href = res.url;
    } catch (e: any) {
      setError(e.message);
      setConnecting(null);
    }
  };

  // ── Manual sync ────────────────────────────────────────────────────────────
  const syncNow = async () => {
    setSyncing(true); setError(null);
    try {
      const res = await apiFetch(`/api/platforms/${brandId}/sync`, { method: 'POST' });
      setSuccessMsg(res.message || 'Sync complete');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = async (connectionId: string, name: string) => {
    if (!confirm(`Disconnect "${name}"? Analytics will stop updating.`)) return;
    try {
      await apiFetch(`/api/platforms/${brandId}/connections/${connectionId}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isConnected = (covers: string[]) =>
    covers.some(p => connections.some(c => c.platform === p && c.is_active));

  const getConnections = (covers: string[]) =>
    connections.filter(c => covers.includes(c.platform) && c.is_active);

  const hasAnyConnection = connections.some(c => c.is_active);
  const tokenExpiringSoon = connections.some(c =>
    c.token_expiry && new Date(c.token_expiry) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">

      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white mb-1">Platform connections</h1>
          <p className="text-sm text-white/40">Connect social and analytics platforms to power ClarityScore™ and brand reports.</p>
        </div>
        {hasAnyConnection && (
          <button onClick={syncNow} disabled={syncing}
            className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/20 rounded-xl px-3 py-2 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync all now'}
          </button>
        )}
      </div>

      {/* Banners */}
      {successMsg && (
        <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-5">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-green-300">{successMsg}</p>
            <button onClick={() => setSuccessMsg(null)} className="text-xs text-green-400/60 mt-1">Dismiss</button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400/60 mt-1">Dismiss</button>
          </div>
        </div>
      )}

      {tokenExpiringSoon && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">One or more platform connections will expire soon. Reconnect to keep analytics updating.</p>
        </div>
      )}

      {/* Platform cards */}
      <div className="space-y-4">
        {PLATFORMS.map(platform => {
          const connected   = isConnected(platform.covers);
          const conns       = getConnections(platform.covers);

          return (
            <div key={platform.id} className={`sabi-card p-5 ${platform.border} border`}>

              {/* Platform header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${platform.iconBg} flex items-center justify-center text-xl flex-shrink-0`}>
                    {platform.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">{platform.label}</p>
                      {connected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Connected
                        </span>
                      )}
                      {platform.comingSoon && (
                        <span className="text-[10px] font-bold text-white/30 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{platform.scope}</p>
                  </div>
                </div>

                {/* Connect / reconnect button */}
                {!platform.comingSoon && (
                  connected ? (
                    <button onClick={() => platform.id === 'meta' && connectMeta()}
                      className="text-xs text-white/40 hover:text-white transition-colors border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
                      <ExternalLink className="w-3 h-3" /> Reconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => platform.id === 'meta' && connectMeta()}
                      disabled={connecting === platform.id}
                      className="flex items-center gap-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {connecting === platform.id ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Redirecting…</>
                      ) : (
                        <>Connect {platform.label}</>
                      )}
                    </button>
                  )
                )}
              </div>

              {/* Description (not connected) */}
              {!connected && (
                <p className="text-xs text-white/30 leading-relaxed mb-2">{platform.desc}</p>
              )}

              {/* Connected accounts list */}
              {conns.length > 0 && (
                <div className="space-y-2">
                  {conns.map(conn => (
                    <div key={conn.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                      {conn.account_picture ? (
                        <img src={conn.account_picture} alt={conn.account_name}
                          className="w-7 h-7 rounded-full flex-shrink-0 object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-purple-400">
                          {(conn.account_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{conn.account_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-white/30 capitalize">{conn.platform}</span>
                          {conn.last_synced_at && (
                            <span className="text-[10px] text-white/20 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(conn.last_synced_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {conn.sync_error && (
                          <p className="text-[10px] text-amber-400 mt-0.5">{conn.sync_error}</p>
                        )}
                      </div>
                      <button onClick={() => disconnect(conn.id, conn.account_name)}
                        title="Disconnect"
                        className="text-white/20 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Analytics panels */}
              {analytics.instagram && platform.covers.includes('instagram') && (
                <InstagramPanel data={analytics.instagram} />
              )}
              {analytics.facebook && platform.covers.includes('facebook') && (
                <FacebookPanel data={analytics.facebook} />
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="mt-6 sabi-card p-4 border border-white/5">
        <p className="text-xs text-white/30 leading-relaxed">
          <strong className="text-white/50">How this works:</strong> Connected platforms sync once daily at 6 AM. Metrics feed directly into your brand's ClarityScore™ and ARIA weekly reports. Platform tokens are stored encrypted and never shared. You can disconnect at any time.
        </p>
      </div>
    </div>
  );
}
