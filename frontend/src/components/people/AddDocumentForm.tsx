'use client';

import { useState } from 'react';
import { addDocument } from './types';

const DOC_TYPES = [
  { key: 'contract', label: 'Contract', emoji: '📄' },
  { key: 'id', label: 'ID', emoji: '🪪' },
  { key: 'certification', label: 'Certification', emoji: '🎓' },
  { key: 'other', label: 'Other', emoji: '📎' },
];

export default function AddDocumentForm({ personName, onClose, onAdded }: {
  personName: string; onClose: () => void; onAdded: (input: Record<string, any>) => Promise<void>;
}) {
  const [docType, setDocType] = useState('contract');
  const [label, setLabel] = useState('');
  const [filePath, setFilePath] = useState('');
  const [expiry, setExpiry] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = label.trim().length > 1 && filePath.trim().length > 3;

  const submit = async () => {
    if (!valid) return;
    setBusy(true); setErr(null);
    try {
      await onAdded({ doc_type: docType, label, file_path: filePath, expiry_date: expiry || null });
      onClose();
    } catch (e: any) { setErr(e.message || 'Could not add the document'); }
    finally { setBusy(false); }
  };

  return (
    <div className="pp-wiz-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-wiz-modal" style={{ maxWidth: 400 }} role="dialog" aria-modal="true">
        <div className="pp-wiz-head">
          <div className="pp-wiz-title-row">
            <div className="pp-wiz-title">Add document — {personName}</div>
            <button className="pp-wiz-close" onClick={onClose} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="pp-wiz-body" style={{ padding: '10px 26px 20px' }}>
          {err && <div className="pp-wiz-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            {err}
          </div>}
          <div className="pp-field">
            <label>Type</label>
            <div className="pp-segmented">
              {DOC_TYPES.map(t => (
                <button key={t.key} type="button" className={`pp-seg-btn ${docType === t.key ? 'sel' : ''}`} onClick={() => setDocType(t.key)}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pp-field">
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Employment contract 2026" />
          </div>
          <div className="pp-field">
            <label>File link</label>
            <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="Drive link or vault reference" />
            <div className="pp-field-hint">Direct upload to the secure vault is coming — for now, link to where the file lives.</div>
          </div>
          <div className="pp-field">
            <label>Expiry date (optional)</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
        </div>
        <div className="pp-wiz-foot">
          <div style={{ flex: 1 }} />
          <button className="pp-btn pp-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="pp-btn pp-btn-primary" onClick={submit} disabled={!valid || busy}>
            {busy ? 'Adding…' : 'Add to vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
