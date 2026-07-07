'use client';

import { useState } from 'react';
import { Plus, X, ExternalLink, Link } from 'lucide-react';
import { detectLinkType, buildProofLink, LINK_META, type ProofLink } from '@/lib/permissions';

interface Props {
  value:    ProofLink[];
  onChange: (links: ProofLink[]) => void;
}

const BADGE_COLORS: Record<string, string> = {
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/25',
  green:  'bg-green-500/15 text-green-400 border-green-500/25',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/25',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  red:    'bg-red-500/15 text-red-400 border-red-500/25',
  gray:   'bg-white/5 text-white/40 border-white/10',
};

export function ProofLinksInput({ value, onChange }: Props) {
  const [url, setUrl]     = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const detected = url ? detectLinkType(url) : null;
  const detectedMeta = detected ? LINK_META[detected] : null;

  const add = () => {
    if (!url.trim()) { setError('Paste a link first'); return; }
    try { new URL(url.trim()); } catch { setError('That doesn\'t look like a valid URL'); return; }
    const link = buildProofLink(url.trim(), label.trim() || undefined);
    onChange([...value, link]);
    setUrl(''); setLabel(''); setError('');
  };

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  };

  return (
    <div>
      <label className="text-xs text-white/50 mb-1.5 block">
        Proof Links <span className="text-white/20">(paste any URL as evidence)</span>
      </label>

      {/* Existing links */}
      {value.length > 0 && (
        <div className="space-y-2 mb-3">
          {value.map((link, i) => {
            const meta = LINK_META[link.type];
            return (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/3 border border-white/6 group">
                <span className="text-base flex-shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{link.label}</p>
                  <p className="text-[10px] text-white/30 truncate">{link.url}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 hidden sm:inline-flex ${BADGE_COLORS[meta.color] ?? BADGE_COLORS.gray}`}>
                  {meta.label}
                </span>
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-white/20 hover:text-purple-400 transition-colors flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={() => remove(i)}
                  className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new link */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {detectedMeta
                ? <span className="text-sm">{detectedMeta.icon}</span>
                : <Link className="w-4 h-4 text-white/25" />}
            </div>
            <input
              className="sabi-input pl-9 text-sm"
              placeholder="Paste Google Meet, Sheets, Canva, any link…"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button type="button" onClick={add}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-600/20 border border-purple-500/30 text-purple-300 rounded-xl hover:bg-purple-600/30 transition-all flex-shrink-0">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {/* Auto-detected type + optional label */}
        {url && detectedMeta && (
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${BADGE_COLORS[detectedMeta.color] ?? BADGE_COLORS.gray}`}>
              {detectedMeta.icon} {detectedMeta.label} detected
            </span>
            <input
              className="sabi-input text-xs flex-1 py-1.5"
              placeholder="Optional label (e.g. July Content Calendar)"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
