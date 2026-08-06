// ═══════════════════════════════════════════════════════════════════
// revenue-waterfall.service.js
// Sabi Intelligence Suite — Phase G
//
// Computes a 6-month forward revenue forecast broken into three layers:
//   Confirmed  — agreement + onboarded stage (≥95% probability)
//   Probable   — decision stage (70%)
//   Possible   — pitch + second_pitch stage (30%)
//
// Each deal lands in the month when it's expected to start generating
// revenue — so a retainer starting in September shows up in September,
// not spread across the year. The chart overlays a target line from
// agency_targets for leadership to see which months are at risk.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query } = require('../db/db');
const supabase  = require('../config/supabase');

// ── Probability weights per stage ─────────────────────────────────
const STAGE_WEIGHTS = {
  introduction: 0.10,
  proposal:     0.25,
  pitch:        0.30,
  second_pitch: 0.30,
  decision:     0.70,
  agreement:    0.95,
  onboarded:    1.00,
};

// Revenue layer by stage
const LAYER = {
  introduction: 'possible',
  proposal:     'possible',
  pitch:        'possible',
  second_pitch: 'possible',
  decision:     'probable',
  agreement:    'confirmed',
  onboarded:    'confirmed',
};

// Estimated weeks to close from current stage
const WEEKS_TO_CLOSE = {
  introduction: 18,
  proposal:     14,
  pitch:        10,
  second_pitch:  8,
  decision:      4,
  agreement:     1,
  onboarded:     0,
};

// ── Month label helper ─────────────────────────────────────────────
const monthKey  = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (d) => d.toLocaleDateString('en-NG', { month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

// ── Build the 6-month grid ─────────────────────────────────────────
const buildMonthGrid = (fromDate, count = 6) => {
  const months = [];
  const cursor = new Date(fromDate);
  cursor.setDate(1);
  for (let i = 0; i < count; i++) {
    months.push({
      key:       monthKey(cursor),
      label:     monthLabel(cursor),
      confirmed: 0,
      probable:  0,
      possible:  0,
      total:     0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
};

// ── Estimate when a deal will start generating revenue ─────────────
const estimateRevenueMonth = (opp, now) => {
  // Prefer explicit retainer_start_date if set
  if (opp.retainer_start_date) {
    const d = new Date(opp.retainer_start_date);
    // Clamp to now if in the past
    return d >= now ? d : now;
  }

  // Prefer campaign_start_date for campaigns
  if (opp.deal_type === 'campaign' && opp.campaign_start_date) {
    const d = new Date(opp.campaign_start_date);
    return d >= now ? d : now;
  }

  // Estimate based on stage
  const weeksOut   = WEEKS_TO_CLOSE[opp.stage] || 12;
  const estimated  = new Date(now);
  estimated.setDate(estimated.getDate() + weeksOut * 7);
  return estimated;
};

// ── Deal value ─────────────────────────────────────────────────────
// Returns the MONTHLY revenue value of a deal (not total contract value).
// For the waterfall we show what each month would receive if the deal
// starts in that month.
const monthlyValue = (opp) => {
  if (opp.deal_type === 'retainer' && opp.retainer_monthly_amount) {
    return Number(opp.retainer_monthly_amount);
  }
  if (opp.deal_type === 'campaign' && opp.campaign_total_amount) {
    // Spread campaign value across duration (or treat as one-time)
    const months = opp.campaign_start_date && opp.campaign_end_date
      ? Math.max(1, Math.ceil(
          (new Date(opp.campaign_end_date) - new Date(opp.campaign_start_date))
          / (1000 * 60 * 60 * 24 * 30)
        ))
      : 1;
    return Number(opp.campaign_total_amount) / months;
  }
  if (opp.estimated_value) {
    // One-time or unknown — treat as 3-month spread
    return Number(opp.estimated_value) / 3;
  }
  return 0;
};

// ── Revenue duration in months ─────────────────────────────────────
const revenueDurationMonths = (opp) => {
  if (opp.deal_type === 'retainer') {
    return Number(opp.retainer_duration_months || 12);
  }
  if (opp.deal_type === 'campaign' && opp.campaign_start_date && opp.campaign_end_date) {
    return Math.max(1, Math.ceil(
      (new Date(opp.campaign_end_date) - new Date(opp.campaign_start_date))
      / (1000 * 60 * 60 * 24 * 30)
    ));
  }
  return 3; // default
};

// ── Core waterfall computation ─────────────────────────────────────
const getRevenueWaterfall = async (monthCount = 6) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Fetch all active pipeline deals (excluding lost)
  const { data: opps, error } = await supabase
    .from('opportunities')
    .select(`
      id, company_name, stage, stage_changed_at,
      deal_type,
      retainer_monthly_amount, retainer_start_date, retainer_duration_months,
      campaign_total_amount, campaign_start_date, campaign_end_date,
      estimated_value
    `)
    .not('stage', 'in', '(lost_paused)')
    .order('stage_changed_at', { ascending: false });

  if (error) throw new Error(error.message);

  // Build 6-month grid
  const months = buildMonthGrid(now, monthCount);
  const monthKeys = months.map(m => m.key);
  const firstKey  = monthKeys[0];
  const lastKey   = monthKeys[monthKeys.length - 1];

  // Distribute each deal into months
  for (const opp of (opps || [])) {
    const weight     = STAGE_WEIGHTS[opp.stage] || 0;
    const layer      = LAYER[opp.stage];
    const value      = monthlyValue(opp);
    const duration   = revenueDurationMonths(opp);

    if (!layer || value <= 0) continue;

    const startDate = estimateRevenueMonth(opp, now);
    const startKey  = monthKey(startDate);

    // Spread revenue across duration months within the 6-month window
    for (let m = 0; m < duration; m++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + m);
      const k = monthKey(d);

      if (k < firstKey || k > lastKey) continue;

      const idx = monthKeys.indexOf(k);
      if (idx === -1) continue;

      months[idx][layer]   += value;
      months[idx].total    += value;
    }
  }

  // Round all values
  for (const m of months) {
    m.confirmed = Math.round(m.confirmed);
    m.probable  = Math.round(m.probable);
    m.possible  = Math.round(m.possible);
    m.total     = Math.round(m.total);
  }

  // Fetch monthly revenue target from agency_targets
  const { data: targetRow, error: targetError } = await supabase
    .from('agency_targets')
    .select('monthly_retainer_revenue_target')
    .eq('year', new Date().getFullYear())
    .single()

    if(targetError) throw new Error(targetError.message);

const monthlyTarget = Number(targetRow?.monthly_retainer_revenue_target || 0) || null;
const annualTarget  = monthlyTarget ? monthlyTarget * 12 : null;

  // Summary stats
  const totalConfirmed = months.reduce((s, m) => s + m.confirmed, 0);
  const totalProbable  = months.reduce((s, m) => s + m.probable,  0);
  const totalPossible  = months.reduce((s, m) => s + m.possible,  0);
  const peakMonth      = months.reduce((best, m) => m.total > best.total ? m : best, months[0]);

  return {
    months,
    monthly_target:   monthlyTarget,
    annual_target:    annualTarget > 0 ? annualTarget : null,
    summary: {
      total_confirmed:  totalConfirmed,
      total_probable:   totalProbable,
      total_possible:   totalPossible,
      total_weighted:   totalConfirmed + totalProbable + totalPossible,
      peak_month:       peakMonth.label,
      peak_value:       peakMonth.total,
    },
    computed_at: new Date().toISOString(),
  };
};

// ── Staleness detection ────────────────────────────────────────────
// Returns active deals that have been in their current stage longer
// than the typical threshold. Used to trigger follow-up drafts.

const STALENESS_DAYS = {
  introduction:  14,
  proposal:       7,
  pitch:         10,
  second_pitch:   7,
  decision:      14,
};

const getStaleDeals = async (limit = 20) => {
  const now = new Date();

  const { data: opps, error } = await supabase
    .from('opportunities')
    .select(`
      id, company_name, deal_title, stage, stage_changed_at,
      contact_name, contact_position, contact_email,
      deal_type, service_scope, industry, notes,
      business_bringer:users!business_bringer_id ( id, full_name, email )
    `)
    .not('stage', 'in', '(agreement,onboarded,lost_paused)')
    .not('stage_changed_at', 'is', null)
    .order('stage_changed_at', { ascending: true })
    .limit(limit * 3); // fetch extra to filter

  if (error) throw new Error(error.message);

  const stale = [];
  for (const opp of (opps || [])) {
    const threshold = STALENESS_DAYS[opp.stage];
    if (!threshold) continue;

    const changedAt = new Date(opp.stage_changed_at);
    const daysStale = Math.floor((now - changedAt) / 86400000);

    if (daysStale >= threshold) {
      stale.push({ ...opp, days_stale: daysStale, threshold });
    }

    if (stale.length >= limit) break;
  }

  return stale;
};

module.exports = {
  getRevenueWaterfall,
  getStaleDeals,
  STALENESS_DAYS,
  STAGE_WEIGHTS,
};
