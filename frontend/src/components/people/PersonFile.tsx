'use client';

import { useEffect, useState } from 'react';
import StampAvatar from './StampAvatar';
import AddDocumentForm from './AddDocumentForm';
import {
  getPersonFile, offboardPerson, regenerateProfile, addDocument,
  type PersonFilePayload, type PersonRow,
} from './types';

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="pp-dr-fact"><span>{label}</span><b>{value ?? '—'}</b></div>
);

export default function PersonFile({ person, isHR, onClose, onChanged }: {
  person: PersonRow; isHR: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [file, setFile] = useState<PersonFilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOffboard, setConfirmOffboard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    getPersonFile(person.user_id).then(setFile).catch((e) => setError(e.message));
  }, [person.user_id]);

  const close = () => { setVisible(false); setTimeout(onClose, 200); };

  const doOffboard = async () => {
    setBusy(true);
    try { await offboardPerson(person.user_id); onChanged(); close(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };
  const doRegenerate = async () => {
    setBusy(true);
    try { await regenerateProfile(person.user_id); onChanged(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const r = file?.record;

  return (
    <>
      <div className="pp-overlay" onClick={close} style={{ opacity: visible ? 1 : 0, transition: 'opacity .2s' }} />
      <div className="pp-drawer" style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .28s cubic-bezier(.16,1,.3,1)' }}>
        <div style={{ padding: 22 }}>
          <div className="pp-dr-head">
            <StampAvatar name={person.display_name} size={52} />
            <div style={{ minWidth: 0 }}>
              <div className="pp-dr-name">{person.display_name}</div>
              <div className="pp-dr-role">{person.role_title}{person.department ? ` · ${person.department}` : ''}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <span className={`pp-ribbon ${person.profile_state === 'published' ? 'pp-rib-live' : 'pp-rib-draft'}`}>
                  {person.profile_state === 'published' ? 'Profile live' : person.profile_state === 'draft' ? `Draft · ${person.profile_draft_days ?? 0}d` : 'No profile'}
                </span>
                {person.probation_active && <span className="pp-ribbon pp-rib-probation">Probation → {person.probation_end}</span>}
                {person.on_leave_now && <span className="pp-ribbon pp-rib-leave">On leave</span>}
              </div>
            </div>
            <div className="pp-dr-close" onClick={close}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </div>
          </div>

          {error && (
            <div className="pp-dr-section" style={{ borderColor: 'var(--ember-soft)', background: 'var(--ember-soft)', color: 'var(--ember)', fontSize: 12.5 }}>
              {error}
            </div>
          )}

          {!file ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[1, 2, 3].map(i => <div key={i} className="pp-dr-section" style={{ height: 90, background: 'var(--paper)', opacity: .6 }} />)}
            </div>
          ) : (
            <>
              <div className="pp-dr-section">
                <h5>📇 Employment</h5>
                <div className="pp-dr-fact-grid">
                  <Fact label="Started" value={r?.start_date} />
                  <Fact label="Type" value={r?.employment_type?.replace('_', '-')} />
                  {r?.tp_cohort && <Fact label="Cohort" value={r.tp_cohort} />}
                  <Fact label="Status" value={r?.status} />
                  {r?.spark_line && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <Fact label="Spark line" value={<i>&ldquo;{r.spark_line}&rdquo;</i>} />
                    </div>
                  )}
                </div>
                {isHR && person.profile_state !== 'none' && (
                  <button className="pp-btn pp-btn-ghost" style={{ marginTop: 12, fontSize: 11.5 }} onClick={doRegenerate} disabled={busy}>
                    ↻ Regenerate profile draft
                  </button>
                )}
              </div>

              {r?.personal_email !== undefined && (
                <div className="pp-dr-section confidential">
                  <h5>🔒 Confidential</h5>
                  <div className="pp-dr-fact-grid">
                    <Fact label="Personal email" value={r.personal_email} />
                    <Fact label="Personal phone" value={r.personal_phone} />
                    <Fact label="Comp band" value={r.comp_band} />
                    <div style={{ gridColumn: '1/-1' }}>
                      <Fact label="Emergency contact" value={r.emergency_contact
                        ? `${r.emergency_contact.name} (${r.emergency_contact.relationship}) · ${r.emergency_contact.phone}` : '—'} />
                    </div>
                  </div>
                  {r.hr_notes && <p style={{ fontSize: 12, color: 'var(--soft)', marginTop: 10, whiteSpace: 'pre-wrap' }}>{r.hr_notes}</p>}
                  <div className="pp-audit-note">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                    This view is logged to the audit trail.
                  </div>
                </div>
              )}

              {file.documents && (
                <div className="pp-dr-section">
                  <h5>📁 Document vault
                    {isHR && <button onClick={() => setShowAddDoc(true)} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--volt)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>+ add</button>}
                  </h5>
                  {file.documents.length === 0
                    ? <p style={{ fontSize: 12, color: 'var(--soft)' }}>No documents on file.</p>
                    : <div style={{ display: 'grid', gap: 8 }}>{file.documents.map(doc => (
                        <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span><b>{doc.label}</b> <span style={{ color: 'var(--soft)' }}>· {doc.doc_type}</span></span>
                          {doc.expiry_date && (
                            <span className="pp-ribbon" style={{
                              background: new Date(doc.expiry_date) < new Date(Date.now() + 30 * 86400000) ? 'var(--ember-soft)' : 'var(--paper)',
                              color: new Date(doc.expiry_date) < new Date(Date.now() + 30 * 86400000) ? 'var(--ember)' : 'var(--soft)',
                            }}>exp {doc.expiry_date}</span>
                          )}
                        </div>
                      ))}</div>}
                </div>
              )}

              <div className="pp-dr-section">
                <h5>⭐ Performance · HR lens</h5>
                <div className="pp-perf-score">
                  <b>{file.performance.rolling_avg != null ? Math.round(file.performance.rolling_avg) : '—'}</b>
                  <span>/ 100 · rolling avg</span>
                </div>
                {file.performance.low_ratings.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ember)', textTransform: 'uppercase', marginBottom: 4 }}>Low ratings (≤2) with notes</div>
                    {file.performance.low_ratings.map((lr, i) => (
                      <p key={i} style={{ fontSize: 12, color: 'var(--soft)', marginBottom: 4 }}><b style={{ color: 'var(--ink)' }}>{lr.rating}/5</b> — {lr.note || 'no note recorded'}</p>
                    ))}
                  </div>
                )}
                {file.performance.recognition.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', marginBottom: 4 }}>Recognition</div>
                    {file.performance.recognition.map((rec, i) => (
                      <p key={i} style={{ fontSize: 12, color: 'var(--soft)' }}>⭐ {rec.title} (+{rec.points})</p>
                    ))}
                  </div>
                )}
                {!file.performance.low_ratings.length && !file.performance.recognition.length && (
                  <p style={{ fontSize: 12, color: 'var(--soft)' }}>Nothing flagged either way.</p>
                )}
              </div>

              <div className="pp-dr-section">
                <h5>🌴 Leave history</h5>
                {file.leave_history.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--soft)' }}>No leave recorded.</p>
                  : <div style={{ display: 'grid', gap: 7 }}>{file.leave_history.map(l => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>{l.leave_type} · {l.start_date} → {l.end_date}</span>
                        <span className="pp-ribbon" style={{
                          background: l.status === 'approved' ? 'var(--moss-soft)' : l.status === 'declined' ? 'var(--ember-soft)' : 'var(--amber-soft)',
                          color: l.status === 'approved' ? 'var(--moss)' : l.status === 'declined' ? 'var(--ember)' : 'var(--amber)',
                        }}>{l.status}</span>
                      </div>
                    ))}</div>}
              </div>

              {isHR && r?.status !== 'offboarding' && (
                <div className="pp-dr-section" style={{ borderColor: 'var(--ember-soft)' }}>
                  {!confirmOffboard ? (
                    <button className="pp-btn pp-btn-danger-ghost" style={{ fontSize: 11.5 }} onClick={() => setConfirmOffboard(true)}>
                      Begin offboarding…
                    </button>
                  ) : (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--soft)', marginBottom: 10 }}>
                        This deactivates their account, removes them from client Team pages, releases brand assignments,
                        and flags open tasks for reassignment. History is preserved.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="pp-btn pp-btn-primary" style={{ background: 'var(--ember)', fontSize: 12 }} onClick={doOffboard} disabled={busy}>
                          {busy ? 'Running checklist…' : 'Confirm offboarding'}
                        </button>
                        <button className="pp-btn pp-btn-ghost" style={{ fontSize: 12 }} onClick={() => setConfirmOffboard(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddDoc && (
        <AddDocumentForm
          personName={person.display_name}
          onClose={() => setShowAddDoc(false)}
          onAdded={async (input) => { await addDocument(person.user_id, input); const f = await getPersonFile(person.user_id); setFile(f); }}
        />
      )}
    </>
  );
}
