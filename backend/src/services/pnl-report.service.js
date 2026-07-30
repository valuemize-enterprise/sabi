/**
 * P&L Report Service — Sabi Finance Phase 3
 *
 * Computes profit and loss from payments (revenue) and expenses (costs).
 *
 * Reports:
 *   getMonthlyPnL(year, brandId?)   → month-by-month table for a year
 *   getAnnualSummary()              → year-over-year comparison
 *   getBrandPnL(brandId, year)      → single brand P&L
 */

'use strict';

const { supabase } = require('../config/supabase');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Revenue by month for a year ───────────────────────────────────────────────
async function getRevenueByMonth(year, brandId = null) {
  let query = supabase
    .from('payments')
    .select('amount, payment_date, invoice:invoices!inner(type, brand_id)')
    .gte('payment_date', `${year}-01-01`)
    .lt('payment_date', `${Number(year) + 1}-01-01`);

  if (brandId) query = query.eq('invoice.brand_id', brandId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Build month → type → amount map
  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { retainer: 0, project: 0, adhoc: 0, total: 0 };

  for (const p of data || []) {
    const month = new Date(p.payment_date).getMonth() + 1;
    const type  = p.invoice?.type || 'adhoc';
    const amt   = Number(p.amount);
    byMonth[month][type] = (byMonth[month][type] || 0) + amt;
    byMonth[month].total += amt;
  }

  return byMonth;
}

// ── Expenses by month for a year ──────────────────────────────────────────────
async function getExpensesByMonth(year, brandId = null) {
  let query = supabase
    .from('expenses')
    .select('amount, date, category, brand_id')
    .gte('date', `${year}-01-01`)
    .lt('date', `${Number(year) + 1}-01-01`);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, by_category: {} };

  for (const e of data || []) {
    const month = new Date(e.date).getMonth() + 1;
    const amt   = Number(e.amount);
    byMonth[month].total += amt;
    byMonth[month].by_category[e.category] = (byMonth[month].by_category[e.category] || 0) + amt;
  }

  return byMonth;
}

// ── Full monthly P&L table ────────────────────────────────────────────────────
async function getMonthlyPnL(year, brandId = null) {
  const [revenue, expenses] = await Promise.all([
    getRevenueByMonth(year, brandId),
    getExpensesByMonth(year, brandId),
  ]);

  const months = MONTHS.map((label, i) => {
    const m        = i + 1;
    const rev      = revenue[m]   || { retainer: 0, project: 0, adhoc: 0, total: 0 };
    const exp      = expenses[m]  || { total: 0, by_category: {} };
    const profit   = rev.total - exp.total;
    const margin   = rev.total > 0 ? Math.round((profit / rev.total) * 100) : null;

    return {
      month:       m,
      month_label: label,
      revenue: {
        retainer: rev.retainer,
        project:  rev.project,
        adhoc:    rev.adhoc,
        total:    rev.total,
      },
      expenses: {
        total:       exp.total,
        by_category: exp.by_category,
      },
      gross_profit:   profit,
      margin_pct:     margin,
    };
  });

  // Year totals
  const totals = months.reduce((acc, m) => ({
    revenue_total:   acc.revenue_total   + m.revenue.total,
    revenue_retainer: acc.revenue_retainer + m.revenue.retainer,
    revenue_project:  acc.revenue_project  + m.revenue.project,
    expenses_total:  acc.expenses_total  + m.expenses.total,
    gross_profit:    acc.gross_profit    + m.gross_profit,
  }), { revenue_total: 0, revenue_retainer: 0, revenue_project: 0, expenses_total: 0, gross_profit: 0 });

  totals.margin_pct = totals.revenue_total > 0
    ? Math.round((totals.gross_profit / totals.revenue_total) * 100)
    : null;

  return { year: Number(year), brand_id: brandId || null, months, totals };
}

// ── Annual year-over-year summary ─────────────────────────────────────────────
async function getAnnualSummary() {
  const { data: payments, error: pmtErr } = await supabase
    .from('payments')
    .select('amount, payment_date, invoice:invoices(type)');

  const { data: exps, error: expErr } = await supabase
    .from('expenses').select('amount, date');

  if (pmtErr) throw new Error(pmtErr.message);

  // Group by year
  const byYear = {};

  for (const p of payments || []) {
    const yr  = new Date(p.payment_date).getFullYear();
    const amt = Number(p.amount);
    const type = p.invoice?.type || 'adhoc';
    if (!byYear[yr]) byYear[yr] = { revenue: 0, retainer: 0, project: 0, expenses: 0 };
    byYear[yr].revenue += amt;
    byYear[yr][type === 'retainer' ? 'retainer' : 'project'] += amt;
  }

  for (const e of exps || []) {
    const yr  = new Date(e.date).getFullYear();
    const amt = Number(e.amount);
    if (!byYear[yr]) byYear[yr] = { revenue: 0, retainer: 0, project: 0, expenses: 0 };
    byYear[yr].expenses += amt;
  }

  const years = Object.keys(byYear).sort().map((yr, i, arr) => {
    const d       = byYear[yr];
    const profit  = d.revenue - d.expenses;
    const margin  = d.revenue > 0 ? Math.round((profit / d.revenue) * 100) : null;
    const prevYr  = i > 0 ? byYear[arr[i - 1]] : null;
    const growthPct = prevYr && prevYr.revenue > 0
      ? Math.round(((d.revenue - prevYr.revenue) / prevYr.revenue) * 100)
      : null;

    return {
      year:           Number(yr),
      total_revenue:  d.revenue,
      retainer:       d.retainer,
      project:        d.project,
      total_expenses: d.expenses,
      gross_profit:   profit,
      margin_pct:     margin,
      growth_pct:     growthPct,
    };
  });

  return { years };
}

// ── Per-brand P&L summary (for the brands tab) ────────────────────────────────
async function getBrandPnLSummary(year) {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount, invoice:invoices!inner(brand_id, type, brand:brands(name))')
    .gte('payment_date', `${year}-01-01`)
    .lt('payment_date', `${Number(year) + 1}-01-01`);

  const { data: exps } = await supabase
    .from('expenses')
    .select('amount, brand_id')
    .not('brand_id', 'is', null)
    .gte('date', `${year}-01-01`)
    .lt('date', `${Number(year) + 1}-01-01`);

  const brands = {};

  for (const p of payments || []) {
    const bid  = p.invoice?.brand_id;
    const name = p.invoice?.brand?.name || 'Unknown';
    if (!bid) continue;
    if (!brands[bid]) brands[bid] = { brand_id: bid, brand_name: name, revenue: 0, expenses: 0 };
    brands[bid].revenue += Number(p.amount);
  }

  for (const e of exps || []) {
    if (!brands[e.brand_id]) continue;
    brands[e.brand_id].expenses += Number(e.amount);
  }

  return Object.values(brands).map(b => ({
    ...b,
    gross_profit: b.revenue - b.expenses,
    margin_pct:   b.revenue > 0 ? Math.round(((b.revenue - b.expenses) / b.revenue) * 100) : null,
  })).sort((a, b) => b.revenue - a.revenue);
}

module.exports = { getMonthlyPnL, getAnnualSummary, getBrandPnLSummary };
