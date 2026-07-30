// ═══════════════════════════════════════════════════════════════════
// pipeline-intelligence.service.js
// Sabi Intelligence Suite — Phase 3: ARIA Intelligence Layer
//
// Computes and narrates:
//   • Win pattern analysis  — which deals close, how fast, from what source
//   • Loss pattern analysis — why deals are lost, quarterly trends
//   • Conversion forecast   — weighted probability by stage
//   • Deal velocity         — avg days per stage across the pipeline
// ═══════════════════════════════════════════════════════════════════

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../db/db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ARIA_MODEL = 'claude-sonnet-4-6';

const fmtN = v => v != null ? `₦${Number(v).toLocaleString('en-NG')}` : '—';
const round1 = v => Math.round(Number(v) * 10) / 10;

// ── Win Pattern Analysis ──────────────────────────────────────────

/**
 * Analyses won deals from the past 90 days.
 * Returns patterns by: source, service_type, avg_days_to_close.
 */
const getWinPatterns = async () => {
  const [bySource, byServiceType, velocity] = await Promise.all([

    // Wins by source + avg days to close
    query(
      `SELECT
         o.source,
         COUNT(*)                                                        AS win_count,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (sh.changed_at - o.created_at)) / 86400
         )::numeric, 1)                                                  AS avg_days_to_close,
         COALESCE(SUM(o.estimated_value), 0)                             AS total_value
       FROM opportunities o
       JOIN opportunity_stage_history sh
         ON sh.opportunity_id = o.id AND sh.to_stage = 'won'
       WHERE o.stage = 'won'
         AND o.created_at >= NOW() - INTERVAL '90 days'
       GROUP BY o.source
       ORDER BY win_count DESC`
    ).catch(() => ({ rows: [] })),

    // Wins by service type
    query(
      `SELECT
         UNNEST(o.service_types)                                         AS service_type,
         COUNT(*)                                                        AS win_count,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (sh.changed_at - o.created_at)) / 86400
         )::numeric, 1)                                                  AS avg_days_to_close
       FROM opportunities o
       JOIN opportunity_stage_history sh
         ON sh.opportunity_id = o.id AND sh.to_stage = 'won'
       WHERE o.stage = 'won'
         AND o.created_at >= NOW() - INTERVAL '90 days'
       GROUP BY service_type
       ORDER BY win_count DESC`
    ).catch(() => ({ rows: [] })),

    // Overall velocity: avg days per stage (for won deals)
    query(
      `SELECT
         sh_from.to_stage                                                AS stage,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (sh_to.changed_at - sh_from.changed_at)) / 86400
         )::numeric, 1)                                                  AS avg_days_in_stage
       FROM opportunity_stage_history sh_from
       JOIN opportunity_stage_history sh_to
         ON sh_to.opportunity_id = sh_from.opportunity_id
        AND sh_to.changed_at > sh_from.changed_at
       JOIN opportunities o ON o.id = sh_from.opportunity_id
       WHERE o.stage = 'won'
       GROUP BY sh_from.to_stage
       HAVING AVG(EXTRACT(EPOCH FROM (sh_to.changed_at - sh_from.changed_at)) / 86400) IS NOT NULL
       ORDER BY sh_from.changed_at`
    ).catch(() => ({ rows: [] })),
  ]);

  // Total wins summary
  const totalWins = bySource.rows.reduce((s, r) => s + Number(r.win_count), 0);
  const totalValue = bySource.rows.reduce((s, r) => s + Number(r.total_value), 0);
  const overallAvgDays = bySource.rows.length
    ? round1(bySource.rows.reduce((s, r) => s + Number(r.avg_days_to_close || 0), 0) / bySource.rows.length)
    : null;

  // Find fastest and slowest source
  const sortedBySpeed = [...bySource.rows].sort(
    (a, b) => Number(a.avg_days_to_close) - Number(b.avg_days_to_close)
  );
  const fastest = sortedBySpeed[0] || null;
  const slowest = sortedBySpeed[sortedBySpeed.length - 1] || null;

  return {
    period: 'Last 90 days',
    total_wins: totalWins,
    total_value: totalValue,
    overall_avg_days_to_close: overallAvgDays,
    by_source: bySource.rows.map(r => ({
      source: r.source || 'Unknown',
      win_count: Number(r.win_count),
      avg_days_to_close: round1(r.avg_days_to_close),
      total_value: Number(r.total_value),
    })),
    by_service_type: byServiceType.rows.map(r => ({
      service_type: r.service_type,
      win_count: Number(r.win_count),
      avg_days_to_close: round1(r.avg_days_to_close),
    })),
    velocity_by_stage: velocity.rows.map(r => ({
      stage: r.stage,
      avg_days: round1(r.avg_days_in_stage),
    })),
    fastest_source: fastest ? { source: fastest.source, avg_days: round1(fastest.avg_days_to_close) } : null,
    slowest_source: slowest && slowest !== fastest ? { source: slowest.source, avg_days: round1(slowest.avg_days_to_close) } : null,
  };
};

// ── Loss Pattern Analysis ─────────────────────────────────────────

/**
 * Analyses lost deals with reason breakdown.
 * Compares current quarter vs previous quarter.
 */
const getLossPatterns = async () => {
  const [thisQuarter, lastQuarter, allTime] = await Promise.all([

    query(
      `SELECT
         COALESCE(lost_reason, 'not_recorded')    AS lost_reason,
         COUNT(*)                                  AS count,
         COALESCE(SUM(estimated_value), 0)         AS value_lost
       FROM opportunities
       WHERE stage = 'lost_paused'
         AND updated_at >= DATE_TRUNC('quarter', NOW())
       GROUP BY lost_reason
       ORDER BY count DESC`
    ).catch(() => ({ rows: [] })),

    query(
      `SELECT
         COALESCE(lost_reason, 'not_recorded')    AS lost_reason,
         COUNT(*)                                  AS count
       FROM opportunities
       WHERE stage = 'lost_paused'
         AND updated_at >= DATE_TRUNC('quarter', NOW()) - INTERVAL '3 months'
         AND updated_at <  DATE_TRUNC('quarter', NOW())
       GROUP BY lost_reason
       ORDER BY count DESC`
    ).catch(() => ({ rows: [] })),

    query(
      `SELECT COUNT(*) AS total_lost,
              COALESCE(SUM(estimated_value), 0) AS total_value_lost
       FROM opportunities
       WHERE stage = 'lost_paused'`
    ).catch(() => ({ rows: [{ total_lost: 0, total_value_lost: 0 }] })),
  ]);

  const REASON_LABELS = {
    budget_constraints:    'Budget Constraints',
    went_with_competitor:  'Went with Competitor',
    scope_too_broad:       'Scope Too Broad',
    timing_not_right:      'Timing Not Right',
    no_budget_at_this_time:'No Budget at This Time',
    other:                 'Other',
    not_recorded:          'Reason Not Recorded',
  };

  const totalThisQ = thisQuarter.rows.reduce((s, r) => s + Number(r.count), 0);
  const prevMap = Object.fromEntries(lastQuarter.rows.map(r => [r.lost_reason, Number(r.count)]));

  // Find dominant reason
  const dominant = thisQuarter.rows[0] || null;

  return {
    this_quarter: thisQuarter.rows.map(r => ({
      reason: r.lost_reason,
      label: REASON_LABELS[r.lost_reason] || r.lost_reason,
      count: Number(r.count),
      value_lost: Number(r.value_lost),
      prev_quarter_count: prevMap[r.lost_reason] || 0,
      change: Number(r.count) - (prevMap[r.lost_reason] || 0),
    })),
    total_lost_this_quarter: totalThisQ,
    total_lost_all_time: Number(allTime.rows[0]?.total_lost || 0),
    total_value_lost_all_time: Number(allTime.rows[0]?.total_value_lost || 0),
    dominant_reason: dominant ? {
      reason: dominant.lost_reason,
      label: REASON_LABELS[dominant.lost_reason] || dominant.lost_reason,
      count: Number(dominant.count),
      pct_of_losses: totalThisQ > 0 ? Math.round((Number(dominant.count) / totalThisQ) * 100) : 0,
    } : null,
  };
};

// ── Conversion Forecast ───────────────────────────────────────────

/**
 * Weighted pipeline forecast.
 * Stage probability weights from the blueprint.
 */
const STAGE_WEIGHTS = {
  identified:    0.05,
  in_progress:   0.15,
  proposal_sent: 0.30,
  under_review:  0.50,
  negotiating:   0.70,
};

const getConversionForecast = async () => {
  const result = await query(
    `SELECT
       stage,
       COUNT(*)                              AS deal_count,
       COALESCE(SUM(estimated_value), 0)     AS raw_value,
       COUNT(*) FILTER (WHERE estimated_value IS NOT NULL) AS with_value_count
     FROM opportunities
     WHERE stage NOT IN ('won', 'lost_paused')
     GROUP BY stage`
  ).catch(() => ({ rows: [] }));

  const stageData = result.rows.map(r => {
    const weight = STAGE_WEIGHTS[r.stage] || 0;
    const rawValue = Number(r.raw_value);
    return {
      stage: r.stage,
      deal_count: Number(r.deal_count),
      raw_value: rawValue,
      weight_pct: Math.round(weight * 100),
      weighted_value: Math.round(rawValue * weight),
      has_value_count: Number(r.with_value_count),
    };
  });

  // Sort by stage order
  const ORDER = ['identified', 'in_progress', 'proposal_sent', 'under_review', 'negotiating'];
  stageData.sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage));

  const totalWeightedValue = stageData.reduce((s, r) => s + r.weighted_value, 0);
  const totalRawValue = stageData.reduce((s, r) => s + r.raw_value, 0);
  const totalDeals = stageData.reduce((s, r) => s + r.deal_count, 0);

  // High-confidence deals (negotiating only, 70%)
  const highConfidence = stageData
    .filter(r => r.stage === 'negotiating')
    .reduce((s, r) => s + r.weighted_value, 0);

  return {
    stages: stageData,
    total_active_deals: totalDeals,
    total_raw_pipeline: totalRawValue,
    total_weighted_forecast: totalWeightedValue,
    high_confidence_value: highConfidence,
    note: 'Weighted by close probability: Identified 5% · In Progress 15% · Proposal Sent 30% · Under Review 50% · Negotiating 70%',
  };
};

// ── Quarter-over-Quarter Summary ──────────────────────────────────

const getQuarterSummary = async () => {
  const result = await query(
    `SELECT
       DATE_TRUNC('quarter', created_at) AS quarter,
       COUNT(*) FILTER (WHERE stage = 'won')                   AS won,
       COUNT(*) FILTER (WHERE stage = 'lost_paused')           AS lost,
       COUNT(*)                                                 AS total,
       COALESCE(SUM(estimated_value) FILTER (WHERE stage='won'), 0) AS won_value
     FROM opportunities
     WHERE created_at >= NOW() - INTERVAL '4 quarters'
     GROUP BY quarter
     ORDER BY quarter ASC`
  ).catch(() => ({ rows: [] }));

  return result.rows.map(r => ({
    quarter: new Date(r.quarter).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    won: Number(r.won),
    lost: Number(r.lost),
    total: Number(r.total),
    win_rate: Number(r.won) + Number(r.lost) > 0
      ? Math.round((Number(r.won) / (Number(r.won) + Number(r.lost))) * 100)
      : null,
    won_value: Number(r.won_value),
  }));
};

// ── Full ARIA Intelligence Report ─────────────────────────────────

/**
 * Compiles all four data sets and generates ARIA narratives.
 * Returns the structured data AND ARIA-written insight summaries.
 */
const generateFullIntelligenceReport = async () => {
  const [winPatterns, lossPatterns, forecast, quarterSummary] = await Promise.all([
    getWinPatterns(),
    getLossPatterns(),
    getConversionForecast(),
    getQuarterSummary(),
  ]);

  // Generate ARIA narratives in parallel
  const [winNarrative, lossNarrative, forecastNarrative] = await Promise.all([
    generateWinNarrative(winPatterns),
    generateLossNarrative(lossPatterns),
    generateForecastNarrative(forecast),
  ]);

  return {
    win_patterns: { ...winPatterns, aria_narrative: winNarrative },
    loss_patterns: { ...lossPatterns, aria_narrative: lossNarrative },
    forecast:      { ...forecast,    aria_narrative: forecastNarrative },
    quarter_summary: quarterSummary,
    generated_at: new Date().toISOString(),
  };
};

// ── ARIA Narrative Generators ─────────────────────────────────────

const ARIA_VOICE = `You are ARIA, the intelligence engine for Cerebre Media Africa's Sabi. Write in a confident, direct, factual voice. No filler. Use ₦ for Naira. Maximum 2 sentences.`;

const generateWinNarrative = async (data) => {
  if (!data.total_wins) return null;

  const prompt = `${ARIA_VOICE}

Win pattern data (last 90 days):
Total wins: ${data.total_wins}
Total value: ${fmtN(data.total_value)}
Average days to close: ${data.overall_avg_days_to_close || 'N/A'}
By source: ${data.by_source.map(s => `${s.source}: ${s.win_count} wins, avg ${s.avg_days_to_close}d`).join(' | ')}
By service: ${data.by_service_type.map(s => `${s.service_type}: ${s.win_count}`).join(', ')}
Fastest source: ${data.fastest_source ? `${data.fastest_source.source} (${data.fastest_source.avg_days}d avg)` : 'N/A'}

Write one 2-sentence insight about win patterns. Focus on the most actionable finding — what source or service type should the team prioritise? Be specific with numbers.`;

  const res = await client.messages.create({
    model: ARIA_MODEL, max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content[0]?.text?.trim() || null;
};

const generateLossNarrative = async (data) => {
  if (!data.total_lost_this_quarter) return null;

  const dominant = data.dominant_reason;
  const prompt = `${ARIA_VOICE}

Loss pattern data (this quarter):
Total losses this quarter: ${data.total_lost_this_quarter}
Dominant reason: ${dominant ? `${dominant.label} (${dominant.count} of ${data.total_lost_this_quarter} losses, ${dominant.pct_of_losses}%)` : 'None recorded'}
All reasons this quarter: ${data.this_quarter.map(r => `${r.label}: ${r.count}`).join(', ')}
Total value lost (all time): ${fmtN(data.total_value_lost_all_time)}

Write one 2-sentence insight about loss patterns. What should leadership change to address the dominant loss reason? Be specific.`;

  const res = await client.messages.create({
    model: ARIA_MODEL, max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content[0]?.text?.trim() || null;
};

const generateForecastNarrative = async (data) => {
  const prompt = `${ARIA_VOICE}

Pipeline forecast data:
Active deals: ${data.total_active_deals}
Raw pipeline value: ${fmtN(data.total_raw_pipeline)}
Probability-weighted forecast: ${fmtN(data.total_weighted_forecast)}
High-confidence value (negotiating): ${fmtN(data.high_confidence_value)}
Stage breakdown: ${data.stages.map(s => `${s.stage}: ${s.deal_count} deals, ${fmtN(s.raw_value)} raw, ${s.weight_pct}% probability`).join(' | ')}

Write one 2-sentence weighted forecast summary. State the weighted number, then note what the high-confidence portion represents. Be precise.`;

  const res = await client.messages.create({
    model: ARIA_MODEL, max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content[0]?.text?.trim() || null;
};

module.exports = {
  getWinPatterns,
  getLossPatterns,
  getConversionForecast,
  getQuarterSummary,
  generateFullIntelligenceReport,
};
