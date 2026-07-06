'use client';
import { useState, useEffect } from 'react';
import { Users2, Mail, Phone, Linkedin } from 'lucide-react';
import { LoadingPage, EmptyState, Badge } from '@/components/ui';

const TEAM = [
  { name:'Kalu Kingsley',    role:'Account Director',      avatar:'K', email:'kalu@cerebre.media',    note:'Your primary contact for all strategic decisions.' },
  { name:'Amaka Okonkwo',   role:'Senior Strategist',     avatar:'A', email:'amaka@cerebre.media',   note:'Leads your content and campaign strategy.' },
  { name:'Tunde Adewale',   role:'Social Media Manager',  avatar:'T', email:'tunde@cerebre.media',   note:'Manages day-to-day social content and scheduling.' },
  { name:'Chidinma Eze',    role:'Analytics Specialist',  avatar:'C', email:'chidinma@cerebre.media', note:'Owns your data, reporting, and ClarityScore™.' },
  { name:'Bode Fashola',    role:'Copywriter',             avatar:'B', email:'bode@cerebre.media',    note:'Writes all brand copy and campaign messaging.' },
];

export default function ClientTeamPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-white">Our Team</h1>
        <p className="text-sm text-white/40 mt-1">Your dedicated Cerebre Media Africa account team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEAM.map(m => (
          <div key={m.name} className="sabi-card p-5">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-lg font-bold text-purple-300 flex-shrink-0">
                {m.avatar}
              </div>
              <div>
                <p className="font-semibold text-white">{m.name}</p>
                <Badge label={m.role} color="purple" />
              </div>
            </div>
            <p className="text-sm text-white/40 mb-4 leading-relaxed">{m.note}</p>
            <a href={`mailto:${m.email}`}
              className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors">
              <Mail className="w-3.5 h-3.5" />{m.email}
            </a>
          </div>
        ))}
      </div>

      <div className="sabi-card p-6 mt-6">
        <h2 className="text-sm font-semibold text-white mb-2">Need urgent support?</h2>
        <p className="text-sm text-white/40 mb-4">For urgent matters outside regular reporting, reach us directly.</p>
        <div className="flex items-center gap-4 flex-wrap">
          <a href="mailto:hello@cerebre.media" className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors">
            <Mail className="w-4 h-4" />hello@cerebre.media
          </a>
          <a href="https://wa.me/2348000000000" className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 transition-colors">
            <Phone className="w-4 h-4" />WhatsApp Support
          </a>
        </div>
      </div>
    </div>
  );
}
