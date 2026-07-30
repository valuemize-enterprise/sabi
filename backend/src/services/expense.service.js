/**
 * Expense Service — Sabi Finance Phase 3
 *
 * Tracks two types of costs:
 *   Brand expenses  → brand_id is set  → costs specific to a client account
 *   Agency overhead → brand_id is null → rent, salaries, software, etc.
 *
 * Both feed the P&L report. Brand expenses are also visible per-brand.
 * Billable expenses can be recharged on future invoices.
 */

'use strict';

const { supabase } = require('../config/supabase');

const FINANCE_ROLES = new Set(['super_admin', 'admin', 'md', 'accountant']);

const CATEGORIES = [
  'software', 'rent', 'contractor', 'ad_spend',
  'travel', 'salaries', 'utilities', 'equipment',
  'marketing', 'legal', 'other',
];

// ── Create expense ────────────────────────────────────────────────────────────
async function createExpense(data, callerId) {
  const {
    brand_id = null, category, description, amount,
    date, receipt_url, billable_to_client = false,
    vat_inclusive = false, notes,
  } = data;

  if (!category || !CATEGORIES.includes(category)) {
    throw Object.assign(new Error(`category must be one of: ${CATEGORIES.join(', ')}`), { status: 400 });
  }
  if (!description?.trim()) throw Object.assign(new Error('description is required'), { status: 400 });
  if (!amount || Number(amount) <= 0) throw Object.assign(new Error('amount must be greater than 0'), { status: 400 });

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      brand_id:           brand_id || null,
      category,
      description:        description.trim(),
      amount:             Number(amount),
      date:               date || new Date().toISOString().slice(0, 10),
      receipt_url:        receipt_url || null,
      billable_to_client: Boolean(billable_to_client),
      vat_inclusive:      Boolean(vat_inclusive),
      notes:              notes || null,
      recorded_by:        callerId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return expense;
}

// ── List expenses ─────────────────────────────────────────────────────────────
async function listExpenses({ brand_id, category, from_date, to_date, overhead_only, limit = 50, offset = 0 }) {
  let query = supabase
    .from('expenses')
    .select('*, brand:brands(name), recorder:users!recorded_by(full_name)', { count: 'exact' })
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (overhead_only === 'true' || overhead_only === true) {
    query = query.is('brand_id', null);
  } else if (brand_id) {
    query = query.eq('brand_id', brand_id);
  }

  if (category)  query = query.eq('category', category);
  if (from_date) query = query.gte('date', from_date);
  if (to_date)   query = query.lte('date', to_date);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { expenses: data || [], total: count || 0 };
}

// ── Update expense ────────────────────────────────────────────────────────────
async function updateExpense(id, data) {
  const allowed = ['category', 'description', 'amount', 'date', 'receipt_url',
                   'billable_to_client', 'vat_inclusive', 'notes', 'brand_id'];
  const updates = {};
  allowed.forEach(k => { if (data[k] !== undefined) updates[k] = data[k]; });

  const { data: updated, error } = await supabase
    .from('expenses').update(updates).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  if (!updated) throw Object.assign(new Error('Expense not found'), { status: 404 });
  return updated;
}

// ── Delete expense ────────────────────────────────────────────────────────────
async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Expense summary for a period ──────────────────────────────────────────────
async function getExpenseSummary({ year, month, brand_id }) {
  let query = supabase.from('expenses').select('category, amount, brand_id');

  if (year) {
    query = query
      .gte('date', `${year}-01-01`)
      .lt('date', `${Number(year) + 1}-01-01`);
  }
  if (month && year) {
    const m = String(month).padStart(2, '0');
    const nextM = month === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;
    query = query.gte('date', `${year}-${m}-01`).lt('date', nextM);
  }
  if (brand_id) query = query.eq('brand_id', brand_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byCategory = {};
  let totalBrand    = 0;
  let totalOverhead = 0;

  for (const e of data || []) {
    if (!byCategory[e.category]) byCategory[e.category] = 0;
    byCategory[e.category] += Number(e.amount);
    if (e.brand_id) totalBrand += Number(e.amount);
    else totalOverhead += Number(e.amount);
  }

  return {
    by_category:    byCategory,
    total_brand:    totalBrand,
    total_overhead: totalOverhead,
    total:          totalBrand + totalOverhead,
  };
}

module.exports = {
  createExpense,
  listExpenses,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  CATEGORIES,
  FINANCE_ROLES,
};
