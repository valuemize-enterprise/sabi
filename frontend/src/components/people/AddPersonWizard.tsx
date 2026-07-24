'use client';

import { useMemo, useState } from 'react';
import StampAvatar from './StampAvatar';
import { createPerson } from './types';

const ROLES: { key: string; label: string; emoji: string }[] = [
  { key: 'designer', label: 'Designer', emoji: '🎨' },
  { key: 'copywriter', label: 'Copywriter', emoji: '✍️' },
  { key: 'strategist', label: 'Strategist', emoji: '🧭' },
  { key: 'account_manager', label: 'Account Manager', emoji: '🤝' },
  { key: 'brand_manager', label: 'Brand Manager', emoji: '💬' },
  { key: 'cinematographer', label: 'Cinematographer', emoji: '🎬' },
  { key: 'video_editor', label: 'Video Editor', emoji: '🎞️' },
  { key: 'analyst', label: 'Analyst', emoji: '📊' },
  { key: 'developer', label: 'Developer', emoji: '💻' },
  { key: 'photographer', label: 'Photographer', emoji: '📷' },
  { key: 'media_buyer', label: 'Media Buyer', emoji: '📈' },
  { key: 'pr_specialist', label: 'PR Specialist', emoji: '📣' },
  { key: 'seo_specialist', label: 'SEO Specialist', emoji: '🔍' },
  { key: 'accountant', label: 'Accountant', emoji: '🧮' },
  { key: 'operations', label: 'Operations', emoji: '⚙️' },
];

const STEPS = ['Who', 'Role', 'Terms', 'Voice', 'Review'];

const TITLE_SUGGEST: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.key, r.label]));

type FormState = {
  display_name: string; email: string;
  role_key: string; role_title: string; department: string;
  start_date: string; employment_type: string; tp_cohort: string; probation_end: string;
  spark_line: string;
  confidential_open: boolean;
  personal_email: string; personal_phone: string; comp_band: string;
  emergency_name: string; emergency_relationship: string; emergency_phone: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const plusDays = (iso: string, days: number) => {
  const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
};
const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function AddPersonWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormState>({
    display_name: '', email: '', role_key: '', role_title: '', department: '',
    start_date: todayISO(), employment_type: 'full_time', tp_cohort: '', probation_end: '',
    spark_line: '', confidential_open: false,
    personal_email: '', personal_phone: '', comp_band: '',
    emergency_name: '', emergency_relationship: '', emergency_phone: '',
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  const stepValid = useMemo(() => [
    form.display_name.trim().length > 1 && emailValid(form.email),
    Boolean(form.role_key) && form.role_title.trim().length > 1,
    Boolean(form.start_date),
    true, // spark line optional
    true,
  ], [form]);

  const goto = (i: number) => { if (i <= furthest) setStep(i); };
  const next = () => {
    if (!stepValid[step]) return;
    const n = Math.min(step + 1, STEPS.length - 1);
    setStep(n); setFurthest(f => Math.max(f, n));
  };
  const back = () => setStep(s => Math.max(0, s - 1));

  const selectRole = (key: string) => {
    set('role_key', key);
    if (!form.role_title) set('role_title', TITLE_SUGGEST[key]);
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await createPerson({
        email: form.email, display_name: form.display_name,
        role_key: form.role_key, role_title: form.role_title,
        department: form.department || null,
        start_date: form.start_date, employment_type: form.employment_type,
        tp_cohort: form.employment_type === 'intern' ? (form.tp_cohort || null) : null,
        probation_end: form.probation_end || null,
        spark_line: form.spark_line || null,
        ...(form.confidential_open ? {
          personal_email: form.personal_email || null,
          personal_phone: form.personal_phone || null,
          comp_band: form.comp_band || null,
          emergency_contact: form.emergency_name
            ? { name: form.emergency_name, relationship: form.emergency_relationship, phone: form.emergency_phone } : null,
        } : {}),
      });
      setSuccess(true);
      setTimeout(() => { onCreated(); }, 1400);
    } catch (e: any) { setErr(e.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  if (success) {
    return (
      <Modal onClose={onClose} noHeader>
        <div className="pp-success">
          <div className="pp-success-stamp">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <div className="pp-wiz-step-title">{form.display_name.split(' ')[0]} is in the ledger</div>
          <p className="pp-wiz-step-sub" style={{ maxWidth: 320 }}>
            Invite sent, profile draft generated, onboarding checklist started. They&rsquo;ll get an email the moment their draft is ready to claim.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} >
      <div className="pp-wiz-head">
        <div className="pp-wiz-title-row">
          <div className="pp-wiz-title">Add person</div>
          <button className="pp-wiz-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="pp-wiz-steps">
          {STEPS.map((label, i) => (
            <FragmentStep key={label} label={label} i={i} step={step} furthest={furthest} onGoto={goto} last={i === STEPS.length - 1} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: step === STEPS.length - 1 ? '1fr' : '1fr 200px', gap: 20, padding: '0 26px' }}>
        <div className="pp-wiz-body" style={{ padding: '6px 0 20px' }}>
          {err && <div className="pp-wiz-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            {err}
          </div>}

          {step === 0 && (
            <>
              <div className="pp-wiz-step-title">Who&rsquo;s joining?</div>
              <p className="pp-wiz-step-sub">This becomes their login and the name clients see.</p>
              <div className="pp-field">
                <label>Full name</label>
                <input autoFocus className={form.display_name.length > 1 ? 'valid' : ''} value={form.display_name}
                  onChange={(e) => set('display_name', e.target.value)} placeholder="e.g. Ada Nwosu" />
              </div>
              <div className="pp-field">
                <label>Work email</label>
                <input type="email" className={emailValid(form.email) ? 'valid' : ''} value={form.email}
                  onChange={(e) => set('email', e.target.value)} placeholder="ada@cerebre.media" />
                <div className="pp-field-hint">We&rsquo;ll send the invite here — nothing to configure.</div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="pp-wiz-step-title">What will they do?</div>
              <p className="pp-wiz-step-sub">Pick the closest role — you can refine the title next to it.</p>
              <div className="pp-role-grid">
                {ROLES.map(r => (
                  <div key={r.key} className={`pp-role-card ${form.role_key === r.key ? 'sel' : ''}`} onClick={() => selectRole(r.key)}>
                    <span className="emoji">{r.emoji}</span>
                    <span className="label">{r.label}</span>
                  </div>
                ))}
              </div>
              <div className="pp-field-row" style={{ marginTop: 14 }}>
                <div className="pp-field">
                  <label>Title clients will see</label>
                  <input value={form.role_title} onChange={(e) => set('role_title', e.target.value)} placeholder="e.g. Senior Designer" />
                </div>
                <div className="pp-field">
                  <label>Team (optional)</label>
                  <input value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Creative" />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="pp-wiz-step-title">The essentials</div>
              <p className="pp-wiz-step-sub">Employment facts — these sync to their profile automatically and stay locked for them to edit.</p>
              <div className="pp-field-row">
                <div className="pp-field">
                  <label>Start date</label>
                  <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
                </div>
                <div className="pp-field">
                  <label>Employment type</label>
                  <div className="pp-segmented">
                    {['full_time', 'contract', 'intern'].map(t => (
                      <button key={t} type="button" className={`pp-seg-btn ${form.employment_type === t ? 'sel' : ''}`}
                        onClick={() => set('employment_type', t)}>
                        {t === 'full_time' ? 'Full-time' : t === 'contract' ? 'Contract' : 'Intern'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {form.employment_type === 'intern' && (
                <div className="pp-field">
                  <label>Tomorrow&rsquo;s People cohort</label>
                  <input value={form.tp_cohort} onChange={(e) => set('tp_cohort', e.target.value)} placeholder="e.g. C02" />
                </div>
              )}
              <div className="pp-field">
                <label>Probation ends (optional)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={form.probation_end} onChange={(e) => set('probation_end', e.target.value)} style={{ flex: 1 }} />
                  <button type="button" className="pp-btn pp-btn-ghost" style={{ padding: '0 14px', fontSize: 12 }}
                    onClick={() => set('probation_end', plusDays(form.start_date, 90))}>
                    +90 days
                  </button>
                </div>
                <div className="pp-field-hint">HR gets a reminder 7 days before this date — never lets it lapse by accident.</div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="pp-wiz-step-title">Give ARIA something to work with</div>
              <p className="pp-wiz-step-sub">One real sentence turns a generic bio into a good one. This is the only thing that makes their draft sound like them.</p>
              <div className="pp-spark-box">
                <div className="icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.1L12 16.4l-6.3 4.3L8 13.6 2 9.2h7.6z" /></svg>
                </div>
                <textarea rows={3} value={form.spark_line} onChange={(e) => set('spark_line', e.target.value)}
                  placeholder="e.g. ran social for two banks before joining us" maxLength={200} />
                <div className="pp-spark-example">Optional, but it&rsquo;s the difference between &ldquo;a designer&rdquo; and someone a client remembers.</div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="pp-confidential-toggle" onClick={() => set('confidential_open', !form.confidential_open)}>
                  <span>🔒 Add confidential details</span>
                  <span>{form.confidential_open ? '− collapse' : '+ optional'}</span>
                </div>
                {form.confidential_open && (
                  <div className="pp-confidential-panel">
                    <div className="pp-field-row">
                      <div className="pp-field"><label>Personal email</label><input value={form.personal_email} onChange={(e) => set('personal_email', e.target.value)} /></div>
                      <div className="pp-field"><label>Personal phone</label><input value={form.personal_phone} onChange={(e) => set('personal_phone', e.target.value)} /></div>
                    </div>
                    <div className="pp-field"><label>Comp band (no exact figures)</label><input value={form.comp_band} onChange={(e) => set('comp_band', e.target.value)} placeholder="e.g. Band C" /></div>
                    <div className="pp-field-row">
                      <div className="pp-field"><label>Emergency contact name</label><input value={form.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} /></div>
                      <div className="pp-field"><label>Relationship</label><input value={form.emergency_relationship} onChange={(e) => set('emergency_relationship', e.target.value)} placeholder="e.g. Sister" /></div>
                    </div>
                    <div className="pp-field"><label>Emergency phone</label><input value={form.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} /></div>
                    <p className="pp-field-hint">Visible only to HR and Super Admin — you can also add this later from their Person File.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="pp-wiz-step-title">Ready to send</div>
              <p className="pp-wiz-step-sub">Here&rsquo;s exactly what happens the moment you click Create.</p>
              <div className="pp-review-card">
                <div className="pp-review-row"><span>Name</span><span>{form.display_name || '—'}</span></div>
                <div className="pp-review-row"><span>Email</span><span>{form.email || '—'}</span></div>
                <div className="pp-review-row"><span>Role</span><span>{form.role_title || '—'}{form.department ? ` · ${form.department}` : ''}</span></div>
                <div className="pp-review-row"><span>Starts</span><span>{form.start_date}</span></div>
                <div className="pp-review-row"><span>Type</span><span>{form.employment_type.replace('_', '-')}{form.tp_cohort ? ` · ${form.tp_cohort}` : ''}</span></div>
                {form.probation_end && <div className="pp-review-row"><span>Probation ends</span><span>{form.probation_end}</span></div>}
                {form.confidential_open && <div className="pp-review-row"><span>Confidential details</span><span>Added</span></div>}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--soft)', marginBottom: 8 }}>On submit</div>
                {['Invite email sent to their work address', 'ARIA drafts their profile from this record', '"Your draft is ready" email goes out', 'Onboarding checklist starts tracking'].map((t, i) => (
                  <div key={i} className="pp-checklist-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                    {t}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {step !== STEPS.length - 1 && (
          <div style={{ paddingTop: 6 }}>
            <LivePreview form={form} />
          </div>
        )}
      </div>

      <div className="pp-wiz-foot">
        {step > 0 && <button className="pp-btn pp-btn-ghost" onClick={back}>Back</button>}
        <div style={{ flex: 1 }} />
        {step < STEPS.length - 1 ? (
          <button className="pp-btn pp-btn-primary" onClick={next} disabled={!stepValid[step]}>Continue</button>
        ) : (
          <button className="pp-btn pp-btn-gold" onClick={submit} disabled={busy}>
            {busy ? 'Creating…' : 'Create & invite'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/* ── live stamp preview — updates as they type ─────────────── */
function LivePreview({ form }: { form: FormState }) {
  const role = ROLES.find(r => r.key === form.role_key);
  return (
    <div className="pp-preview-card">
      <div className="pp-preview-label">Registry preview</div>
      {form.display_name ? (
        <div className="pp-preview-stamp-row">
          <StampAvatar name={form.display_name} size={44} />
          <div>
            <div className="pp-p-name">{form.display_name}</div>
            <div className="pp-p-sub">{form.role_title || (role ? role.label : 'Role pending')}</div>
          </div>
        </div>
      ) : (
        <div className="pp-preview-empty">Their card appears here as you type…</div>
      )}
      {form.spark_line && (
        <p style={{ fontSize: 11.5, color: 'var(--soft)', fontStyle: 'italic', marginTop: 12, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
          &ldquo;{form.spark_line}&rdquo;
        </p>
      )}
      {form.employment_type === 'intern' && (
        <span className="pp-ribbon pp-rib-probation" style={{ marginTop: 10, display: 'inline-block' }}>Intern{form.tp_cohort ? ` · ${form.tp_cohort}` : ''}</span>
      )}
    </div>
  );
}

function FragmentStep({ label, i, step, furthest, onGoto, last }: {
  label: string; i: number; step: number; furthest: number; onGoto: (i: number) => void; last: boolean;
}) {
  const done = i < step;
  const active = i === step;
  return (
    <>
      <button type="button" className={`pp-wiz-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
        onClick={() => onGoto(i)} disabled={i > furthest}>
        <span className="pp-wiz-step-dot">{done ? '✓' : i + 1}</span>
        <span className="pp-wiz-step-label">{label}</span>
      </button>
      {!last && <span className={`pp-wiz-step-line ${i < step ? 'done' : ''}`} />}
    </>
  );
}

function Modal({ children, onClose, noHeader }: { children: React.ReactNode; onClose: () => void; noHeader?: boolean }) {
  return (
    <div className="pp-wiz-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-wiz-modal" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
