'use client';

import React from 'react';

export interface DateFilter {
  month:      number | null;  // 1–12 or null
  year:       number | null;
  date_field: 'due_date' | 'created_at';
}

interface TaskDateFilterProps {
  value:    DateFilter;
  onChange: (f: DateFilter) => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

const iS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '7px', padding: '6px 10px',
  fontSize: '12px', color: '#f1f5f9',
  fontFamily: 'Inter, sans-serif',
  cursor: 'pointer', outline: 'none',
};

export function TaskDateFilter({ value, onChange }: TaskDateFilterProps) {
  const isActive = value.month != null || value.year != null;

  const set = (patch: Partial<DateFilter>) =>
    onChange({ ...value, ...patch });

  const clear = () =>
    onChange({ month: null, year: null, date_field: 'due_date' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      {/* Month selector */}
      <select
        style={iS}
        value={value.month ?? ''}
        onChange={e => set({ month: e.target.value ? Number(e.target.value) : null })}
      >
        <option value="" style={{ background: '#1e1e35' }}>Month</option>
        {MONTHS.map((m, i) => (
          <option key={i} value={i + 1} style={{ background: '#1e1e35' }}>{m}</option>
        ))}
      </select>

      {/* Year selector */}
      <select
        style={iS}
        value={value.year ?? ''}
        onChange={e => set({ year: e.target.value ? Number(e.target.value) : null })}
      >
        <option value="" style={{ background: '#1e1e35' }}>Year</option>
        {YEARS.map(y => (
          <option key={y} value={y} style={{ background: '#1e1e35' }}>{y}</option>
        ))}
      </select>

      {/* Date field toggle */}
      <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '2px' }}>
        {(['due_date', 'created_at'] as const).map(f => (
          <button
            key={f}
            onClick={() => set({ date_field: f })}
            style={{
              padding: '4px 8px', borderRadius: '5px', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              border: 'none',
              background: value.date_field === f ? 'rgba(109,40,217,0.25)' : 'transparent',
              color: value.date_field === f ? '#c4b5fd' : '#64748b',
            }}
          >
            {f === 'due_date' ? 'Due' : 'Created'}
          </button>
        ))}
      </div>

      {/* Active filter chip + clear */}
      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(109,40,217,0.15)', border: '1px solid rgba(109,40,217,0.3)', borderRadius: '6px' }}>
          <span style={{ fontSize: '11px', color: '#c4b5fd', fontFamily: 'JetBrains Mono, monospace' }}>
            {value.month ? MONTHS[value.month - 1] : ''}
            {value.month && value.year ? ' ' : ''}
            {value.year ?? ''}
          </span>
          <button
            onClick={clear}
            style={{ background: 'none', border: 'none', color: '#6d28d9', cursor: 'pointer', padding: '0 2px', fontSize: '13px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
