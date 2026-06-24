/**
 * ARIA — Advanced Reporting & Intelligence Analyst
 * Core Service: Base Claude API client for all ARIA features
 * A product of Cerebre Media Africa
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ARIA_MODEL      = process.env.ARIA_MODEL || 'claude-sonnet-4-6';
const ARIA_MAX_TOKENS = parseInt(process.env.ARIA_MAX_TOKENS || '2048');

const ARIA_SYSTEM = `You are ARIA (Advanced Reporting & Intelligence Analyst), the AI engine powering Sabi Intelligence Suite — a premium marketing intelligence platform by Cerebre Media Africa, Lagos, Nigeria.

Your role is to provide sharp, actionable, data-driven marketing intelligence for African brands — with deep understanding of the Nigerian consumer market, cultural context, and business ecosystem.

Your outputs must always be:
- Professional and precise (executive-grade language)
- Grounded in Nigerian market realities (Lagos, Abuja, Port Harcourt, FMCG, fintech, retail, telecoms)
- Specific and actionable, not generic
- Formatted exactly as requested (JSON, narrative, scores, etc.)

You understand Nigerian consumer psychology: Awoof mentality, aspirational consumption, social proof, religious/cultural calendar significance, Lagos hustle culture, and the difference between Tier 1 and Tier 2 city consumer behaviour.`;

/**
 * Core ARIA call
 * @param {string} userPrompt - The task-specific prompt
 * @param {string} [systemOverride] - Optional system message override
 * @param {number} [maxTokens] - Override max tokens
 * @returns {Promise<string>} AI response text
 */
async function callARIA(userPrompt, systemOverride = null, maxTokens = ARIA_MAX_TOKENS) {
  const response = await client.messages.create({
    model:      ARIA_MODEL,
    max_tokens: maxTokens,
    system:     systemOverride || ARIA_SYSTEM,
    messages:   [{ role: 'user', content: userPrompt }],
  });
  return response.content[0]?.text || '';
}

/**
 * Core ARIA call expecting JSON output
 * Returns parsed JSON or throws if parsing fails
 */
async function callARIAJson(userPrompt, systemOverride = null, maxTokens = ARIA_MAX_TOKENS) {
  const jsonSystem = (systemOverride || ARIA_SYSTEM) + '\n\nCRITICAL: Respond ONLY with valid JSON. No preamble, no markdown, no backticks. Raw JSON only.';
  const raw = await callARIA(userPrompt, jsonSystem, maxTokens);
  try {
    return JSON.parse(raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, ''));
  } catch {
    throw new Error(`ARIA returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

/**
 * Multi-turn ARIA conversation (Ask ARIA)
 */
async function callARIAChat(messages, systemOverride = null, maxTokens = ARIA_MAX_TOKENS) {
  const response = await client.messages.create({
    model:      ARIA_MODEL,
    max_tokens: maxTokens,
    system:     systemOverride || ARIA_SYSTEM,
    messages,
  });
  return response.content[0]?.text || '';
}

module.exports = { callARIA, callARIAJson, callARIAChat, ARIA_SYSTEM };
