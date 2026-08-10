// ═══════════════════════════════════════════════════════════════════
// Add to your strategies routes file
// POST /api/agency/strategies/generate
// ═══════════════════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const router   = require('express').Router();
const supabase  = require('../config/supabase');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/generate', async (req, res) => {
  try {
    const {
      brand_id,
      brand_name,
      industry,
      type,
      brief,
      duration,
      goals,
    } = req.body;

    if (!brand_id) return res.status(400).json({ error: 'brand_id is required' });
    if (!type)     return res.status(400).json({ error: 'type is required' });
    if (!brief)    return res.status(400).json({ error: 'brief is required' });

    // ── Compute date range from duration ────────────────────────
    const now        = new Date();
    const start_date = now.toISOString().split('T')[0];
    const end        = new Date(now);
    const months     = Number(duration) || 3;
    end.setMonth(end.getMonth() + months);
    const end_date   = end.toISOString().split('T')[0];

    // ── Build ARIA prompt ───────────────────────────────────────
    const prompt = `You are ARIA, a senior marketing strategist for a 360° digital marketing agency called Cerebre Media Africa.

Generate a complete, professional ${type} strategy for the following brand.

BRAND CONTEXT:
- Brand: ${brand_name || 'The client brand'}
- Industry: ${industry || 'Not specified'}
- Strategy Type: ${type}
- Duration: ${months} months (${start_date} to ${end_date})
- Client Brief: ${brief}
- Goals: ${goals || 'Not specified'}

Generate a structured strategy. Return ONLY valid JSON — no preamble, no markdown, no code fences.

{
  "title": "<concise strategy title>",
  "description": "<2-3 sentence executive summary>",
  "content": {
    "executive_summary": "<paragraph>",
    "situation_analysis": "<current brand situation and market context>",
    "objectives": ["<objective 1>", "<objective 2>", "<objective 3>"],
    "target_audience": "<who this strategy targets>",
    "key_messages": ["<message 1>", "<message 2>", "<message 3>"],
    "channels": ["<channel 1>", "<channel 2>", "<channel 3>"],
    "tactics": [
      { "tactic": "<tactic name>", "description": "<what it involves>", "timeline": "<when>" },
      { "tactic": "<tactic name>", "description": "<what it involves>", "timeline": "<when>" },
      { "tactic": "<tactic name>", "description": "<what it involves>", "timeline": "<when>" }
    ],
    "kpis": ["<KPI 1>", "<KPI 2>", "<KPI 3>"],
    "budget_allocation": "<recommended budget split>",
    "success_metrics": "<how to measure success at end of period>",
    "risks": ["<risk 1>", "<risk 2>"]
  }
}

Be specific to ${brand_name || 'this brand'} and ${industry || 'their industry'}. 
Make it actionable and client-ready.`;

    // ── Call ARIA ───────────────────────────────────────────────
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Parse JSON response
    let generated;
    try {
      const cleaned = rawText.replace(/```json?|```/g, '').trim();
      generated = JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('ARIA returned an unreadable response. Please try again.');
      generated = JSON.parse(match[0]);
    }

    // ── Insert into strategies table ─────────────────────────────
    const { data: strategy, error } = await supabase
      .from('strategies')
      .insert({
        brand_id,
        created_by:  req.user.id,
        title:       generated.title       || `${type} Strategy — ${brand_name}`,
        description: generated.description || brief.slice(0, 300),
        type,
        status:      'draft',
        start_date,
        end_date,
        content:     generated.content     || {},
        client_status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    res.status(201).json({ data: { strategy } });
  } catch (err) {
    console.error('[strategies/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;