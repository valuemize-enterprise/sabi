'use client';

import React from 'react';
import {
  Opportunity,
  STAGE_COLOURS,
  STAGE_LABELS,
  STALENESS_COLOURS,
  SERVICE_TYPE_LABELS,
  formatNaira,
} from '@/lib/pipeline-api';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onClick: (opp: Opportunity) => void;
  compact?: boolean; // true for Kanban (narrower columns)
}

export function OpportunityCard({ opportunity: opp, onClick, compact = false }: OpportunityCardProps) {
  const stageColour = STAGE_COLOURS[opp.stage];
  const stalenessColour = STALENESS_COLOURS[opp.staleness];

  const staleBorderStyle =
    opp.staleness === 'red'
      ? { borderColor: 'rgba(239,68,68,0.4)' }
      : opp.staleness === 'amber'
      ? { borderColor: 'rgba(245,158,11,0.3)' }
      : {};

  return (
    <div
      onClick={() => onClick(opp)}
      className="group cursor-pointer rounded-xl border transition-all duration-150 hover:scale-[1.01]"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.08)',
        ...staleBorderStyle,
      }}
    >
      {/* Staleness indicator strip */}
      <div
        className="h-0.5 rounded-t-xl"
        style={{ background: stalenessColour, opacity: opp.staleness === 'green' ? 0.4 : 0.8 }}
      />

      <div className={`p-3 ${compact ? '' : 'p-4'}`}>
        {/* Company + Stage badge */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span
            className="text-xs font-mono font-semibold tracking-wide"
            style={{ color: stalenessColour }}
          >
            {opp.company_name.toUpperCase()}
          </span>
          {!compact && (
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                background: stageColour.bg,
                color: stageColour.text,
                border: `1px solid ${stageColour.border}`,
              }}
            >
              {STAGE_LABELS[opp.stage]}
            </span>
          )}
        </div>

        {/* Deal title */}
        <p
          className="font-semibold text-sm leading-snug mb-2"
          style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#f1f5f9' }}
        >
          {opp.deal_title}
        </p>

        {/* Value */}
        {opp.estimated_value && (
          <p className="text-xs font-mono mb-2" style={{ color: '#10b981' }}>
            {formatNaira(opp.estimated_value)}
          </p>
        )}

        {/* Service chips */}
        {opp.service_types.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {opp.service_types.slice(0, compact ? 2 : 3).map(st => (
              <span
                key={st}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(109,40,217,0.12)', color: '#c4b5fd' }}
              >
                {SERVICE_TYPE_LABELS[st]}
              </span>
            ))}
          </div>
        )}

        {/* Meta row: days + BA */}
        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span
            className="text-[11px] font-mono"
            style={{ color: stalenessColour }}
          >
            {opp.days_in_stage === 0 ? 'Today' : `${opp.days_in_stage}d`}
          </span>
          {opp.lead_ba_name && (
            <span className="text-[11px]" style={{ color: '#64748b' }}>
              {opp.lead_ba_name.split(' ')[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
