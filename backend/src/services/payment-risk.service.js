/**
 * Payment Risk Service — Sabi Finance Phase 2
 *
 * Uses ARIA (Claude) to analyse each brand's payment history and
 * assign a risk level: low / medium / high.
 *
 * Risk factors:
 *   - How often does the client pay on time vs late?
 *   - What is the average delay in days?
 *   - What is the worst single delay?
 *   - Is the trend improving or worsening?
 *
 * Output stored in brand_payment_risk. Visible:
 *   - On the finance portal Brands tab (coloured badge)
 *   - In the Command Center financial dial (informs the dial state)
 *   - In ARIA weekly finance digest
 */

'use strict';

const { supabase } = require('../config/supabase');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL  = 'claude-sonnet-4-6'; // Sonnet is fast enough for this analysis

// ── Compute raw payment stats for a brand ────────────────────────────────────
async function computePaymentStats(brandId) {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, type, total_amount, due_date, paid_date, status, amount_paid')
    .eq('brand_id', brandId)
    .in('status', ['paid', 'partial', 'sent', 'viewed', 'overdue'])
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);
  if (!invoices?.length) return null;

  const paid    = invoices.filter(i => i.status === 'paid' && i.paid_date);
  const today   = new Date();
  const overdue = invoices.filter(i => ['sent','viewed','overdue'].includes(i.status) && new Date(i.due_date) < today);

  let timesOnTime = 0, timesLate = 0, totalDaysLate = 0, largestDelay = 0;

  for (const inv of paid) {
    const due  = new Date(inv.due_date);
    const paidAt = new Date(inv.paid_date);
    const daysDiff = Math.floor((paidAt.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 0) {
      timesOnTime++;
    } else {
      timesLate++;
      totalDaysLate += daysDiff;
      if (daysDiff > largestDelay) largestDelay = daysDiff;
    }
  }

  const totalPaid  = paid.length;
  const avgDaysLate = timesLate > 0 ? Math.round((totalDaysLate / timesLate) * 10) / 10 : 0;
  const totalPaidAmount = invoices.reduce((s, i) => s + Number(i.amount_paid), 0);

  return {
    total_invoices:   invoices.length,
    total_paid:       totalPaid,
    times_on_time:    timesOnTime,
    times_late:       timesLate,
    avg_days_late:    avgDaysLate,
    largest_delay:    largestDelay,
    currently_overdue: overdue.length,
    total_paid_amount: totalPaidAmount,
    payment_rate:     invoices.length > 0 ? (totalPaid / invoices.length) : 1,
    recent_invoices:  paid.slice(-5).map(i => ({
      number: i.invoice_number,
      due:    i.due_date,
      paid:   i.paid_date,
      days_late: Math.max(0, Math.floor((new Date(i.paid_date).getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24))),
    })),
  };
}

// ── Rule-based risk score (no AI needed for the score itself) ─────────────────
function computeRiskScore(stats) {
  if (!stats || stats.total_invoices < 1) return { score: 50, level: 'unknown' };

  let score = 100;

  // Penalise for late payments
  if (stats.times_late > 0) {
    const lateRate = stats.times_late / (stats.times_on_time + stats.times_late);
    score -= Math.round(lateRate * 40);    // up to -40 for always late
    score -= Math.min(stats.avg_days_late * 0.5, 20); // up to -20 for avg delay
    score -= Math.min(stats.largest_delay * 0.2, 15); // up to -15 for worst delay
  }

  // Penalise for currently overdue
  score -= stats.currently_overdue * 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const level = score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';
  return { score, level };
}

// ── ARIA narrative for the risk score ────────────────────────────────────────
async function getAriaNarrative(brandName, stats, riskLevel) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return 'Payment history analysis unavailable — ANTHROPIC_API_KEY not set.';

  const prompt = `You are a financial analyst at Cerebre Media Africa, a Lagos-based marketing agency.

Analyse this client's payment history and write a 2-sentence summary for the accountant.
Be direct, factual, and practical. Do not use any asterisks, markdown, or bullet points.
The first sentence states the payment pattern clearly. The second recommends one specific action.

Client: ${brandName}
Risk level: ${riskLevel}
Total invoices: ${stats.total_invoices}
Paid on time: ${stats.times_on_time}
Paid late: ${stats.times_late}
Average days late: ${stats.avg_days_late}
Worst delay: ${stats.largest_delay} days
Currently overdue invoices: ${stats.currently_overdue}
Last 5 payments: ${JSON.stringify(stats.recent_invoices)}

Write the 2-sentence summary now:`;

  try {
    const res  = await fetch(ANTHROPIC_API, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 200,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    return data.content?.[0]?.text?.trim() || 'Unable to generate narrative.';
  } catch (err) {
    console.error('[payment-risk] ARIA narrative failed:', err.message);
    return 'Payment history analysis temporarily unavailable.';
  }
}

// ── Score a single brand ──────────────────────────────────────────────────────
async function scoreBrand(brandId) {
  const { data: brand } = await supabase
    .from('brands').select('id, name').eq('id', brandId).single();

  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 });

  const stats = await computePaymentStats(brandId);

  if (!stats || stats.total_invoices < 2) {
    // Not enough history to score meaningfully
    await supabase.from('brand_payment_risk').upsert({
      brand_id:       brandId,
      risk_level:     'unknown',
      risk_score:     null,
      aria_summary:   'Not enough payment history to assess risk. Score will update after at least 2 invoices are paid.',
      computed_at:    new Date().toISOString(),
    }, { onConflict: 'brand_id' });

    return { brand_id: brandId, risk_level: 'unknown', risk_score: null };
  }

  const { score, level } = computeRiskScore(stats);
  const narrative        = await getAriaNarrative(brand.name, stats, level);

  const { data, error } = await supabase.from('brand_payment_risk').upsert({
    brand_id:        brandId,
    risk_level:      level,
    risk_score:      score,
    avg_days_to_pay: stats.avg_days_late,
    times_on_time:   stats.times_on_time,
    times_late:      stats.times_late,
    largest_delay:   stats.largest_delay,
    total_paid:      stats.total_paid_amount,
    aria_summary:    narrative,
    computed_at:     new Date().toISOString(),
  }, { onConflict: 'brand_id' }).select('*').single();

  if (error) throw new Error(error.message);
  return data;
}

// ── Score all active brands (for scheduled sweep) ─────────────────────────────
async function scoreAllBrands() {
  const { data: brands } = await supabase
    .from('brands').select('id').eq('status', 'active');

  const results = [];
  for (const brand of brands || []) {
    try {
      const r = await scoreBrand(brand.id);
      results.push({ brand_id: brand.id, ...r });
    } catch (err) {
      results.push({ brand_id: brand.id, error: err.message });
    }
    // Small delay to avoid hitting Claude rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  return results;
}

// ── Get stored risk scores for all brands ─────────────────────────────────────
async function getAllRiskScores() {
  const { data, error } = await supabase
    .from('brand_payment_risk')
    .select('*, brand:brands(id, name)')
    .order('risk_score', { ascending: true }); // highest risk first (lowest score)

  if (error) throw new Error(error.message);
  return data || [];
}

// ── Get risk score for a single brand ─────────────────────────────────────────
async function getBrandRisk(brandId) {
  const { data } = await supabase
    .from('brand_payment_risk')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  return data || null;
}

module.exports = {
  scoreBrand,
  scoreAllBrands,
  getAllRiskScores,
  getBrandRisk,
};
