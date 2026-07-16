'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Loader2, Briefcase, ChevronRight } from 'lucide-react';
import { useClientStore } from '@/lib/store';

const tok = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_client_token') : null;

export default function ClientTeamPage() {
  const { client }    = useClientStore();
  const [team, setTeam]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/client/team`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
      .then(r => r.json())
      .then((res: any) => setTeam(res.data?.team ?? []))
      .catch(() => setTeam([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Your Team</h1>
        <p className="text-sm text-white/40 mt-1">
          The Cerebre team working on <strong className="text-white">{client?.brand?.name ?? 'your brand'}</strong>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <div className="sabi-card p-12 text-center">
          <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/35 text-sm">No team members assigned yet.</p>
          <p className="text-white/20 text-xs mt-1">Your Cerebre account team will be listed here once assigned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {team.map((member: any) => {
            const roleLabel = member.display_title
              || member.role_on_brand?.replace(/_/g, ' ')
              || member.system_role?.replace(/_/g, ' ')
              || 'Team Member';

            return (
              <Link
                key={member.id}
                href={`/client/team/${member.user_id}`}
                className="sabi-card p-5 flex items-center gap-4 hover:border-purple-500/25 transition-all group"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-purple-500/20 border border-purple-500/20 flex-shrink-0">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg font-bold text-purple-300">
                      {member.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {member.full_name}
                  </p>
                  <p className="text-sm text-white/45 capitalize mt-0.5">{roleLabel}</p>
                  {member.department && (
                    <p className="text-xs text-white/25 mt-0.5">{member.department}</p>
                  )}
                </div>

                {/* View profile arrow */}
                <div className="flex items-center gap-1.5 text-xs text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0">
                  <span>View profile</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/15 text-center mt-8">
        Click any team member to see their background, skills, and portfolio.
      </p>
    </div>
  );
}