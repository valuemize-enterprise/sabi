/**
 * ClarityScore™ Service
 * Computes an AI-powered 0–1000 brand health score
 * across 7 weighted dimensions
 */

'use strict';

const { callARIAJson } = require('./aria.service');

const DIMENSIONS = [
  { key: 'goal_performance',    label: 'Goal Performance',      weight: 0.20 },
  { key: 'content_consistency', label: 'Content Consistency',   weight: 0.15 },
  { key: 'competitive_position',label: 'Competitive Position',  weight: 0.15 },
  { key: 'audience_engagement', label: 'Audience Engagement',   weight: 0.20 },
  { key: 'brand_visibility',    label: 'Brand Visibility',      weight: 0.15 },
  { key: 'digital_presence',    label: 'Digital Presence',      weight: 0.10 },
  { key: 'campaign_execution',  label: 'Campaign Execution',    weight: 0.05 },
];

/**
 * Compute ClarityScore™ for a brand
 * @param {{ brand, goals, reports, competitors }} params
 */
async function compute({ brand, goals = [], reports = [], competitors = [] }) {
  const goalSummary = {
    total:    goals.length,
    active:   goals.filter(g => g.status === 'active').length,
    achieved: goals.filter(g => g.status === 'achieved').length,
    avgProgress: goals.length
      ? Math.round(goals.reduce((s, g) => s + Math.min(100, (g.current_value / Math.max(g.target_value, 1)) * 100), 0) / goals.length)
      : 0,
  };

  const reportSummary = {
    total:     reports.length,
    published: reports.filter(r => r.status === 'published').length,
    recent:    reports.filter(r => {
      const d = new Date(r.created_at);
      return d > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }).length,
  };

  const prompt = `You are computing the ClarityScore™ for a brand. Score each of the 7 dimensions from 0–100, then compute the weighted total (max 1000).

BRAND PROFILE:
- Name: ${brand.name}
- Industry: ${brand.industry}
- Description: ${brand.description || 'No description provided'}

GOALS DATA:
- Total goals: ${goalSummary.total}
- Active goals: ${goalSummary.active}
- Achieved goals: ${goalSummary.achieved}
- Average progress: ${goalSummary.avgProgress}%

REPORTS DATA:
- Total reports: ${reportSummary.total}
- Published reports: ${reportSummary.published}
- Reports last 30 days: ${reportSummary.recent}

COMPETITORS:
- Tracking ${competitors.length} competitor(s)
- Names: ${competitors.map(c => c.name).join(', ') || 'None tracked'}

SCORING DIMENSIONS AND WEIGHTS:
${DIMENSIONS.map(d => `- ${d.key}: ${d.label} (weight: ${d.weight * 100}%)`).join('\n')}

INSTRUCTIONS:
1. Score each dimension 0–100
2. Compute weighted_score = sum of (dimension_score × weight) × 10 (to scale to 1000)
3. Round to nearest integer
4. Write a 2-sentence executive analysis of the brand's health

Respond with this exact JSON structure:
{
  "scores": {
    "goal_performance": <0-100>,
    "content_consistency": <0-100>,
    "competitive_position": <0-100>,
    "audience_engagement": <0-100>,
    "brand_visibility": <0-100>,
    "digital_presence": <0-100>,
    "campaign_execution": <0-100>
  },
  "score": <0-1000>,
  "grade": "<S|A|B|C|D>",
  "analysis": "<2-sentence executive analysis>",
  "top_strength": "<dimension key>",
  "top_weakness": "<dimension key>",
  "priority_action": "<most important action to take>"
}`;

  const result = await callARIAJson(prompt, null, 1024);

  // Compute weighted score server-side as a sanity check
  const computed = Math.round(
    DIMENSIONS.reduce((sum, d) => sum + (result.scores[d.key] || 0) * d.weight, 0) * 10
  );
  const score = Math.min(1000, Math.max(0, computed));

  const grade = score >= 850 ? 'S' : score >= 700 ? 'A' : score >= 550 ? 'B' : score >= 400 ? 'C' : 'D';

  return {
    score,
    grade,
    breakdown: result.scores,
    analysis:  result.analysis,
    top_strength:    result.top_strength,
    top_weakness:    result.top_weakness,
    priority_action: result.priority_action,
    dimensions: DIMENSIONS,
  };
}

module.exports = { compute, DIMENSIONS };
