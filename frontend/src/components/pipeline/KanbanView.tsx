'use client';

import React from 'react';
import {
  Opportunity,
  PipelineStage,
  STAGE_LABELS,
  STAGE_COLOURS,
  STAGE_ORDER,
  formatNaira,
} from '@/lib/pipeline-api';
import { OpportunityCard } from './OpportunityCard';

interface KanbanViewProps {
  opportunities: Opportunity[];
  onCardClick: (opp: Opportunity) => void;
  onAddInStage: (stage: PipelineStage) => void;
}

export function KanbanView({ opportunities, onCardClick, onAddInStage }: KanbanViewProps) {
  // Group opportunities by stage
  const byStage = STAGE_ORDER.reduce<Record<PipelineStage, Opportunity[]>>(
    (acc, s) => {
      acc[s] = opportunities.filter(o => o.stage === s);
      return acc;
    },
    {} as Record<PipelineStage, Opportunity[]>
  );

  // Active stages (exclude won/lost from main columns - show as smaller side columns)
  const ACTIVE_STAGES: PipelineStage[] = [
     'introduction', 'in_progress', 'proposal_sent', 'under_review', 'negotiating',
  ];
  const CLOSED_STAGES: PipelineStage[] = ['won', 'lost_paused'];

  const stageTotal = (stage: PipelineStage) =>
    byStage[stage].reduce((sum, o) => sum + (o.estimated_value || 0), 0);

  const stageAlertCount = (stage: PipelineStage) =>
    byStage[stage].filter(o => o.staleness !== 'green').length;

  return (
    <div className="pipeline-kanban flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>

      {/* Active stage columns */}
      {ACTIVE_STAGES.map(stage => {
        const colour = STAGE_COLOURS[stage];
        const cards = byStage[stage];
        const alerts = stageAlertCount(stage);
        const total = stageTotal(stage);

        return (
          <div
            key={stage}
            className="kanban-col flex-shrink-0 flex flex-col rounded-xl"
            style={{
              width: '220px',
              background: 'rgba(255,255,255,0.015)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Column header */}
            <div
              className="px-3 py-2.5 rounded-t-xl"
              style={{ borderBottom: `1px solid ${colour.border}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs font-mono font-bold tracking-wide"
                  style={{ color: colour.text }}
                >
                  {STAGE_LABELS[stage]}
                </span>
                <div className="flex items-center gap-1.5">
                  {alerts > 0 && (
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}
                    >
                      ⚠ {alerts}
                    </span>
                  )}
                  <span
                    className="text-[11px] font-mono w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: colour.bg, color: colour.text }}
                  >
                    {cards.length}
                  </span>
                </div>
              </div>
              {total > 0 && (
                <p className="text-[10px] font-mono" style={{ color: '#64748b' }}>
                  {formatNaira(total)}
                </p>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto">
              {cards.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onClick={onCardClick}
                  compact
                />
              ))}

              {/* Empty state */}
              {cards.length === 0 && (
                <div
                  className="flex-1 flex items-center justify-center rounded-lg min-h-20"
                  style={{ border: '1px dashed rgba(255,255,255,0.06)' }}
                >
                  <span className="text-xs" style={{ color: '#475569' }}>No deals</span>
                </div>
              )}
            </div>

            {/* Add button */}
            <div className="p-2 pt-0">
              <button
                onClick={() => onAddInStage(stage)}
                className="w-full py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: colour.bg,
                  color: colour.text,
                  border: `1px solid ${colour.border}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                + Add deal
              </button>
            </div>
          </div>
        );
      })}

      {/* Divider */}
      <div
        className="self-stretch w-px flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.06)', margin: '0 4px' }}
      />

      {/* Won / Lost columns (narrower) */}
      {CLOSED_STAGES.map(stage => {
        const colour = STAGE_COLOURS[stage];
        const cards = byStage[stage];
        const total = stageTotal(stage);

        return (
          <div
            key={stage}
            className="kanban-col flex-shrink-0 flex flex-col rounded-xl"
            style={{
              width: '180px',
              background: 'rgba(255,255,255,0.01)',
              border: `1px solid ${colour.border}`,
              opacity: 0.85,
            }}
          >
            <div className="px-3 py-2.5 rounded-t-xl" style={{ borderBottom: `1px solid ${colour.border}` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold tracking-wide" style={{ color: colour.text }}>
                  {stage === 'won' ? '🏆 Won' : '⏸ Lost / Paused'}
                </span>
                <span
                  className="text-[11px] font-mono w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: colour.bg, color: colour.text }}
                >
                  {cards.length}
                </span>
              </div>
              {total > 0 && (
                <p className="text-[10px] font-mono mt-1" style={{ color: '#64748b' }}>
                  {formatNaira(total)}
                </p>
              )}
            </div>

            <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto max-h-[400px]">
              {cards.map(opp => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onClick={onCardClick}
                  compact
                />
              ))}
              {cards.length === 0 && (
                <div className="flex-1 flex items-center justify-center rounded-lg min-h-12">
                  <span className="text-xs" style={{ color: '#374151' }}>None</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
