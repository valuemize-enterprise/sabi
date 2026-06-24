/**
 * MomentMap™ Service
 * AI-powered Nigerian cultural calendar recommendations
 */

'use strict';

const { callARIAJson } = require('./aria.service');

const NIGERIAN_CALENDAR = [
  { name: 'New Year', date: 'Jan 1', type: 'national' },
  { name: 'Valentine\'s Day', date: 'Feb 14', type: 'commercial' },
  { name: 'Eid al-Fitr', date: 'Varies (Islamic calendar)', type: 'religious' },
  { name: 'Easter', date: 'Varies', type: 'religious' },
  { name: 'Workers Day', date: 'May 1', type: 'national' },
  { name: 'Children\'s Day', date: 'May 27', type: 'national' },
  { name: 'Democracy Day', date: 'Jun 12', type: 'national' },
  { name: 'Eid al-Adha (Ileya)', date: 'Varies (Islamic calendar)', type: 'religious' },
  { name: 'Independence Day', date: 'Oct 1', type: 'national' },
  { name: 'Eid Maulud', date: 'Varies', type: 'religious' },
  { name: 'Christmas', date: 'Dec 25', type: 'religious' },
  { name: 'Black Friday / Ember Month Sales', date: 'Nov', type: 'commercial' },
  { name: 'Lagos Carnival', date: 'Dec', type: 'cultural' },
];

async function recommend({ brand, events = [], month, year }) {
  const targetPeriod = month ? `${year || new Date().getFullYear()}-${String(month).padStart(2, '0')}` : 'upcoming 30 days';
  const upcomingEvents = events.slice(0, 10).map(e => `- ${e.title} (${e.event_date}): ${e.event_type}`).join('\n') || 'No events currently in calendar';

  const prompt = `You are MomentMap™, generating cultural calendar marketing recommendations for a Nigerian brand.

BRAND: ${brand.name}
INDUSTRY: ${brand.industry}
PERIOD: ${targetPeriod}
SOCIAL HANDLES: ${JSON.stringify(brand.social_handles || {})}

UPCOMING CALENDAR EVENTS:
${upcomingEvents}

NIGERIAN CULTURAL CALENDAR REFERENCE:
${NIGERIAN_CALENDAR.map(e => `- ${e.name} (${e.date}): ${e.type}`).join('\n')}

Generate marketing moment recommendations for this brand and period. Respond with this exact JSON:
{
  "summary": "<1-sentence overview of marketing moment opportunities this period>",
  "recommendations": [
    {
      "event_id": null,
      "momentName": "<cultural moment name>",
      "eventType": "<cultural|national|religious|commercial>",
      "relevanceScore": <0-100>,
      "recommendation": "<specific content/campaign recommendation for this brand>",
      "audienceInsight": "<why this moment resonates with Nigerian audience>",
      "contentIdea": "<specific content angle or campaign idea>",
      "bestPlatform": "<Instagram|Twitter|TikTok|Facebook|All>",
      "timing": "<when to publish — days before/after event>",
      "estimatedImpact": "<Low|Medium|High>"
    }
  ],
  "priorityMoment": "<name of highest-value moment this period>",
  "nigerianInsight": "<broader cultural context relevant to ${brand.industry} brands in Nigeria this period>"
}

Include 3-5 recommendations relevant to this brand's industry.`;

  return await callARIAJson(prompt, null, 1024);
}

module.exports = { recommend };
