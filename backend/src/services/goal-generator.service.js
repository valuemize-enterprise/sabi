/**
 * Goal Generator Service
 * Sabi Intelligence Suite · AI Goal Generator
 *
 * Uses Claude to transform uploaded client documents into structured
 * OKR (Objectives & Key Results) goals, then saves them to brand_goals.
 *
 * Pipeline:
 *   parsed documents → build Claude message → call API → parse JSON
 *   → duplicate check → return for review → save on approval
 */

'use strict';

const { supabase }   = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL   = 'claude-opus-4-6'; // Best model for strategic reasoning

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildSystemPrompt(brandName, existingGoals) {
  const existingSection = existingGoals.length > 0
    ? `\nEXISTING ACTIVE GOALS FOR ${brandName.toUpperCase()} (check for duplicates):\n${
        existingGoals.map((g, i) => `${i + 1}. ${g.objective || g.title}`).join('\n')
      }\n`
    : '';

  return `You are a senior brand strategist at Cerebre Media Africa, a world-class 360° digital marketing agency in Lagos. You are analysing a client document to generate strategic OKR goals.

${existingSection}
FRAMEWORK RULES:
• Default to OKR (Objectives & Key Results) for strategic, quarterly, or brand-growth briefs.
• Use SMART format only for highly tactical, one-off campaign briefs (e.g. "run Black Friday sale Nov 1-30").
• OKR Objective = ambitious, inspiring, qualitative north star (what winning looks like).
• Key Results = 2-5 specific, measurable outcomes that prove the objective was achieved.
• Every Key Result must have a realistic current baseline and an ambitious but achievable target.
• Units should be specific: followers, %, NGN, posts, campaigns, sessions, leads, etc.

CONFIDENCE SCORING (0-100):
• 90-100: Goal explicitly stated in document with specific numbers
• 70-89: Goal clearly implied with some numbers available
• 50-69: Goal inferred from context; numbers are estimated from Nigerian market benchmarks
• Below 50: Speculative — flag it

DUPLICATE DETECTION:
If any generated goal substantially overlaps with an existing active goal listed above, add "is_duplicate_risk": true and "duplicate_of": "<existing goal title>" to that goal.

BRIEF INTELLIGENCE:
Write a 2-sentence "brief_intelligence" that summarises: (1) what this document is and what the client needs, (2) one strategic recommendation for the Brand Admin.

Return ONLY valid JSON — no markdown fences, no explanatory text before or after:

{
  "brief_intelligence": "...",
  "document_type": "brief|strategy_deck|contact_report|pitch|unknown",
  "recommended_quarter": "Q3 2026",
  "goals": [
    {
      "objective": "...",
      "framework": "OKR",
      "quarter": "Q3 2026",
      "confidence_score": 85,
      "source_insight": "One sentence explaining what in the document led to this goal.",
      "is_duplicate_risk": false,
      "duplicate_of": null,
      "key_results": [
        {
          "title": "Grow Instagram following to 50,000",
          "metric": "instagram_followers",
          "current_value": 28000,
          "target_value": 50000,
          "unit": "followers",
          "due_date": "2026-09-30"
        }
      ]
    }
  ]
}

Generate 2-4 objectives with 2-5 key results each. Brand name: ${brandName}.`;
}

// ── Claude API call ───────────────────────────────────────────────────────────
async function callClaude(systemPrompt, contentParts) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is not set.');

  const res = await fetch(ANTHROPIC_API, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 4096,
      system:     systemPrompt,
      messages: [{ role: 'user', content: contentParts }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API error (${res.status}): ${err?.error?.message || 'Unknown error'}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Build Claude content array from parsed documents ──────────────────────────
function buildContentParts(parsedDocs) {
  const parts = [];

  for (const doc of parsedDocs) {
    if (doc.type === 'image') {
      parts.push({
        type:   'image',
        source: { type: 'base64', media_type: doc.mimeType, data: doc.base64 },
      });
      parts.push({ type: 'text', text: `[Image file: ${doc.fileName}]\n\n` });
    } else {
      parts.push({
        type: 'text',
        text: `=== DOCUMENT: ${doc.fileName} ===\n${doc.content}\n\n`,
      });
    }
  }

  parts.push({ type: 'text', text: 'Analyse all documents above and return the JSON goal structure.' });
  return parts;
}

// ── Parse & validate Claude's JSON response ────────────────────────────────────
function parseClaudeResponse(text) {
  // Strip markdown code fences if Claude adds them despite the prompt
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON object from the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI did not return valid JSON. Please try again.');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed.goals) || parsed.goals.length === 0) {
    throw new Error('AI returned no goals. The document may not contain enough strategic content.');
  }

  return parsed;
}

// ── Generate goals from parsed documents ──────────────────────────────────────
async function generateGoals({ brandId, brandName, parsedDocs }) {
  // Fetch existing active goals for duplicate detection
  const { data: existingGoals } = await supabase
    .from('brand_goals')
    .select('id, title, objective')
    .eq('brand_id', brandId)
    .in('status', ['on_track', 'at_risk']);

  const systemPrompt  = buildSystemPrompt(brandName, existingGoals || []);
  const contentParts  = buildContentParts(parsedDocs);
  const rawText       = await callClaude(systemPrompt, contentParts);
  const result        = parseClaudeResponse(rawText);

  // Attach UUIDs to each key result for the review UI
  result.goals = result.goals.map(goal => ({
    ...goal,
    key_results: (goal.key_results || []).map(kr => ({
      ...kr,
      id:     uuidv4(),
      status: 'not_started',
    })),
    selected: true, // default to all selected in the review UI
  }));

  return result;
}

// ── Save approved goals to brand_goals ─────────────────────────────────────────
async function saveGoals({ brandId, goals, sourceDocumentId, callerId }) {
  if (!goals || goals.length === 0) throw new Error('No goals to save.');

  const rows = goals
    .filter(g => g.selected !== false) // respect deselected goals from review UI
    .map(goal => ({
      brand_id:           brandId,
      title:              goal.objective, // title = objective for display compatibility
      objective:          goal.objective,
      framework:          goal.framework || 'OKR',
      key_results:        goal.key_results || [],
      quarter:            goal.quarter,
      confidence_score:   goal.confidence_score,
      source_insight:     goal.source_insight,
      is_ai_generated:    true,
      source_document_id: sourceDocumentId || null,
      status:             'on_track', // trigger will recompute from KRs
      locked:             true,       // require SA permission to edit/delete
      created_by:         callerId,
      last_edited_by:     callerId,
    }));

  const { data, error } = await supabase
    .from('brand_goals')
    .insert(rows)
    .select('*');

  if (error) throw new Error(`Failed to save goals: ${error.message}`);

  // Write to audit log
  for (const goal of data) {
    await supabase.from('goal_audit_log').insert({
      goal_id:        goal.id,
      brand_id:       brandId,
      actor_id:       callerId,
      action:         'ai_generated',
      change_summary: `AI generated from ${sourceDocumentId ? 'uploaded document' : 'unknown source'}`,
      after_state:    goal,
    }).catch(() => {}); // audit failure is non-blocking
  }

  // Update goals_generated count on the source document
  if (sourceDocumentId) {
    await supabase
      .from('goal_source_documents')
      .update({ goals_generated: data.length })
      .eq('id', sourceDocumentId)
      .catch(() => {});
  }

  return data;
}

// ── Update a single key result's current value (VelocityTracker hook) ─────────
async function updateKeyResult({ goalId, krId, currentValue, callerId }) {
  const { data: goal, error: fetchErr } = await supabase
    .from('brand_goals')
    .select('key_results, brand_id')
    .eq('id', goalId)
    .single();

  if (fetchErr || !goal) throw new Error('Goal not found.');

  const updatedKRs = (goal.key_results || []).map(kr =>
    kr.id === krId
      ? { ...kr, current_value: Number(currentValue) }
      : kr
  );

  const { data, error } = await supabase
    .from('brand_goals')
    .update({ key_results: updatedKRs, last_edited_by: callerId })
    .eq('id', goalId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update key result: ${error.message}`);

  // Audit
  await supabase.from('goal_audit_log').insert({
    goal_id:        goalId,
    brand_id:       goal.brand_id,
    actor_id:       callerId,
    action:         'kr_updated',
    change_summary: `Key result progress updated`,
    after_state:    { current_value: currentValue, kr_id: krId },
  }).catch(() => {});

  return data;
}

// ── Get goals for a brand ─────────────────────────────────────────────────────
async function getBrandGoals(brandId) {
  const { data, error } = await supabase
    .from('brand_goals')
    .select(`
      *,
      source_document:goal_source_documents(file_name, document_type),
      creator:users!created_by(full_name)
    `)
    .eq('brand_id', brandId)
    .not('status', 'eq', 'paused')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  generateGoals,
  saveGoals,
  updateKeyResult,
  getBrandGoals,
};
