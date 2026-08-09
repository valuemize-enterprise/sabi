/**
 * Revenue Tracker Service — Sabi Finance Phase 2
 *
 * Connects actual paid revenue from the payments table to
 * Cerebre's declared annual targets:
 *   2026 → ₦5,000,000,000
 *   2027 → ₦10,600,000,000
 *
 * Also feeds the Brand Admin score's "New Brief Revenue" component
 * by providing actual paid revenue per Brand Admin per period.
 */

'use strict';

const  supabase  = require('../config/supabase');

// ── Get targets for a year ────────────────────────────────────────────────────
async function getTargets(year) {
  const { data, error } = await supabase
    .from('finance_targets')
    .select('*')
    .eq('year', year);

  if (error) throw new Error(error.message);

  const targets = {};
  for (const t of data || []) {
    const key = t.quarter ? `q${t.quarter}_${t.target_type}` : `annual_${t.target_type}`;
    targets[key] = Number(t.target_amount);
  }
  return targets;
}

// ── Revenue actuals for a period ──────────────────────────────────────────────
async function getActuals(year, quarter = null, month = null) {
  let query = supabase
    .from('payments')
    .select('amount, payment_date, invoice:invoices(type)')
    .gte('payment_date', `${year}-01-01`)
    .lt('payment_date', `${year + 1}-01-01`);

  if (quarter) {
    const qStart = ['01', '04', '07', '10'][quarter - 1];
    const qEnd   = ['04', '07', '10', '01'][quarter - 1];
    const qEndYear = quarter === 4 ? year + 1 : year;
    query = query
      .gte('payment_date', `${year}-${qStart}-01`)
      .lt('payment_date', `${qEndYear}-${qEnd}-01`);
  }

  if (month) {
    const m   = String(month).padStart(2, '0');
    const mEnd = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    query = query
      .gte('payment_date', `${year}-${m}-01`)
      .lt('payment_date', mEnd);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const totals = { total: 0, retainer: 0, project: 0, adhoc: 0 };
  for (const p of data || []) {
    const amount = Number(p.amount);
    totals.total += amount;
    const type = p.invoice?.type || 'adhoc';
    if (type in totals) totals[type] += amount;
  }
  return totals;
}

// ── Full revenue dashboard ────────────────────────────────────────────────────
async function getRevenueDashboard() {
  const now     = new Date();
  const year    = now.getFullYear();
  const month   = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  const [targets, ytd, qtd, mtd] = await Promise.all([
    getTargets(year),
    getActuals(year),
    getActuals(year, quarter),
    getActuals(year, null, month),
  ]);

  // Monthly retainer target = annual_retainer / 12
  const monthlyRetainerTarget = (targets.annual_retainer || 0) / 12;
  // Quarterly project target = annual_project / 4
  const quarterlyProjectTarget = (targets.annual_project || 0) / 4;
  // Quarterly total target = annual_total / 4
  const quarterlyTotalTarget = (targets.annual_total || 0) / 4;
  // Monthly total target = annual_total / 12
  const monthlyTotalTarget = (targets.annual_total || 0) / 12;

  // Forecast year-end: use YTD run rate
  const daysElapsed = Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
  const daysInYear  = (year % 4 === 0) ? 366 : 365;
  const runRate     = daysElapsed > 0 ? (ytd.total / daysElapsed) * daysInYear : 0;
  const annualTarget = targets.annual_total || 0;

  // Month-over-month: compare with last month
  const lastMonth    = month === 1 ? 12 : month - 1;
  const lastMonthYear = month === 1 ? year - 1 : year;
  const prevMtd      = await getActuals(lastMonthYear, null, lastMonth);

  return {
    year, quarter, month,
    targets: {
      annual:             annualTarget,
      quarterly:          quarterlyTotalTarget,
      monthly:            monthlyTotalTarget,
      monthly_retainer:   monthlyRetainerTarget,
      quarterly_project:  quarterlyProjectTarget,
    },
    ytd: {
      ...ytd,
      pct_of_target: annualTarget > 0 ? Math.round((ytd.total / annualTarget) * 100) : 0,
    },
    qtd: {
      ...qtd,
      target:        quarterlyTotalTarget,
      pct_of_target: quarterlyTotalTarget > 0 ? Math.round((qtd.total / quarterlyTotalTarget) * 100) : 0,
    },
    mtd: {
      ...mtd,
      target:        monthlyTotalTarget,
      pct_of_target: monthlyTotalTarget > 0 ? Math.round((mtd.total / monthlyTotalTarget) * 100) : 0,
      vs_last_month: prevMtd.total > 0 ? Math.round(((mtd.total - prevMtd.total) / prevMtd.total) * 100) : null,
    },
    forecast: {
      year_end_at_run_rate: Math.round(runRate),
      pct_of_target:        annualTarget > 0 ? Math.round((runRate / annualTarget) * 100) : 0,
      on_track:             runRate >= annualTarget * 0.9,
    },
  };
}

// ── Actual paid revenue for a Brand Admin (for scoring) ──────────────────────
// Used by the Brand Admin scoring engine to replace expected_revenue with actuals.
async function getPaidRevenueForBrandAdmin(brandAdminUserId, brandId, fromDate, toDate) {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, invoice:invoices!inner(brand_id, type, created_by)')
    .eq('invoice.brand_id', brandId)
    .gte('payment_date', fromDate)
    .lte('payment_date', toDate);

  if (error) throw new Error(error.message);

  const total = (data || []).reduce((s, p) => s + Number(p.amount), 0);
  return { total, count: (data || []).length };
}

// ── Upsert a target (for the settings page) ───────────────────────────────────
async function upsertTarget(year, quarter, targetType, amount, callerId) {
  const { data, error } = await supabase
    .from('finance_targets')
    .upsert({
      year, quarter: quarter || null, target_type: targetType,
      target_amount: amount, created_by: callerId,
    }, { onConflict: 'year,quarter,target_type' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

module.exports = {
  getRevenueDashboard,
  getPaidRevenueForBrandAdmin,
  upsertTarget,
  getActuals,
  getTargets,
};
