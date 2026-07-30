/**
 * VAT Report Service — Sabi Finance Phase 3
 *
 * Nigeria charges 7.5% VAT (FIRS). This service generates the
 * output VAT summary needed for quarterly FIRS returns.
 *
 * Output VAT = VAT charged to clients on issued invoices
 * Filing periods: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
 * Return due: 21st of the month following the quarter end
 */

'use strict';

const { supabase } = require('../config/supabase');

const QUARTER_MONTHS = {
  1: [1, 2, 3],
  2: [4, 5, 6],
  3: [7, 8, 9],
  4: [10, 11, 12],
};

const QUARTER_DUE = {
  1: 'April 21',
  2: 'July 21',
  3: 'October 21',
  4: 'January 21 (following year)',
};

// ── VAT for a specific quarter ────────────────────────────────────────────────
async function getQuarterlyVAT(year, quarter) {
  const months = QUARTER_MONTHS[quarter];
  if (!months) throw Object.assign(new Error('quarter must be 1, 2, 3, or 4'), { status: 400 });

  const startMonth = String(months[0]).padStart(2, '0');
  const endMonth   = String(months[2]).padStart(2, '0');
  const lastDay    = new Date(year, months[2], 0).getDate();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, brand_id, type, subtotal, vat_rate, vat_amount, total_amount, issued_date, brand:brands(name)')
    .not('status', 'in', '("cancelled","draft")')
    .gte('issued_date', `${year}-${startMonth}-01`)
    .lte('issued_date', `${year}-${endMonth}-${lastDay}`)
    .gt('vat_amount', 0)
    .order('issued_date');

  if (error) throw new Error(error.message);

  const list = invoices || [];

  // Monthly breakdown within the quarter
  const byMonth = {};
  months.forEach(m => { byMonth[m] = { invoice_count: 0, net_amount: 0, vat_amount: 0, gross_amount: 0 }; });

  for (const inv of list) {
    const m = new Date(inv.issued_date).getMonth() + 1;
    byMonth[m].invoice_count++;
    byMonth[m].net_amount   += Number(inv.subtotal);
    byMonth[m].vat_amount   += Number(inv.vat_amount);
    byMonth[m].gross_amount += Number(inv.total_amount);
  }

  const totals = {
    invoice_count: list.length,
    net_amount:    list.reduce((s, i) => s + Number(i.subtotal), 0),
    vat_amount:    list.reduce((s, i) => s + Number(i.vat_amount), 0),
    gross_amount:  list.reduce((s, i) => s + Number(i.total_amount), 0),
  };

  return {
    year:     Number(year),
    quarter:  Number(quarter),
    period:   `Q${quarter} ${year}`,
    due_date: QUARTER_DUE[quarter],
    months:   byMonth,
    totals,
    invoices: list.map(i => ({
      invoice_number: i.invoice_number,
      brand_name:     i.brand?.name,
      type:           i.type,
      issued_date:    i.issued_date,
      net_amount:     Number(i.subtotal),
      vat_rate:       Number(i.vat_rate),
      vat_amount:     Number(i.vat_amount),
      gross_amount:   Number(i.total_amount),
    })),
  };
}

// ── Annual VAT summary — all four quarters ────────────────────────────────────
async function getAnnualVAT(year) {
  const quarters = await Promise.all([1, 2, 3, 4].map(q => getQuarterlyVAT(year, q)));

  const annualTotal = quarters.reduce((acc, q) => ({
    invoice_count: acc.invoice_count + q.totals.invoice_count,
    net_amount:    acc.net_amount    + q.totals.net_amount,
    vat_amount:    acc.vat_amount    + q.totals.vat_amount,
    gross_amount:  acc.gross_amount  + q.totals.gross_amount,
  }), { invoice_count: 0, net_amount: 0, vat_amount: 0, gross_amount: 0 });

  return {
    year:     Number(year),
    quarters: quarters.map(q => ({ quarter: q.quarter, period: q.period, due_date: q.due_date, ...q.totals })),
    annual:   annualTotal,
  };
}

module.exports = { getQuarterlyVAT, getAnnualVAT };
