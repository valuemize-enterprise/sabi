/**
 * Proof of Value Engine™
 * AI-powered task-to-metric correlation and value attribution
 */

'use strict';

const { callARIAJson } = require('./aria.service');

async function analyze({ task, goal, brand, metricBefore, metricAfter, metricNotes }) {
  const hasMetrics = metricBefore !== undefined && metricAfter !== undefined;
  const change = hasMetrics ? ((metricAfter - metricBefore) / Math.max(Math.abs(metricBefore), 1) * 100).toFixed(1) : null;

  const prompt = `You are the Proof of Value Engine™, correlating completed marketing tasks to measurable business outcomes for a Nigerian brand.

BRAND: ${brand?.name || 'Unknown'} (${brand?.industry || 'Unknown'} industry)
COMPLETED TASK: ${task.title}
TASK DESCRIPTION: ${task.description || 'No description'}
TASK PRIORITY: ${task.priority}
${goal ? `LINKED GOAL: ${goal.title} (${goal.metric_type}, target: ${goal.target_value} ${goal.unit})` : 'No linked goal'}

${hasMetrics ? `METRIC DATA:
- Before task completion: ${metricBefore}
- After task completion: ${metricAfter}
- Change: ${change}%
- Notes: ${metricNotes || 'None'}` : 'No before/after metrics provided'}

Generate a Proof of Value assessment. Respond with this exact JSON:
{
  "povScore": <0-100, confidence that this task drove positive value>,
  "impactLabel": "<No Impact|Minimal|Moderate|Significant|High Impact>",
  "attributionConfidence": "<Low|Medium|High>",
  "valueStatement": "<1-sentence executive statement of value delivered>",
  "metricImpact": ${hasMetrics ? `"${change}% change in ${goal?.metric_type || 'key metric'}"` : '"No metrics captured"'},
  "businessOutcome": "<what this task contributed to the brand's growth>",
  "recommendation": "<next task or action to build on this result>",
  "reportingSummary": "<2-sentence summary suitable for client-facing report>",
  "nigerianContext": "<any Nigerian market context relevant to interpreting this result>"
}`;

  return await callARIAJson(prompt, null, 768);
}

module.exports = { analyze };
