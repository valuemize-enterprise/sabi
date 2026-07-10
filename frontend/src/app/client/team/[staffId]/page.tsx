'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Award, ExternalLink,
  Briefcase, Linkedin, AlertCircle
} from 'lucide-react';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;

const PLATFORM_LABELS: Record<string, string> = {
  behance:  'Behance',
  dribbble: 'Dribbble',
  notion:   'Notion',
  canva:    'Canva',
  linkedin: 'LinkedIn',
  youtube:  'YouTube',
  gdocs:    'Google Docs',
  website:  'Website',
  other:    'View',
};

export default function StaffProfilePage() {
  const { staffId }           = useParams<{ staffId: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/client/team/${staffId}/profile`,
      { headers: { Authorization: `Bearer ${tok()}` } }
    )
      .then(r => r.json())
      .then((res: any) => {
        if (!res.success) throw new Error(res.error || 'Not found');
        setProfile(res.data?.profile ?? res.data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [staffId]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────
  if (error || !profile) return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/client/team"
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Team
      </Link>
      <div className="sabi-card p-10 text-center">
        <AlertCircle className="w-8 h-8 text-white/15 mx-auto mb-3" />
        <p className="text-white/35 text-sm">{error || 'Profile not available'}</p>
      </div>
    </div>
  );

  const displayRole = profile.display_title || profile.role?.replace(/_/g, ' ');
  const skills: string[]                     = profile.skills ?? [];
  const certifications: string[]             = profile.certifications ?? [];
  const portfolioLinks: any[]                = profile.portfolio_links ?? [];

  // ── Profile ────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link href="/client/team"
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white mb-5 transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Team
      </Link>

      {/* Header card */}
      <div className="sabi-card p-6 mb-4">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-purple-500/20 border border-purple-500/20 flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black text-purple-300">
                {profile.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{profile.full_name}</h1>
            <p className="text-sm text-purple-400 mt-0.5 capitalize">{displayRole}</p>
            {profile.department && (
              <p className="text-xs text-white/30 mt-0.5">{profile.department}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {profile.experience_years && (
                <span className="flex items-center gap-1.5 text-xs text-white/45">
                  <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                  {profile.experience_years} yr{profile.experience_years !== 1 ? 's' : ''} experience
                </span>
              )}
              {profile.linkedin_url && (
                <a
                  href={
                    profile.linkedin_url.startsWith('http')
                      ? profile.linkedin_url
                      : `https://${profile.linkedin_url}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-5 pt-5 border-t border-white/5">
            <p className="text-sm text-white/65 leading-relaxed">{profile.bio}</p>
          </div>
        )}
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="sabi-card p-5 mb-4">
          <h2 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">
            Skills & Expertise
          </h2>
          <div className="flex flex-wrap gap-2">
            {skills.map(s => (
              <span
                key={s}
                className="text-xs bg-purple-500/12 border border-purple-500/20 text-purple-300 px-3 py-1 rounded-full"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {certifications.length > 0 && (
        <div className="sabi-card p-5 mb-4">
          <h2 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">
            Certifications
          </h2>
          <div className="space-y-2">
            {certifications.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Award className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm text-white/65">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {portfolioLinks.length > 0 && (
        <div className="sabi-card p-5">
          <h2 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">
            Portfolio & Work Samples
          </h2>
          <div className="space-y-2">
            {portfolioLinks.map((l: any, i: number) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-white/6 hover:border-white/15 hover:bg-white/3 transition-all group"
              >
                <ExternalLink className="w-4 h-4 text-white/25 group-hover:text-purple-400 transition-colors flex-shrink-0" />
                <span className="text-sm text-white flex-1 truncate">{l.label}</span>
                <span className="text-xs text-white/30 flex-shrink-0">
                  {PLATFORM_LABELS[l.platform] ?? 'View'} →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Nothing to show */}
      {!profile.bio && skills.length === 0 && portfolioLinks.length === 0 && certifications.length === 0 && (
        <div className="sabi-card p-8 text-center mt-4">
          <p className="text-white/30 text-sm">Full profile coming soon.</p>
        </div>
      )}
    </div>
  );
}