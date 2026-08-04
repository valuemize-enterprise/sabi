'use client';

import React, { useState } from 'react';
import { peopleEditApi, FIELD_LABELS } from '@/lib/people-edit-api';

interface InlineFieldEditProps {
  recordId:    string;
  fieldName:   string;
  currentValue: string | null | undefined;
  displayValue?: string;
  isEditable:  boolean;        // only true for HR + Super Admin
  requiresReason?: boolean;
  inputType?:  'text' | 'date' | 'select' | 'textarea';
  selectOptions?: { value: string; label: string }[];
  onSaved: (newValue: string) => void;
  placeholder?: string;
}

// Fields that need a reason modal
const REASON_FIELDS = new Set([
  'role_key', 'role_title', 'employment_status', 'comp_band', 'start_date',
]);

export function InlineFieldEdit({
  recordId, fieldName, currentValue, displayValue,
  isEditable, inputType = 'text', selectOptions,
  onSaved, placeholder,
}: InlineFieldEditProps) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(String(currentValue ?? ''));
  const [reason,  setReason]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const needsReason = REASON_FIELDS.has(fieldName);
  const label       = FIELD_LABELS[fieldName] || fieldName;

  const handleSave = async () => {
    if (needsReason && !reason.trim()) {
      setError('Please provide a reason for this change');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await peopleEditApi.updateField(recordId, fieldName, value, reason || undefined);
      onSaved(value);
      setEditing(false);
      setReason('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(109,40,217,0.4)', borderRadius: '7px',
    padding: '7px 10px', fontSize: '13px', color: '#f1f5f9',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
      {!editing ? (
        <>
          <span style={{ fontSize: '13px', color: '#e2e8f0', flex: 1, wordBreak: 'break-word' }}>
            {displayValue ?? currentValue ?? <span style={{ color: '#475569', fontStyle: 'italic' }}>Not set</span>}
          </span>
          {isEditable && (
            <button
              onClick={() => { setValue(String(currentValue ?? '')); setEditing(true); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#64748b', fontSize: '12px', padding: '0 2px', flexShrink: 0,
                transition: 'color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#c4b5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; }}
              title={`Edit ${label}`}
            >
              ✏
            </button>
          )}
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {inputType === 'textarea' ? (
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder || `Enter ${label}…`}
              autoFocus
            />
          ) : inputType === 'select' && selectOptions ? (
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
            >
              {selectOptions.map(o => (
                <option key={o.value} value={o.value} style={{ background: '#1e1e35' }}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={inputType}
              style={inputStyle}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={placeholder || `Enter ${label}…`}
              autoFocus
            />
          )}

          {/* Reason field for sensitive changes */}
          {needsReason && (
            <div>
              <p style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b', marginBottom: '4px' }}>
                ⚠ Reason required for changing {label}
              </p>
              <textarea
                style={{ ...inputStyle, minHeight: '60px', resize: 'none', borderColor: 'rgba(245,158,11,0.4)' }}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why is this being changed? This is logged permanently."
              />
            </div>
          )}

          {error && (
            <p style={{ fontSize: '12px', color: '#f87171', fontFamily: 'JetBrains Mono, monospace' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave} disabled={saving}
              style={{
                padding: '5px 14px', borderRadius: '6px', background: '#6d28d9',
                border: 'none', color: 'white', fontSize: '12px', fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); setReason(''); }}
              style={{
                padding: '5px 12px', borderRadius: '6px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                color: '#64748b', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
