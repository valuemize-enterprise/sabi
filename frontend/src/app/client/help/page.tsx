'use client';
import { useState } from 'react';
import { HelpCircle, ChevronDown, Mail, MessageCircle, ExternalLink, BookOpen, Brain, FileText } from 'lucide-react';

const FAQS = [
  { q:'What is ClarityScore™?', a:'ClarityScore™ is Cerebre\'s proprietary AI-powered brand health metric, scored from 0–1000. It evaluates 7 dimensions: goal performance, content consistency, competitive position, audience engagement, brand visibility, digital presence, and campaign execution. Grades run from D (0–399) to S (850–1000).' },
  { q:'How often is my ClarityScore™ updated?', a:'Your score is typically refreshed weekly. Your account team can also manually trigger a refresh after a major campaign or milestone. You\'ll get a notification each time it updates.' },
  { q:'What does ARIA do?', a:'ARIA is your AI intelligence assistant powered by Anthropic\'s Claude. ARIA can answer questions about your brand performance, explain report findings, summarize your goals, and provide strategic recommendations based on your real data.' },
  { q:'How do I read my performance reports?', a:'Go to Reports in your sidebar. Each report includes a NarrativeAI™ summary written by ARIA, followed by key metrics. Reports are published monthly (or as agreed with your team) and cover the period specified in the report header.' },
  { q:'Can I download my reports?', a:'Currently, reports are viewable in the portal. Contact your account team or email hello@cerebre.media to request a PDF export of any report.' },
  { q:'What are MomentMap™ recommendations?', a:'MomentMap™ uses ARIA to surface Nigerian cultural, religious, commercial, and national moments that your brand should plan content around. Each moment comes with a relevance score, recommended platform, and content brief.' },
  { q:'How do I update my profile or password?', a:'Go to Settings in your sidebar. You can update your name, contact details, job title, and change your password from there.' },
  { q:'My dashboard looks empty — why?', a:'This usually means your account team hasn\'t published any content to your portal yet, or data is still being configured. Reach out to your account manager to confirm setup is complete.' },
];

const RESOURCES = [
  { icon: Brain,    label: 'Ask ARIA',              href: '/client/ask',        desc: 'Get instant AI answers about your brand' },
  { icon: FileText, label: 'View Your Reports',      href: '/client/reports',    desc: 'Access all published performance reports' },
  { icon: BookOpen, label: 'ClarityScore™ Guide',   href: '/client/dashboard',  desc: 'Understand your brand health score' },
];

export default function ClientHelpPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Help & Support</h1>
          <p className="text-sm text-white/40">Answers to common questions and how to get support</p>
        </div>
      </div>

      {/* Quick resources */}
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Quick Actions</h2>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {RESOURCES.map(({ icon: Icon, label, href, desc }) => (
          <a key={href} href={href}
            className="sabi-card p-4 text-center hover:border-purple-500/30 hover:bg-purple-500/3 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/15 flex items-center justify-center mx-auto mb-3 group-hover:bg-purple-500/20 transition-all">
              <Icon className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">{label}</p>
            <p className="text-xs text-white/30 mt-0.5">{desc}</p>
          </a>
        ))}
      </div>

      {/* FAQ */}
      <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Frequently Asked Questions</h2>
      <div className="space-y-2 mb-8">
        {FAQS.map((faq, i) => (
          <div key={i} className="sabi-card overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/2 transition-all">
              <p className="text-sm font-medium text-white pr-4">{faq.q}</p>
              <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-5 pb-5 border-t border-white/5">
                <p className="text-sm text-white/60 leading-relaxed pt-4">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="sabi-card p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Still need help?</h2>
        <div className="grid grid-cols-2 gap-4">
          <a href="mailto:hello@cerebre.media"
            className="flex items-center gap-3 p-4 bg-white/3 rounded-xl border border-white/5 hover:border-purple-500/20 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center"><Mail className="w-4 h-4 text-purple-400" /></div>
            <div>
              <p className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors">Email Support</p>
              <p className="text-xs text-white/30">hello@cerebre.media</p>
            </div>
          </a>
          <a href="https://wa.me/2348000000000"
            className="flex items-center gap-3 p-4 bg-white/3 rounded-xl border border-white/5 hover:border-green-500/20 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-green-400" /></div>
            <div>
              <p className="text-sm font-medium text-white group-hover:text-green-300 transition-colors">WhatsApp</p>
              <p className="text-xs text-white/30">Mon–Fri, 9am–6pm WAT</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
