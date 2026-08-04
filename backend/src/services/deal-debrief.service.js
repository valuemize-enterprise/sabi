// ═══════════════════════════════════════════════════════════════════
// deal-debrief.service.js
// Sabi Intelligence Suite — Phase H
//
// Win/Loss Debrief System — every closed deal becomes institutional
// knowledge. ARIA aggregates debriefs quarterly and surfaces patterns
// in the Pipeline Intelligence panel.
//
// Pitch Archive — searchable library of past decks, tagged by outcome,
// industry, and service type.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const supabase  = require('../config/supabase');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Create a debrief ─────────────────────────────────────────────

const createDebrief = async (userId, opportunityId, payload) => {
  const {
    outcome,            // 'won' | 'lost'
    deciding_factor,    // required
    competitor_name,    // lost only
    pitch_again,        // boolean
    what_worked,        // won only
    what_failed,        // lost only — why we didn't win
    notes,              // free text
  } = payload;

  if (!['won', 'lost'].includes(outcome)) {
    throw Object.assign(new Error('outcome must be won or lost'), { status: 400 });
  }
  if (!deciding_factor) {
    throw Object.assign(new Error('deciding_factor is required'), { status: 400 });
  }

  // Fetch opportunity for context
  let opp = null;
  try {
    const r = await supabase
      .from('opportunities')
      .select('id, company_name, stage, industry, service_scope, deal_type')
      .eq('id', opportunityId)
      .single();
    opp = r.data;
  } catch { /* fall through to not-found */ }

  if (!opp) throw Object.assign(new Error('Opportunity not found'), { status: 404 });

  const { data: debrief, error } = await supabase
    .from('deal_debriefs')
    .insert({
      opportunity_id:  opportunityId,
      outcome,
      deciding_factor,
      competitor_name: competitor_name?.trim() || null,
      pitch_again:     pitch_again ?? null,
      what_worked:     what_worked?.trim()    || null,
      what_failed:     what_failed?.trim()    || null,
      notes:           notes?.trim()          || null,
      debrief_by:      userId,
      created_at:      new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to save debrief: ${error.message}`);
  return { debrief, opportunity: opp };
};

// ── Get debrief by opportunity ────────────────────────────────────

const getDebriefByOpportunity = async (opportunityId) => {
  try {
    const { data, error } = await supabase
      .from('deal_debriefs')
      .select(`
        *,
        debriefer:users!debrief_by ( id, full_name, role )
      `)
      .eq('opportunity_id', opportunityId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
};

// ── Debrief archive (leadership) ──────────────────────────────────

const getDebriefArchive = async ({
  outcome, industry, quarter,
} = {}) => {
  let q = supabase
    .from('deal_debriefs')
    .select(`
      id, outcome, deciding_factor, competitor_name, pitch_again,
      what_worked, what_failed, notes, created_at,
      opportunity:opportunities!opportunity_id (
        id, company_name, industry, service_scope, deal_type, deck_url
      ),
      debriefer:users!debrief_by ( id, full_name )
    `)
    .order('created_at', { ascending: false });

  if (outcome) q = q.eq('outcome', outcome);

  if (quarter) {
    // quarter = 'Q1 2026' → derive date range
    const [q_label, year_str] = quarter.split(' ');
    const year = Number(year_str);
    const q_map = { Q1: [1,3], Q2: [4,6], Q3: [7,9], Q4: [10,12] };
    const [startMonth, endMonth] = q_map[q_label] || [1, 12];
    const startDate = `${year}-${String(startMonth).padStart(2,'0')}-01`;
    const endDate   = new Date(year, endMonth, 0).toISOString().split('T')[0];
    q = q.gte('created_at', startDate).lte('created_at', endDate);
  }

  const { data, error } = await q.limit(100);
  if (error) throw new Error(error.message);

  // If industry filter, do it in JS (industry is on opportunity, not debrief)
  let results = data || [];
  if (industry) {
    results = results.filter(d => d.opportunity?.industry === industry);
  }

  return results;
};

// ── Pitch Archive ─────────────────────────────────────────────────
// All opportunities where deck_url IS NOT NULL — searchable by
// industry, outcome, and service scope.

const getPitchArchive = async ({
  outcome, industry, service_scope, search,
} = {}) => {
  let q = supabase
    .from('opportunities')
    .select(`
      id, company_name, stage, industry, service_scope, deal_type,
      deck_url, created_at, stage_changed_at,
      business_bringer:users!business_bringer_id ( id, full_name )
    `)
    .not('deck_url', 'is', null)
    .neq('deck_url', '')
    .order('created_at', { ascending: false })
    .limit(100);

  // Filter by outcome (won = agreement/onboarded, lost = lost_paused)
  if (outcome === 'won') {
    q = q.in('stage', ['agreement', 'onboarded']);
  } else if (outcome === 'lost') {
    q = q.eq('stage', 'lost_paused');
  }

  if (industry) q = q.eq('industry', industry);
  if (search)   q = q.ilike('company_name', `%${search}%`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let results = data || [];

  // service_scope filter (TEXT[] column)
  if (service_scope) {
    results = results.filter(d =>
      Array.isArray(d.service_scope) && d.service_scope.includes(service_scope)
    );
  }

  // Enrich with outcome label
  return results.map(r => ({
    ...r,
    outcome: ['agreement', 'onboarded'].includes(r.stage)
      ? 'won' : r.stage === 'lost_paused' ? 'lost' : 'in_progress',
  }));
};

// ── ARIA quarterly insights ───────────────────────────────────────
// Generates a structured analysis of all debriefs from the current quarter.

const quarterStart = () => {
  const now   = new Date();
  const month = Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), month, 1).toISOString().split('T')[0];
};

const generateQuarterlyInsights = async () => {
  // Fetch this quarter's debriefs
  const since = quarterStart();
  const { data: debriefs, error } = await supabase
    .from('deal_debriefs')
    .select(`
      outcome, deciding_factor, competitor_name, pitch_again,
      what_worked, what_failed, notes,
      opportunity:opportunities!opportunity_id (
        company_name, industry, service_scope, deal_type
      )
    `)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  if (!debriefs || debriefs.length === 0) {
    return {
      quarter: since.slice(0, 7),
      debrief_count: 0,
      insights: null,
      message: 'Not enough debriefs this quarter for pattern analysis. Submit at least 3 debriefs to generate insights.',
    };
  }

  const won  = debriefs.filter(d => d.outcome === 'won');
  const lost = debriefs.filter(d => d.outcome === 'lost');

  // Build a compact summary for the prompt
  const summary = debriefs.map(d => ({
    outcome:         d.outcome,
    deciding_factor: d.deciding_factor,
    competitor:      d.competitor_name || null,
    what_worked:     d.what_worked,
    what_failed:     d.what_failed,
    industry:        d.opportunity?.industry || null,
    scope:           d.opportunity?.service_scope?.join(', ') || null,
    deal_type:       d.opportunity?.deal_type || null,
  }));

  const prompt = `You are ARIA, Cerebre Media Africa's business intelligence engine.

Analyze these win/loss debriefs from the current quarter and produce actionable insights for the leadership team.

DEBRIEF DATA (${debriefs.length} entries — ${won.length} won, ${lost.length} lost):
${JSON.stringify(summary, null, 2)}

INSTRUCTIONS:
Produce a structured analysis. Return ONLY valid JSON — no preamble, no markdown.

{
  "win_rate": "<X of Y deals won — e.g. '3 of 7'>",
  "win_rate_pct": <number 0-100>,
  "top_win_factors": [
    { "factor": "<what made deals close>", "count": <number>, "insight": "<actionable observation>" }
  ],
  "top_objections": [
    { "objection": "<what caused losses>", "count": <number>, "insight": "<how to address it>" }
  ],
  "competitor_patterns": [
    { "competitor": "<name>", "appearances": <number>, "industries": ["<list>"], "note": "<pattern>" }
  ],
  "industry_performance": [
    { "industry": "<name>", "won": <number>, "lost": <number>, "insight": "<trend>" }
  ],
  "deck_impact": "<observation about whether deck_url was correlated with outcomes>",
  "top_recommendations": [
    "<specific actionable recommendation for next quarter>",
    "<second recommendation>",
    "<third recommendation>"
  ],
  "aria_summary": "<2-3 sentence executive summary of what this quarter's data shows>"
}

Be specific and actionable. Surface patterns, not just counts.
If there are fewer than 5 debriefs, note the limited sample size in aria_summary.`;

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  let insights;
  try {
    const cleaned = rawText.replace(/```json?|```/g, '').trim();
    insights = JSON.parse(cleaned);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    insights = match ? JSON.parse(match[0]) : { aria_summary: rawText };
  }

  return {
    quarter:       since.slice(0, 7),
    debrief_count: debriefs.length,
    won_count:     won.length,
    lost_count:    lost.length,
    insights,
    generated_at:  new Date().toISOString(),
  };
};

// ── Deck URL sync to brand workspace ─────────────────────────────
// Called from the pipeline conversion route when a deal reaches 'agreement'.
// Fetches deck_url from the opportunity and includes it in the brand Brief.

const getDeckUrlForConversion = async (opportunityId) => {
  try {
    const { data } = await supabase
      .from('opportunities')
      .select('deck_url, company_name, notes')
      .eq('id', opportunityId)
      .single();
    return data?.deck_url || null;
  } catch {
    return null;
  }
};

module.exports = {
  createDebrief,
  getDebriefByOpportunity,
  getDebriefArchive,
  getPitchArchive,
  generateQuarterlyInsights,
  getDeckUrlForConversion,
};
