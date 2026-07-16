/**
 * ARIA Strategy Service
 * Uses Claude to generate digital marketing strategies and analyse social reports.
 */
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

// ── Strategy generation ───────────────────────────────────────
async function generateStrategy({ brandName, industry, goals, type, brief, duration }) {
  const prompt = `
You are a senior strategist at a world-class 360° digital marketing agency in Nigeria (Cerebre Media Africa).

Generate a comprehensive ${type || 'digital marketing'} strategy for the following brand:
- Brand: ${brandName}
- Industry: ${industry}
- Goals: ${goals || 'Increase brand awareness, grow social media following, generate leads'}
- Duration: ${duration || '3 months'}
${brief ? `- Brief/Context: ${brief}` : ''}

Create a strategy in the following EXACT JSON format (respond with JSON only, no markdown):
{
  "title": "Strategy title",
  "executive_summary": "2-3 sentences describing the strategy",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "target_audience": {
    "primary": "Primary audience description",
    "secondary": "Secondary audience description",
    "psychographics": "Key motivations, pain points, aspirations"
  },
  "key_messages": ["message 1", "message 2", "message 3"],
  "channels": [
    {"name": "Instagram", "role": "Role in strategy", "content_type": "Content types", "frequency": "Posting frequency"}
  ],
  "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "tactics": [
    {"tactic": "Tactic name", "description": "What it involves", "channel": "Channel", "timeline": "When"}
  ],
  "kpis": [
    {"metric": "Metric name", "target": "Target value", "timeframe": "Timeframe"}
  ],
  "budget_allocation": [
    {"category": "Category", "percentage": 30, "description": "What it covers"}
  ],
  "timeline": [
    {"phase": "Phase 1 - Foundation", "duration": "Week 1-2", "activities": ["activity 1", "activity 2"]}
  ],
  "success_criteria": "How we measure overall campaign success",
  "risks": ["Risk 1", "Risk 2"],
  "nigerian_market_notes": "Specific considerations for the Nigerian market context"
}
`;

  const message = await client.messages.create({
    model: MODEL, max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { title: 'Generated Strategy', executive_summary: text, raw: true };
  }
}

// ── Generate tasks from a strategy ───────────────────────────
async function generateTasksFromStrategy({ strategy, brandName, staffList }) {
  const staffDesc = staffList?.length
    ? `Team available: ${staffList.map(s => `${s.full_name} (${s.role_on_brand || s.role})`).join(', ')}`
    : '';

  const prompt = `
You are a project manager at a digital marketing agency.

Based on this marketing strategy for ${brandName}:
${JSON.stringify(strategy, null, 2)}

${staffDesc}

Generate a practical task list to implement this strategy. Respond in JSON only:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done and why",
      "category": "One of: strategy, content_copy, design, social_media, analytics, video, ads, seo, community, client_comms, other",
      "priority": "One of: low, medium, high, urgent",
      "estimated_hours": 2.5,
      "suggested_role": "Which role should own this task (e.g. copywriter, graphic_designer)",
      "phase": "Phase number (1, 2, 3)",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Create 8-15 practical, specific tasks. Be realistic about hours. Cover all key tactics.
`;

  const message = await client.messages.create({
    model: MODEL, max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text    = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return parsed.tasks ?? [];
  } catch {
    return [];
  }
}

// ── Social report analysis ────────────────────────────────────
async function analyseSocialReport({ platform, reportText, brandName, period }) {
  const prompt = `
You are a data analyst at a digital marketing agency specialising in Nigerian and African markets.

Analyse the following ${platform} report for ${brandName} (${period || 'recent period'}):

---
${reportText}
---

Extract all metrics and generate insights. Respond in JSON only:
{
  "metrics": {
    "followers": {"value": null, "change": null, "change_pct": null},
    "reach": {"value": null, "change": null, "change_pct": null},
    "impressions": {"value": null, "change": null, "change_pct": null},
    "engagement_rate": {"value": null, "change": null},
    "posts_published": {"value": null},
    "top_performing_content": "Description of best content",
    "worst_performing_content": "Description of worst content"
  },
  "summary": "2-3 sentence plain-English summary of performance",
  "highlights": ["Key positive 1", "Key positive 2"],
  "concerns": ["Area for improvement 1", "Area for improvement 2"],
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2", "Actionable recommendation 3"],
  "client_narrative": "A professional 2-paragraph narrative suitable for a client report, written in the tone of a senior marketing strategist",
  "performance_grade": "A, B, C, D or F",
  "performance_label": "Exceptional / Strong / Average / Below Average / Poor"
}
`;

  const message = await client.messages.create({
    model: MODEL, max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text    = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return { summary: text, raw: true };
  }
}

// ── Brief → strategy brief extraction ────────────────────────
async function extractBriefInsights({ title, description, briefType }) {
  const prompt = `
A client has submitted the following brief to their marketing agency:
Title: ${title}
Type: ${briefType}
Description: ${description}

Extract key information and respond in JSON only:
{
  "core_objective": "The single most important thing the client wants",
  "target_audience": "Who this is for",
  "key_deliverables": ["deliverable 1", "deliverable 2"],
  "suggested_channels": ["channel 1", "channel 2"],
  "complexity": "simple / medium / complex",
  "estimated_timeline": "e.g. 2 weeks, 1 month",
  "questions_to_ask": ["Clarification question 1", "Clarification question 2"],
  "recommended_team_roles": ["Account Manager", "Copywriter"],
  "suggested_strategy_type": "campaign / content / social_media / etc."
}
`;

  const message = await client.messages.create({
    model: MODEL, max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text    = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try { return JSON.parse(cleaned); }
  catch { return {}; }
}

// ── Weekly Pulse executive summary ────────────────────────────
async function generateWeeklyPulse(pulseData) {
  const panels = pulseData.panels;
  const clientBrands = panels.clientReview.brands ?? panels.clientReview;
  const goalAdmins = panels.goalAlignment.admins ?? panels.goalAlignment;

  const prompt = `
You are writing a weekly executive summary for the Managing Director of Cerebre Media Africa,
a digital marketing agency in Lagos, Nigeria. Base this ONLY on the data provided — do not invent numbers.

DATA FOR THE WEEK OF ${pulseData.weekStart}:

Financials:
- Expected this month: ₦${panels.pnl.expected.toLocaleString()}
- Collected this month: ₦${panels.pnl.collected.toLocaleString()}
- Overdue invoices: ${panels.pnl.overdueCount} totalling ₦${panels.pnl.overdueTotal.toLocaleString()}

Staff Activity:
- ${panels.activeStaff.activeCount} of ${panels.activeStaff.totalStaff} staff logged work this week
- ${panels.activeStaff.zeroActivity.length} staff had zero logged activity: ${panels.activeStaff.zeroActivity.map(s=>s.full_name).join(', ') || 'none'}

Achievements This Week (vs last week):
- Tasks verified: ${panels.achievements.thisWeek.tasksVerified} (${panels.achievements.deltas.tasksVerified >= 0 ? '+' : ''}${panels.achievements.deltas.tasksVerified})
- Briefs resolved: ${panels.achievements.thisWeek.briefsResolved} (${panels.achievements.deltas.briefsResolved >= 0 ? '+' : ''}${panels.achievements.deltas.briefsResolved})
- Strategies approved: ${panels.achievements.thisWeek.strategiesApproved} (${panels.achievements.deltas.strategiesApproved >= 0 ? '+' : ''}${panels.achievements.deltas.strategiesApproved})

Client Health (${clientBrands.length} active brands):
${clientBrands.map(c => `- ${c.brand_name}: satisfaction ${c.satisfaction?.toFixed(1) ?? 'no rating'}/5, ${c.openBriefs} open briefs, ${c.overdueTasks} overdue tasks`).join('\n')}

Challenges Flagged (${panels.challenges.totalFlags} total):
- Goals at risk: ${panels.challenges.goalsAtRisk.length}
- Briefs unanswered 3+ days: ${panels.challenges.unansweredBriefs.length}
- Overdue tasks: ${panels.challenges.overdueTasks.length}
- Tasks awaiting verification too long: ${panels.challenges.staleVerifications.length}
- Client satisfaction drops: ${panels.challenges.satisfactionDrops.length}

Brand Admin Goal Alignment:
${goalAdmins.map(g => `- ${g.staff_name} (${g.brand_name}): ${g.onTrackPct ?? 'n/a'}% goals on track, rolling score ${g.rollingScore ?? 'n/a'}`).join('\n')}

Write a concise executive summary in this EXACT JSON format (respond with JSON only):
{
  "headline": "One sentence capturing the week's overall state",
  "went_well": ["specific point 1", "specific point 2", "specific point 3"],
  "needs_attention": ["specific concern 1", "specific concern 2"],
  "recommended_actions": ["specific action 1", "specific action 2", "specific action 3"],
  "closing_note": "1-2 sentence forward-looking statement"
}

Be direct and specific — name brands and numbers where relevant. Do not pad with generic praise. If something is concerning, say so plainly.
`;

  const message = await client.messages.create({
    model: MODEL, max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
  const cleaned = text.replace(/```json|```/g, '').trim();

  try { return JSON.parse(cleaned); }
  catch { return { headline: text, raw: true }; }
}

module.exports = {
  generateStrategy,
  generateTasksFromStrategy,
  analyseSocialReport,
  extractBriefInsights,
  generateWeeklyPulse,
};
