/**
 * DepthView™ Service
 * AI-powered head-to-head competitor comparison matrix
 */

'use strict';

const { callARIAJson } = require('./aria.service');

async function analyze({ brand, competitors }) {
  const compList = competitors.map(c => `- ${c.name} (${c.industry || 'same industry'}, website: ${c.website || 'unknown'})`).join('\n');

  const prompt = `You are DepthView™, performing a competitive intelligence analysis for a Nigerian brand.

OUR BRAND: ${brand.name}
Industry: ${brand.industry}
Website: ${brand.website || 'Not provided'}
Social Handles: ${JSON.stringify(brand.social_handles || {})}

COMPETITORS:
${compList}

Perform a comprehensive competitive analysis and respond with this exact JSON:
{
  "summary": "<2-sentence executive overview of competitive landscape>",
  "ourPosition": "<market position descriptor>",
  "comparisons": {
    ${competitors.map(c => `"${c.id}": {
      "name": "${c.name}",
      "overallThreatLevel": "<Low|Medium|High|Critical>",
      "dimensions": {
        "brand_awareness": { "ours": <0-10>, "theirs": <0-10>, "insight": "<1 sentence>" },
        "digital_presence": { "ours": <0-10>, "theirs": <0-10>, "insight": "<1 sentence>" },
        "content_quality": { "ours": <0-10>, "theirs": <0-10>, "insight": "<1 sentence>" },
        "audience_engagement": { "ours": <0-10>, "theirs": <0-10>, "insight": "<1 sentence>" },
        "market_positioning": { "ours": <0-10>, "theirs": <0-10>, "insight": "<1 sentence>" }
      },
      "competitorStrengths": ["<strength 1>", "<strength 2>"],
      "competitorWeaknesses": ["<weakness 1>", "<weakness 2>"],
      "opportunityToWin": "<specific opportunity to outperform this competitor>"
    }`).join(',\n')}
  },
  "strategicRecommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "nigerianMarketInsight": "<specific insight about the competitive landscape in the Nigerian context>"
}`;

  return await callARIAJson(prompt, null, 2048);
}

module.exports = { analyze };
