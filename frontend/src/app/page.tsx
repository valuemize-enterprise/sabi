'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface Brand {
  name: string; initial: string; color: string; status: 'green' | 'amber' | 'red';
  satisfaction: number; revenue: string; goalPct: number; tasks: string;
  brandAdmin: string; strategy: string; openBriefs: number;
}

const BRANDS: Brand[] = [
  { name: 'FiberOne Telecom', initial: 'F', color: '#7c3aed', status: 'green', satisfaction: 4.6, revenue: '₦1.2M', goalPct: 88, tasks: '22/24', brandAdmin: 'Tunde A.', strategy: 'Q3 Instagram Growth', openBriefs: 1 },
  { name: 'Zenith Foods', initial: 'Z', color: '#10b981', status: 'green', satisfaction: 4.8, revenue: '₦640k', goalPct: 95, tasks: '18/18', brandAdmin: 'Ngozi E.', strategy: 'Ramadan Campaign Push', openBriefs: 0 },
  { name: 'Lagos Fashion Week', initial: 'L', color: '#f0b429', status: 'amber', satisfaction: 4.1, revenue: '₦980k', goalPct: 62, tasks: '14/20', brandAdmin: 'Tunde A.', strategy: 'Event Coverage Sprint', openBriefs: 2 },
  { name: 'Prime Realty', initial: 'P', color: '#3b82f6', status: 'green', satisfaction: 4.5, revenue: '₦510k', goalPct: 79, tasks: '16/19', brandAdmin: 'Ngozi E.', strategy: 'Lead Gen — Diaspora', openBriefs: 0 },
  { name: 'Naija Fintech Co', initial: 'N', color: '#ef4444', status: 'red', satisfaction: 3.2, revenue: '₦0', goalPct: 34, tasks: '6/15', brandAdmin: 'Kemi S.', strategy: 'Awaiting Strategy Approval', openBriefs: 3 },
  { name: 'Coral & Co Skincare', initial: 'C', color: '#a78bfa', status: 'amber', satisfaction: 4.0, revenue: '₦370k', goalPct: 58, tasks: '9/14', brandAdmin: 'Kemi S.', strategy: 'Influencer Seeding Q3', openBriefs: 1 },
];

const STATUS_META = {
  green: { label: 'On Track', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]' },
  amber: { label: 'Needs Attention', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' },
  red: { label: 'At Risk', color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400 shadow-[0_0_8px_#ef4444]' },
};

const ROLES = [
  { key: 'staff', label: '👤 Staff', badge: 'Individual Contributor', badgeClass: 'bg-violet-500/10 text-violet-300', title: "The person doing the work — copywriter, designer, strategist, social media manager.", desc: "Staff log their own work with proof, see the strategy behind every task, claim credit for going above their role, and always know exactly where their score stands.", points: [{ strong: 'Sees', text: "— only the brands they're assigned to, and the active strategy driving each one" }, { strong: 'Does', text: '— completes tasks, logs work with proof links, claims verified contributions' }, { strong: 'Scored on', text: '— client satisfaction, verified tasks, manager rating, contributions' }, { strong: 'Never does', text: '— mark their own work as "verified" — someone else always checks' }] },
  { key: 'brandadmin', label: '🛡️ Brand Admin', badge: 'Full Control, One Brand', badgeClass: 'bg-amber-500/10 text-amber-300', title: "A trusted staff member promoted to run one client account end-to-end.", desc: "Same power as an Admin — but the authority stops at the edge of their assigned brand. Only the Super Admin can grant this role.", points: [{ strong: 'Sees', text: '— everything about their one brand: financials, team, strategy, reports' }, { strong: 'Does', text: '— assigns tasks, verifies work, rates their team weekly, approves briefs' }, { strong: 'Scored on', text: "— client satisfaction, goal achievement, team's verified output, new revenue" }, { strong: 'Accountable for', text: '— unverified work sitting too long counts against their own score' }] },
  { key: 'creative', label: '🎨 Creative Director', badge: 'Craft Quality Guardian', badgeClass: 'bg-blue-500/10 text-blue-300', title: "The one person who reviews every designer's and creator's output — every single week.", desc: "A dedicated screen shows all creative work uploaded that week, grouped by person, with every proof link one click away.", points: [{ strong: 'Sees', text: '— all design, video, and content work from the last 7 days, agency-wide' }, { strong: 'Does', text: "— rates each creative's weekly output 1–5, nominates Creative of the Week" }, { strong: 'Powers', text: "— the manager-rating component of every designer's and creator's score" }, { strong: 'Rewards', text: '— Creative of the Week earns a visible badge and a score bonus' }] },
  { key: 'md', label: '👑 MD', badge: 'Agency-Wide Command', badgeClass: 'bg-red-500/10 text-red-300', title: "One screen, every Monday: money, people, clients, and risk — before anyone has to ask.", desc: "The Weekly Pulse compiles six panels automatically and can write itself into an executive summary with one click.", points: [{ strong: 'Sees', text: '— P&L, staff activity (including who did nothing), achievements, client health, flagged risks' }, { strong: 'Does', text: '— sets agency-wide annual targets, reviews score disputes, generates the AI weekly report' }, { strong: 'Full detail in', text: '— the MD Command Center demo below ↓' }] },
  { key: 'superadmin', label: '⚙️ Super Admin', badge: 'Unrestricted Access', badgeClass: 'bg-violet-500/10 text-violet-300', title: "The CEO's seat. Every brand, every score, every setting, every override.", desc: "The only role that can promote someone to Brand Admin, change how scores are weighted, or resolve a disputed score.", points: [{ strong: 'Sees', text: '— literally everything, including the private scoring weights' }, { strong: 'Does', text: '— creates brands and staff accounts, assigns Brand Admins, edits scoring formulas' }, { strong: 'Owns', text: '— the score-dispute queue and the final word on any conflict' }, { strong: 'Shares', text: '— full Weekly Pulse and Command Center access with the MD' }] },
  { key: 'client', label: '🤝 Client', badge: 'External, Read-Focused', badgeClass: 'bg-emerald-500/10 text-emerald-300', title: "A branded portal that replaces every WhatsApp thread the client used to send briefs through.", desc: "Clients see only their own brand — never other clients, never internal agency data — and their weekly rating is the single most important number in the entire system.", points: [{ strong: 'Sees', text: '— their reports, strategies awaiting approval, team profiles, goal progress' }, { strong: 'Does', text: '— submits briefs, approves or revises strategies, rates their week in one tap' }, { strong: 'Powers', text: '— 30–35% of every staff and Brand Admin score on their account' }, { strong: 'Never sees', text: '— other clients, internal scores, or staff salary/role details' }] },
];

const AI_CARDS = [
  { icon: '🧠', title: 'Strategy Generation', desc: 'Give ARIA the goals and context. It returns a full strategy — objectives, audience, channels, KPIs, timeline, Nigerian market notes — in under 30 seconds.' },
  { icon: '✅', title: 'Task Generation', desc: 'From an approved strategy, ARIA writes 8–15 implementation tasks and suggests who on the team should own each one, based on their role.' },
  { icon: '📋', title: 'Brief Analysis', desc: 'The moment a client submits a brief, ARIA extracts the core objective, complexity, timeline, and the clarifying questions the team should ask.' },
  { icon: '📊', title: 'Report Writing', desc: 'Upload a raw Instagram or Meta Ads export. ARIA reads it and writes a client-ready narrative with a performance grade — A through F.' },
  { icon: '👑', title: 'Weekly Pulse Summary', desc: "One click compiles the MD's entire week — financials, staff activity, client health, risks — into a written executive brief." },
  { icon: '💬', title: 'Ask ARIA', desc: 'A senior strategist available around the clock. Staff and clients can ask marketing questions and get grounded, on-brand answers instantly.' },
];

const TIME_SAVES = [
  { task: 'Writing a monthly performance report', before: '~2 hrs', beforeNote: 'manual, per brand', after: '~10 sec', afterNote: 'ARIA draft, human reviewed' },
  { task: 'Drafting a campaign strategy', before: '~1 day', beforeNote: 'from scratch', after: '~30 sec', afterNote: 'ARIA first draft' },
  { task: 'Breaking a strategy into tasks', before: '~45 min', beforeNote: 'manual planning', after: '~15 sec', afterNote: 'auto-generated + assigned' },
  { task: "Compiling the MD's weekly numbers", before: '~3 hrs', beforeNote: 'chasing six people', after: '0 min', afterNote: 'already waiting on /pulse' },
  { task: 'Finding out who did what this week', before: 'Guesswork', beforeNote: 'WhatsApp scroll-back', after: 'Verified', afterNote: 'logged, proven, scored' },
];

const GUIDES = [
  { href: 'Sabi-Staff-Bible.html', icon: '👤', title: 'The Staff Bible', desc: 'For individual contributors — logging work, claiming credit, tracking your score.', iconBg: 'bg-violet-500/10' },
  { href: 'Sabi-BrandAdmin-Bible.html', icon: '🛡️', title: 'The Brand Admin Bible', desc: 'For those managing brand relationships, verifying work, and reporting to clients.', iconBg: 'bg-amber-500/10' },
  { href: 'Sabi-CreativeDirector-Bible.html', icon: '🎨', title: 'The Creative Director Bible', desc: 'For overseeing creative strategy, quality, and direction across brands.', iconBg: 'bg-emerald-500/10' },
  { href: 'Sabi-Leadership-Bible.html', icon: '👑', title: 'The Leadership Bible', desc: 'For the MD and senior leadership — the agency-wide pulse and command view.', iconBg: 'bg-amber-500/10' },
  { href: 'Sabi-HR-Bible.html', icon: '⚙️', title: 'The HR Bible', desc: 'For people operations — onboarding, roles, performance, and admin.', iconBg: 'bg-blue-500/10' },
  { href: 'Sabi-Client-Guide.html', icon: '🤝', title: 'Your Guide to Sabi', desc: "For clients — what you'll see, what it means, and how to read your reports.", iconBg: 'bg-red-500/10' },
];

const NAV_LINKS = [
  ['#what', 'What It Is'], ['#roles', 'Roles'], ['#scoring', 'Scoring'],
  ['#ai', 'AI Engine'], ['#command-center', 'MD View'], ['#guides', 'Guides'],
  ['/client/login', 'Client Portal'], ['/login', 'Log In'],
];

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sabi-in'); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.sabi-reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="sabi-reveal flex items-center gap-2.5 mb-5 font-mono text-[11px] tracking-[3px] uppercase text-violet-300 font-semibold">
      <span className="w-6 h-px bg-violet-300 shrink-0" />
      {children}
    </div>
  );
}

function MockDot({ status }: { status: 'green' | 'amber' | 'red' }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 inline-block ${STATUS_META[status].dot}`} />;
}

function MockWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0e0e26] border border-white/10 rounded-2xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#131230] border-b border-white/[0.06]">
        {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => <span key={i} style={{ background: c }} className="w-2 h-2 rounded-full inline-block" />)}
        <span className="font-mono text-[10px] text-white/30 ml-2">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FormulaCard({ icon, title, subtitle, bars }: { icon: string; title: string; subtitle: string; bars: { label: string; width: number; color: string; val: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setAnimated(true); observer.disconnect(); } }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="bg-[#131230] border border-white/[0.06] rounded-2xl p-8">
      <div className="flex items-center gap-3.5 mb-7">
        <span className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center text-lg shrink-0">{icon}</span>
        <div>
          <div className="font-display text-[18px] font-semibold text-white">{title}</div>
          <div className="text-[12px] text-white/30 mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="space-y-4">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-3.5">
            <span className="w-36 shrink-0 text-[13px] text-white/60">{b.label}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-[1100ms] ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: animated ? `${b.width}%` : '0%', background: b.color }} />
            </div>
            <span className="w-6 text-right font-bold text-[13px] text-white font-mono">{b.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandCenter() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="bg-[#0a0a20] border border-white/10 rounded-3xl overflow-hidden shadow-[0_60px_120px_-40px_rgba(124,58,237,0.25)]">
      <div className="flex items-center justify-between px-6 py-4 bg-[#111129] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => <span key={i} style={{ background: c }} className="w-2 h-2 rounded-full inline-block" />)}
          <span className="font-mono text-[10px] text-white/30 ml-2">{process.env.NEXT_PUBLIC_APP_URL}/command-center</span>
        </div>
        <span className="font-mono text-[11px] text-white/30 hidden sm:block">Week of Jul 14 – 20</span>
      </div>
      <div className="p-5 sm:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden mb-7">
          {[{ num: '6', cls: 'text-white', lbl: 'Active Brands' }, { num: '₦4.2M', cls: 'text-amber-400', lbl: 'Revenue This Month' }, { num: '4.4★', cls: 'text-emerald-400', lbl: 'Avg Satisfaction' }, { num: '3', cls: 'text-red-400', lbl: 'Brands Flagged' }].map(s => (
            <div key={s.lbl} className="bg-[#0c0c22] p-5 text-center">
              <div className={`font-mono text-2xl font-bold ${s.cls}`}>{s.num}</div>
              <div className="text-[11px] text-white/30 mt-1">{s.lbl}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-3.5">
          {BRANDS.map((b, i) => (
            <button key={b.name} onClick={() => setSelected(selected === i ? null : i)} className={`rounded-2xl p-5 cursor-pointer text-left transition-all duration-200 ${selected === i ? 'bg-violet-500/10 border border-violet-500 shadow-[0_0_0_1px_#7c3aed]' : 'bg-[#131230] border border-white/[0.06] hover:border-white/10'}`}>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ background: b.color }}>{b.initial}</div>
                  <div>
                    <div className="font-semibold text-sm text-white">{b.name}</div>
                    <div className="text-[10px] text-white/30 mt-px">{b.brandAdmin}</div>
                  </div>
                </div>
                <MockDot status={b.status} />
              </div>
              <div className="flex gap-3.5 text-[11px] text-white/50">
                <span>★ <b className="text-white font-mono">{b.satisfaction}</b></span>
                <span>✓ <b className="text-white font-mono">{b.tasks}</b></span>
                <span>🎯 <b className="text-white font-mono">{b.goalPct}%</b></span>
              </div>
            </button>
          ))}
        </div>
        <div className={`bg-[#0c0c22] border border-white/[0.06] rounded-2xl p-8 min-h-[120px] flex ${selected === null ? 'items-center justify-center' : 'flex-col items-start'}`}>
          {selected === null ? (
            <span className="text-white/20 text-[13px]">↑ Click a brand card above to see its full command view</span>
          ) : (() => {
            const b = BRANDS[selected];
            const sm = STATUS_META[b.status];
            return (
              <div className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg text-white shrink-0" style={{ background: b.color }}>{b.initial}</div>
                    <div>
                      <div className="font-display text-xl font-semibold text-white">{b.name}</div>
                      <div className="text-[12px] text-white/30 mt-0.5">Brand Admin: {b.brandAdmin} · {b.strategy}</div>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-3.5 py-1.5 rounded-full shrink-0 ${sm.bg} ${sm.color}`}>{sm.label}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {[
                    { lbl: 'Satisfaction', val: `${b.satisfaction} ★`, cls: 'text-violet-300' },
                    { lbl: 'Revenue (New Briefs)', val: b.revenue, cls: 'text-amber-400' },
                    { lbl: 'Goal Achievement', val: `${b.goalPct}%`, cls: 'text-white' },
                    { lbl: 'Tasks Verified', val: b.tasks, cls: 'text-white' },
                    { lbl: 'Open Briefs', val: String(b.openBriefs), cls: b.openBriefs > 0 ? 'text-amber-400' : 'text-white' },
                  ].map(s => (
                    <div key={s.lbl} className="bg-[#131230] rounded-xl p-4">
                      <div className="text-[10px] text-white/30 mb-1.5">{s.lbl}</div>
                      <div className={`font-mono text-lg font-bold ${s.cls}`}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default function SabiPresentationPage() {
  const [activeRole, setActiveRole] = useState('staff');
  useReveal();
  const role = ROLES.find(r => r.key === activeRole)!;

  const STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .font-display { font-family: 'Space Grotesk', sans-serif !important; }
        .font-mono    { font-family: 'JetBrains Mono', monospace !important; }
        .sabi-reveal  { opacity: 0; transform: translateY(24px); transition: opacity .7s cubic-bezier(.2,.7,.3,1), transform .7s cubic-bezier(.2,.7,.3,1); }
        .sabi-in      { opacity: 1 !important; transform: translateY(0) !important; }
        @keyframes sabiIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        html { scroll-behavior: smooth; }
        ::selection { background: #7c3aed; color: #fff; }
      `

  return (
    <>
      {/* Inject styles */}
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <style>{ }</style>

      <div
        className="min-h-screen bg-[#08081a] text-[#f5f5fa] leading-relaxed overflow-x-hidden"
        style={{ backgroundImage: 'radial-gradient(ellipse 900px 500px at 15% -5%, rgba(124,58,237,0.18), transparent 60%), radial-gradient(ellipse 700px 500px at 90% 15%, rgba(240,180,41,0.06), transparent 60%)', backgroundAttachment: 'fixed' }}
      >

        {/* ── NAV ── */}
        <nav className="
    fixed top-5 left-1/2 -translate-x-1/2 z-50
    flex items-center gap-2
    px-4 lg:px-6 py-2
    rounded-full
    border border-white/10
    bg-[rgba(10,10,26,0.80)]
    backdrop-blur-xl
    w-max max-w-[95vw]
    overflow-x-auto md:overflow-visible
    whitespace-nowrap
  ">
          <div className="flex items-center gap-2 mr-3.5 shrink-0">
            <Image src="/sabi_logo.png" alt="Sabi" width={60} height={60} className="h-7 w-auto" />
          </div>
          {NAV_LINKS.map(([href, label]) => {
            const isLogin = href === '/login';
            const isClient = href === '/client/login';
            const isAction = isLogin || isClient;
            return (
              <a
                key={href}
                href={href}
                target={href.startsWith('/') ? '_blank' : '_self'}
                rel={href.startsWith('/') ? 'noopener noreferrer' : undefined}
                className={[
                  'text-[12.5px] font-semibold px-3.5 py-2 rounded-full whitespace-nowrap no-underline transition-all duration-200',
                  isLogin ? 'bg-violet-600 text-white hover:bg-violet-500' : '',
                  isClient ? 'border border-white/10 text-white hover:bg-white/5' : '',
                  !isAction ? 'text-white/50 hover:text-white hover:bg-white/5' : '',
                ].filter(Boolean).join(' ')}
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* ── HERO ── */}
        <header className="pt-[200px] pb-24 text-center relative">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <div className="inline-flex items-center gap-2 font-mono text-[12px] text-amber-400 bg-amber-400/10 border border-amber-400/30 px-4 py-1.5 rounded-full mb-8 tracking-wide">
              ● BUILT FOR CEREBRE MEDIA AFRICA
            </div>
            <h1 className="font-display text-[clamp(42px,6vw,88px)] leading-[0.98] font-bold tracking-[-0.03em] max-w-[1000px] mx-auto mb-6">
              The agency now runs<br />
              <span className="bg-gradient-to-r from-white via-violet-300 to-amber-400 bg-clip-text text-transparent">
                on evidence, not memory.
              </span>
            </h1>
            <p className="text-[clamp(16px,2vw,20px)] text-white/50 max-w-[680px] mx-auto mb-11 leading-[1.7]">
              Sabi Intelligence Suite is the operating system that connects every brand, every task, every naira, and every contribution — verified, scored, and visible to the people who need to see it.
            </p>
            <div className="flex gap-3.5 justify-center mb-24 flex-wrap">
              <a href="#command-center" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-[14.5px] bg-violet-600 text-white shadow-[0_8px_30px_-8px_rgba(124,58,237,0.35)] hover:bg-violet-500 transition-all no-underline">
                See the MD Command Center →
              </a>
              <a href="#what" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-[14.5px] border border-white/10 text-white hover:bg-white/5 transition-all no-underline">
                What is Sabi?
              </a>
            </div>
            <div className="sabi-reveal grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden max-w-[960px] mx-auto">
              {[{ num: '6', sub: '', lbl: 'User roles, one platform' }, { num: '100%', sub: '', lbl: 'Verified, not self-reported' }, { num: '10', sub: 'sec', lbl: 'To generate a client report' }, { num: '₦0', sub: '', lbl: 'Spent on WhatsApp confusion' }].map(s => (
                <div key={s.lbl} className="bg-[#0c0c22] px-5 py-7 text-center">
                  <div className="font-mono text-[clamp(22px,3vw,32px)] font-bold text-white">{s.num}<span className="text-violet-300">{s.sub}</span></div>
                  <div className="text-[12.5px] text-white/30 mt-1.5">{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── WHAT IS SABI ── */}
        <section id="what" className="py-[120px]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>WHAT IT IS</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[820px] mb-6">
              One platform. Three jobs the agency was doing badly across six different tools.
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[640px] leading-[1.7] mb-16">
              Before Sabi: briefs on WhatsApp, reports in Google Docs, tasks in someone's head, performance judged on vibes. Sabi replaces all of it with one system where nothing depends on someone remembering.
            </p>
            <div className="sabi-reveal grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { icon: '◆', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-300', title: 'Project Management', desc: 'Every task assigned, tracked, and — critically — <b class="text-white">verified</b> before it counts as done. Nothing marks itself complete.' },
                { icon: '◈', iconBg: 'bg-amber-500/10', iconColor: 'text-amber-300', title: 'Client Relationship', desc: "Clients submit briefs, review strategies, approve work, and rate their week — all inside their own branded portal, not a WhatsApp thread." },
                { icon: '✦', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-300', title: 'AI Intelligence Layer', desc: "ARIA — the built-in AI — drafts strategies, writes performance reports, and analyses briefs, so senior staff start from a first draft, not a blank page." },
              ].map(c => (
                <div key={c.title} className="bg-[#131230] border border-white/[0.06] rounded-2xl p-8 hover:border-white/10 transition-all">
                  <div className={`w-12 h-12 rounded-xl ${c.iconBg} ${c.iconColor} flex items-center justify-center text-xl mb-5`}>{c.icon}</div>
                  <h3 className="font-display text-[clamp(20px,2vw,26px)] font-semibold tracking-tight mb-3">{c.title}</h3>
                  <p className="text-white/50 text-[15px]" dangerouslySetInnerHTML={{ __html: c.desc }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="py-[120px] bg-[#0c0c22] border-t border-b border-white/[0.06]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>HOW IT WORKS</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[760px] mb-16">
              Four steps. Every piece of work follows the same evidence trail.
            </h2>
            <div className="sabi-reveal flex flex-col lg:flex-row items-start gap-2">
              {[
                { n: '01', title: 'Brief comes in', body: "A client submits a request, or a strategy defines the work. It's classified as Retainer or New Project — the line that decides billing." },
                { n: '02', title: 'Task gets assigned', body: 'A named person, a deadline, a priority. ARIA can generate the whole task list from an approved strategy automatically.' },
                { n: '03', title: 'Work gets verified', body: 'The staff member marks it done with proof — a link, a file, a recording. A Brand Admin checks it and verifies. Unverified work earns nothing.' },
                { n: '04', title: 'It counts — visibly', body: "Verified work feeds the client's report, the staff member's score, the Brand Admin's scorecard, and the MD's weekly pulse. Automatically." },
              ].map((s, i, arr) => (
                <div key={s.n} className="contents">
                  <div className="flex-1 bg-[#131230] border border-white/[0.06] rounded-2xl p-6 w-full">
                    <div className="font-mono text-violet-300 text-[13px] font-bold mb-3.5">{s.n}</div>
                    <h4 className="font-display text-[17px] mb-2 text-white">{s.title}</h4>
                    <p className="text-[13.5px] text-white/50 leading-[1.55]">{s.body}</p>
                  </div>
                  {i < arr.length - 1 && <div className="hidden lg:block text-white/20 text-xl pt-12 shrink-0">→</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ROLES ── */}
        <section id="roles" className="py-[120px]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>SIX ROLES, ONE PLATFORM</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[760px] mb-4">
              Everyone sees a different screen. Everyone sees the truth.
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[640px] leading-[1.7] mb-12">
              Click a role to see exactly what they do in Sabi, and what they're accountable for.
            </p>
            <div className="sabi-reveal flex gap-2 flex-wrap mb-2">
              {ROLES.map(r => (
                <button key={r.key} onClick={() => setActiveRole(r.key)} className={`font-semibold text-[13.5px] px-5 py-2.5 rounded-full cursor-pointer transition-all duration-200 ${activeRole === r.key ? 'bg-violet-600 border border-violet-600 text-white' : 'bg-[#131230] border border-white/[0.06] text-white/50 hover:text-white hover:border-white/10'}`}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="sabi-reveal bg-[#131230] border border-white/[0.06] rounded-2xl p-6 sm:p-11 mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                  <span className={`inline-block text-[12px] font-bold px-3.5 py-1.5 rounded-full tracking-wide ${role.badgeClass}`}>{role.badge}</span>
                  <h3 className="font-display text-[clamp(20px,2vw,28px)] font-semibold tracking-tight my-3.5">{role.title}</h3>
                  <p className="text-white/50 text-[15px] mb-6">{role.desc}</p>
                  <ul className="space-y-3">
                    {role.points.map(p => (
                      <li key={p.strong} className="text-[14px] text-white/50 pl-4 relative leading-[1.55]">
                        <span className="absolute left-0 text-violet-300">—</span>
                        <strong className="text-white font-semibold">{p.strong}</strong>{p.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="opacity-90">
                  {activeRole === 'staff' && (
                    <MockWindow title="my-work · Sabi">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-300 flex items-center justify-center font-bold text-[13px] shrink-0">A</div>
                        <div><div className="font-semibold text-[13px]">Adaeze O.</div><div className="text-[10.5px] text-white/30">Copywriter · FiberOne, Zenith Foods</div></div>
                      </div>
                      <div className="bg-gradient-to-br from-violet-500/10 to-[#0e0e26]/40 border border-violet-500/20 rounded-xl px-3.5 py-3 mb-3.5">
                        <div className="font-mono text-[10px] text-violet-300 font-bold tracking-widest">ACTIVE STRATEGY</div>
                        <div className="font-semibold text-[13.5px] mt-1">Q3 Instagram Growth — FiberOne</div>
                      </div>
                      {[['Write 10 Eid campaign captions', 'verified', true], ['Draft newsletter — August', 'in review', false], ['Blog: "5 Data Habits for SMEs"', 'to do', false]].map(([task, tag, done]) => (
                        <div key={String(task)} className="flex items-center gap-2.5 py-2.5 border-t border-white/[0.06] text-[12.5px]">
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 text-[10px] text-white ${done ? 'bg-emerald-500' : 'border border-white/10'}`}>{done ? '✓' : ''}</div>
                          <span className="flex-1 text-white/50">{String(task)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${tag === 'verified' ? 'bg-emerald-500/10 text-emerald-400' : tag === 'in review' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white/30'}`}>{String(tag)}</span>
                        </div>
                      ))}
                    </MockWindow>
                  )}
                  {activeRole === 'brandadmin' && (
                    <MockWindow title="brand · financials">
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-base shrink-0">🛡️</div>
                        <div><div className="font-semibold text-[13px]">FiberOne Telecom</div><div className="text-[10.5px] text-white/30">Brand Admin: Tunde A.</div></div>
                      </div>
                      <div className="flex gap-2.5 mb-3.5">
                        {[{ n: '4.6★', c: 'text-emerald-400', l: 'Satisfaction' }, { n: '92%', c: 'text-white', l: 'Verified' }, { n: '₦850k', c: 'text-amber-400', l: 'New Revenue' }].map(s => (
                          <div key={s.l} className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                            <div className={`font-mono font-bold text-[15px] ${s.c}`}>{s.n}</div>
                            <div className="text-[9.5px] text-white/30 mt-1">{s.l}</div>
                          </div>
                        ))}
                      </div>
                      {['Reels caption pack — Chidi O.', 'Logo variant set — Blessing K.'].map(task => (
                        <div key={task} className="flex items-center justify-between py-2 border-t border-white/[0.06] text-[12px] text-white/50">
                          <span>{task}</span>
                          <button className="font-semibold text-[10.5px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">Verify ✓</button>
                        </div>
                      ))}
                    </MockWindow>
                  )}
                  {activeRole === 'md' && (
                    <MockWindow title="pulse · weekly">
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {[{ dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]', lbl: 'P&L', val: '₦2.1M' }, { dot: 'bg-amber-400 shadow-[0_0_8px_#f59e0b]', lbl: 'Staff Active', val: '11/14' }, { dot: 'bg-emerald-400 shadow-[0_0_8px_#10b981]', lbl: 'Achievements', val: '+18' }, { dot: 'bg-red-400 shadow-[0_0_8px_#ef4444]', lbl: 'Challenges', val: '3 flags' }].map(s => (
                          <div key={s.lbl} className="bg-white/5 rounded-xl p-3 text-center">
                            <div className={`w-1.5 h-1.5 rounded-full ${s.dot} mx-auto mb-2`} />
                            <div className="text-[10px] text-white/30">{s.lbl}</div>
                            <div className="font-bold text-[13px]">{s.val}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl p-3.5 text-[12px] text-white/50 leading-relaxed italic">
                        ✦ ARIA: "FiberOne satisfaction dropped 1.2pts this week — recommend a check-in call before Friday."
                      </div>
                    </MockWindow>
                  )}
                  {activeRole === 'creative' && (
                    <MockWindow title="creative-review">
                      {[{ init: 'B', name: 'Blessing K.', sub: '3 items · Graphic Designer', stars: '★★★★★', gold: false, pending: false }, { init: 'C', name: 'Chidi O.', sub: '5 items · Content Creator', stars: '★★★★★', gold: true, pending: false, badge: '🏆 Creative of the Week' }, { init: 'M', name: 'Musa I.', sub: '2 items · Video Editor', stars: '☆☆☆☆☆', gold: false, pending: true }].map(c => (
                        <div key={c.name} className="flex items-center gap-3 py-2.5 border-t border-white/[0.06]">
                          <div className={`w-8 h-8 rounded-lg ${c.gold ? 'bg-amber-500/10 text-amber-400' : 'bg-violet-500/10 text-violet-300'} flex items-center justify-center font-bold text-[13px] shrink-0`}>{c.init}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-[12.5px]">{c.name}{c.badge && <span className="ml-1 text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full">{c.badge}</span>}</div>
                            <div className="text-[10px] text-white/30">{c.sub}</div>
                          </div>
                          <span className={`text-[12px] tracking-wide ${c.pending ? 'text-white/20' : 'text-amber-400'}`}>{c.stars}{c.pending && <span className="text-[9px] text-white/20 ml-1">pending</span>}</span>
                        </div>
                      ))}
                    </MockWindow>
                  )}
                  {activeRole === 'superadmin' && (
                    <MockWindow title="settings · scoring config">
                      <div className="font-mono text-[10px] text-white/20 mb-2.5 tracking-wide">STAFF SCORE WEIGHTS — PRIVATE</div>
                      {[{ lbl: 'Client Satisfaction', w: 35, color: '#7c3aed' }, { lbl: 'Verified Tasks', w: 30, color: '#a78bfa' }, { lbl: 'Manager Rating', w: 20, color: '#3b82f6' }, { lbl: 'Contributions', w: 15, color: '#f0b429' }].map(r => (
                        <div key={r.lbl} className="flex items-center gap-3 mb-3 text-[12px] text-white/50">
                          <span className="w-[120px] shrink-0">{r.lbl}</span>
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden"><div style={{ width: `${r.w}%`, background: r.color }} className="h-full rounded-full" /></div>
                          <span className="w-6 text-right text-white font-bold font-mono">{r.w}</span>
                        </div>
                      ))}
                    </MockWindow>
                  )}
                  {activeRole === 'client' && (
                    <MockWindow title="client · dashboard">
                      <div className="bg-gradient-to-br from-violet-500/10 to-[#0e0e26]/30 border border-violet-500/20 rounded-xl p-4 mb-3.5">
                        <div className="font-semibold text-[13px] mb-2.5">How was this week? 👋</div>
                        <div className="text-amber-400 text-xl tracking-[4px]">★ ★ ★ ★ ★</div>
                      </div>
                      {[['📊 August Performance Report', 'ready', 'bg-emerald-500/10 text-emerald-400'], ['📋 Q3 Strategy — awaiting your review', 'action needed', 'bg-amber-500/10 text-amber-400']].map(([task, tag, cls]) => (
                        <div key={String(task)} className="flex items-center gap-2.5 py-2.5 border-t border-white/[0.06] text-[12.5px]">
                          <span className="flex-1 text-white/50">{String(task)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${String(cls)}`}>{String(tag)}</span>
                        </div>
                      ))}
                    </MockWindow>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SCORING ── */}
        <section id="scoring" className="py-[120px] bg-[#0c0c22] border-t border-b border-white/[0.06]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>THE SCORING SYSTEM</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[800px] mb-4">
              A system built so it measures outcomes, not activity — and can't be gamed.
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[640px] leading-[1.7] mb-14">
              The biggest mistake most scoring systems make: they reward busyness. Sabi anchors every score to what the client actually experiences, verified by a human who isn't the person being scored.
            </p>
            <div className="sabi-reveal grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
              <FormulaCard icon="👤" title="Staff Score" subtitle="Out of 100, every week" bars={[{ label: 'Client Satisfaction', width: 35, color: '#7c3aed', val: 35 }, { label: 'Verified Tasks', width: 30, color: '#a78bfa', val: 30 }, { label: 'Manager Rating', width: 20, color: '#3b82f6', val: 20 }, { label: 'Contributions', width: 15, color: '#f0b429', val: 15 }]} />
              <FormulaCard icon="🛡️" title="Brand Admin Score" subtitle="Out of 100, every week" bars={[{ label: 'Client Satisfaction', width: 30, color: '#7c3aed', val: 30 }, { label: 'Goal Achievement', width: 25, color: '#10b981', val: 25 }, { label: 'Team Completion', width: 25, color: '#3b82f6', val: 25 }, { label: 'New Brief Revenue', width: 20, color: '#f0b429', val: 20 }]} />
            </div>
            <div className="sabi-reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[{ n: '01', title: 'Nothing self-reported counts', body: 'A staff member marking their own task "done" earns zero points until a Brand Admin verifies it.' }, { n: '02', title: 'The client controls the anchor', body: "Satisfaction comes from the client's own weekly rating — submitted independently, before any staff member sees it." }, { n: '03', title: "Weights are private, categories aren't", body: "Everyone knows what's measured. No one knows the exact formula — so no one optimizes for one number." }, { n: '04', title: '4-week rolling average', body: "One bad week from a sick child or a difficult client never defines anyone's standing." }].map(ag => (
                <div key={ag.n} className="p-6 bg-[#131230] border border-white/[0.06] rounded-2xl">
                  <div className="font-mono text-[12px] text-white/20 mb-3">{ag.n}</div>
                  <h5 className="font-display text-[14.5px] mb-2 text-white">{ag.title}</h5>
                  <p className="text-[12.5px] text-white/50 leading-[1.55]">{ag.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI ENGINE ── */}
        <section id="ai" className="py-[120px]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>THE AI ENGINE</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[760px] mb-4">
              ARIA writes the first draft. The team never starts from a blank page again.
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[640px] leading-[1.7] mb-14">
              Built on Claude, Anthropic's AI model. ARIA doesn't replace judgment — every output is reviewed by a human before a client sees it. It just removes the blank page.
            </p>
            <div className="sabi-reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {AI_CARDS.map(c => (
                <div key={c.title} className="bg-gradient-to-br from-[#131230] to-[#0c0c22] border border-white/[0.06] rounded-2xl p-7 hover:border-white/10 hover:-translate-y-1 transition-all">
                  <div className="text-2xl mb-4">{c.icon}</div>
                  <h4 className="font-display text-[16px] mb-2 text-white">{c.title}</h4>
                  <p className="text-[13.5px] text-white/50 leading-[1.55]">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TIME SAVED ── */}
        <section className="py-[120px] bg-[#0c0c22] border-t border-b border-white/[0.06]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>TIME, RECLAIMED</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[700px] mb-14">
              The same work. A fraction of the time.
            </h2>
            <div className="sabi-reveal flex flex-col gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
              {TIME_SAVES.map(row => (
                <div key={row.task} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_40px_140px] items-center bg-[#0c0c22] px-7 py-5 gap-4">
                  <div className="text-[14.5px] text-white font-medium">{row.task}</div>
                  <div>
                    <span className="font-mono text-[16px] font-bold text-white/30 line-through decoration-red-500/40">{row.before}</span>
                    <small className="block text-[10.5px] text-white/20 mt-0.5">{row.beforeNote}</small>
                  </div>
                  <div className="hidden sm:block text-violet-300 text-[18px] text-center">→</div>
                  <div>
                    <span className="font-mono text-[16px] font-bold text-emerald-400">{row.after}</span>
                    <small className="block text-[10.5px] text-white/20 mt-0.5">{row.afterNote}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMMAND CENTER ── */}
        <section id="command-center" className="py-[120px]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>THE SIGNATURE VIEW</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[800px] mb-4">
              This is what the MD opens Monday morning. Every brand, one glance, zero guessing.
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[640px] leading-[1.7] mb-3">
              This is a working preview — click any brand below to see it expand.
            </p>
            <p className="text-[12.5px] text-white/20 mb-10">Brand names shown are illustrative examples for this demo.</p>
            <div className="sabi-reveal"><CommandCenter /></div>
          </div>
        </section>

        {/* ── GUIDES ── */}
        <section id="guides" className="py-[120px] bg-[#0c0c22] border-t border-b border-white/[0.06]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8">
            <Eyebrow>DOCUMENTATION</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(32px,4.2vw,56px)] font-semibold tracking-tight max-w-[760px] mb-4">
              A guide for every role.
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[640px] leading-[1.7] mb-12">
              Each role has its own handbook — what to do, what's expected, and how Sabi supports the work.
            </p>
            <div className="sabi-reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {GUIDES.map(g => (
                <a key={g.title} href={g.href} className="block bg-[#131230] border border-white/[0.06] rounded-2xl p-8 no-underline text-inherit hover:border-white/10 hover:-translate-y-1 transition-all">
                  <div className={`w-12 h-12 rounded-xl ${g.iconBg} flex items-center justify-center text-xl mb-5`}>{g.icon}</div>
                  <h4 className="font-display text-[18px] mb-2 text-white">{g.title}</h4>
                  <p className="text-[14px] text-white/50">{g.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── CLOSING ── */}
        <section className="py-[140px]">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8 text-center">
            <Eyebrow>WHERE WE'RE HEADED</Eyebrow>
            <h2 className="sabi-reveal font-display text-[clamp(42px,6vw,88px)] leading-[0.98] font-bold tracking-[-0.03em] max-w-[900px] mx-auto mb-6">
              Not just software.<br />
              <span className="bg-gradient-to-r from-white via-violet-300 to-amber-400 bg-clip-text text-transparent">
                A world-class agency's operating rhythm.
              </span>
            </h2>
            <p className="sabi-reveal text-[19px] text-white/50 max-w-[600px] mx-auto mb-11 leading-[1.7]">
              Every brand accounted for. Every contribution verified. Every naira traceable. Every person — from the newest hire to the MD — working from the same truth.
            </p>
            <div className="sabi-reveal flex gap-3.5 justify-center flex-wrap">
              <a href="#command-center" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-[14.5px] bg-violet-600 text-white no-underline shadow-[0_8px_30px_-8px_rgba(124,58,237,0.35)] hover:bg-violet-500 transition-all">
                Revisit the Command Center ↑
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t border-white/[0.06] py-8">
          <div className="max-w-[1180px] mx-auto px-6 sm:px-8 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 font-display font-bold text-[15px] text-white">
              <span className="w-2 h-2 rounded-full bg-violet-600 shadow-[0_0_12px_#7c3aed] inline-block" />
              SABI
            </div>
            <span className="text-[12px] text-white/20">
              Sabi Intelligence Suite · Cerebre Media Africa · Confidential Board Presentation · July 2026
            </span>
          </div>
        </footer>

      </div>
    </>
  );
}