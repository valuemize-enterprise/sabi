/**
 * NarrativeAI™ Service
 * Generates professional weekly/monthly brand performance narratives
 * Written in Cerebre Media Africa's executive voice
 */

'use strict';

const { callARIA } = require('./aria.service');

/**
 * Generate a brand narrative for a report
 * @param {{ report, brand, metrics, period }} params
 */
async function generate({ report, brand, metrics = {}, period = {} }) {
  const metricsText = Object.entries(metrics)
    .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`)
    .join('\n') || 'No specific metrics provided';

  const periodText = period.start && period.end
    ? `${period.start} to ${period.end}`
    : 'the reporting period';

  const prompt = `You are NarrativeAI™, writing a professional brand performance narrative for the Sabi Intelligence Suite platform.

BRAND: ${brand.name}
INDUSTRY: ${brand.industry}
REPORT TYPE: ${report.type || 'performance report'}
PERIOD: ${periodText}

PERFORMANCE METRICS:
${metricsText}

REPORT CONTEXT: ${report.title}

Write a 3-paragraph executive narrative (NOT bullet points) that:
1. Opening paragraph: Opens with a punchy 1-sentence headline statement about the brand's performance, then summarises what the period looked like — be specific about the numbers.
2. Middle paragraph: Explains the "why" behind the performance — what drove results, what held them back, and what the data reveals about the brand's market position in Nigeria.
3. Closing paragraph: Gives 2-3 precise, actionable next steps for the coming period. Tie each to a specific metric or goal.

Tone: Executive. Sharp. Nigerian market-aware. No fluff.
Length: 200–280 words total.
Format: Plain text, no headers, no bullet points.`;

  const narrative = await callARIA(prompt, null, 1024);
  return narrative.trim();
}

module.exports = { generate };
