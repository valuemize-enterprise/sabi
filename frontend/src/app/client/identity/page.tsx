'use client';

import { useState, useEffect } from 'react';
import {
  Palette, BookOpen, Target, Volume2, FileText, Image,
  ChevronRight, Loader2, ExternalLink, Globe
} from 'lucide-react';
import { clientPortal } from '@/lib/api';
import { LoadingPage } from '@/components/ui';

const ARCHETYPES: Record<string, { label: string; icon: string; desc: string }> = {
  ruler:     { label: 'The Ruler',     icon: '👑', desc: 'Power, control, responsibility.' },
  creator:   { label: 'The Creator',   icon: '🎨', desc: 'Innovation, imagination, vision.' },
  sage:      { label: 'The Sage',      icon: '🦉', desc: 'Wisdom, knowledge, truth.' },
  innocent:  { label: 'The Innocent',  icon: '☀️', desc: 'Safety, optimism, simplicity.' },
  explorer:  { label: 'The Explorer',  icon: '🧭', desc: 'Freedom, adventure, discovery.' },
  rebel:     { label: 'The Rebel',     icon: '⚡', desc: 'Revolution, disruption, change.' },
  magician:  { label: 'The Magician',  icon: '✨', desc: 'Transformation, vision, wonder.' },
  hero:      { label: 'The Hero',      icon: '🛡️', desc: 'Courage, achievement, mastery.' },
  lover:     { label: 'The Lover',     icon: '❤️', desc: 'Intimacy, passion, commitment.' },
  jester:    { label: 'The Jester',    icon: '🎭', desc: 'Joy, humor, lightness.' },
  everyman:  { label: 'The Everyman',  icon: '🤝', desc: 'Belonging, realism, empathy.' },
  caregiver: { label: 'The Caregiver', icon: '💚', desc: 'Nurturing, service, compassion.' },
};

const ASSET_ICONS: Record<string, string> = {
  logo: '🎯', icon: '⚡', image: '📸', font: '🔤', template: '📄', other: '📁',
};

export default function ClientBrandIdentityPage() {
  const [identity, setIdentity] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'story' | 'archetype' | 'voice' | 'visual' | 'assets' | 'guidelines'>('overview');

  useEffect(() => {
    clientPortal.brandIdentity()
      .then((r: any) => setIdentity(r.data?.identity ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingPage label="Loading brand identity…" />;
  if (!identity) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="sabi-card p-10 text-center">
        <Palette className="w-10 h-10 text-white/15 mx-auto mb-3"/>
        <p className="text-white/40 text-sm">Brand identity not available yet.</p>
        <p className="text-white/25 text-xs mt-1">Your agency will set this up for you.</p>
      </div>
    </div>
  );

  const archetype = identity.brand_archetype ? ARCHETYPES[identity.brand_archetype] : null;
  const voice = identity.brand_voice ?? {};
  const colors = identity.brand_colors ?? [];
  const dos = identity.dos_and_donts?.dos ?? [];
  const donts = identity.dos_and_donts?.donts ?? [];
  const assets = identity.brand_assets ?? [];

  const TABS = [
    { key: 'overview',   label: 'Overview',    icon: Palette },
    { key: 'story',      label: 'Story',       icon: BookOpen },
    { key: 'archetype',  label: 'Archetype',   icon: Target },
    { key: 'voice',      label: 'Voice',       icon: Volume2 },
    { key: 'visual',     label: 'Visual',      icon: Image },
    { key: 'assets',     label: 'Assets',      icon: FileText },
  ] as const;

  const VoiceBar = ({ left, right, value }: { left: string; right: string; value: number }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-xs text-white/40">{left}</span>
        <span className="text-xs text-white/40">{right}</span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="absolute left-0 top-0 h-full bg-purple-500 rounded-full transition-all" style={{ width: `${value}%` }}/>
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-purple-500 shadow-lg" style={{ left: `calc(${value}% - 6px)` }}/>
      </div>
      <p className="text-[10px] text-center text-white/25">
        {value < 35 ? left : value > 65 ? right : 'Balanced'}
      </p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header card */}
      <div className="sabi-card p-6 mb-5">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            {identity.logo_url
              ? <img src={identity.logo_url} alt={identity.name} className="w-full h-full object-contain p-1"/>
              : <span className="text-3xl font-black text-white/20">{identity.name?.[0]?.toUpperCase()}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{identity.name}</h1>
            {identity.tagline && <p className="text-sm text-purple-400 mt-1 italic">"{identity.tagline}"</p>}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {identity.industry && <span className="text-xs text-white/40 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">{identity.industry}</span>}
              {archetype && <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">{archetype.icon} {archetype.label}</span>}
              {identity.website && (
                <a href={identity.website.startsWith('http') ? identity.website : `https://${identity.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-400/70 hover:text-blue-400 flex items-center gap-0.5 transition-colors">
                  <Globe className="w-3 h-3"/> {identity.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>
        {identity.mission_statement && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-1">Mission</p>
            <p className="text-sm text-white/65 leading-relaxed">{identity.mission_statement}</p>
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 mb-5 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === key ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
            }`}>
            <Icon className="w-3.5 h-3.5"/>{label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ───────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {identity.tagline && (
              <div className="sabi-card p-4 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Tagline</p>
                <p className="text-sm font-medium text-white italic">"{identity.tagline}"</p>
              </div>
            )}
            {archetype && (
              <div className="sabi-card p-4 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Archetype</p>
                <p className="text-2xl mb-1">{archetype.icon}</p>
                <p className="text-xs font-medium text-white">{archetype.label}</p>
              </div>
            )}
            {colors.length > 0 && (
              <div className="sabi-card p-4 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Colors</p>
                <div className="flex justify-center gap-1.5 mt-1">
                  {colors.slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: c.hex }} title={c.name}/>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mission */}
          {identity.mission_statement && (
            <div className="sabi-card p-5">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Mission Statement</p>
              <p className="text-sm text-white/65 leading-relaxed">{identity.mission_statement}</p>
            </div>
          )}

          {/* Target Audience */}
          {identity.target_audience && (
            <div className="sabi-card p-5">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Target Audience</p>
              <p className="text-sm text-white/65 leading-relaxed">{identity.target_audience}</p>
            </div>
          )}

          {/* Social handles */}
          {identity.social_handles && Object.values(identity.social_handles).some(v => v) && (
            <div className="sabi-card p-5">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Social Presence</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(identity.social_handles).filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="text-xs bg-white/5 border border-white/10 text-white/50 px-3 py-1 rounded-full capitalize">{k}: {v as string}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Story tab ──────────────────────────────────────── */}
      {activeTab === 'story' && (
        <div className="space-y-4">
          {identity.brand_story ? (
            <div className="sabi-card p-6">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">Brand Story</p>
              <div className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{identity.brand_story}</div>
            </div>
          ) : (
            <div className="sabi-card p-8 text-center">
              <BookOpen className="w-8 h-8 text-white/15 mx-auto mb-2"/>
              <p className="text-sm text-white/35">Brand story not yet written.</p>
            </div>
          )}
          {identity.target_audience && (
            <div className="sabi-card p-6">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Target Audience</p>
              <p className="text-sm text-white/65 leading-relaxed">{identity.target_audience}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Archetype tab ──────────────────────────────────── */}
      {activeTab === 'archetype' && (
        <div className="sabi-card p-6">
          {archetype ? (
            <>
              <div className="p-5 bg-purple-500/10 border border-purple-500/20 rounded-xl mb-5">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{archetype.icon}</span>
                  <div>
                    <p className="text-lg font-bold text-white">{archetype.label}</p>
                    <p className="text-sm text-white/50">{archetype.desc}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">All Archetypes</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(ARCHETYPES).map(([key, a]) => (
                  <div key={key} className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                    key === identity.brand_archetype
                      ? 'border-purple-500/40 bg-purple-500/15'
                      : 'border-white/5 opacity-40'
                  }`}>
                    <span className="text-xl">{a.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{a.label}</p>
                      <p className="text-[10px] text-white/30">{a.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Target className="w-8 h-8 text-white/15 mx-auto mb-2"/>
              <p className="text-sm text-white/35">Archetype not yet defined.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Voice tab ──────────────────────────────────────── */}
      {activeTab === 'voice' && (
        <div className="space-y-4">
          {(voice.formal_casual != null || voice.serious_playful != null || voice.conservative_bold != null) ? (
            <div className="sabi-card p-6 space-y-8">
              <div>
                <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-1">Brand Voice Matrix</p>
                <p className="text-xs text-white/25 mb-6">How the brand communicates.</p>
                <div className="space-y-8">
                  {voice.formal_casual != null && <VoiceBar left="Formal" right="Casual" value={voice.formal_casual}/>}
                  {voice.serious_playful != null && <VoiceBar left="Serious" right="Playful" value={voice.serious_playful}/>}
                  {voice.conservative_bold != null && <VoiceBar left="Conservative" right="Bold" value={voice.conservative_bold}/>}
                </div>
              </div>
            </div>
          ) : (
            <div className="sabi-card p-8 text-center">
              <Volume2 className="w-8 h-8 text-white/15 mx-auto mb-2"/>
              <p className="text-sm text-white/35">Brand voice not yet configured.</p>
            </div>
          )}

          {/* Dos & Don'ts */}
          {(dos.length > 0 || donts.length > 0) && (
            <div className="sabi-card p-6">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-4">Do's & Don'ts</p>
              <div className="grid grid-cols-2 gap-6">
                {dos.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 font-medium mb-2">✓ The brand DOES…</p>
                    <div className="space-y-1.5">
                      {dos.map((d: string, i: number) => (
                        <div key={i} className="text-xs bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2 text-white/65">
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {donts.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 font-medium mb-2">✕ The brand NEVER…</p>
                    <div className="space-y-1.5">
                      {donts.map((d: string, i: number) => (
                        <div key={i} className="text-xs bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2 text-white/65">
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Visual tab ─────────────────────────────────────── */}
      {activeTab === 'visual' && (
        <div className="space-y-4">
          {colors.length > 0 ? (
            <div className="sabi-card p-6">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-4">Brand Color Palette</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {colors.map((c: any, i: number) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-white/8">
                    <div className="h-16 w-full" style={{ backgroundColor: c.hex }}/>
                    <div className="bg-white/3 p-3">
                      <p className="text-xs font-medium text-white">{c.name}</p>
                      <p className="text-[10px] text-white/30 font-mono mt-0.5">{c.hex}</p>
                      {c.usage && <p className="text-[10px] text-white/25 mt-1">{c.usage}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="sabi-card p-8 text-center">
              <Palette className="w-8 h-8 text-white/15 mx-auto mb-2"/>
              <p className="text-sm text-white/35">No brand colors defined yet.</p>
            </div>
          )}

          {/* Brand Fonts */}
          {identity.brand_fonts?.length > 0 && (
            <div className="sabi-card p-6">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-3">Typography</p>
              <div className="space-y-2">
                {identity.brand_fonts.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/3 border border-white/6 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-white">{f.name}</p>
                      <p className="text-xs text-white/30">{f.font} — Weight {f.weight}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Assets tab ─────────────────────────────────────── */}
      {activeTab === 'assets' && (
        <div className="space-y-4">
          {assets.length > 0 ? (
            <div className="sabi-card p-6">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-4">Brand Asset Library</p>
              <div className="space-y-2">
                {assets.map((a: any, i: number) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white/3 border border-white/6 rounded-xl hover:border-purple-500/20 hover:bg-purple-500/3 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center text-base flex-shrink-0">
                      {ASSET_ICONS[a.category] ?? '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">{a.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/30 capitalize">{a.category}</span>
                        <span className="text-xs text-white/20">{a.format}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0"/>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="sabi-card p-8 text-center">
              <Image className="w-8 h-8 text-white/15 mx-auto mb-2"/>
              <p className="text-sm text-white/35">No brand assets uploaded yet.</p>
            </div>
          )}

          {/* Guidelines link */}
          {identity.brand_guidelines_url && (
            <div className="sabi-card p-5">
              <p className="text-xs text-white/30 font-medium uppercase tracking-wider mb-2">Brand Guidelines</p>
              <a href={identity.brand_guidelines_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-purple-500/8 border border-purple-500/20 rounded-xl hover:bg-purple-500/12 transition-all group">
                <FileText className="w-5 h-5 text-purple-400 flex-shrink-0"/>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">View Brand Guidelines</p>
                  <p className="text-xs text-white/30">Full brand guidelines document</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-purple-400 transition-colors"/>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
