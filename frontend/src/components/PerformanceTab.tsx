'use client';

import React, { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
});

// ── Types ─────────────────────────────────────────────────────────

interface ScoreEntry {
  id:             string;
  score:          number;
  week_start:     string;
  notes?:         string | null;
  scored_by_name?: string | null;
}

interface RatingEntry {
  id:            string;
  rating:        number;
  category?:     string | null;
  note?:         string | null;
  period:        string;
  rated_by_name?: string | null;
}

interface ScoreData {
  user_id:       string;
  current_score: number | null;
  average_score: number | null;
  trend:         number | null;
  avg_rating:    number | null;
  score_history: ScoreEntry[];
  ratings:       RatingEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────

const scoreColour = (s: number) =>
  s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#f43f5e';

const Stars = ({ rating }: { rating: number }) => (
  <span style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} style={{ color: i <= rating ? '#f59e0b' : '#1e293b', fontSize: '14px' }}>★</span>
    ))}
  </span>
);

const formatWeek = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ── Sparkline chart — pure CSS/SVG, no library ────────────────────

const ScoreChart = ({ history }: { history: ScoreEntry[] }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!history.length) return null;

  const W = 560, H = 140, PAD = 16;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  const scores = history.map(h => h.score);
  const min    = Math.max(0,   Math.min(...scores) - 10);
  const max    = Math.min(100, Math.max(...scores) + 10);
  const range  = max - min || 1;

  const x = (i: number) => PAD + (i / Math.max(history.length - 1, 1)) * plotW;
  const y = (s: number) => PAD + plotH - ((s - min) / range) * plotH;

  const points = history.map((h, i) => `${x(i)},${y(h.score)}`).join(' ');
  const fillPts = `${x(0)},${y(min)} ${points} ${x(history.length - 1)},${y(min)}`;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6d28d9" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(v => {
          const yy = y(Math.max(min, Math.min(max, v)));
          return (
            <g key={v}>
              <line x1={PAD} y1={yy} x2={W - PAD} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PAD - 4} y={yy + 4} fill="#374151" fontSize="9" textAnchor="end"
                    fontFamily="JetBrains Mono, monospace">{v}</text>
            </g>
          );
        })}

        {/* Fill */}
        <polygon points={fillPts} fill="url(#scoreGrad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#6d28d9"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {history.map((h, i) => (
          <g key={h.id}>
            <circle
              cx={x(i)} cy={y(h.score)} r="4"
              fill={scoreColour(h.score)}
              stroke="#0d0d1a" strokeWidth="2"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)}
            />
            {/* Invisible larger hit area */}
            <circle cx={x(i)} cy={y(h.score)} r="12" fill="transparent"
              onMouseEnter={() => setHovered(i)} />
          </g>
        ))}

        {/* Hover tooltip */}
        {hovered !== null && (() => {
          const h  = history[hovered];
          const cx = x(hovered);
          const cy = y(h.score);
          const tx = Math.min(cx, W - 100);
          return (
            <g>
              <line x1={cx} y1={PAD} x2={cx} y2={H - PAD}
                stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3" />
              <rect x={tx} y={cy - 48} width="90" height="42"
                rx="6" fill="#1e1e35" stroke="rgba(255,255,255,0.12)" />
              <text x={tx + 8} y={cy - 30} fill="#f1f5f9" fontSize="13" fontWeight="700"
                    fontFamily="Space Grotesk, sans-serif">{h.score}</text>
              <text x={tx + 8} y={cy - 14} fill="#64748b" fontSize="9"
                    fontFamily="JetBrains Mono, monospace">{formatWeek(h.week_start)}</text>
            </g>
          );
        })()}
      </svg>

      {/* X-axis labels — show first, middle, last */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingInline: `${PAD}px`, marginTop: '-4px' }}>
        {[0, Math.floor(history.length / 2), history.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i && history[v])
          .map(i => (
            <span key={i} style={{ fontSize: '9px', color: '#374151', fontFamily: 'JetBrains Mono, monospace' }}>
              {formatWeek(history[i].week_start)}
            </span>
          ))}
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────

export function PerformanceTab({ userId, displayName }: { userId: string; displayName: string }) {
  const [data,    setData]    = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res  = await fetch(`${API}/api/agency/scores/${userId}`, { headers: getHeaders() });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load scores');
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
      {[80, 200, 120].map((h, i) => (
        <div key={i} style={{ height: `${h}px`, background: 'rgba(255,255,255,0.03)', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.6}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ marginTop: '12px', padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fca5a5' }}>
      {error}
    </div>
  );

  if (!data) return null;

  const hasScores  = data.score_history.length > 0;
  const hasRatings = data.ratings.length > 0;

  return (
    <div>
      <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>
        Performance Summary
      </p>

      {/* Summary stat chips */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          {
            label: 'Current Score',
            value: data.current_score != null ? `${data.current_score}` : '—',
            sub:   data.trend != null
              ? `${data.trend >= 0 ? '+' : ''}${data.trend} vs last week`
              : 'No history yet',
            colour: data.current_score != null ? scoreColour(data.current_score) : '#475569',
          },
          {
            label: '6-Week Average',
            value: data.average_score != null ? `${data.average_score}` : '—',
            sub:   `${data.score_history.length} data point${data.score_history.length !== 1 ? 's' : ''}`,
            colour: data.average_score != null ? scoreColour(data.average_score) : '#475569',
          },
          {
            label: 'Team Rating',
            value: data.avg_rating != null ? `${data.avg_rating}/5` : '—',
            sub:   `${data.ratings.length} rating${data.ratings.length !== 1 ? 's' : ''}`,
            colour: '#f59e0b',
          },
        ].map(chip => (
          <div key={chip.label} style={{
            flex: 1, minWidth: '120px', padding: '12px 16px',
            background: 'rgba(255,255,255,0.025)', border: `1px solid ${chip.colour}25`,
            borderRadius: '10px',
          }}>
            <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 800, color: chip.colour, marginBottom: '2px' }}>
              {chip.value}
            </p>
            <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>{chip.label}</p>
            <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{chip.sub}</p>
          </div>
        ))}
      </div>

      {/* Score chart */}
      {hasScores ? (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
            Clarity Score History
          </p>
          <ScoreChart history={data.score_history} />
          {/* Latest note */}
          {data.score_history.at(-1)?.notes && (
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', fontStyle: 'italic' }}>
              Latest note: "{data.score_history.at(-1)!.notes}"
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#475569' }}>No clarity scores logged yet for {displayName}.</p>
          <p style={{ fontSize: '11px', color: '#374151', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>
            {/* POST /api/agency/scores/{userId} to add the first score. */}
          </p>
        </div>
      )}

      {/* Ratings list */}
      {hasRatings && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
            Manager Ratings
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.ratings.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <Stars rating={r.rating} />
                    {r.category && (
                      <span style={{ fontSize: '10px', color: '#c4b5fd', fontFamily: 'JetBrains Mono, monospace', padding: '1px 7px', background: 'rgba(109,40,217,0.12)', borderRadius: '4px' }}>
                        {r.category}
                      </span>
                    )}
                  </div>
                  {r.note && (
                    <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>"{r.note}"</p>
                  )}
                  <p style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                    {r.rated_by_name || 'Manager'} · {new Date(r.period).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: '#f59e0b', flexShrink: 0 }}>
                  {r.rating}/5
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
