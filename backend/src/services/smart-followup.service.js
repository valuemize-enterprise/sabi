// ═══════════════════════════════════════════════════════════════════
// smart-followup.service.js
// Sabi Intelligence Suite — Phase G
//
// When a deal has been in its current stage longer than the historical
// average, ARIA generates a personalized follow-up draft in 3 formats:
//   • Professional email (3-4 sentences + subject line)
//   • WhatsApp message (1-2 sentences, casual)
//   • LinkedIn DM (2-3 sentences, professional)
//
// The draft is specific to the company, contact, stage, and what's
// been discussed — not a generic template.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const supabase  = require('../config/supabase');
const { STALENESS_DAYS, STAGE_WEIGHTS } = require('./revenue-waterfall.service');

const client     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ARIA_MODEL = 'claude-sonnet-4-6';

// ── Stage labels for the prompt ───────────────────────────────────
const STAGE_LABELS = {
  introduction: 'Introduction',
  proposal:     'Proposal',
  pitch:        'Pitch',
  second_pitch: 'Second Pitch',
  decision:     'Decision',
};

// ── Tone guidance by stage ────────────────────────────────────────
const STAGE_TONE = {
  introduction: 'warm and curious — you are re-connecting after initial contact. Keep it brief. Ask if they have had time to think.',
  proposal:     'helpful and progress-focused — check whether they have reviewed the deck/brief yet and offer to walk them through it.',
  pitch:        'confident and value-focused — reference what was presented, ask for their reaction, and invite their questions.',
  second_pitch: 'collaborative — they have seen the pitch, now you want to understand their questions and tailor the solution further.',
  decision:     'reassuring and deadline-aware — they are weighing their options. Acknowledge that, reinforce Cerebre\'s fit, and gently nudge for a decision timeline.',
};

// ── Fetch full opportunity context ────────────────────────────────
const fetchOpportunity = async (opportunityId) => {
  const { data: opp, error } = await supabase
    .from('opportunities')
    .select(`
      id, company_name, deal_title, stage, stage_changed_at,
      contact_name, contact_position, contact_email, contact_phone,
      deal_type, service_scope, industry, notes, deck_url,
      retainer_monthly_amount, retainer_duration_months,
      campaign_name, campaign_goals,
      business_bringer:users!business_bringer_id ( id, full_name, email, role ),
      account_manager:users!account_manager_id   ( id, full_name, email )
    `)
    .eq('id', opportunityId)
    .single();

  if (error || !opp) throw new Error('Opportunity not found');
  return opp;
};

// ── Last weekly note ──────────────────────────────────────────────
const fetchLastNote = async (opportunityId) => {
  try {
    const { data } = await supabase
      .from('opportunity_weekly_notes')
      .select('note, created_at')
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data?.note || null;
  } catch {
    return null;
  }
};

// ── Days in current stage ─────────────────────────────────────────
const daysInStage = (opp) => {
  if (!opp.stage_changed_at) return null;
  return Math.floor((Date.now() - new Date(opp.stage_changed_at).getTime()) / 86400000);
};

// ── Build ARIA prompt ─────────────────────────────────────────────
const buildPrompt = (opp, lastNote, days) => {
  const stageTone    = STAGE_TONE[opp.stage] || 'professional and helpful';
  const stageLabel   = STAGE_LABELS[opp.stage] || opp.stage;
  const contactLine  = opp.contact_name
    ? `${opp.contact_name}${opp.contact_position ? `, ${opp.contact_position}` : ''}`
    : 'their team';
  const scopeStr     = opp.service_scope?.length
    ? opp.service_scope.join(', ')
    : 'marketing services';
  const industryStr  = opp.industry
    ? opp.industry.replace(/_/g, ' ')
    : null;
  const valueHint    = opp.deal_type === 'retainer' && opp.retainer_monthly_amount
    ? `a retainer arrangement at ₦${Number(opp.retainer_monthly_amount).toLocaleString('en-NG')}/month`
    : opp.deal_type === 'campaign' && opp.campaign_name
    ? `a campaign (${opp.campaign_name})`
    : 'their marketing requirements';

  const context = [
    `Company: ${opp.company_name}`,
    `Contact: ${contactLine}`,
    `Stage: ${stageLabel} (${days ?? '?'} days in this stage)`,
    `Deal type: ${opp.deal_type || 'Not specified'}`,
    `Service scope: ${scopeStr}`,
    industryStr ? `Industry: ${industryStr}` : null,
    `Proposal: ${valueHint}`,
    lastNote ? `Last note logged: "${lastNote}"` : 'No notes logged yet',
    opp.notes ? `Background: ${opp.notes.slice(0, 300)}` : null,
  ].filter(Boolean).join('\n');

  return `You are ARIA, Cerebre Media Africa's business development intelligence engine.
Cerebre Media Africa is a 360° digital marketing agency based in Lagos, Nigeria.

Generate a personalized, specific follow-up message for a business development deal that has gone quiet.

DEAL CONTEXT:
${context}

TONE GUIDANCE FOR THIS STAGE:
${stageTone}

Generate three follow-up message variants. Return ONLY valid JSON — no preamble, no code block, no explanation.
The JSON must exactly match this structure:

{
  "email": {
    "subject": "[Subject line — concise and relevant]",
    "body": "[3-4 sentence professional email body. Do NOT include a salutation or sign-off — start directly with the message content.]"
  },
  "whatsapp": "[1-2 sentence casual WhatsApp message. Include the contact's first name if available. Keep it conversational — like a message from someone they know.]",
  "linkedin": "[2-3 sentence professional LinkedIn DM. Reference what Cerebre can do for them specifically. Professional but not stiff.]"
}

Important:
- Be specific to ${opp.company_name} and what Cerebre is offering them
- Do NOT be pushy or desperate — let the value speak
- Reference the industry (${industryStr || 'their industry'}) where relevant
- Never mention internal pipeline stages or Sabi
- Keep every format appropriately brief
- Each message should feel written for a human, not generated by a system`;
};

// ── Parse ARIA JSON response ──────────────────────────────────────
const parseDraftResponse = (rawText) => {
  try {
    // Strip code fences if present
    const cleaned = rawText.replace(/```json?|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback parsing — try to extract JSON from the response
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error('ARIA returned non-JSON response');
  }
};

// ── Main generation function ──────────────────────────────────────

/**
 * Generate personalized follow-up drafts for a specific opportunity.
 *
 * @param {string} opportunityId - UUID of the opportunity
 * @returns {{ email: {subject, body}, whatsapp: string, linkedin: string,
 *             opportunity_context: object, is_stale: boolean, days_in_stage: number }}
 */
const generateFollowUpDraft = async (opportunityId) => {
  const [opp, lastNote] = await Promise.all([
    fetchOpportunity(opportunityId),
    fetchLastNote(opportunityId),
  ]);

  const days      = daysInStage(opp);
  const threshold = STALENESS_DAYS[opp.stage];
  const isStale   = threshold != null && days != null && days >= threshold;

  // Build prompt and call ARIA
  const prompt = buildPrompt(opp, lastNote, days);

  const response = await client.messages.create({
    model:      ARIA_MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const drafts = parseDraftResponse(rawText);

  return {
    drafts: {
      email:    drafts.email    || null,
      whatsapp: drafts.whatsapp || null,
      linkedin: drafts.linkedin || null,
    },
    opportunity_context: {
      company_name:  opp.company_name,
      contact_name:  opp.contact_name,
      stage:         opp.stage,
      days_in_stage: days,
      threshold,
    },
    is_stale:      isStale,
    days_in_stage: days,
    generated_at:  new Date().toISOString(),
  };
};

/**
 * Returns whether a given opportunity qualifies as stale.
 * Lightweight check — no ARIA call.
 */
const checkStaleness = async (opportunityId) => {
  const opp = await fetchOpportunity(opportunityId);
  const days = daysInStage(opp);
  const threshold = STALENESS_DAYS[opp.stage];

  return {
    opportunity_id: opp.id,
    company_name:   opp.company_name,
    stage:          opp.stage,
    days_in_stage:  days,
    threshold,
    is_stale:       threshold != null && days != null && days >= threshold,
    has_contact:    !!opp.contact_name,
  };
};

module.exports = {
  generateFollowUpDraft,
  checkStaleness,
};
