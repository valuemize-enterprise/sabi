'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Camera, Check, Loader2, Plus, X, ExternalLink,
  Star, Award, Briefcase, Link, Linkedin, User, Eye, EyeOff
} from 'lucide-react';
import { useAgencyStore } from '@/lib/store';
import { AgencyTopNav } from '@/components/internal/AgencyTopNav';

const SKILL_SUGGESTIONS = [
  'Brand Strategy','Content Writing','Copywriting','Social Media Management',
  'Graphic Design','Video Editing','Photography','SEO','Google Analytics','Meta Ads',
  'Google Ads','Email Marketing','Community Management','PR & Comms',
  'Campaign Management','Data Analysis','UX Design','Motion Graphics',
  'Influencer Marketing','Event Marketing',
];

const PORTFOLIO_PLATFORMS: Record<string, string> = {
  behance:'Behance', dribbble:'Dribbble', notion:'Notion',
  gdocs:'Google Docs', canva:'Canva', linkedin:'LinkedIn',
  youtube:'YouTube', website:'Website', other:'Other',
};

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const api = (p: string, opts?: RequestInit) =>
  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${p}`, {
    ...opts, headers:{'Content-Type':'application/json', Authorization:`Bearer ${tok()}`, ...(opts?.headers??{})}
  }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error||b.message); return b; });

export default function MyProfilePage() {
  const { user, setAuth, token } = useAgencyStore();

  const [form, setForm] = useState({
    display_title:     '',
    bio:               '',
    experience_years:  '',
    linkedin_url:      '',
    is_profile_public: true,
  });
  const [skills, setSkills]           = useState<string[]>([]);
  const [certifications, setCerts]     = useState<string[]>([]);
  const [portfolioLinks, setPortfolio] = useState<{url:string;label:string;platform:string}[]>([]);
  const [newSkill, setNewSkill]       = useState('');
  const [newCert, setNewCert]         = useState('');
  const [newLink, setNewLink]         = useState({ url:'', label:'', platform:'website' });
  const [avatarUrl, setAvatarUrl]     = useState('');
  const [avatarFile, setAvatarFile]   = useState<File | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState('');
  const [completeness, setCompleteness] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    api('/api/agency/staff/me/profile').then((r: any) => {
      const p = r.data?.profile ?? r.data ?? {};
      setForm({
        display_title:     p.display_title     ?? '',
        bio:               p.bio               ?? '',
        experience_years:  p.experience_years  ? String(p.experience_years) : '',
        linkedin_url:      p.linkedin_url      ?? '',
        is_profile_public: p.is_profile_public ?? true,
      });
      setSkills(p.skills ?? []);
      setCerts(p.certifications ?? []);
      setPortfolio(p.portfolio_links ?? []);
      setAvatarUrl(p.avatar_url ?? '');
    }).catch(() => {});
  }, []);

  // Completeness score
  useEffect(() => {
    const checks = [
      !!avatarUrl,
      !!form.display_title,
      form.bio.length >= 50,
      skills.length >= 3,
      !!form.experience_years,
      portfolioLinks.length >= 1,
      certifications.length >= 1,
      !!form.linkedin_url,
    ];
    setCompleteness(Math.round((checks.filter(Boolean).length / checks.length) * 100));
  }, [form, skills, certifications, portfolioLinks, avatarUrl]);

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        fd.append('display_title', form.display_title);
        fd.append('bio', form.bio);
        fd.append('skills', JSON.stringify(skills));
        fd.append('certifications', JSON.stringify(certifications));
        fd.append('portfolio_links', JSON.stringify(portfolioLinks));
        fd.append('experience_years', form.experience_years ? String(parseInt(form.experience_years)) : '');
        fd.append('linkedin_url', form.linkedin_url);
        fd.append('is_profile_public', String(form.is_profile_public));

        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agency/staff/me/profile`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tok()}` },
          body: fd,
        });
        const b = await r.json();
        if (!r.ok) throw new Error(b.error || b.message);
        setAvatarFile(null);
        if (b.data?.profile?.avatar_url) setAvatarUrl(b.data.profile.avatar_url);
      } else {
        await api('/api/agency/staff/me/profile', {
          method: 'PATCH',
          body: JSON.stringify({
            ...form,
            avatar_url:     avatarUrl || null,
            skills,
            certifications,
            portfolio_links: portfolioLinks,
            experience_years: form.experience_years ? parseInt(form.experience_years) : null,
          }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const addSkill = (skill: string) => {
    const s = skill.trim();
    if (s && !skills.includes(s)) setSkills(p => [...p, s]);
    setNewSkill('');
  };

  const addLink = () => {
    if (!newLink.url || !newLink.label) return;
    setPortfolio(p => [...p, { ...newLink }]);
    setNewLink({ url:'', label:'', platform:'website' });
  };

  const progressColor = completeness >= 80 ? 'bg-green-500' : completeness >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <AgencyTopNav title="My Profile" subtitle="How others see you on Sabi — your clients see this too"/>

      {/* Completeness bar */}
      <div className="sabi-card p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-white">Profile Completeness</p>
          <span className={`text-sm font-bold ${completeness >= 80 ? 'text-green-400' : completeness >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {completeness}%
          </span>
        </div>
        <div className="w-full bg-white/8 rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full transition-all ${progressColor}`} style={{ width: `${completeness}%` }}/>
        </div>
        <p className="text-xs text-white/35">
          {completeness < 50 && 'Add a photo, bio, and skills to get started.'}
          {completeness >= 50 && completeness < 80 && 'Looking good — add portfolio links and certifications to complete your profile.'}
          {completeness >= 80 && '✓ Strong profile — clients can see your full professional background.'}
        </p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}

      {/* ── Photo ──────────────────────────────────────────── */}
      <div className="sabi-card p-6 mb-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-purple-500/20 border border-purple-500/20 flex-shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-purple-300">
                    {user?.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>}
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-purple-600 border-2 border-[#0d0d1a] flex items-center justify-center hover:bg-purple-500 transition-colors">
              <Camera className="w-3.5 h-3.5 text-white"/>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatarFile(file);
                setAvatarUrl(URL.createObjectURL(file));
              }}/>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{user?.full_name}</p>
            <p className="text-xs text-white/40 capitalize mt-0.5">{user?.role?.replace(/_/g,' ')}</p>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setF('is_profile_public', !form.is_profile_public)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  form.is_profile_public
                    ? 'border-green-500/25 bg-green-500/10 text-green-400'
                    : 'border-white/10 text-white/35'
                }`}>
                {form.is_profile_public ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>}
                {form.is_profile_public ? 'Visible to clients' : 'Hidden from clients'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── About ──────────────────────────────────────────── */}
      <div className="sabi-card p-6 mb-4 space-y-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">About You</h2>

        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Professional Title</label>
          <input className="sabi-input" placeholder="e.g. Senior Brand Strategist & Content Director"
            value={form.display_title} onChange={e => setF('display_title', e.target.value)}/>
          <p className="text-xs text-white/25 mt-1">This is what clients see — make it descriptive</p>
        </div>

        <div>
          <label className="text-xs text-white/50 mb-1.5 block">Bio</label>
          <textarea className="sabi-input resize-none" rows={5}
            placeholder="Write a short professional bio. What's your background? What do you specialise in? What excites you about digital marketing? Clients read this to understand who you are."
            value={form.bio} onChange={e => setF('bio', e.target.value)}/>
          <p className="text-xs text-white/25 mt-1">{form.bio.length} characters · aim for at least 150</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">Years of Experience</label>
            <input type="number" min="0" max="40" className="sabi-input text-sm" placeholder="e.g. 5"
              value={form.experience_years} onChange={e => setF('experience_years', e.target.value)}/>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">LinkedIn Profile</label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25"/>
              <input className="sabi-input pl-9 text-sm" placeholder="linkedin.com/in/yourname"
                value={form.linkedin_url} onChange={e => setF('linkedin_url', e.target.value)}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Skills ─────────────────────────────────────────── */}
      <div className="sabi-card p-6 mb-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Skills</h2>

        {/* Selected skills */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
          {skills.map(s => (
            <span key={s} className="flex items-center gap-1.5 text-xs bg-purple-500/15 border border-purple-500/25 text-purple-300 px-2.5 py-1 rounded-full">
              {s}
              <button onClick={() => setSkills(p => p.filter(x => x !== s))} className="text-purple-400/50 hover:text-red-400 transition-colors">
                <X className="w-3 h-3"/>
              </button>
            </span>
          ))}
          {skills.length === 0 && <p className="text-xs text-white/20">No skills added yet</p>}
        </div>

        {/* Add new skill */}
        <div className="flex gap-2 mb-3">
          <input className="sabi-input flex-1 text-sm" placeholder="Type a skill and press Enter"
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(newSkill); } }}/>
          <button onClick={() => addSkill(newSkill)}
            className="flex items-center gap-1 px-3 py-2 text-xs text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all">
            <Plus className="w-3.5 h-3.5"/> Add
          </button>
        </div>

        {/* Suggestions */}
        <div>
          <p className="text-[10px] text-white/25 mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_SUGGESTIONS.filter(s => !skills.includes(s)).slice(0, 12).map(s => (
              <button key={s} onClick={() => addSkill(s)}
                className="text-[10px] px-2 py-1 rounded-full border border-white/8 text-white/35 hover:border-purple-500/30 hover:text-purple-300 hover:bg-purple-500/8 transition-all">
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Certifications & Training ───────────────────────── */}
      <div className="sabi-card p-6 mb-4">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Certifications & Training</h2>
        <div className="space-y-2 mb-3">
          {certifications.map((c, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 bg-white/3 rounded-xl border border-white/6">
              <Award className="w-4 h-4 text-amber-400 flex-shrink-0"/>
              <span className="text-sm text-white/70 flex-1">{c}</span>
              <button onClick={() => setCerts(p => p.filter((_,j) => j !== i))} className="text-white/20 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
          {certifications.length === 0 && <p className="text-xs text-white/20">No certifications added</p>}
        </div>
        <div className="flex gap-2">
          <input className="sabi-input flex-1 text-sm" placeholder="e.g. Google Analytics Certification, Meta Blueprint"
            value={newCert}
            onChange={e => setNewCert(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newCert.trim()) {
                setCerts(p => [...p, newCert.trim()]);
                setNewCert('');
              }
            }}/>
          <button onClick={() => { if (newCert.trim()) { setCerts(p => [...p, newCert.trim()]); setNewCert(''); } }}
            className="flex items-center gap-1 px-3 py-2 text-xs text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/8 transition-all">
            <Plus className="w-3.5 h-3.5"/> Add
          </button>
        </div>
      </div>

      {/* ── Portfolio Links ─────────────────────────────────── */}
      <div className="sabi-card p-6 mb-6">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Portfolio & Work Samples</h2>
        <p className="text-xs text-white/25 mb-4">Add links to case studies, design work, or campaigns you've led — clients can click these.</p>

        <div className="space-y-2 mb-4">
          {portfolioLinks.map((l, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/6 group">
              <ExternalLink className="w-4 h-4 text-purple-400 flex-shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{l.label}</p>
                <p className="text-xs text-white/30 truncate">{l.url}</p>
              </div>
              <span className="text-xs text-white/25 border border-white/8 rounded-full px-2 py-0.5 capitalize flex-shrink-0">
                {PORTFOLIO_PLATFORMS[l.platform] ?? l.platform}
              </span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-purple-400 transition-colors flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5"/>
              </a>
              <button onClick={() => setPortfolio(p => p.filter((_,j) => j !== i))} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            <input className="sabi-input col-span-3 text-sm" placeholder="Paste link URL"
              value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))}/>
            <select className="sabi-input text-sm col-span-2"
              value={newLink.platform} onChange={e => setNewLink(p => ({ ...p, platform: e.target.value }))}>
              {Object.entries(PORTFOLIO_PLATFORMS).map(([v, l]) => <option className="bg-[#12122a]" key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input className="sabi-input flex-1 text-sm" placeholder="Label — e.g. FiberOne 2026 Campaign"
              value={newLink.label}
              onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}/>
            <button onClick={addLink} disabled={!newLink.url || !newLink.label}
              className="flex items-center gap-1 px-3 py-2 text-xs text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/8 transition-all disabled:opacity-40">
              <Plus className="w-3.5 h-3.5"/> Add
            </button>
          </div>
        </div>
      </div>

      {/* Save */}
      <button onClick={save} disabled={saving}
        className="sabi-btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50">
        {saving  ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving Profile…</>
         : saved ? <><Check className="w-4 h-4"/>Profile Saved!</>
         :          'Save Profile'}
      </button>
    </div>
  );
}
