/**
 * Aging Report Service — Sabi Finance Phase 2
 *
 * Generates the standard accountancy aging report:
 * outstanding invoices grouped by how long they've been overdue.
 *
 * Buckets:
 *   Current   → due in future
 *   0–7 days  → just overdue
 *   8–30 days → moderate
 *   31–60 days → serious
 *   60+ days  → critical — immediate escalation needed
 */

'use strict';

const { supabase } = require('../config/supabase');

// ── Full aging report ─────────────────────────────────────────────────────────
async function getAgingReport() {
  // Use the pre-built view for brand-level buckets
  const { data: rows, error } = await supabase
    .from('v_invoice_aging')
    .select('*')
    .order('total_outstanding', { ascending: false });

  if (error) throw new Error(error.message);

  const brands = rows || [];

  // Compute column totals across all brands
  const totals = brands.reduce((acc, row) => ({
    current_outstanding: acc.current_outstanding + Number(row.current_outstanding),
    overdue_0_7:         acc.overdue_0_7         + Number(row.overdue_0_7),
    overdue_8_30:        acc.overdue_8_30         + Number(row.overdue_8_30),
    overdue_31_60:       acc.overdue_31_60        + Number(row.overdue_31_60),
    overdue_60_plus:     acc.overdue_60_plus      + Number(row.overdue_60_plus),
    total_outstanding:   acc.total_outstanding    + Number(row.total_outstanding),
  }), {
    current_outstanding: 0, overdue_0_7: 0, overdue_8_30: 0,
    overdue_31_60: 0, overdue_60_plus: 0, total_outstanding: 0,
  });

  // Critical brands: anything in 60+ bucket
  const critical = brands.filter(b => Number(b.overdue_60_plus) > 0)
    .map(b => ({ brand_name: b.brand_name, amount: Number(b.overdue_60_plus) }));

  return { brands, totals, critical, generated_at: new Date().toISOString() };
}

// ── Detailed aging for a single brand ────────────────────────────────────────
async function getBrandAging(brandId) {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, brand:brands(name)')
    .eq('brand_id', brandId)
    .not('status', 'in', '("paid","cancelled","draft")')
    .order('due_date', { ascending: true });

  if (error) throw new Error(error.message);

  const today  = new Date();
  const result = (invoices || []).map(inv => {
    const due        = new Date(inv.due_date);
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    const bucket =
      daysOverdue === 0 ? 'current' :
      daysOverdue <= 7  ? '0_7' :
      daysOverdue <= 30 ? '8_30' :
      daysOverdue <= 60 ? '31_60' : '60_plus';

    return {
      invoice_number: inv.invoice_number,
      type:           inv.type,
      due_date:       inv.due_date,
      outstanding,
      days_overdue:   daysOverdue,
      bucket,
      status:         daysOverdue > 0 ? 'overdue' : inv.status,
    };
  });

  return result;
}

module.exports = { getAgingReport, getBrandAging };
