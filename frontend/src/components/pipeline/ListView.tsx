'use client';

import React, { useState, useMemo } from 'react';
import {
  Opportunity,
  PipelineStage,
  ServiceType,
  STAGE_LABELS,
  STAGE_COLOURS,
  STALENESS_COLOURS,
  SERVICE_TYPE_LABELS,
  SOURCE_LABELS,
  STAGE_ORDER,
  formatNaira,
} from '@/lib/pipeline-api';

interface ListViewProps {
  opportunities: Opportunity[];
  onRowClick: (opp: Opportunity) => void;
}

type SortKey = 'company_name' | 'stage' | 'days_in_stage' | 'estimated_value' | 'updated_at';

export function ListView({ opportunities, onRowClick }: ListViewProps) {
  const [stageFilter, setStageFilter] = useState<PipelineStage | 'all'>('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceType | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('days_in_stage');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = [...opportunities];

    if (stageFilter !== 'all') list = list.filter(o => o.stage === stageFilter);
    if (serviceFilter !== 'all') list = list.filter(o => o.service_types.includes(serviceFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.company_name.toLowerCase().includes(q) ||
        o.deal_title.toLowerCase().includes(q) ||
        (o.lead_ba_name || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let av: string | number = a[sortKey] as string | number || '';
      let bv: string | number = b[sortKey] as string | number || '';
      if (sortKey === 'stage') {
        av = STAGE_ORDER.indexOf(a.stage);
        bv = STAGE_ORDER.indexOf(b.stage);
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });

    return list;
  }, [opportunities, stageFilter, serviceFilter, sortKey, sortDir, search]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // alias to avoid naming conflict
  const setDir = setSortDir;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      <span style={{ color: '#6d28d9' }}>{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
    ) : (
      <span style={{ color: '#475569' }}> ↕</span>
    );

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: '10px',
    fontFamily: 'JetBrains Mono, monospace',
    color: '#64748b',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    padding: '10px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.2)',
    cursor: 'pointer',
    userSelect: 'none',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#94a3b8',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    verticalAlign: 'middle',
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search company or deal…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#f1f5f9',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
            width: '220px',
          }}
        />

        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value as PipelineStage | 'all')}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
          }}
        >
          <option value="all">All Stages</option>
          {STAGE_ORDER.map(s => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={serviceFilter}
          onChange={e => setServiceFilter(e.target.value as ServiceType | 'all')}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            outline: 'none',
          }}
        >
          <option value="all">All Services</option>
          {Object.entries(SERVICE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
          {filtered.length} deal{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle} onClick={() => toggleSort('company_name')}>Company <SortIcon col="company_name" /></th>
              <th style={thStyle}>Deal</th>
              <th style={thStyle} onClick={() => toggleSort('stage')}>Stage <SortIcon col="stage" /></th>
              <th style={thStyle} onClick={() => toggleSort('days_in_stage')}>Days in Stage <SortIcon col="days_in_stage" /></th>
              <th style={thStyle} onClick={() => toggleSort('estimated_value')}>Value <SortIcon col="estimated_value" /></th>
              <th style={thStyle}>Services</th>
              <th style={thStyle}>Brand Admin</th>
              <th style={thStyle} onClick={() => toggleSort('updated_at')}>Updated <SortIcon col="updated_at" /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(opp => {
              const sc = STAGE_COLOURS[opp.stage];
              const staleCol = STALENESS_COLOURS[opp.staleness];

              return (
                <tr
                  key={opp.id}
                  onClick={() => onRowClick(opp)}
                  className="group"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: staleCol, flexShrink: 0 }} />
                      <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{opp.company_name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>{opp.deal_title}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        background: sc.bg,
                        color: sc.text,
                        border: `1px solid ${sc.border}`,
                      }}
                    >
                      {STAGE_LABELS[opp.stage]}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: staleCol, fontFamily: 'JetBrains Mono, monospace' }}>
                    {opp.days_in_stage === 0 ? 'Today' : `${opp.days_in_stage}d`}
                  </td>
                  <td style={{ ...tdStyle, color: '#10b981', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatNaira(opp.estimated_value)}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {opp.service_types.slice(0, 2).map(st => (
                        <span
                          key={st}
                          style={{
                            fontSize: '10px',
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: 'rgba(109,40,217,0.12)',
                            color: '#c4b5fd',
                          }}
                        >
                          {SERVICE_TYPE_LABELS[st]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={tdStyle}>{opp.lead_ba_name || '—'}</td>
                  <td style={{ ...tdStyle, fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                    {opp.updated_at ? new Date(opp.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '40px', color: '#475569' }}>
                  No deals match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
