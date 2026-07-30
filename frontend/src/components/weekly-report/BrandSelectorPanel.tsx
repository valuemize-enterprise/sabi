'use client';

import React from 'react';
import { BrandStatus, STATUS_COLOURS, EntryStatus } from '@/lib/weekly-report-api';

interface BrandSelectorPanelProps {
  brands: BrandStatus[];
  selectedBrandId: string | null;
  onSelect: (brand: BrandStatus) => void;
  weekLabel: string;
  loading?: boolean;
}

const StatusDot = ({ status }: { status: EntryStatus }) => {
  const c = STATUS_COLOURS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {status === 'submitted' ? '✓' : status === 'draft' ? '~' : '○'}
      {' '}{c.label}
    </span>
  );
};

export function BrandSelectorPanel({ brands, selectedBrandId, onSelect, weekLabel, loading }: BrandSelectorPanelProps) {
  const submitted = brands.filter(b => b.status === 'submitted').length;
  const total = brands.length;

  return (
    <div
      style={{
        width: '260px',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.25)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Panel header */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <p style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>
          Week of
        </p>
        <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '12px' }}>
          {weekLabel}
        </p>

        {/* Progress bar */}
        <div style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
              Submitted
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: submitted === total ? '#10b981' : '#f59e0b' }}>
              {submitted}/{total}
            </span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
            <div
              style={{
                height: '100%',
                borderRadius: '2px',
                background: submitted === total ? '#10b981' : '#6d28d9',
                width: total > 0 ? `${(submitted / total) * 100}%` : '0%',
                transition: 'width .4s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Brand list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: '64px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)',
                marginBottom: '6px',
              }}
            />
          ))
        ) : brands.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#475569', padding: '12px 8px', fontFamily: 'JetBrains Mono, monospace' }}>
            No brands assigned
          </p>
        ) : (
          brands.map(brand => {
            const isSelected = brand.id === selectedBrandId;
            return (
              <button
                key={brand.id}
                onClick={() => onSelect(brand)}
                style={{
                  width: '100%',
                  display: 'block',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid rgba(109,40,217,0.4)' : '1px solid transparent',
                  background: isSelected ? 'rgba(109,40,217,0.12)' : 'transparent',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <p style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#e2e8f0' : '#cbd5e1', marginBottom: '5px', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {brand.name}
                </p>
                {brand.brand_admin_name && brand.brand_admin_name !== 'You' && (
                  <p style={{ fontSize: '10px', color: '#475569', fontFamily: 'JetBrains Mono, monospace', marginBottom: '5px' }}>
                    {brand.brand_admin_name}
                  </p>
                )}
                <StatusDot status={brand.status} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
