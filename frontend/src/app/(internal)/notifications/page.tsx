'use client';

import { Bell, CheckCheck, AlertCircle, Info, Trophy, AlertTriangle, X } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';

// ── API ───────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined'
    ? localStorage.getItem('sabi_token') || '' : ''}`,
});

const apiFetch = async (path: string, init: RequestInit = {}) => {
  const res  = await fetch(`${API}${path}`, { ...init, headers: { ...getHeaders(), ...(init.headers || {}) } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
};

// ── Types ─────────────────────────────────────────────────────────

interface Notification {
  id:         string;
  type:       'success' | 'warning' | 'info' | 'error';
  title:      string;
  body?:      string | null;
  metadata?:  Record<string, unknown>;
  is_read:    boolean;
  read_at?:   string | null;
  created_at: string;
}

// ── Icon + colour maps ────────────────────────────────────────────

const NOTIF_ICONS: Record<string, React.ElementType> = {
  success: Trophy,
  warning: AlertTriangle,
  info:    Info,
  error:   AlertCircle,
};

const NOTIF_COLORS: Record<string, string> = {
  success: 'text-green-400 bg-green-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  info:    'text-blue-400 bg-blue-500/10',
  error:   'text-red-400 bg-red-500/10',
};

// ── Relative time ─────────────────────────────────────────────────

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ── Notification row ──────────────────────────────────────────────

function NotifRow({
  n, onRead, onDelete,
}: {
  n:        Notification;
  onRead:   (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = NOTIF_ICONS[n.type] || Info;

  return (
    <div
      onClick={() => !n.is_read && onRead(n.id)}
      className={`group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer relative ${
        n.is_read
          ? 'border-white/5 bg-transparent hover:bg-white/[0.02]'
          : 'border-white/8 bg-white/[0.03] hover:bg-white/5'
      }`}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${NOTIF_COLORS[n.type]}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${n.is_read ? 'text-white/60' : 'text-white'}`}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{n.body}</p>
        )}
        <p className="text-xs text-white/20 mt-2">{relativeTime(n.created_at)}</p>
      </div>

      {/* Unread dot */}
      {!n.is_read && (
        <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-2" />
      )}

      {/* Delete button — appears on hover */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(n.id); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-white/60 p-1"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [filter,        setFilter]        = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(
        `/api/notifications/mine?limit=50${filter === 'unread' ? '&unread_only=true' : ''}`
      );
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(c => Math.max(0, c - 1));
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      load(); // revert on failure
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    } catch {
      load();
    }
  };

  const deleteNotif = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch {
      load();
    }
  };

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <AgencyTopNav title="Notifications" unreadCount={unreadCount} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-white/40 mt-1">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-white/[0.02] rounded-lg p-1 w-fit">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
          {error}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="w-10 h-10 text-white/10 mb-4" />
          <p className="text-sm text-white/30">
            {filter === 'unread' ? 'All caught up.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <NotifRow key={n.id} n={n} onRead={markRead} onDelete={deleteNotif} />
          ))}
        </div>
      )}
    </div>
  );
}
