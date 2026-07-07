'use client';

import { Lightbulb, Calendar, ChevronRight, Target } from 'lucide-react';

interface Strategy {
  id:          string;
  title:       string;
  type:        string;
  description?: string;
  start_date?:  string;
  end_date?:    string;
  status:       string;
}

const TYPE_ICON: Record<string, string> = {
  content:'✍️', social:'📱', paid:'📣', seo:'🔍', email:'📧',
  brand:'🎯', campaign:'🚀', quarterly:'📊', annual:'🗓️', other:'📌',
};

const STATUS_COLOR: Record<string, string> = {
  active:'text-green-400 bg-green-500/10 border-green-500/20',
  draft: 'text-white/30 bg-white/5 border-white/10',
  paused:'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

interface Props {
  strategy:   Strategy;
  compact?:   boolean;
  selected?:  boolean;
  onClick?:   () => void;
}

/**
 * StrategyCard
 * Used on the staff dashboard as a "Big Picture" banner
 * and in the work log form as a selectable strategy option.
 */
export function StrategyCard({ strategy: s, compact, selected, onClick }: Props) {
  const icon = TYPE_ICON[s.type] ?? '📌';

  if (compact) {
    return (
      <button type={onClick ? 'button' : undefined} onClick={onClick}
        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
          selected
            ? 'border-purple-500/50 bg-purple-500/15'
            : 'border-white/5 hover:border-white/10 hover:bg-white/3'
        }`}>
        <span className="text-lg flex-shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${selected ? 'text-purple-300' : 'text-white/80'}`}>
            {s.title}
          </p>
          {s.description && (
            <p className="text-xs text-white/35 mt-0.5 line-clamp-1">{s.description}</p>
          )}
          {(s.start_date || s.end_date) && (
            <p className="text-[10px] text-white/25 mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {s.start_date && s.end_date
                ? `${s.start_date} → ${s.end_date}`
                : s.start_date || s.end_date}
            </p>
          )}
        </div>
        {selected && (
          <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        )}
      </button>
    );
  }

  // Full size — used on staff dashboard as "Big Picture" banner
  return (
    <div className="sabi-card p-5"
      style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(13,13,26,1) 70%)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <p className="text-[10px] text-purple-400/60 font-semibold uppercase tracking-widest">
              Active Strategy
            </p>
            <p className="text-xs text-white/30 capitalize">{s.type?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide capitalize ${STATUS_COLOR[s.status] ?? STATUS_COLOR.draft}`}>
          {s.status}
        </span>
      </div>

      <h3 className="text-base font-bold text-white mb-2 leading-snug">{s.title}</h3>

      {s.description && (
        <p className="text-sm text-white/45 leading-relaxed mb-3 line-clamp-3">{s.description}</p>
      )}

      {(s.start_date || s.end_date) && (
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <Calendar className="w-3.5 h-3.5" />
          {s.start_date && <span>{s.start_date}</span>}
          {s.start_date && s.end_date && <span>→</span>}
          {s.end_date && <span>{s.end_date}</span>}
        </div>
      )}
    </div>
  );
}
