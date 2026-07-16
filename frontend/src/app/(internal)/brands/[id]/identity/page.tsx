'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Upload, Plus, X, Check, Loader2,
  Palette, BookOpen, Target, Volume2, FileText, Image,
  ChevronRight
} from 'lucide-react';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';
import { useBrandPermissions } from '@/lib/permissions';

// ── Brand Archetypes ─────────────────────────────────────────
const ARCHETYPES = [
  { value:'ruler',     label:'The Ruler',     icon:'👑', desc:'Power, control, responsibility. Premium brands with authority.',         example:'Mercedes-Benz, Microsoft'  },
  { value:'creator',   label:'The Creator',   icon:'🎨', desc:'Innovation, imagination, vision. Brands that inspire self-expression.',  example:'Apple, Adobe, LEGO'        },
  { value:'sage',      label:'The Sage',      icon:'🦉', desc:'Wisdom, knowledge, truth. Expert brands that educate and inform.',       example:'Google, BBC, Harvard'      },
  { value:'innocent',  label:'The Innocent',  icon:'☀️', desc:'Safety, optimism, simplicity. Pure, wholesome, trustworthy brands.',    example:'Coca-Cola, Dove, Nintendo'  },
  { value:'explorer',  label:'The Explorer',  icon:'🧭', desc:'Freedom, adventure, discovery. Brands that break boundaries.',           example:'Jeep, Patagonia, Airbnb'   },
  { value:'rebel',     label:'The Rebel',     icon:'⚡', desc:'Revolution, disruption, change. Bold brands that challenge norms.',      example:'Harley-Davidson, Virgin'   },
  { value:'magician',  label:'The Magician',  icon:'✨', desc:'Transformation, vision, wonder. Brands that make dreams real.',          example:'Disney, Tesla, Dyson'      },
  { value:'hero',      label:'The Hero',      icon:'🛡️', desc:'Courage, achievement, mastery. Brands that help you overcome.',         example:'Nike, FedEx, Red Bull'     },
  { value:'lover',     label:'The Lover',     icon:'❤️', desc:'Intimacy, passion, commitment. Sensory and aspirational brands.',       example:'Chanel, Godiva, Victoria\'s Secret'},
  { value:'jester',    label:'The Jester',    icon:'🎭', desc:'Joy, humor, lightness. Fun brands that make life more enjoyable.',       example:'M&Ms, Old Spice, Innocent' },
  { value:'everyman',  label:'The Everyman',  icon:'🤝', desc:'Belonging, realism, empathy. Unpretentious, relatable brands.',         example:'IKEA, Budweiser, eBay'     },
  { value:'caregiver', label:'The Caregiver', icon:'💚', desc:'Nurturing, service, compassion. Protective and helpful brands.',        example:'Johnson\'s, UNICEF, Pampers'},
];

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

type Color  = { name:string; hex:string; usage:string };
type Asset  = { name:string; url:string; category:string; format:string };

export default function BrandIdentityPage() {
  const { id: brandId } = useParams<{ id: string }>();
    const perms           = useBrandPermissions(brandId);

  const [identity, setIdentity]   = useState<any>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState<'story'|'archetype'|'voice'|'visual'|'assets'|'guidelines'>('story');

  const canEdit = perms.canManage;

  // Local editable state
  const [logoUrl, setLogoUrl]           = useState('');
  const [tagline, setTagline]           = useState('');
  const [mission, setMission]           = useState('');
  const [story, setStory]               = useState('');
  const [archetype, setArchetype]       = useState('');
  const [targetAudience, setAudience]   = useState('');
  const [voice, setVoice]               = useState({ formal_casual:50, serious_playful:50, conservative_bold:50 });
  const [colors, setColors]             = useState<Color[]>([]);
  const [newColor, setNewColor]         = useState<Color>({ name:'', hex:'#6d28d9', usage:'' });
  const [dos, setDos]                   = useState<string[]>([]);
  const [donts, setDonts]               = useState<string[]>([]);
  const [newDo, setNewDo]               = useState('');
  const [newDont, setNewDont]           = useState('');
  const [guidelinesUrl, setGuidelinesUrl] = useState('');
  const [assets, setAssets]             = useState<Asset[]>([]);
  const [newAsset, setNewAsset]         = useState<Asset>({ name:'', url:'', category:'logo', format:'PNG' });
  const logoRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  useEffect(() => {
    api(`/api/agency/brands/${brandId}/identity`)
      .then((r: any) => {
        const d = r.data?.identity ?? r.data ?? {};
        setIdentity(d);
        setLogoUrl(d.logo_url ?? '');
        setTagline(d.tagline ?? '');
        setMission(d.mission_statement ?? '');
        setStory(d.brand_story ?? '');
        setArchetype(d.brand_archetype ?? '');
        setAudience(d.target_audience ?? '');
        setVoice({ formal_casual:50, serious_playful:50, conservative_bold:50, ...(d.brand_voice ?? {}) });
        setColors(d.brand_colors ?? []);
        setDos(d.dos_and_donts?.dos ?? []);
        setDonts(d.dos_and_donts?.donts ?? []);
        setGuidelinesUrl(d.brand_guidelines_url ?? '');
        setAssets(d.brand_assets ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brandId]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api(`/api/agency/brands/${brandId}/identity`, {
        method: 'PATCH',
        body: JSON.stringify({
          logo_url:            logoUrl          || null,
          tagline:             tagline          || null,
          mission_statement:   mission          || null,
          brand_story:         story            || null,
          brand_archetype:     archetype        || null,
          target_audience:     targetAudience   || null,
          brand_voice:         voice,
          brand_colors:        colors,
          dos_and_donts:       { dos, donts },
          brand_guidelines_url: guidelinesUrl   || null,
          brand_assets:        assets,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const TABS = [
    { key:'story',      label:'Story',       icon:BookOpen  },
    { key:'archetype',  label:'Archetype',   icon:Target    },
    { key:'voice',      label:'Voice',       icon:Volume2   },
    { key:'visual',     label:'Visual',      icon:Palette   },
    { key:'assets',     label:'Assets',      icon:Image     },
    { key:'guidelines', label:'Guidelines',  icon:FileText  },
  ];

  const VoiceSlider = ({ left, right, field }: { left:string; right:string; field:keyof typeof voice }) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-xs text-white/40">{left}</span>
        <span className="text-xs text-white/40">{right}</span>
      </div>
      <input type="range" min="0" max="100" value={voice[field]}
        onChange={e => setVoice(p => ({ ...p, [field]: parseInt(e.target.value) }))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #6d28d9 0%, #6d28d9 ${voice[field]}%, rgba(255,255,255,0.1) ${voice[field]}%, rgba(255,255,255,0.1) 100%)` }}/>
      <p className="text-xs text-center text-white/25">
        {voice[field] < 35 ? left : voice[field] > 65 ? right : 'Balanced'}
      </p>
    </div>
  );

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-48">
      <Loader2 className="w-5 h-5 text-purple-400 animate-spin"/>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {perms.canAssignStaff && (<AgencyTopNav title="Brand Identity Vault"
          breadcrumb={[{label:'Brands',href:'/brands'},{label:identity.name??'Brand',href:`/brands/${brandId}`}]}/>)}
      <button
  type="button"
  onClick={() => router.back()}
  className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit"
>
  <ArrowLeft className="w-3.5 h-3.5" /> Back
</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Brand Identity Vault</h1>
          <p className="text-sm text-white/40 mt-0.5">{canEdit ? 'The single source of truth for everything that defines this brand' : 'View-only — only admins can edit brand identity'}</p>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving}
            className="sabi-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : saved ? <><Check className="w-4 h-4"/>Saved!</> : 'Save All'}
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}

      {/* Logo + quick info bar */}
      <div className="sabi-card p-5 mb-5 flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1"/>
              : <span className="text-3xl font-black text-white/20">{identity.name?.[0]?.toUpperCase()}</span>}
          </div>
          {canEdit && (
            <>
              <button onClick={() => logoRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-purple-600 border-2 border-[#0d0d1a] flex items-center justify-center hover:bg-purple-500 transition-colors">
                <Upload className="w-3 h-3 text-white"/>
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) setLogoUrl(URL.createObjectURL(f)); }}/>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {canEdit ? (
            <>
              <input className="sabi-input text-base font-semibold" placeholder="Brand tagline — e.g. Just Do It"
                value={tagline} onChange={e => setTagline(e.target.value)}/>
              <input className="sabi-input text-sm" placeholder="Mission statement — one sentence that defines why you exist"
                value={mission} onChange={e => setMission(e.target.value)}/>
            </>
          ) : (
            <>
              {tagline && <p className="text-base font-semibold text-white italic">"{tagline}"</p>}
              {mission && <p className="text-sm text-white/65">{mission}</p>}
              {!tagline && !mission && <p className="text-sm text-white/25">No tagline or mission set yet.</p>}
            </>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 p-1 bg-white/3 rounded-xl border border-white/5 mb-5 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
              activeTab === key ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white'
            }`}>
            <Icon className="w-3.5 h-3.5"/>{label}
          </button>
        ))}
      </div>

      {/* ── STORY tab ──────────────────────────────────────── */}
      {activeTab === 'story' && (
        <div className="space-y-4">
          <div className="sabi-card p-6">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 block">Brand Story</label>
            <p className="text-xs text-white/25 mb-3">Tell the full story — where the brand came from, what drives it, where it's going. Staff read this to understand the brand deeply.</p>
            {canEdit ? (
              <>
                <textarea className="sabi-input resize-none w-full" rows={10}
                  placeholder="Write the brand's story. Include the founding moment, the problem it solves, what makes it different, and its vision for the future."
                  value={story} onChange={e => setStory(e.target.value)}/>
                <p className="text-xs text-white/20 mt-2">{story.length} characters</p>
              </>
            ) : (
              <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{story || 'No brand story written yet.'}</p>
            )}
          </div>
          <div className="sabi-card p-6">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 block">Target Audience</label>
            {canEdit ? (
              <textarea className="sabi-input resize-none w-full" rows={4}
                placeholder="Who is this brand for? Age range, demographics, psychographics..."
                value={targetAudience} onChange={e => setAudience(e.target.value)}/>
            ) : (
              <p className="text-sm text-white/65 leading-relaxed">{targetAudience || 'No target audience defined yet.'}</p>
            )}
          </div>
        </div>
      )}

      {/* ── ARCHETYPE tab ──────────────────────────────────── */}
      {activeTab === 'archetype' && (
        <div className="sabi-card p-6">
          <div className="mb-5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Brand Archetype</p>
            <p className="text-xs text-white/25">The archetype defines the brand's personality at a deep level — how it speaks, what it stands for, and what emotions it evokes.</p>
          </div>
          {archetype && (
            <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              {(() => { const a = ARCHETYPES.find(x => x.value === archetype); return a ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{a.icon}</span>
                  <div>
                    <p className="font-bold text-white">{a.label}</p>
                    <p className="text-xs text-white/50">{a.desc}</p>
                    <p className="text-xs text-white/30 mt-0.5">Examples: {a.example}</p>
                  </div>
                </div>
              ) : null; })()}
            </div>
          )}
          {!archetype && !canEdit && (
            <p className="text-sm text-white/35 text-center py-4">Archetype not yet defined.</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ARCHETYPES.map(a => (
              <button key={a.value} onClick={() => canEdit && setArchetype(a.value)}
                disabled={!canEdit}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                  archetype === a.value
                    ? 'border-purple-500/50 bg-purple-500/15'
                    : canEdit ? 'border-white/5 hover:border-white/12 hover:bg-white/3' : 'border-white/5 opacity-50'
                }`}>
                <span className="text-2xl flex-shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-none ${archetype === a.value ? 'text-purple-300' : 'text-white/70'}`}>{a.label}</p>
                  <p className="text-[10px] text-white/30 mt-1 leading-tight line-clamp-2">{a.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── VOICE tab ──────────────────────────────────────── */}
      {activeTab === 'voice' && (
        <div className="sabi-card p-6 space-y-8">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Brand Voice Matrix</p>
            <p className="text-xs text-white/25 mb-6">How the brand communicates. {canEdit ? 'Drag each slider to define.' : ''}</p>

            <div className="space-y-8">
              {canEdit ? (
                <>
                  <VoiceSlider left="Formal" right="Casual" field="formal_casual"/>
                  <VoiceSlider left="Serious" right="Playful" field="serious_playful"/>
                  <VoiceSlider left="Conservative" right="Bold" field="conservative_bold"/>
                </>
              ) : (
                <>
                  {voice.formal_casual != null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-xs text-white/40">Formal</span><span className="text-xs text-white/40">Casual</span></div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${voice.formal_casual}%` }}/></div>
                      <p className="text-xs text-center text-white/25">{voice.formal_casual < 35 ? 'Formal' : voice.formal_casual > 65 ? 'Casual' : 'Balanced'}</p>
                    </div>
                  )}
                  {voice.serious_playful != null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-xs text-white/40">Serious</span><span className="text-xs text-white/40">Playful</span></div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${voice.serious_playful}%` }}/></div>
                      <p className="text-xs text-center text-white/25">{voice.serious_playful < 35 ? 'Serious' : voice.serious_playful > 65 ? 'Playful' : 'Balanced'}</p>
                    </div>
                  )}
                  {voice.conservative_bold != null && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span className="text-xs text-white/40">Conservative</span><span className="text-xs text-white/40">Bold</span></div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${voice.conservative_bold}%` }}/></div>
                      <p className="text-xs text-center text-white/25">{voice.conservative_bold < 35 ? 'Conservative' : voice.conservative_bold > 65 ? 'Bold' : 'Balanced'}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="border-t border-white/5 pt-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Do's & Don'ts</p>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-green-400 font-medium mb-2">✓ The brand DOES…</p>
                <div className="space-y-1.5 mb-2">
                  {dos.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2 group">
                      <Check className="w-3 h-3 text-green-400 flex-shrink-0"/>
                      <span className="flex-1 text-white/65">{d}</span>
                      {canEdit && <button onClick={() => setDos(p => p.filter((_,j) => j!==i))} className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X className="w-3 h-3"/></button>}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <input className="sabi-input flex-1 text-xs" placeholder="e.g. Use warm, human language"
                      value={newDo} onChange={e => setNewDo(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter'&&newDo.trim()) { setDos(p=>[...p,newDo.trim()]); setNewDo(''); } }}/>
                    <button onClick={() => { if (newDo.trim()) { setDos(p=>[...p,newDo.trim()]); setNewDo(''); } }} className="px-2 py-1.5 text-green-400 border border-green-500/20 rounded-lg text-xs hover:bg-green-500/8 transition-all"><Plus className="w-3.5 h-3.5"/></button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-red-400 font-medium mb-2">✕ The brand NEVER…</p>
                <div className="space-y-1.5 mb-2">
                  {donts.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2 group">
                      <X className="w-3 h-3 text-red-400 flex-shrink-0"/>
                      <span className="flex-1 text-white/65">{d}</span>
                      {canEdit && <button onClick={() => setDonts(p => p.filter((_,j) => j!==i))} className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X className="w-3 h-3"/></button>}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <input className="sabi-input flex-1 text-xs" placeholder="e.g. Use jargon or corporate speak"
                      value={newDont} onChange={e => setNewDont(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter'&&newDont.trim()) { setDonts(p=>[...p,newDont.trim()]); setNewDont(''); } }}/>
                    <button onClick={() => { if (newDont.trim()) { setDonts(p=>[...p,newDont.trim()]); setNewDont(''); } }} className="px-2 py-1.5 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/8 transition-all"><Plus className="w-3.5 h-3.5"/></button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VISUAL tab ─────────────────────────────────────── */}
      {activeTab === 'visual' && (
        <div className="sabi-card p-6">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Brand Color Palette</p>
          <div className={`grid ${canEdit ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} gap-3 mb-5`}>
            {colors.map((c, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-white/8 group">
                <div className="h-14 w-full" style={{ backgroundColor: c.hex }}/>
                <div className="bg-white/3 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-white">{c.name}</p>
                    {canEdit && <button onClick={() => setColors(p => p.filter((_,j) => j!==i))} className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X className="w-3 h-3"/></button>}
                  </div>
                  <p className="text-[10px] text-white/30 font-mono">{c.hex}</p>
                  <p className="text-[10px] text-white/25 mt-0.5">{c.usage}</p>
                </div>
              </div>
            ))}
            {canEdit && (
              <div className="rounded-xl border border-dashed border-white/15 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="color" value={newColor.hex} onChange={e => setNewColor(p=>({...p,hex:e.target.value}))}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0.5 flex-shrink-0"/>
                  <input className="sabi-input flex-1 text-xs" placeholder="Name (e.g. Primary)" value={newColor.name} onChange={e => setNewColor(p=>({...p,name:e.target.value}))}/>
                </div>
                <input className="sabi-input w-full text-xs" placeholder="Usage (e.g. CTAs, headings)" value={newColor.usage} onChange={e => setNewColor(p=>({...p,usage:e.target.value}))}/>
                <button onClick={() => { if (newColor.name) { setColors(p=>[...p,newColor]); setNewColor({name:'',hex:'#6d28d9',usage:''}); } }}
                  className="w-full py-1.5 text-xs text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-500/8 transition-all flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5"/> Add Colour
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ASSETS tab ─────────────────────────────────────── */}
      {activeTab === 'assets' && (
        <div className="sabi-card p-6">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Brand Asset Library</p>
          <p className="text-xs text-white/25 mb-4">{canEdit ? 'Add links to logos, icons, and other brand assets hosted in Google Drive, Canva, Dropbox, etc.' : 'Links to brand assets for reference.'}</p>

          <div className="space-y-2 mb-5">
            {assets.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/3 border border-white/6 rounded-xl group">
                <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-base flex-shrink-0">
                  {a.category==='logo'?'🎯':a.category==='icon'?'⚡':a.category==='image'?'📸':'📁'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{a.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/30 capitalize">{a.category}</span>
                    <span className="text-xs text-white/20">{a.format}</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors">View <ChevronRight className="w-3.5 h-3.5" /></a>
                  </div>
                </div>
                {canEdit && <button onClick={() => setAssets(p => p.filter((_,j)=>j!==i))} className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><X className="w-4 h-4"/></button>}
              </div>
            ))}
          </div>

          {canEdit && (
            <div className="space-y-2 border border-dashed border-white/10 rounded-xl p-4">
              <p className="text-xs text-white/30 mb-2">Add asset</p>
              <div className="grid grid-cols-2 gap-2">
                <input className="sabi-input text-sm" placeholder="Asset name (e.g. Primary Logo)" value={newAsset.name} onChange={e=>setNewAsset(p=>({...p,name:e.target.value}))}/>
                <input className="sabi-input text-sm" placeholder="Link URL (Google Drive, Canva…)" value={newAsset.url} onChange={e=>setNewAsset(p=>({...p,url:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="sabi-input text-sm" value={newAsset.category} onChange={e=>setNewAsset(p=>({...p,category:e.target.value}))}>
                  {['Logo','Icon','Image','Font','Template','Other'].map(c=><option className="bg-black" key={c} value={c} >{c}</option>)}
                </select>
                <select className="sabi-input text-sm" value={newAsset.format} onChange={e=>setNewAsset(p=>({...p,format:e.target.value}))}>
                  {['PNG','SVG','JPG','PDF','AI','EPS','TTF','OTF','Other'].map(f=><option key={f} className="bg-black">{f}</option>)}
                </select>
              </div>
              <button onClick={() => { if (newAsset.name&&newAsset.url) { setAssets(p=>[...p,newAsset]); setNewAsset({name:'',url:'',category:'logo',format:'PNG'}); } }}
                className="w-full py-2 text-sm text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4"/> Add Asset
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GUIDELINES tab ─────────────────────────────────── */}
      {activeTab === 'guidelines' && (
        <div className="sabi-card p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Brand Guidelines Document</p>
            <p className="text-xs text-white/25 mb-3">{canEdit ? 'Link to the full brand guidelines PDF (upload to Google Drive first, then paste the shareable link).' : 'Link to the full brand guidelines.'}</p>
            <div className="flex gap-2">
              {canEdit ? (
                <input className="sabi-input flex-1 text-sm" placeholder="https://drive.google.com/file/..."
                  value={guidelinesUrl} onChange={e => setGuidelinesUrl(e.target.value)}/>
              ) : guidelinesUrl ? (
                <a href={guidelinesUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all flex-shrink-0">
                  View Guidelines <ChevronRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <p className="text-sm text-white/25">No guidelines link set.</p>
              )}
              {canEdit && guidelinesUrl && (
                <a href={guidelinesUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 text-xs text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all flex-shrink-0">
                  View <ChevronRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="bg-purple-500/6 border border-purple-500/15 rounded-xl p-5">
            <p className="text-sm font-medium text-white mb-2">💡 What to include in your brand guidelines</p>
            <ul className="space-y-1.5 text-xs text-white/50">
              {[
                'Logo usage rules (spacing, sizing, what not to do)',
                'Primary and secondary colour palettes with hex/CMYK codes',
                'Typography — fonts, weights, hierarchy',
                'Photography and image style guide',
                'Tone of voice examples and writing style',
                'Social media post templates',
                'Business card and stationery templates',
                'Icon and illustration style',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-purple-400 flex-shrink-0 mt-0.5"><ChevronRight className="w-3.5 h-3.5" /></span>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mt-6">
          <button onClick={save} disabled={saving}
            className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving…</> : saved ? <><Check className="w-4 h-4"/>Saved!</> : 'Save Brand Identity'}
          </button>
        </div>
      )}
    </div>
  );
}
