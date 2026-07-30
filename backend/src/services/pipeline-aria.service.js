// ═══════════════════════════════════════════════════════════════════
// pipeline-aria.service.js
// ARIA Intelligence Layer — New Business Pipeline (Phase 0)
//
// Functions:
//   draftWeeklyNote     → ARIA writes the week's update for one deal
//   draftMomentumPara   → ARIA writes MD pipeline commentary paragraph
//   buildForecastNote   → ARIA writes weighted pipeline forecast insight
//
// All functions call Anthropic's API via the same env var used
// throughout Sabi (ANTHROPIC_API_KEY).
// ═══════════════════════════════════════════════════════════════════

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const pipelineService = require('./pipeline.service');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ARIA_MODEL = 'claude-sonnet-4-6';

// ── Draft weekly note for one opportunity ─────────────────────────

/**
 * Generates ARIA's draft narrative for an opportunity's weekly note.
 *
 * @param {string} opportunity_id
 * @param {string} week_start  - YYYY-MM-DD (Monday)
 * @returns {string} aria_draft text
 */
const draftWeeklyNote = async (opportunity_id, week_start) => {
  const opp = await pipelineService.getOpportunityById(opportunity_id);
  if (!opp) throw new Error('Opportunity not found');

  // Get the previous week's note for context
  const prevNotes = opp.weekly_notes.slice(0, 3); // last 3 weeks for context

  const stageLabel = {
    identified: 'Identified (no pitch started)',
    in_progress: 'In Progress — pitch work underway internally',
    proposal_sent: 'Proposal Sent — awaiting client feedback',
    under_review: 'Under Review — client has acknowledged, discussing internally',
    negotiating: 'Negotiating — SLA/NDA/scope being finalised',
    won: 'Won',
    lost_paused: 'Lost / Paused',
  }[opp.stage] || opp.stage;

  const prompt = `You are ARIA, the AI intelligence engine for Cerebre Media Africa's internal agency management system (Sabi Intelligence Suite). You are drafting a brief weekly pipeline update for the brand team's Friday report.

DEAL DETAILS:
Company: ${opp.company_name}
Deal: ${opp.deal_title}
Current stage: ${stageLabel}
Days in current stage: ${opp.days_in_stage}
Estimated value: ${opp.estimated_value ? `₦${Number(opp.estimated_value).toLocaleString()}` : 'Not set'}
Service types: ${(opp.service_types || []).join(', ') || 'Not specified'}
Accountable team: ${opp.accountable_team_text || 'Not specified'}
Brand Admin: ${opp.lead_ba_name || 'Not assigned'}

PREVIOUS NOTES (most recent first):
${prevNotes.length
  ? prevNotes.map(n => `Week of ${n.week_start}: ${n.notes || '(no note recorded)'}`).join('\n')
  : '(no previous notes)'
}

CURRENT NOTES FIELD: ${opp.notes || '(empty)'}

Task: Write a concise, professional weekly update for this deal. The update should:
- Be 2–4 sentences maximum
- State what happened this week (or that there was no movement)
- Note any action items or next steps if obvious from context
- Flag if the deal has been in the same stage too long (${opp.days_in_stage} days) and a follow-up is needed
- Use plain, direct business language — no marketing fluff
- Write in third person: "ReactSquad reviewed the deck internally this week..."

Do NOT include preamble, labels, or any text other than the update paragraph itself.`;

  const response = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text?.trim() || '';
};

// ── MD Pipeline Momentum Commentary ──────────────────────────────

/**
 * Generates ARIA's one-paragraph pipeline momentum commentary
 * for the MD's weekly consolidated view.
 *
 * @param {Object} analytics - from pipelineService.getAnalytics()
 * @param {Array}  alerts    - from pipelineService.getStalenessAlerts()
 * @param {Array}  recentMoves - opportunities where stage changed this week
 * @returns {string} commentary paragraph
 */
const draftMomentumPara = async (analytics, alerts, recentMoves = []) => {
  const alertsSummary = alerts.slice(0, 3).map(a => a.alert_message).join('\n');

  const movesSummary = recentMoves.length
    ? recentMoves.map(m => `${m.company_name} (${m.deal_title}) moved from ${m.from_stage} to ${m.to_stage}`).join('; ')
    : 'No stage changes recorded this week';

  const prompt = `You are ARIA, the AI intelligence engine for Cerebre Media Africa's Sabi Intelligence Suite. Write a concise one-paragraph pipeline momentum commentary for the MD's Friday report.

PIPELINE SUMMARY:
Active deals: ${analytics.active_count}
Total pipeline value: ₦${Number(analytics.total_pipeline_value).toLocaleString()}
Weighted forecast: ₦${Number(analytics.weighted_forecast).toLocaleString()}
Win rate this quarter: ${analytics.win_rate_pct}%
Deals needing attention (stale): ${analytics.staleness.red} critical, ${analytics.staleness.amber} watch

STAGE MOVEMENTS THIS WEEK:
${movesSummary}

STALENESS ALERTS (top 3):
${alertsSummary || 'No critical alerts this week'}

Write one paragraph (3–5 sentences) covering:
1. Overall pipeline health and value
2. Any deal movements this week (wins, stage advances)
3. The one or two deals that need the MD's attention this week
4. A forward-looking note if relevant

Use the Cerebre voice: confident, factual, direct. No bullet points — flowing paragraph only. No preamble.`;

  const response = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text?.trim() || '';
};

// ── Forecast narrative ────────────────────────────────────────────

/**
 * ARIA writes a one-sentence forecast insight based on weighted pipeline value
 * vs agency monthly target (if available).
 */
const buildForecastNote = async (weighted_forecast, monthly_target = null) => {
  if (!weighted_forecast) return null;

  const prompt = `You are ARIA. Write one sentence (maximum 30 words) summarising this pipeline forecast insight for the MD.

Weighted pipeline value (probability-adjusted): ₦${Number(weighted_forecast).toLocaleString()}
Monthly revenue target: ${monthly_target ? `₦${Number(monthly_target).toLocaleString()}` : 'not set'}

The sentence should state the weighted forecast value and, if a target is set, how much of the gap it addresses. Be precise and factual. No preamble.`;

  const response = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 80,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text?.trim() || null;
};

module.exports = {
  draftWeeklyNote,
  draftMomentumPara,
  buildForecastNote,
};
