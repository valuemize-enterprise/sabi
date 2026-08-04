// ═══════════════════════════════════════════════════════════════════
// weekly-report-aria.service.js
// ARIA intelligence layer for the Weekly Intelligence Report
//
// Generates six narrative sections per brand per week:
//   1. Payment & Briefs summary
//   2. Achievements
//   3. To-dos
//   4. Goal Status
//   5. Social & Analytics (optional)
//   6. New Business Pipeline
//
// Also generates the MD-level opening paragraph for the consolidated view.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const weeklyReportService = require('./weekly-report.service');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ARIA_MODEL = 'claude-sonnet-4-6';

// ── Format helpers for the prompt ────────────────────────────────

const fmtNaira = (v) =>
  v != null ? `₦${Number(v).toLocaleString('en-NG')}` : 'Not set';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date';

const STAGE_LABELS = {
  introduction: 'Introduction',
  proposal: 'Proposal',
  pitch: 'Pitch',
  second_pitch: 'Second Pitch',
  decision: 'Decision',
  agreement: 'Agreement',
  onboarded: 'Onboarded',
  lost_paused: 'Lost / Paused',
};

// ── Core generation function ──────────────────────────────────────

/**
 * Generate all six ARIA draft sections for a brand's weekly report.
 *
 * @param {string} brand_name   - Display name of the brand
 * @param {string} ba_name      - Brand Admin's name
 * @param {Object} weekData     - Output of gatherWeekData()
 * @returns {Object} All six aria_draft_* sections
 */
const generateAllDrafts = async (brand_name, ba_name, weekData) => {
  const {
    week_start, tasks_completed, tasks_open,
    invoices_this_week, payments_this_week, overdue_invoices,
    briefs_active, goals, pipeline_notes,
  } = weekData;

  // Build a rich data summary for ARIA
  const context = buildDataContext(brand_name, ba_name, weekData);

  // Run all six sections in parallel to save time
  const [payment, achievements, todos, goals_section, pipeline] = await Promise.all([
    generatePaymentSection(context, weekData),
    generateAchievementsSection(context, weekData),
    generateTodosSection(context, weekData),
    generateGoalsSection(context, weekData),
    generatePipelineSection(context, weekData),
  ]);

  return {
    aria_draft_payment: payment,
    aria_draft_achievements: achievements,
    aria_draft_todos: todos,
    aria_draft_goals: goals_section,
    aria_draft_social: null, // populated separately if social is connected
    aria_draft_pipeline: pipeline,
  };
};

// ── Build shared context string ───────────────────────────────────

const buildDataContext = (brand_name, ba_name, weekData) => {
  const {
    week_start, tasks_completed, tasks_open,
    invoices_this_week, payments_this_week, overdue_invoices,
    briefs_active, goals, pipeline_notes,
  } = weekData;

  const weekLabel = fmtDate(week_start);

  let ctx = `BRAND: ${brand_name}\nBRAND ADMIN: ${ba_name}\nREPORT WEEK: ${weekLabel}\n\n`;

  ctx += `=== TASKS COMPLETED THIS WEEK (${tasks_completed.length}) ===\n`;
  ctx += tasks_completed.length
    ? tasks_completed.map(t => `• ${t.title}${t.description ? ` — ${t.description.slice(0, 120)}` : ''}${t.assigned_to_name ? ` [${t.assigned_to_name}]` : ''}`).join('\n')
    : '• None recorded';

  ctx += `\n\n=== OPEN TASKS / TO-DOS (${tasks_open.length}) ===\n`;
  ctx += tasks_open.length
    ? tasks_open.map(t => `• [${t.status}] ${t.title}${t.due_date ? ` (due ${fmtDate(t.due_date)})` : ''}${t.assigned_to_name ? ` — ${t.assigned_to_name}` : ''}`).join('\n')
    : '• No open tasks';

  ctx += `\n\n=== PAYMENTS RECEIVED THIS WEEK ===\n`;
  ctx += payments_this_week.length
    ? payments_this_week.map(p => `• ${fmtNaira(p.amount)} received${p.invoice_number ? ` for ${p.invoice_number}` : ''}${p.payment_date ? ` on ${fmtDate(p.payment_date)}` : ''}`).join('\n')
    : '• No payments received';

  const totalReceived = payments_this_week.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (totalReceived > 0) ctx += `\nTotal received: ${fmtNaira(totalReceived)}`;

  ctx += `\n\n=== OUTSTANDING / OVERDUE INVOICES ===\n`;
  ctx += overdue_invoices.length
    ? overdue_invoices.map(i => `• ${i.invoice_number}: ${fmtNaira(i.amount)} — due ${fmtDate(i.due_date)} [${i.status}]`).join('\n')
    : '• No overdue invoices';

  ctx += `\n\n=== ACTIVE BRIEFS (${briefs_active.length}) ===\n`;
  ctx += briefs_active.length
    ? briefs_active.map(b => `• [${b.status}] ${b.title}${b.is_bau ? ' (BAU)' : ' (New Project)'}`).join('\n')
    : '• No active briefs';

  ctx += `\n\n=== BRAND GOALS / OKR STATUS (${goals.length}) ===\n`;
  ctx += goals.length
    ? goals.map(g => `• ${g.title}: ${g.progress_pct || 0}%${g.deadline ? ` (deadline: ${fmtDate(g.deadline)})` : ''} [${g.status}]`).join('\n')
    : '• No active goals recorded';

  ctx += `\n\n=== NEW BUSINESS PIPELINE (${pipeline_notes.length} active deals) ===\n`;
  ctx += pipeline_notes.length
    ? pipeline_notes.map(p =>
        `• ${p.company_name} — ${p.deal_title} [${STAGE_LABELS[p.stage] || p.stage}]${p.estimated_value ? ` | ${fmtNaira(p.estimated_value)}` : ''} | ${p.days_in_stage}d in stage${p.weekly_note ? `\n  This week: ${p.weekly_note}` : ' | No note this week'}`
      ).join('\n')
    : '• No active pipeline deals for this Brand Admin';

  return ctx;
};

// ── Section generators ────────────────────────────────────────────

const ARIA_PERSONA = `You are ARIA, the AI intelligence engine for Cerebre Media Africa's Sabi Intelligence Suite.
You write clear, professional, direct weekly report content for Nigeria's top marketing agency.
Your voice is confident and factual — no filler, no corporate fluff. Write concisely.
Use ₦ for Nigerian Naira. Dates in DD Mon YYYY format.
Never include preamble, section headers, or labels — just the content itself.`;

const generatePaymentSection = async (context, weekData) => {
  const { payments_this_week, overdue_invoices, invoices_this_week } = weekData;
  const totalReceived = payments_this_week.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOverdue = overdue_invoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  const prompt = `${ARIA_PERSONA}

Based on this week's data:
${context}

Write the PAYMENT & BRIEFS section for this brand's weekly report. Cover:
1. What was received this week (total ₦ amount, number of payments)
2. Outstanding invoices or overdue amounts (if any) and follow-up needed
3. Any new invoices raised this week
4. Brief status summary (how many active briefs, anything awaiting client feedback)

Format as 2–4 short, factual bullet points. Each bullet on a new line starting with "•".
If nothing happened on a line item, skip it — don't write "• Nothing to report."`;

  const res = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0]?.text?.trim() || '';
};

const generateAchievementsSection = async (context, weekData) => {
  const { tasks_completed } = weekData;

  if (!tasks_completed.length) {
    return '• No verified tasks recorded for this brand this week.';
  }

  const prompt = `${ARIA_PERSONA}

Based on this week's data:
${context}

Write the ACHIEVEMENTS section for this brand's weekly report.
List what was accomplished this week, based on the completed tasks.
Group related items together if helpful. Focus on outcomes, not just activities.
3–6 bullet points maximum. Start each with "•".
Write in past tense. Be specific — name what was delivered, not just that work was done.`;

  const res = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0]?.text?.trim() || '';
};

const generateTodosSection = async (context, weekData) => {
  const { tasks_open, briefs_active } = weekData;

  if (!tasks_open.length && !briefs_active.length) {
    return '• No open tasks or pending briefs recorded.';
  }

  const prompt = `${ARIA_PERSONA}

Based on this week's data:
${context}

Write the TO-DOS & NEXT STEPS section for this brand's weekly report.
This is what needs to happen next week:
- List priority open tasks (most urgent / overdue first)
- Flag any briefs awaiting client feedback
- Note any follow-ups required on invoices or outstanding items
- Maximum 5 bullet points. Start each with "•".
- If there's a due date, include it.`;

  const res = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0]?.text?.trim() || '';
};

const generateGoalsSection = async (context, weekData) => {
  const { goals } = weekData;

  if (!goals.length) {
    return '• No brand goals recorded in Sabi for this brand.';
  }

  const prompt = `${ARIA_PERSONA}

Based on this week's data:
${context}

Write the GOAL STATUS section for this brand's weekly report.
For each active goal:
- State the goal name, current progress %, and any change
- Flag goals that are at risk (low progress relative to deadline)
- Note any goals completed or nearly complete
Maximum 4 bullet points. Start each with "•".
If progress data is missing for a goal, note it as "progress not yet updated."`;

  const res = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0]?.text?.trim() || '';
};

const generatePipelineSection = async (context, weekData) => {
  const { pipeline_notes } = weekData;

  if (!pipeline_notes.length) {
    return null; // No pipeline section if BA has no deals
  }

  const prompt = `${ARIA_PERSONA}

Based on this week's data:
${context}

Write the NEW BUSINESS PIPELINE section for this Brand Admin's weekly report.
Cover:
- Each active deal: stage, estimated value if known, what happened this week
- Flag any deals that are stale (14+ days in one stage with no movement)
- Note any expected closures or upcoming pitches
- Be brief: 1 sentence per deal. Maximum 5 bullet points total. Start each with "•".
If a deal has no note this week, write "No update logged this week."`;

  const res = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0]?.text?.trim() || '';
};

// ── MD opening paragraph ──────────────────────────────────────────

/**
 * Generates ARIA's cross-brand intelligence paragraph for the MD's
 * consolidated Friday view.
 *
 * @param {string} week_start
 * @param {Array}  entries        - All submitted entries from getConsolidatedView()
 * @param {Object} submissionSummary - { total, submitted, draft, not_started }
 * @param {Object} pipelineAnalytics - from pipeline service (optional)
 */
const generateMDOpeningParagraph = async (week_start, entries, submissionSummary, pipelineAnalytics = null) => {
  const weekLabel = weeklyReportService.formatDate(week_start);

  // Summarise payment data across all submitted entries
  const submittedEntries = entries.filter(e => e.is_submitted);
  const brandSummaries = submittedEntries.map(e =>
    `${e.brand_name} (${e.brand_admin_name}): ${e.edited_payment || e.aria_draft_payment || 'No payment data'}`
  ).join('\n');

  const achievementSummaries = submittedEntries.slice(0, 5).map(e =>
    `${e.brand_name}: ${(e.edited_achievements || e.aria_draft_achievements || '').slice(0, 200)}`
  ).join('\n');

  const flaggedComments = entries.reduce((sum, e) => sum + Number(e.flagged_count || 0), 0);

  const prompt = `${ARIA_PERSONA}

You are writing the OPENING INTELLIGENCE PARAGRAPH for the MD's weekly consolidated report.
Week: ${weekLabel}
Submission status: ${submissionSummary.submitted} of ${submissionSummary.total} brands submitted (${submissionSummary.not_started} not yet started, ${submissionSummary.draft} in draft).
${flaggedComments > 0 ? `${flaggedComments} section(s) have been flagged for discussion at the meeting.` : ''}

BRAND PAYMENT SUMMARIES:
${brandSummaries || 'No payment data available yet.'}

ACHIEVEMENT HIGHLIGHTS:
${achievementSummaries || 'Reports not yet submitted.'}

${pipelineAnalytics ? `PIPELINE: ${pipelineAnalytics.active_count} active deals, ₦${Number(pipelineAnalytics.total_pipeline_value).toLocaleString()} total pipeline value.` : ''}

Write a single opening paragraph (4–6 sentences) that:
1. States this week's overall picture (payments, delivery, notable items)
2. Names anything that needs the MD's attention before the meeting
3. Notes the submission status briefly if any are missing
4. Closes with a forward-looking statement if relevant

Write it as ARIA — confident, direct intelligence briefing. No preamble. No "Here is the paragraph:" — just the paragraph itself.`;

  const res = await client.messages.create({
    model: ARIA_MODEL,
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  });

  return res.content[0]?.text?.trim() || '';
};

module.exports = {
  generateAllDrafts,
  generateMDOpeningParagraph,
};
