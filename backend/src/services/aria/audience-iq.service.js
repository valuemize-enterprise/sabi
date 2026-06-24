/**
 * AudienceIQ™ Service — NEW FEATURE
 * AI-powered Nigerian consumer audience profiling and psychographic segmentation
 * Deep understanding of Nigerian consumer psychology built in
 */

'use strict';

const { callARIAJson } = require('./aria.service');

async function generate({ brand, profile_name, segment_type, demographics, behaviourals, psychoInput, nigerianCtx }) {
  const prompt = `You are AudienceIQ™, building a deep Nigerian consumer audience profile for a brand strategy team.

BRAND: ${brand.name} (${brand.industry} industry)
PROFILE NAME: ${profile_name}
SEGMENT TYPE: ${segment_type}

DEMOGRAPHIC INPUT:
${JSON.stringify(demographics, null, 2)}

BEHAVIOURAL INPUT:
${JSON.stringify(behaviourals, null, 2)}

PSYCHOGRAPHIC INPUT:
${JSON.stringify(psychoInput, null, 2)}

ADDITIONAL NIGERIAN CONTEXT:
${JSON.stringify(nigerianCtx, null, 2)}

Build a comprehensive Nigerian consumer audience profile. Your analysis must reflect:
- Nigerian consumer psychology (Awoof mentality, aspirational consumption, social proof, status signalling)
- Tier 1 vs Tier 2 city dynamics (Lagos/Abuja vs Ibadan/Enugu/PHC)
- Religious and cultural influences (Ramadan spending, Christmas/Easter behaviour)
- Mobile-first digital behaviour in Nigeria
- The role of WhatsApp, Instagram, TikTok, and Twitter in this audience's life
- Economic sensitivity and value-consciousness in the current Nigerian economy

Respond with this exact JSON:
{
  "psychographics": {
    "core_values": ["<value 1>", "<value 2>", "<value 3>"],
    "lifestyle_descriptors": ["<descriptor 1>", "<descriptor 2>", "<descriptor 3>"],
    "motivations": ["<motivation 1>", "<motivation 2>", "<motivation 3>"],
    "frustrations": ["<frustration 1>", "<frustration 2>", "<frustration 3>"],
    "aspirations": ["<aspiration 1>", "<aspiration 2>", "<aspiration 3>"],
    "decision_drivers": ["<driver 1>", "<driver 2>", "<driver 3>"],
    "brand_personality_fit": "<how this audience relates to the brand personality>",
    "content_preferences": ["<format 1>", "<format 2>", "<format 3>"]
  },
  "nigerian_context": {
    "consumer_archetype": "<Nigerian consumer archetype name>",
    "awoof_sensitivity": "<Low|Medium|High — sensitivity to deals/discounts>",
    "status_motivation": "<Low|Medium|High — importance of social signalling>",
    "religious_cultural_influence": "<key religious/cultural factors affecting buying>",
    "economic_sensitivity": "<how current naira/inflation affects this segment>",
    "digital_behaviour": "<primary platforms, peak usage times, content types>",
    "influence_channels": ["<channel 1>", "<channel 2>", "<channel 3>"],
    "trust_signals": ["<what makes them trust a brand>", "<signal 2>"],
    "geographic_nuance": "<Lagos vs other cities behaviour differences>",
    "language_preference": "<English/Pidgin/Yoruba/Igbo/Hausa usage patterns>"
  },
  "ai_insights": "<3-4 sentence strategic insight paragraph about this audience segment in the Nigerian context — sharp, specific, actionable>",
  "ai_strategy": "<3-4 sentence recommended marketing strategy for reaching and converting this audience segment — platform-specific, tone-specific, culturally grounded>"
}`;

  return await callARIAJson(prompt, null, 2048);
}

module.exports = { generate };
