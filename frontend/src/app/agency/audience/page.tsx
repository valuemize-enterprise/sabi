'use client';

/**
 * AudienceIQ™ Page — NEW FEATURE
 * AI-powered Nigerian consumer audience profiling
 * Route: /agency/audience
 */

import { useState, useEffect } from 'react';
import { Users, Plus, Brain, Target, MapPin, Sparkles, ChevronRight, Trash2 } from 'lucide-react';
import { audienceIQ, brands as brandsApi } from '@/lib/api';

interface Profile {
  id: string;
  profile_name: string;
  segment_type: string;
  demographics: Record<string, string>;
  ai_insights:  string;
  created_at:   string;
  brands:       { name: string };
}

const SEGMENT_TYPES = ['primary', 'secondary', 'tertiary', 'niche', 'aspirational'];
const INCOME_LEVELS = ['Low income (< ₦100k/mo)', 'Mid income (₦100k–500k/mo)', 'High income (₦500k–2M/mo)', 'Premium (₦2M+/mo)'];
const AGE_RANGES   = ['18–24', '25–34', '35–44', '45–54', '55+'];
const LOCATIONS    = ['Lagos Island', 'Lagos Mainland', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Other Major City', 'Secondary City'];

export default function AudienceIQPage() {
  const [profiles, setProfiles]     = useState<Profile[]>([]);
  const [brandList, setBrandList]   = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [selectedProfile, setSelected] = useState<Profile | null>(null);
  const [error, setError]           = useState('');

  const [form, setForm] = useState({
    brand_id: '', profile_name: '', segment_type: 'primary',
    age_range: '25–34', gender: 'Mixed', location: 'Lagos Island',
    income_level: 'Mid income (₦100k–500k/mo)', education: '',
    occupation: '', lifestyle: '', goals_and_aspirations: '',
    pain_points: '', brand_relationship: '', purchase_behaviour: '',
    digital_behaviour: '',
  });

  useEffect(() => {
    Promise.all([
      audienceIQ.list().catch(() => ({ data: [] })),
      brandsApi.list({ limit: '100' }).catch(() => ({ data: [] })),
    ]).then(([aud, br]: any) => {
      setProfiles(aud.data || []);
      setBrandList(br.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand_id || !form.profile_name) { setError('Select a brand and enter a profile name'); return; }
    setGenerating(true); setError('');
    try {
      const res: any = await audienceIQ.generate(form);
      setProfiles(prev => [res.data.profile, ...prev]);
      setSelected(res.data.profile);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message || 'Generation failed. Try again.');
    } finally { setGenerating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this audience profile?')) return;
    await audienceIQ.delete(id);
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (selectedProfile?.id === id) setSelected(null);
  };

  const segmentColor: Record<string, string> = {
    primary: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    secondary: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    tertiary: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    niche: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    aspirational: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
      <div className="sabi-spinner" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d1a] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-purple-400 font-medium tracking-widest uppercase">New Feature</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AudienceIQ™</h1>
          <p className="text-white/40 text-sm mt-1">AI-powered Nigerian consumer audience profiling & psychographic segmentation</p>
        </div>
        <button onClick={() => { setShowForm(true); setSelected(null); }}
          className="sabi-btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Generate Profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile List */}
        <div className="lg:col-span-1 space-y-3">
          {profiles.length === 0 && !showForm && (
            <div className="sabi-card p-6 text-center">
              <Users className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No audience profiles yet.</p>
              <p className="text-white/20 text-xs mt-1">Generate your first profile to get started.</p>
            </div>
          )}
          {profiles.map(profile => (
            <div key={profile.id}
              onClick={() => { setSelected(profile); setShowForm(false); }}
              className={`sabi-card p-4 cursor-pointer transition-all hover:border-purple-500/30 ${selectedProfile?.id === profile.id ? 'border-purple-500/50 bg-purple-500/5' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{profile.profile_name}</p>
                  <p className="text-xs text-white/40 mt-0.5">{profile.brands?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${segmentColor[profile.segment_type] || segmentColor.primary}`}>
                    {profile.segment_type}
                  </span>
                  <button onClick={e => { e.stopPropagation(); handleDelete(profile.id); }} className="text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-white/30 mt-2 line-clamp-2">{profile.demographics?.age_range} · {profile.demographics?.location} · {profile.demographics?.income_level}</p>
            </div>
          ))}
        </div>

        {/* Main Panel */}
        <div className="lg:col-span-2">
          {/* Generation Form */}
          {showForm && (
            <div className="sabi-card p-6">
              <h2 className="text-white font-semibold mb-5 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Generate AudienceIQ™ Profile
              </h2>
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">{error}</div>}
              <form onSubmit={handleGenerate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Brand *</label>
                    <select className="sabi-input" value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}>
                      <option value="">Select brand...</option>
                      {brandList.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Profile Name *</label>
                    <input className="sabi-input" placeholder="e.g. Lagos Young Professional" value={form.profile_name} onChange={e => setForm(f => ({ ...f, profile_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Segment Type</label>
                    <select className="sabi-input" value={form.segment_type} onChange={e => setForm(f => ({ ...f, segment_type: e.target.value }))}>
                      {SEGMENT_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Age Range</label>
                    <select className="sabi-input" value={form.age_range} onChange={e => setForm(f => ({ ...f, age_range: e.target.value }))}>
                      {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Income Level</label>
                    <select className="sabi-input" value={form.income_level} onChange={e => setForm(f => ({ ...f, income_level: e.target.value }))}>
                      {INCOME_LEVELS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Primary Location</label>
                    <select className="sabi-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                      {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Occupation / Industry</label>
                  <input className="sabi-input" placeholder="e.g. Financial services professional, tech worker, business owner..." value={form.occupation} onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Goals & Aspirations</label>
                  <textarea className="sabi-input resize-none" rows={2} placeholder="What are they trying to achieve? What does success look like for them?" value={form.goals_and_aspirations} onChange={e => setForm(f => ({ ...f, goals_and_aspirations: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Pain Points & Frustrations</label>
                  <textarea className="sabi-input resize-none" rows={2} placeholder="What keeps them up at night? What problems does this brand solve for them?" value={form.pain_points} onChange={e => setForm(f => ({ ...f, pain_points: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={generating} className="sabi-btn-primary flex items-center gap-2 flex-1 justify-center">
                    {generating ? <><div className="sabi-spinner w-4 h-4" /> Generating with ARIA...</> : <><Brain className="w-4 h-4" /> Generate Profile</>}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors border border-white/10 rounded-lg">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Profile Detail View */}
          {selectedProfile && !showForm && (
            <div className="space-y-4 animate-fade-in">
              <div className="sabi-card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-white font-bold text-lg">{selectedProfile.profile_name}</h2>
                    <p className="text-white/40 text-sm">{selectedProfile.brands?.name}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border font-medium ${segmentColor[selectedProfile.segment_type] || segmentColor.primary}`}>
                    {selectedProfile.segment_type} segment
                  </span>
                </div>

                {/* Demographics */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {Object.entries(selectedProfile.demographics || {}).filter(([,v]) => v).map(([k, v]) => (
                    <div key={k} className="bg-white/3 rounded-lg p-3 border border-white/5">
                      <p className="text-xs text-white/40 capitalize mb-1">{k.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-white font-medium">{String(v)}</p>
                    </div>
                  ))}
                </div>

                {/* AI Insights */}
                {selectedProfile.ai_insights && (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium uppercase tracking-wider">ARIA Insights</span>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{selectedProfile.ai_insights}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showForm && !selectedProfile && (
            <div className="sabi-card p-12 text-center">
              <Brain className="w-12 h-12 text-purple-500/30 mx-auto mb-4" />
              <h3 className="text-white/60 font-medium mb-2">Select or Generate a Profile</h3>
              <p className="text-white/30 text-sm">AudienceIQ™ uses ARIA to build deep Nigerian consumer personas with psychographic segmentation, cultural context, and marketing strategy recommendations.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
