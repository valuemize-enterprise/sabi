/**
 * IntelliPulse™ Service
 * AI-powered competitor activity intelligence feed
 */

'use strict';

const { callARIAJson } = require('./aria.service');

async function scan({ competitor, brand }) {
  const prompt = `You are IntelliPulse™, generating a competitor intelligence pulse report.

OUR BRAND: ${brand?.name || 'Unknown'} (${brand?.industry || 'Unknown'} industry, Nigeria)
COMPETITOR: ${competitor.name}
Competitor website: ${competitor.website || 'Unknown'}
Competitor social: ${JSON.stringify(competitor.social_handles || {})}

Based on your knowledge of this company and Nigerian market dynamics, generate a realistic intelligence pulse. Note: This is AI-synthesized intelligence, not live scraped data.

Respond with this exact JSON:
{
  "lastUpdated": "${new Date().toISOString()}",
  "overallActivityLevel": "<Low|Medium|High|Very High>",
  "pulseScore": <0-100>,
  "activities": [
    {
      "type": "<Social|Campaign|Product|PR|Partnership|Pricing>",
      "title": "<activity title>",
      "description": "<2-sentence description>",
      "estimatedImpact": "<Low|Medium|High>",
      "detectedAt": "<date string within last 30 days>",
      "threatLevel": "<Low|Medium|High>"
    }
  ],
  "keyThreat": "<most important competitive threat right now>",
  "opportunity": "<opportunity this competitor activity creates for our brand>",
  "recommendedResponse": "<specific action our brand should take in response>",
  "nigerianContext": "<Nigerian market context for this competitor activity>"
}

Include 3-5 realistic activities. Focus on Nigerian market context.`;

  return await callARIAJson(prompt, null, 1024);
}

module.exports = { scan };
