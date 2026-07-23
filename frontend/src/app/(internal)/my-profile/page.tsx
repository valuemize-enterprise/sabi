'use client';

/**
 * /my-profile — Staff Profile Form
 * Staff fills this; HR reads all sections (including Tier-3 medical).
 * Architecture:
 *   - 8 sections in a sidebar-nav + main-panel layout
 *   - Uses Tailwind CSS and Sabi design system
 *   - POST /api/people/me/profile on final submit
 *   - PUT /api/people/me/profile/save for interim auto-saves
 */

import { useCallback, useEffect, useReducer, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { MaritalStatus, BloodGroup, Genotype, Proficiency, StaffProfileFull } from '@/components/profile/staff-profile.types';
import {
  Field, Locked, Seg, Reveal, Card, ConfCard, InfoNote,
  G1, G2, G3, SecFoot, DelBtn, AddRowBtn, ProficiencyPicker, CheckRow,
} from '@/components/profile/ProfilePrimitives';

/* ── sections ─────────────────────────────────────────── */
const SECTIONS = ['personal', 'family', 'medical', 'education', 'languages', 'experience', 'guarantor', 'declaration'] as const;
type SectionKey = typeof SECTIONS[number];
const NAV: { key: SectionKey; icon: string; name: string; sub: string }[] = [
  { key: 'personal', icon: '👤', name: 'Personal', sub: 'Name, identity, contact' },
  { key: 'family', icon: '👨‍👩‍👧', name: 'Family & Next of Kin', sub: 'Dependants, next of kin' },
  { key: 'medical', icon: '🏥', name: 'Medical', sub: 'Health, blood, emergency' },
  { key: 'education', icon: '🎓', name: 'Education', sub: 'Schools, degrees, courses' },
  { key: 'languages', icon: '🌍', name: 'Languages', sub: 'Proficiency levels' },
  { key: 'experience', icon: '💼', name: 'Work Experience', sub: 'Employment history' },
  { key: 'guarantor', icon: '🤝', name: 'Guarantor', sub: 'Your guarantor\'s details' },
  { key: 'declaration', icon: '✍️', name: 'Declaration', sub: 'Review & sign' },
];

/* ── blank defaults for repeating rows ────────────────── */
const blankFamily = () => ({ full_name: '', date_of_birth: '', relationship: 'Other' as const });
const blankLang = () => ({ language: '', speaking: 'Good' as Proficiency, reading: 'Good' as Proficiency, writing: 'Good' as Proficiency });
const blankWork = () => ({ organisation: '', from_date: '', to_date: '', responsibilities: '' });
const blankEdu = () => ({ institution_name: '', address: '', from_date: '', to_date: '', certificate_obtained: '' });

/* ── state ─────────────────────────────────────────────── */
type State = Partial<StaffProfileFull> & {
  non_nigerian?: boolean;
  family_members: ReturnType<typeof blankFamily>[];
  languages: ReturnType<typeof blankLang>[];
  work_history: ReturnType<typeof blankWork>[];
  tertiary_education: ReturnType<typeof blankEdu>[];
  professional_qualifications: ReturnType<typeof blankEdu>[];
  has_criminal_record: boolean;
  guarantor_form_acknowledged: boolean;
  declaration_1: boolean;
  declaration_2: boolean;
  secondary_education: any
};

const initialState: State = {
  marital_status: 'Single', nationality: '', non_nigerian: false,
  family_members: [blankFamily()], languages: [blankLang()], secondary_education: [blankEdu()],
  work_history: [blankWork()], tertiary_education: [blankEdu()],
  professional_qualifications: [blankEdu()],
  has_criminal_record: false, guarantor_form_acknowledged: false,
  declaration_1: false, declaration_2: false,
};

type Action = { type: 'SET'; key: string; value: unknown }
  | { type: 'LIST_SET'; list: string; idx: number; key: string; value: unknown }
  | { type: 'LIST_ADD'; list: string; blank: object }
  | { type: 'LIST_DEL'; list: string; idx: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET': return { ...state, [action.key]: action.value };
    case 'LIST_SET': {
      const arr = [...((state as any)[action.list] as any[])];
      arr[action.idx] = { ...arr[action.idx], [action.key]: action.value };
      return { ...state, [action.list]: arr };
    }
    case 'LIST_ADD': return { ...state, [action.list]: [...((state as any)[action.list] as any[]), action.blank] };
    case 'LIST_DEL': {
      const arr = ((state as any)[action.list] as any[]).filter((_: any, i: number) => i !== action.idx);
      return { ...state, [action.list]: arr };
    }
    default: return state;
  }
}

const set = (dispatch: React.Dispatch<Action>) =>
  (key: string) => (value: unknown) => dispatch({ type: 'SET', key, value });

/* ── API calls ─────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_URL || '';
const token = () => typeof window !== 'undefined' ? localStorage.getItem('sabi_token') : null;
const apiFetch = (path: string, body: unknown, method = 'POST') =>
  fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) }, body: JSON.stringify(body) }).then(r => r.json());

/* ══════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════ */
export default function MyProfilePage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [section, setSection] = useState<SectionKey>('personal');
  const [done, setDone] = useState<Set<SectionKey>>(new Set());
  const [partial, setPartial] = useState<Set<SectionKey>>(new Set(['personal']));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const s = set(dispatch);

  const pct = Math.round((done.size / SECTIONS.length) * 100);
  const CIRC = 69.1;
  const dashOffset = CIRC - (CIRC * pct / 100);

  const goTo = (key: SectionKey) => {
    setPartial(p => new Set([...p, key]));
    setSection(key);
    setSidebarOpen(false); // Close sidebar on mobile after selection
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const next = (key: SectionKey) => {
    setDone(d => new Set([...d, section]));
    goTo(key);
  };
  const prev = (key: SectionKey) => goTo(key);

  const save = useCallback(async () => {
    setSaving(true);
    await apiFetch('/api/people/me/profile/save', state, 'PUT').catch(() => { });
    setSaving(false);
  }, [state]);

  const submit = async () => {
    const method = hasExistingProfile ? 'PUT' : 'POST';
    const res = await apiFetch('/api/people/me/profile', { ...state, profile_state: 'submitted', submitted_at: new Date().toISOString() }, method);
    if (res.success) { 
      setDone(new Set(SECTIONS)); 
      setSubmitted(true); 
      setIsEditMode(false);
      setHasExistingProfile(true);
    }
  };

  const canSubmit = state.declaration_1 && state.declaration_2 && state.digital_signature?.trim();

  // Fetch existing profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API}/api/people/me/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch profile: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success && data.form) {
          // Populate form with existing data
          Object.keys(data.form).forEach((key) => {
            if (data.form[key] !== null && data.form[key] !== undefined) {
              dispatch({ type: 'SET', key, value: data.form[key] });
            }
          });

          // Set flags
          setHasExistingProfile(true);
          if (data.form.profile_state === 'submitted') {
            setSubmitted(true);
          }
          
          // Mark all sections as done if profile is submitted
          if (data.form.profile_state === 'submitted') {
            setDone(new Set(SECTIONS));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    dispatch({ type: 'SET', key: 'signature_date', value: new Date().toISOString().slice(0, 10) });
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-lg font-semibold text-white">Loading your profile...</div>
          <div className="text-sm text-white/60 mt-2">Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="sabi-card p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="text-xl font-bold text-white mb-2">Unable to load profile</div>
            <div className="text-sm text-white/60 mb-6">{error}</div>
            <button
              className="sabi-btn-primary px-6 py-2.5 text-sm font-semibold"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted && !isEditMode) return <SuccessScreen onEdit={() => setIsEditMode(true)} profileData={state} />;

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      {/* topbar */}
      <header className="sticky top-0 z-30 h-16 bg-[#12122a]/95 backdrop-blur-sm border-b border-white/10 px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
        {/* Mobile menu button */}
        <button
          className="lg:hidden w-9 h-9 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo/Mark */}
        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center text-white font-bold text-sm">
          S
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-white truncate">My Profile</h1>
          <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/40">Staff Record · Sabi</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Progress indicator - hidden on mobile */}
          <div className="hidden sm:flex items-center gap-2 bg-[#12122a] border border-white/10 rounded-full px-3 py-1.5">
            <div className="relative w-7 h-7">
              <svg viewBox="0 0 28 28" className="transform -rotate-90 w-full h-full">
                <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
                <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="69.1" strokeDashoffset={dashOffset} strokeLinecap="round" className="text-purple-500 transition-all duration-500" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white/60">{pct}%</div>
            </div>
            <span className="text-[10px] font-bold text-white/50 hidden md:inline">Profile completion</span>
          </div>

          {/* Save button */}
          <button
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white/60 hover:text-white transition-colors"
            onClick={save}
            disabled={saving}
          >
            {saving ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-[#0a0a18] border-r border-white/10
          p-4 overflow-y-auto z-40 transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Close button for mobile */}
          <button
            className="lg:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 px-2">Profile sections</div>

          <div className="space-y-0.5">
            {NAV.map(n => {
              const isActive = section === n.key;
              const isDone = done.has(n.key);
              const isPartial = !isDone && partial.has(n.key);

              return (
                <button
                  key={n.key}
                  className={`
                    w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border-none text-left cursor-pointer transition-all
                    ${isActive ? 'bg-purple-500/20' : 'hover:bg-white/5'}
                  `}
                  onClick={() => goTo(n.key)}
                >
                  {/* Status dot */}
                  <span className={`
                    w-2 h-2 rounded-full border-2 flex-shrink-0 transition-all
                    ${isDone ? 'bg-green-500 border-green-500' :
                      isActive ? 'bg-purple-500 border-purple-500 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]' :
                        isPartial ? 'bg-amber-500 border-amber-500' :
                          'bg-transparent border-white/20'}
                  `} />

                  {/* Icon */}
                  <span className="text-base flex-shrink-0">{n.icon}</span>

                  {/* Text */}
                  <span className="flex-1 min-w-0">
                    <span className={`block text-xs font-bold truncate ${isActive || isDone ? 'text-white' : 'text-white/50'}`}>
                      {n.name}
                    </span>
                    <span className="block text-[9px] text-white/30 truncate">{n.sub}</span>
                  </span>

                  {/* Checkmark */}
                  {isDone && <span className="text-xs text-green-500 ml-auto">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-white/10 text-xs text-white/40">
            <b className="text-white/60">Staff-filled form.</b><br />
            Your role and start date are managed by HR and cannot be changed here.
          </div>
        </aside>

        {/* Form area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto w-full pb-24">
          {section === 'personal' && <PersonalSection state={state} s={s} next={() => next('family')} />}
          {section === 'family' && <FamilySection state={state} s={s} dispatch={dispatch} next={() => next('medical')} prev={() => prev('personal')} />}
          {section === 'medical' && <MedicalSection state={state} s={s} dispatch={dispatch} next={() => next('education')} prev={() => prev('family')} />}
          {section === 'education' && <EducationSection state={state} s={s} dispatch={dispatch} next={() => next('languages')} prev={() => prev('medical')} />}
          {section === 'languages' && <LanguagesSection state={state} dispatch={dispatch} next={() => next('experience')} prev={() => prev('education')} />}
          {section === 'experience' && <ExperienceSection state={state} s={s} dispatch={dispatch} next={() => next('guarantor')} prev={() => prev('languages')} />}
          {section === 'guarantor' && <GuarantorSection state={state} s={s} next={() => next('declaration')} prev={() => prev('experience')} />}
          {section === 'declaration' && <DeclarationSection state={state} s={s} done={done} onSubmit={submit} canSubmit={!!canSubmit} prev={() => prev('guarantor')} />}
        </main>
      </div>
    </div>
  );
}

/* ═══ § 1 PERSONAL ════════════════════════════════════════ */
function PersonalSection({ state, s, next }: { state: State; s: ReturnType<typeof set>; next: () => void }) {
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">👤</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Personal Information</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">Your official details. Employment facts like your role and start date are managed by HR — everything else is yours to fill.</div>
      </div>
      <Card title="From your employment record">
        <G2><Locked label="Designation / Role" value="Content Strategist" /><Locked label="Date of Employment" value="July 1, 2026" /></G2>
      </Card>
      <Card title="Full name">
        <G3>
          <Field label="Surname" required><input className="sabi-input" placeholder="e.g. Nwosu" value={state.surname || ''} onChange={e => s('surname')(e.target.value)} /></Field>
          <Field label="First Name" required><input className="sabi-input" placeholder="e.g. Ada" value={state.first_name || ''} onChange={e => s('first_name')(e.target.value)} /></Field>
          <Field label="Middle Name"><input className="sabi-input" placeholder="Optional" value={state.middle_name || ''} onChange={e => s('middle_name')(e.target.value)} /></Field>
        </G3>
      </Card>
      <Card title="Identity & origin">
        <G2>
          <Field label="Date of Birth" required><input className="sabi-input" type="date" value={state.date_of_birth || ''} onChange={e => s('date_of_birth')(e.target.value)} /></Field>
          <Field label="Nationality" required>
            <select className="sabi-input" value={state.nationality || ''} onChange={e => { s('nationality')(e.target.value); s('non_nigerian')(e.target.value === 'Other'); }}>
              <option className="bg-black" value="">Select nationality</option><option className="bg-black">Nigerian</option><option className="bg-black" value="Other">Non-Nigerian</option>
            </select>
          </Field>
        </G2>
        <Reveal show={!!state.non_nigerian}>
          <G2>
            <Field label="Place of Birth"><input className="sabi-input" placeholder="City / Town" value={state.place_of_birth || ''} onChange={e => s('place_of_birth')(e.target.value)} /></Field>
            <Field label="Country of Birth"><input className="sabi-input" placeholder="Country" value={state.country_of_birth || ''} onChange={e => s('country_of_birth')(e.target.value)} /></Field>
          </G2>
        </Reveal>
        <G3 >
          <Field label="State of Origin"><input className="sabi-input" placeholder="e.g. Anambra" value={state.state_of_origin || ''} onChange={e => s('state_of_origin')(e.target.value)} /></Field>
          <Field label="L.G.A"><input className="sabi-input" placeholder="e.g. Awka South" value={state.lga || ''} onChange={e => s('lga')(e.target.value)} /></Field>
          <Field label="Hometown / Village"><input className="sabi-input" placeholder="Your hometown" value={state.hometown || ''} onChange={e => s('hometown')(e.target.value)} /></Field>
        </G3>
        <G2>
          <Field label="Religion">
            <select className="sabi-input" value={state.religion || ''} onChange={e => s('religion')(e.target.value)}>
              <option className="bg-black" value="">Prefer not to say</option><option className="bg-black">Christianity</option><option className="bg-black">Islam</option><option className="bg-black">Other</option>
            </select>
          </Field>
          <Field label="Marital Status" required>
            <Seg options={['Single', 'Married', 'Divorced', 'Widowed']} value={state.marital_status || 'Single'} onChange={v => s('marital_status')(v)} />
          </Field>
        </G2>
        <Reveal show={state.marital_status === 'Married'}>
          <G2>
            <Field label="Date of Marriage"><input className="sabi-input" type="date" value={state.date_of_marriage || ''} onChange={e => s('date_of_marriage')(e.target.value)} /></Field>
            <Field label="Spouse's Full Name"><input className="sabi-input" placeholder="Full legal name" value={state.spouse_name || ''} onChange={e => s('spouse_name')(e.target.value)} /></Field>
          </G2>
          <G2>
            <Field label="Spouse's Nationality"><input className="sabi-input" placeholder="e.g. Nigerian" value={state.spouse_nationality || ''} onChange={e => s('spouse_nationality')(e.target.value)} /></Field>
            <Field label="Spouse's Profession"><input className="sabi-input" placeholder="e.g. Engineer" value={state.spouse_profession || ''} onChange={e => s('spouse_profession')(e.target.value)} /></Field>
          </G2>
        </Reveal>
      </Card>
      <Card title="Contact details">
        <G1><Field label="Home Address" required><textarea className="sabi-input resize-none" rows={3} placeholder="Your full residential address" value={state.home_address || ''} onChange={e => s('home_address')(e.target.value)} /></Field></G1>
        <G2>
          <Field label="Phone Number" required><input className="sabi-input" type="tel" placeholder="+234 800 000 0000" value={state.phone || ''} onChange={e => s('phone')(e.target.value)} /></Field>
          <Field label="Personal Email" hint="Not your work email — for personal correspondence only."><input className="sabi-input" type="email" placeholder="your.personal@email.com" value={state.personal_email || ''} onChange={e => s('personal_email')(e.target.value)} /></Field>
        </G2>
      </Card>
      <SecFoot onNext={next} nextLabel="Family & Next of Kin" />
    </div>
  );
}

/* ═══ § 2 FAMILY ══════════════════════════════════════════ */
function FamilySection({ state, s, dispatch, next, prev }: any) {
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">👨‍👩‍👧</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Family & Next of Kin</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">The person Cerebre contacts in an emergency, and the names of your dependants for our records.</div>
      </div>
      <Card title="Next of kin">
        <G2>
          <Field label="Full Name" required><input className="sabi-input" placeholder="Full name of next of kin" value={state.nok_name || ''} onChange={e => s('nok_name')(e.target.value)} /></Field>
          <Field label="Relationship" required>
            <select className="sabi-input" value={state.nok_relationship || ''} onChange={e => s('nok_relationship')(e.target.value)}>
              <option className="bg-black" value="">Select</option><option className="bg-black">Spouse</option><option className="bg-black">Parent</option><option className="bg-black">Sibling</option><option className="bg-black">Child</option><option className="bg-black">Aunt / Uncle</option><option className="bg-black">Friend</option><option className="bg-black">Other</option>
            </select>
          </Field>
        </G2>
        <G2>
          <Field label="Phone Number" required><input className="sabi-input" type="tel" placeholder="+234 800 000 0000" value={state.nok_phone || ''} onChange={e => s('nok_phone')(e.target.value)} /></Field>
          <Field label="Email (optional)"><input className="sabi-input" type="email" placeholder="nok@email.com" value={state.nok_email || ''} onChange={e => s('nok_email')(e.target.value)} /></Field>
        </G2>
        <G1><Field label="Address of Next of Kin" required><textarea className="sabi-input resize-none" rows={3} placeholder="Their full residential address" value={state.nok_address || ''} onChange={e => s('nok_address')(e.target.value)} /></Field></G1>
      </Card>
      <Card title="Family members — spouse & children">
        <InfoNote>List your spouse and any children. Leave the table empty if not applicable.</InfoNote>
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="hidden sm:grid bg-white/5 border-b border-white/10" style={{ gridTemplateColumns: '2fr 1.2fr 1.2fr 38px' }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 p-2.5">Full Name</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 p-2.5">Date of Birth</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 p-2.5">Relationship</span>
            <span />
          </div>
          {state.family_members.map((row: any, i: number) => (
            <div key={i} className="grid gap-2 sm:gap-0 p-2 sm:p-0 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]" style={{ gridTemplateColumns: '1fr', gridAutoFlow: 'row' }}>
              <div className="sm:hidden col-span-full grid grid-cols-1 gap-2">
                <input className="sabi-input text-sm" placeholder="Full name" value={row.full_name} onChange={e => dispatch({ type: 'LIST_SET', list: 'family_members', idx: i, key: 'full_name', value: e.target.value })} />
                <input className="sabi-input text-sm" type="date" value={row.date_of_birth} onChange={e => dispatch({ type: 'LIST_SET', list: 'family_members', idx: i, key: 'date_of_birth', value: e.target.value })} />
                <select className="sabi-input text-sm" value={row.relationship} onChange={e => dispatch({ type: 'LIST_SET', list: 'family_members', idx: i, key: 'relationship', value: e.target.value })}>
                  <option className="bg-black" value="">Select relationship</option><option className="bg-black">Spouse</option><option className="bg-black">Son</option><option className="bg-black">Daughter</option>
                </select>
                <DelBtn onDelete={() => dispatch({ type: 'LIST_DEL', list: 'family_members', idx: i })} />
              </div>
              <div className="hidden sm:grid" style={{ gridTemplateColumns: '2fr 1.2fr 1.2fr 38px' }}>
                <div className="p-1.5"><input className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-purple-500/50 focus:bg-white/5 rounded-lg px-2.5 py-2 text-sm text-white outline-none transition-all" placeholder="Full name" value={row.full_name} onChange={e => dispatch({ type: 'LIST_SET', list: 'family_members', idx: i, key: 'full_name', value: e.target.value })} /></div>
                <div className="p-1.5"><input className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-purple-500/50 focus:bg-white/5 rounded-lg px-2.5 py-2 text-sm text-white outline-none transition-all" type="date" value={row.date_of_birth} onChange={e => dispatch({ type: 'LIST_SET', list: 'family_members', idx: i, key: 'date_of_birth', value: e.target.value })} /></div>
                <div className="p-1.5"><select className="w-full bg-transparent border border-transparent hover:border-white/10 focus:border-purple-500/50 focus:bg-white/5 rounded-lg px-2.5 py-2 text-sm text-white outline-none transition-all" value={row.relationship} onChange={e => dispatch({ type: 'LIST_SET', list: 'family_members', idx: i, key: 'relationship', value: e.target.value })}><option className="bg-black" value="">—</option><option className="bg-black">Spouse</option><option className="bg-black">Son</option><option className="bg-black">Daughter</option></select></div>
                <DelBtn onDelete={() => dispatch({ type: 'LIST_DEL', list: 'family_members', idx: i })} />
              </div>
            </div>
          ))}
        </div>
        <AddRowBtn label="Add family member" onClick={() => dispatch({ type: 'LIST_ADD', list: 'family_members', blank: blankFamily() })} />
      </Card>
      <SecFoot onBack={prev} onNext={next} nextLabel="Medical Information" />
    </div>
  );
}

/* ═══ § 3 MEDICAL ═════════════════════════════════════════ */
function MedicalSection({ state, s, dispatch, next, prev }: any) {
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">🏥</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Medical Information</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">Strictly confidential — only HR and senior management can access this. Fill accurately; it exists to keep you safe.</div>
      </div>
      <ConfCard notice={<><b className="text-amber-400">Tier 3 — HR &amp; Super Admin access only.</b> Every view of this section is recorded in the audit log. The information here helps us respond correctly in a medical emergency.</>}>
        <div className="flex items-center gap-2 mb-5 text-xs font-bold uppercase tracking-widest text-white/50">
          <span>Blood &amp; health profile</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
        <G2>
          <Field label="Blood Group" required>
            <select className="sabi-input" value={state.blood_group || ''} onChange={e => s('blood_group')(e.target.value)}>
              <option className="bg-black" value="">Select</option><option className="bg-black">A+</option><option className="bg-black">A−</option><option className="bg-black">B+</option><option className="bg-black">B−</option><option className="bg-black">O+</option><option className="bg-black">O−</option><option className="bg-black">AB+</option><option className="bg-black">AB−</option>
            </select>
          </Field>
          <Field label="Genotype" required>
            <select className="sabi-input" value={state.genotype || ''} onChange={e => s('genotype')(e.target.value)}>
              <option className="bg-black" value="">Select</option><option className="bg-black">AA</option><option className="bg-black">AS</option><option className="bg-black">SS</option><option className="bg-black">AC</option><option className="bg-black">SC</option>
            </select>
          </Field>
        </G2>
        <G2>
          <Field label="Known Allergy 1"><input className="sabi-input" placeholder="e.g. Penicillin, Pollen, Nuts" value={state.allergy_1 || ''} onChange={e => s('allergy_1')(e.target.value)} /></Field>
          <Field label="Known Allergy 2"><input className="sabi-input" placeholder="e.g. Latex, Shellfish" value={state.allergy_2 || ''} onChange={e => s('allergy_2')(e.target.value)} /></Field>
        </G2>
        <G1><Field label="Any Medical Conditions or Ongoing Health Issues"><textarea className="sabi-input resize-none" rows={3} placeholder="Describe any conditions, medications or health info we should know. Write 'None' if not applicable." value={state.medical_conditions || ''} onChange={e => s('medical_conditions')(e.target.value)} /></Field></G1>
        <div className="mt-5 pt-5 border-t border-dashed border-amber-500/20">
          <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest text-white/50">
            <span>Emergency contact</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <InfoNote>This can be the same as your next of kin or different — whoever is most reachable in a medical emergency.</InfoNote>
          <G2>
            <Field label="Contact Name" required><input className="sabi-input" placeholder="Full name" value={state.emergency_contact_name || ''} onChange={e => s('emergency_contact_name')(e.target.value)} /></Field>
            <Field label="Phone Number" required><input className="sabi-input" type="tel" placeholder="+234 800 000 0000" value={state.emergency_contact_phone || ''} onChange={e => s('emergency_contact_phone')(e.target.value)} /></Field>
          </G2>
          <G1><Field label="Their Address"><textarea className="sabi-input resize-none" rows={3} placeholder="Optional but helpful" value={state.emergency_contact_address || ''} onChange={e => s('emergency_contact_address')(e.target.value)} /></Field></G1>
        </div>
      </ConfCard>
      <SecFoot onBack={prev} onNext={next} nextLabel="Education" />
    </div>
  );
}

/* ═══ § 4 EDUCATION ═══════════════════════════════════════ */
// ── EduEntry — defined OUTSIDE EducationSection ────────────────
const EduEntry = ({ entry, list, idx, dispatch }: {
  entry: any;
  list: string;
  idx: number;
  dispatch: React.Dispatch<Action>;
}) => (
  <div className={idx > 0 ? 'mt-4 pt-4 border-t border-dashed border-white/10' : ''}>
    {idx > 0 && (
      <div className="flex justify-end mb-2">
        <button
          className="px-3 py-1 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all"
          onClick={() => dispatch({ type: 'LIST_DEL', list, idx })}
        >
          × Remove
        </button>
      </div>
    )}
    <G2>
      <Field label="Institution Name">
        <input
          className="sabi-input"
          placeholder="Name"
          value={entry.institution_name}
          onChange={e => dispatch({ type: 'LIST_SET', list, idx, key: 'institution_name', value: e.target.value })}
        />
      </Field>
      <Field label="Address">
        <input
          className="sabi-input"
          placeholder="City, State / Country"
          value={entry.address}
          onChange={e => dispatch({ type: 'LIST_SET', list, idx, key: 'address', value: e.target.value })}
        />
      </Field>
    </G2>
    <G3>
      <Field label="From">
        <input
          className="sabi-input"
          type="month"
          value={entry.from_date}
          onChange={e => dispatch({ type: 'LIST_SET', list, idx, key: 'from_date', value: e.target.value })}
        />
      </Field>
      <Field label="To">
        <input
          className="sabi-input"
          type="month"
          value={entry.to_date}
          onChange={e => dispatch({ type: 'LIST_SET', list, idx, key: 'to_date', value: e.target.value })}
        />
      </Field>
      <Field label="Certificate / Degree">
        <input
          className="sabi-input"
          placeholder="e.g. B.Sc. Mass Communication"
          value={entry.certificate_obtained}
          onChange={e => dispatch({ type: 'LIST_SET', list, idx, key: 'certificate_obtained', value: e.target.value })}
        />
      </Field>
    </G3>
  </div>
);

/* ═══ § 4 EDUCATION ═══════════════════════════════════════ */
function EducationSection({ state, s, dispatch, next, prev }: any) {
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">🎓</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Education &amp; Qualifications</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">
          Your academic and professional qualifications. Submit certificate copies to HR — you can also upload them to the Documents vault later.
        </div>
      </div>

      <Card title="Secondary / Technical school">
        <EduEntry
          entry={(state.secondary_education ?? [blankEdu()])[0] || blankEdu()}
          list="secondary_education"
          idx={0}
          dispatch={dispatch}
        />
      </Card>

      <Card title="Polytechnic &amp; University">
        {state.tertiary_education.map((e: any, i: number) => (
          <EduEntry
            key={i}
            entry={e}
            list="tertiary_education"
            idx={i}
            dispatch={dispatch}
          />
        ))}
        <AddRowBtn
          label="Add another institution"
          onClick={() => dispatch({ type: 'LIST_ADD', list: 'tertiary_education', blank: blankEdu() })}
        />
      </Card>

      <Card title="Professional studies, special courses &amp; other qualifications">
        {state.professional_qualifications.map((e: any, i: number) => (
          <EduEntry
            key={i}
            entry={e}
            list="professional_qualifications"
            idx={i}
            dispatch={dispatch}
          />
        ))}
        <AddRowBtn
          label="Add another qualification"
          onClick={() => dispatch({ type: 'LIST_ADD', list: 'professional_qualifications', blank: blankEdu() })}
        />
      </Card>

      <SecFoot onBack={prev} onNext={next} nextLabel="Languages" />
    </div>
  );
}

/* ═══ § 5 LANGUAGES ═══════════════════════════════════════ */
function LanguagesSection({ state, dispatch, next, prev }: any) {
  const skills: Array<'speaking' | 'reading' | 'writing'> = ['speaking', 'reading', 'writing'];
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">🌍</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Language Skills</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">List every language you use professionally. Mark your actual level — this helps us assign you to the right projects.</div>
      </div>
      <Card title="Languages known">
        <div className="space-y-3">
          {state.languages.map((row: any, i: number) => (
            <div key={i} className="sabi-card p-3 bg-white/[0.02]">
              <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
                <Field label="Language">
                  <input className="sabi-input" placeholder="e.g. Igbo, French…" value={row.language} onChange={e => dispatch({ type: 'LIST_SET', list: 'languages', idx: i, key: 'language', value: e.target.value })} />
                </Field>
                {skills.map(sk => (
                  <Field key={sk} label={sk.charAt(0).toUpperCase() + sk.slice(1)}>
                    <ProficiencyPicker value={row[sk]} onChange={v => dispatch({ type: 'LIST_SET', list: 'languages', idx: i, key: sk, value: v })} />
                  </Field>
                ))}
                <DelBtn onDelete={() => dispatch({ type: 'LIST_DEL', list: 'languages', idx: i })} />
              </div>
            </div>
          ))}
        </div>
        <AddRowBtn label="Add language" onClick={() => dispatch({ type: 'LIST_ADD', list: 'languages', blank: blankLang() })} />
      </Card>
      <SecFoot onBack={prev} onNext={next} nextLabel="Work Experience" />
    </div>
  );
}

/* ═══ § 6 EXPERIENCE ══════════════════════════════════════ */
function ExperienceSection({ state, s, dispatch, next, prev }: any) {
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">💼</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Work Experience</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">Your professional history before joining Cerebre. This feeds your staff bio and helps us understand your background.</div>
      </div>
      <Card title="Experience overview">
        <G2>
          <Field label="Total Years of Professional Experience"><input className="sabi-input max-w-[120px]" type="number" min={0} max={50} placeholder="e.g. 4" value={state.total_years_experience || ''} onChange={e => s('total_years_experience')(Number(e.target.value))} /></Field>
          <Field label="Any Previous Criminal Record?"><Seg options={['No', 'Yes']} value={state.has_criminal_record ? 'Yes' : 'No'} onChange={v => s('has_criminal_record')(v === 'Yes')} /></Field>
        </G2>
        <Reveal show={!!state.has_criminal_record}>
          <Field label="Please provide details"><textarea className="sabi-input resize-none" rows={3} placeholder="Provide details. This is treated in strict confidence by HR and does not automatically disqualify you." value={state.criminal_record_details || ''} onChange={e => s('criminal_record_details')(e.target.value)} /></Field>
        </Reveal>
      </Card>
      <Card title="Employment history">
        <div className="space-y-3">
          {state.work_history.map((row: any, i: number) => (
            <div key={i} className="sabi-card p-3 bg-white/[0.02]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-3 mb-3">
                <Field label="Organisation">
                  <input className="sabi-input" placeholder="Company / Organisation" value={row.organisation} onChange={e => dispatch({ type: 'LIST_SET', list: 'work_history', idx: i, key: 'organisation', value: e.target.value })} />
                </Field>
                <Field label="From">
                  <input className="sabi-input" type="month" value={row.from_date} onChange={e => dispatch({ type: 'LIST_SET', list: 'work_history', idx: i, key: 'from_date', value: e.target.value })} />
                </Field>
                <Field label="To">
                  <input className="sabi-input" type="month" placeholder="Present" value={row.to_date} onChange={e => dispatch({ type: 'LIST_SET', list: 'work_history', idx: i, key: 'to_date', value: e.target.value })} />
                </Field>
              </div>
              <Field label="Key Responsibilities">
                <textarea className="sabi-input resize-none" rows={2} placeholder="Key responsibilities" value={row.responsibilities} onChange={e => dispatch({ type: 'LIST_SET', list: 'work_history', idx: i, key: 'responsibilities', value: e.target.value })} />
              </Field>
              <div className="flex justify-end mt-2">
                <DelBtn onDelete={() => dispatch({ type: 'LIST_DEL', list: 'work_history', idx: i })} />
              </div>
            </div>
          ))}
        </div>
        <AddRowBtn label="Add previous employer" onClick={() => dispatch({ type: 'LIST_ADD', list: 'work_history', blank: blankWork() })} />
      </Card>
      <SecFoot onBack={prev} onNext={next} nextLabel="Guarantor Details" />
    </div>
  );
}

/* ═══ § 7 GUARANTOR ═══════════════════════════════════════ */
function GuarantorSection({ state, s, next, prev }: any) {
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">🤝</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Guarantor Details</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">Your guarantor vouches for your character and accepts responsibility for any loss during your employment. A physical Guarantor's Form must also be submitted to HR.</div>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
        <h4 className="text-sm font-bold text-amber-400 mb-1.5">Physical form also required</h4>
        <p className="text-sm text-white/60 leading-relaxed">Your guarantor must sign the official <b className="text-white/80">Guarantor's Form</b> — a physical document from HR — and return it before your probation review. This digital section does not replace the physical form.</p>
      </div>
      <Card title="Guarantor bio data">
        <CheckRow id="g-ack" label="My guarantor is aware they need to sign and return the physical Guarantor's Form to HR." checked={!!state.guarantor_form_acknowledged} onChange={v => s('guarantor_form_acknowledged')(v)} />
        <G2 >
          <Field label="Guarantor's Full Name" required><input className="sabi-input" placeholder="Mr / Mrs / Miss — full legal name" value={state.guarantor_name || ''} onChange={e => s('guarantor_name')(e.target.value)} /></Field>
          <Field label="Relationship to You" required><input className="sabi-input" placeholder="e.g. Uncle, Former Employer, Friend" value={state.guarantor_relationship || ''} onChange={e => s('guarantor_relationship')(e.target.value)} /></Field>
        </G2>
        <G2>
          <Field label="Profession / Occupation"><input className="sabi-input" placeholder="e.g. Civil Servant, Business Owner" value={state.guarantor_profession || ''} onChange={e => s('guarantor_profession')(e.target.value)} /></Field>
          <Field label="Company / Organisation"><input className="sabi-input" placeholder="Where they work" value={state.guarantor_company || ''} onChange={e => s('guarantor_company')(e.target.value)} /></Field>
        </G2>
        <G1><Field label="Office / Business Address"><textarea className="sabi-input resize-none" rows={3} placeholder="Their full office address" value={state.guarantor_office_address || ''} onChange={e => s('guarantor_office_address')(e.target.value)} /></Field></G1>
        <G2>
          <Field label="Phone Number" required><input className="sabi-input" type="tel" placeholder="+234 800 000 0000" value={state.guarantor_phone || ''} onChange={e => s('guarantor_phone')(e.target.value)} /></Field>
          <Field label="Email Address"><input className="sabi-input" type="email" placeholder="guarantor@email.com" value={state.guarantor_email || ''} onChange={e => s('guarantor_email')(e.target.value)} /></Field>
        </G2>
        <G1><Field label="Guarantor's Comments or Recommendation"><textarea className="sabi-input resize-none" rows={3} placeholder="Any statement the guarantor wants to add — can also be completed on the physical form." value={state.guarantor_comments || ''} onChange={e => s('guarantor_comments')(e.target.value)} /></Field></G1>
      </Card>
      <SecFoot onBack={prev} onNext={next} nextLabel="Review & Sign" />
    </div>
  );
}

/* ═══ § 8 DECLARATION ════════════════════════════════════ */
const SECTION_LABELS: Record<string, string> = {
  personal: 'Personal Information', family: 'Family & Next of Kin', medical: 'Medical Information',
  education: 'Education & Qualifications', languages: 'Language Skills', experience: 'Work Experience',
  guarantor: 'Guarantor Details',
};
function DeclarationSection({ state, s, done, onSubmit, canSubmit, prev }: any) {
  const fullName = [state.first_name, state.surname].filter(Boolean).join(' ') || '[ your full name ]';
  return (
    <div>
      <div className="mb-8">
        <span className="text-3xl mb-3 block">✍️</span>
        <div className="text-xl sm:text-2xl font-bold text-white mb-2">Declaration &amp; Submission</div>
        <div className="text-sm text-white/60 max-w-2xl leading-relaxed">Review your progress below, confirm the declaration, then submit your profile for HR to verify.</div>
      </div>
      <Card title="Completion summary">
        {Object.entries(SECTION_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center gap-2.5 py-2.5 border-t border-white/5 first:border-t-0 text-sm">
            <span className="text-lg">{done.has(k) ? '✅' : '⚠️'}</span>
            <span className="font-semibold text-white">{label}</span>
            <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${done.has(k) ? 'text-green-500' : 'text-amber-400'}`}>
              {done.has(k) ? 'Complete' : 'Incomplete'}
            </span>
          </div>
        ))}
      </Card>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 sm:p-5 text-sm leading-relaxed text-white/80 mb-4">
        I, <b className="text-white">{fullName}</b>, hereby declare that all information provided in this Staff Profile Form is true, accurate and complete to the best of my knowledge. I give my consent to the lawful use of this information by <b className="text-white">Cerebre Media Africa</b> in connection with my employment, and understand that providing false or misleading information may result in disciplinary action up to and including termination of employment.
      </div>
      <CheckRow id="d1" label="I confirm that all information provided above is true, accurate and complete." checked={!!state.declaration_1} onChange={v => s('declaration_1')(v)} />
      <CheckRow id="d2" label="I consent to the lawful use of this information by Cerebre Media Africa for employment purposes." checked={!!state.declaration_2} onChange={v => s('declaration_2')(v)} />
      <Card title="Digital signature">
        <G2>
          <Field label="Type your full legal name" required><input className="sabi-input" placeholder="Your full name as signature" value={state.digital_signature || ''} onChange={e => s('digital_signature')(e.target.value)} /></Field>
          <Field label="Date"><input className="sabi-input" type="date" value={state.signature_date || ''} onChange={e => s('signature_date')(e.target.value)} /></Field>
        </G2>
      </Card>
      <div className="flex items-center gap-3 mt-7 pt-5 border-t border-white/10">
        <button className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors" onClick={prev}>← Back</button>
        <div className="flex-1" />
        <button
          className="sabi-btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
          Submit My Profile
        </button>
      </div>
    </div>
  );
}

/* ═══ SUCCESS ═════════════════════════════════════════════ */
function SuccessScreen({ onEdit, profileData }: { onEdit: () => void; profileData: State }) {
  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4 sm:p-6">
      <div className="text-center max-w-lg w-full">
        <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-5 shadow-[0_0_0_14px_rgba(34,197,94,0.1)] animate-pulse">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white mb-2">Profile submitted</div>
        <div className="text-sm text-white/60 mb-6">Your record is with HR. You'll receive a confirmation email shortly.</div>
        
        {/* Edit Button */}
        <button
          className="mb-8 px-6 py-2.5 text-sm font-semibold text-purple-500 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-all"
          onClick={onEdit}
        >
          Edit Profile
        </button>

        <div className="sabi-card p-5 text-left max-w-md mx-auto">
          <div className="flex gap-2.5 py-2.5 border-t border-white/5 first:border-t-0 text-sm text-white/70">
            <span className="text-base flex-shrink-0">✅</span>
            <span>HR has been notified and will verify your record</span>
          </div>
          <div className="flex gap-2.5 py-2.5 border-t border-white/5 text-sm text-white/70">
            <span className="text-base flex-shrink-0">📄</span>
            <span>Your guarantor must return the signed physical form before your probation review</span>
          </div>
          <div className="flex gap-2.5 py-2.5 border-t border-white/5 text-sm text-white/70">
            <span className="text-base flex-shrink-0">👤</span>
            <span>Add your photo and bio to publish your profile to client Team pages</span>
          </div>
          <div className="flex gap-2.5 py-2.5 border-t border-white/5 text-sm text-white/70">
            <span className="text-base flex-shrink-0">🔒</span>
            <span>Role and start date can only be changed by HR</span>
          </div>
        </div>
      </div>
    </div>
  );
}
