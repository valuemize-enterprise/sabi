'use client';

import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const getHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('sabi_token') || '' : ''}`,
});

const HR_ROLES = ['hr', 'super_admin', 'admin', 'md'];

// ── Types ─────────────────────────────────────────────────────────

interface ScoreEntry {
  id:              string;
  score:           number;
  week_start:      string;
  notes?:          string | null;
  scored_by_name?: string | null;
}

interface RatingEntry {
  id:             string;
  rating:         number;
  category?:      string | null;
  note?:          string | null;
  period:         string;
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

const currentWeekStart = () => {
  const d   = new Date();
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

const currentMonthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const Stars = ({ rating, onClick }: { rating: number; onClick?: (r: number) => void }) => (
  <span style={{ fontFamily: 'monospace', letterSpacing: '2px' }}>
    {[1, 2, 3, 4, 5].map(i => (
      <span
        key={i}
        onClick={() => onClick?.(i)}
        style={{
          color: i <= rating ? '#f59e0b' : '#1e293b',
          fontSize: '18px',
          cursor: onClick ? 'pointer' : 'default',
        }}
      >★</span>
    ))}
  </span>
);

const formatWeek = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ── Field style ────────────────────────────────────────────────────

const fS: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px',
  padding: '8px 11px', fontSize: '13px', color: '#f1f5f9',
  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
};

// ── Score chart (SVG) ─────────────────────────────────────────────

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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} onMouseLeave={() => setHovered(null)}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6d28d9" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(v => {
          const yy = y(Math.max(min, Math.min(max, v)));
          return (
            <g key={v}>
              <line x1={PAD} y1={yy} x2={W - PAD} y2={yy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PAD - 4} y={yy + 4} fill="#374151" fontSize="9" textAnchor="end" fontFamily="JetBrains Mono, monospace">{v}</text>
            </g>
          );
        })}
        <polygon points={fillPts} fill="url(#scoreGrad)" />
        <polyline points={points} fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {history.map((h, i) => (
          <g key={h.id}>
            <circle cx={x(i)} cy={y(h.score)} r="4" fill={scoreColour(h.score)} stroke="#0d0d1a" strokeWidth="2" style={{ cursor: 'pointer' }} onMouseEnter={() => setHovered(i)} />
            <circle cx={x(i)} cy={y(h.score)} r="12" fill="transparent" onMouseEnter={() => setHovered(i)} />
          </g>
        ))}
        {hovered !== null && (() => {
          const h = history[hovered];
          const cx = x(hovered), cy = y(h.score), tx = Math.min(cx, W - 110);
          return (
            <g>
              <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3,3" />
              <rect x={tx} y={cy - 50} width="100" height="44" rx="6" fill="#1e1e35" stroke="rgba(255,255,255,0.12)" />
              <text x={tx + 8} y={cy - 30} fill="#f1f5f9" fontSize="14" fontWeight="700" fontFamily="Space Grotesk, sans-serif">{h.score}</text>
              <text x={tx + 8} y={cy - 14} fill="#64748b" fontSize="9" fontFamily="JetBrains Mono, monospace">{formatWeek(h.week_start)}</text>
            </g>
          );
        })()}
      </svg>
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

// ── Log Score Form ────────────────────────────────────────────────

function LogScoreForm({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [open,       setOpen]       = useState(false);
  const [score,      setScore]      = useState('');
  const [weekStart,  setWeekStart]  = useState(currentWeekStart());
  const [notes,      setNotes]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const submit = async () => {
    const s = Number(score);
    if (!score || isNaN(s) || s < 0 || s > 100) return setError('Score must be 0–100');
    setSaving(true); setError(null);
    try {
      const res  = await fetch(`${API}/api/agency/scores/${userId}`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ score: s, week_start: weekStart, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setScore(''); setNotes(''); setOpen(false);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const scoreNum = Number(score);
  const previewColour = score && !isNaN(scoreNum) ? scoreColour(scoreNum) : '#475569';

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)', color: '#c4b5fd' }}
      >
        {open ? '✕ Cancel' : '+ Log Clarity Score'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', padding: '16px', background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
            Log Weekly Clarity Score
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '4px' }}>SCORE (0–100) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="100"
                  value={score} onChange={e => setScore(e.target.value)}
                  placeholder="e.g. 82"
                  style={{ ...fS, paddingRight: '40px' }}
                />
                {score && (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', fontWeight: 800, color: previewColour, fontFamily: 'Space Grotesk, sans-serif' }}>
                    {scoreNum}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '4px' }}>WEEK START (MONDAY) *</label>
              <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={fS} />
            </div>
          </div>

          {/* Score guide */}
          {score && (
            <div style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[{ range: '80–100', label: 'Excellent', colour: '#10b981' }, { range: '60–79', label: 'Good', colour: '#f59e0b' }, { range: '0–59', label: 'Needs Improvement', colour: '#f43f5e' }].map(g => (
                <span key={g.range} style={{ fontSize: '10px', color: g.colour, fontFamily: 'JetBrains Mono, monospace', padding: '2px 8px', background: `${g.colour}12`, borderRadius: '4px' }}>
                  {g.range} · {g.label}
                </span>
              ))}
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '4px' }}>NOTE (optional)</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What influenced this score this week?"
              style={{ ...fS, minHeight: '56px', resize: 'none' }}
            />
          </div>

          {error && <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px' }}>{error}</p>}

          <button
            onClick={submit} disabled={saving || !score || !weekStart}
            style={{ padding: '8px 20px', borderRadius: '7px', background: saving ? 'rgba(109,40,217,0.4)' : '#6d28d9', border: 'none', color: 'white', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {saving ? 'Saving…' : 'Save Score'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Add Rating Form ───────────────────────────────────────────────

const RATING_CATEGORIES = ['Delivery', 'Communication', 'Initiative', 'Teamwork', 'Quality', 'Attitude'];

function AddRatingForm({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [open,     setOpen]     = useState(false);
  const [rating,   setRating]   = useState(0);
  const [category, setCategory] = useState('');
  const [note,     setNote]     = useState('');
  const [period,   setPeriod]   = useState(currentMonthStart());
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const submit = async () => {
    if (!rating) return setError('Select a star rating');
    setSaving(true); setError(null);
    try {
      const res  = await fetch(`${API}/api/agency/scores/${userId}/rating`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ rating, category: category || null, note: note.trim() || null, period }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setRating(0); setCategory(''); setNote(''); setOpen(false);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '7px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}
      >
        {open ? '✕ Cancel' : '+ Add Manager Rating'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', padding: '16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
            Add Team Rating
          </p>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '6px' }}>RATING *</label>
            <Stars rating={rating} onClick={setRating} />
            {rating > 0 && (
              <span style={{ marginLeft: '10px', fontSize: '12px', color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace' }}>
                {['', 'Poor', 'Below average', 'Meets expectations', 'Above average', 'Excellent'][rating]}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '4px' }}>CATEGORY (optional)</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...fS, cursor: 'pointer' }}>
                <option value="" style={{ background: '#1e1e35' }}>General</option>
                {RATING_CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#1e1e35' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '4px' }}>PERIOD</label>
              <input type="date" value={period} onChange={e => setPeriod(e.target.value)} style={fS} />
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace', display: 'block', marginBottom: '4px' }}>NOTE (optional)</label>
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="What's behind this rating?"
              style={{ ...fS, minHeight: '56px', resize: 'none' }}
            />
          </div>

          {error && <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '8px' }}>{error}</p>}

          <button
            onClick={submit} disabled={saving || !rating}
            style={{ padding: '8px 20px', borderRadius: '7px', background: saving ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {saving ? 'Saving…' : 'Save Rating'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

interface PerformanceTabProps {
  userId:      string;
  displayName: string;
  viewerRole:  string;  // HR_ROLES see log forms; others read-only
}

export function PerformanceTab({ userId, displayName, viewerRole }: PerformanceTabProps) {
  const [data,    setData]    = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isHR = HR_ROLES.includes(viewerRole);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/api/agency/scores/${userId}`, { headers: getHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load scores');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
      {[80, 200, 100].map((h, i) => (
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

  const hasScores  = (data?.score_history?.length ?? 0) > 0;
  const hasRatings = (data?.ratings?.length ?? 0) > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
          Performance Summary
        </p>
        {isHR && (
          <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            HR view — log forms below
          </span>
        )}
      </div>

      {/* HR log forms */}
      {isHR && (
        <div style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <LogScoreForm  userId={userId} onSaved={load} />
          <AddRatingForm userId={userId} onSaved={load} />
        </div>
      )}

      {/* Summary chips */}
      {data && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Current Score',  value: data.current_score  != null ? `${data.current_score}`  : '—', sub: data.trend != null ? `${data.trend >= 0 ? '+' : ''}${data.trend} vs last week` : 'No history yet', colour: data.current_score != null ? scoreColour(data.current_score) : '#475569' },
            { label: '6-Week Average', value: data.average_score  != null ? `${data.average_score}`  : '—', sub: `${data.score_history.length} data point${data.score_history.length !== 1 ? 's' : ''}`, colour: data.average_score != null ? scoreColour(data.average_score) : '#475569' },
            { label: 'Team Rating',    value: data.avg_rating     != null ? `${data.avg_rating}/5`   : '—', sub: `${data.ratings.length} rating${data.ratings.length !== 1 ? 's' : ''}`, colour: '#f59e0b' },
          ].map(chip => (
            <div key={chip.label} style={{ flex: 1, minWidth: '110px', padding: '12px 14px', background: 'rgba(255,255,255,0.025)', border: `1px solid ${chip.colour}25`, borderRadius: '10px' }}>
              <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 800, color: chip.colour, marginBottom: '2px' }}>{chip.value}</p>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>{chip.label}</p>
              <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{chip.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Score chart */}
      {hasScores ? (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
            Clarity Score History
          </p>
          <ScoreChart history={data!.score_history} />
          {data?.score_history.at(-1)?.notes && (
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', fontStyle: 'italic' }}>
              Latest note: "{data.score_history.at(-1)!.notes}"
            </p>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '24px', padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', textAlign: 'center' }}>
          <p style={{ fontSize: '24px', marginBottom: '8px' }}>📊</p>
          <p style={{ fontSize: '13px', color: '#475569' }}>No clarity scores logged yet for {displayName}.</p>
          {isHR && <p style={{ fontSize: '11px', color: '#374151', marginTop: '4px', fontFamily: 'JetBrains Mono, monospace' }}>Use the "Log Clarity Score" button above to add the first one.</p>}
        </div>
      )}

      {/* Ratings */}
      {hasRatings && (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '12px' }}>
            Manager Ratings
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data!.ratings.map(r => (
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
                  {r.note && <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>"{r.note}"</p>}
                  <p style={{ fontSize: '10px', color: '#374151', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                    {r.rated_by_name || 'Manager'} · {new Date(r.period).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: '#f59e0b', flexShrink: 0 }}>{r.rating}/5</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}