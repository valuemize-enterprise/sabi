/**
 * Invoices Service — Sabi Intelligence Suite · Finance Phase 1
 *
 * Core functions:
 *   createInvoice        → create invoice + line items, compute totals
 *   listInvoices         → list with brand/status/date filters
 *   getInvoice           → single invoice with line items + payments + brand
 *   updateInvoice        → edit draft invoice
 *   sendInvoice          → mark as sent (notifies accountant)
 *   cancelInvoice        → cancel (soft)
 *   recordPayment        → add payment, update amount_paid + status
 *   getBrandFinancialSummary → feeds Command Center financial dial
 *   getAgencyFinancialSummary → feeds /finance overview stats
 *   markOverdueInvoices  → sweep: sent invoices past due_date → overdue
 */

'use strict';

const supabase  = require('../config/supabase');

// ── Finance roles ─────────────────────────────────────────────────────────────
const FINANCE_ROLES = new Set(['super_admin', 'admin', 'md', 'accountant']);

// ── Naira formatter (for Command Center Signal Log) ──────────────────────────
function fmtNaira(n) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `₦${Math.round(n / 1_000)}k`;
  return `₦${Number(n).toLocaleString()}`;
}

// ── Invoice number generator ──────────────────────────────────────────────────
async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const { count, error } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .like('invoice_number', `INV-${year}-%`);

  if (error) throw new Error(error.message);
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `INV-${year}-${seq}`;
}

// ── Totals computation ────────────────────────────────────────────────────────
function computeTotals(lineItems, vatRate) {
  const rate     = parseFloat(vatRate) || 0;
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) * parseFloat(item.unit_price));
  }, 0);
  const vatAmount   = Math.round(subtotal * rate * 100) / 100;
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;
  return {
    subtotal:     Math.round(subtotal * 100) / 100,
    vat_amount:   vatAmount,
    total_amount: totalAmount,
  };
}

// ── Due date from payment terms ───────────────────────────────────────────────
function computeDueDate(issuedDate, paymentTerms) {
  const days = { net_7: 7, net_14: 14, net_30: 30, net_60: 60 };
  const d    = new Date(issuedDate);
  d.setDate(d.getDate() + (days[paymentTerms] || 30));
  return d.toISOString().slice(0, 10);
}

// ── Invoice status from payment state ────────────────────────────────────────
function computeStatus(totalAmount, amountPaid, dueDate, currentStatus) {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (amountPaid >= totalAmount)     return 'paid';
  if (amountPaid > 0)                return 'partial';
  if (new Date(dueDate) < new Date()) return 'overdue';
  return currentStatus === 'sent' ? 'sent' : currentStatus;
}

// ── CREATE INVOICE ────────────────────────────────────────────────────────────
async function createInvoice({ brand_id, type, line_items, vat_rate, payment_terms, notes, issued_date }, callerId) {
  if (!brand_id)                      throw Object.assign(new Error('brand_id is required'), { status: 400 });
  if (!line_items?.length)            throw Object.assign(new Error('At least one line item is required'), { status: 400 });

  const invoiceNumber = await generateInvoiceNumber();
  const issuedDate    = issued_date || new Date().toISOString().slice(0, 10);
  const terms         = payment_terms || 'net_30';
  const dueDate       = computeDueDate(issuedDate, terms);
  const { subtotal, vat_amount, total_amount } = computeTotals(line_items, vat_rate || 0);

  // Insert invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      brand_id,
      invoice_number: invoiceNumber,
      type:           type || 'retainer',
      status:         'draft',
      subtotal,
      vat_rate:       parseFloat(vat_rate) || 0,
      vat_amount,
      total_amount,
      amount_paid:    0,
      issued_date:    issuedDate,
      due_date:       dueDate,
      payment_terms:  terms,
      notes:          notes || null,
      created_by:     callerId,
    })
    .select('*')
    .single();

  if (invErr) throw new Error(invErr.message);

  // Insert line items
  const lineItemRows = line_items.map((item, i) => ({
    invoice_id:  invoice.id,
    description: item.description,
    quantity:    parseFloat(item.quantity) || 1,
    unit_price:  parseFloat(item.unit_price),
    sort_order:  i,
  }));

  const { error: liErr } = await supabase.from('invoice_line_items').insert(lineItemRows);
  if (liErr) throw new Error(liErr.message);

  return { ...invoice, line_items: lineItemRows };
}

// ── LIST INVOICES ─────────────────────────────────────────────────────────────
async function listInvoices({ brand_id, status, type, from_date, to_date, limit = 50 } = {}, user) {
  let q = supabase
    .from('invoices')
    .select(`
      *,
      brand:brands(id, name, primary_color),
      creator:users!created_by(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  // Scope: accountant/SA/admin/md see all; brand admin sees only their brands
  if (!FINANCE_ROLES.has(user.role)) {
    // Get brands this user manages
    const { data: assignments } = await supabase
      .from('staff_brand_assignments')
      .select('brand_id')
      .eq('staff_id', user.id)
      .eq('role_on_brand', 'brand_admin');
    const brandIds = (assignments || []).map(a => a.brand_id);
    if (!brandIds.length) return [];
    q = q.in('brand_id', brandIds);
  }

  if (brand_id) q = q.eq('brand_id', brand_id);
  if (status)   q = q.eq('status', status);
  if (type)     q = q.eq('type', type);
  if (from_date) q = q.gte('issued_date', from_date);
  if (to_date)   q = q.lte('issued_date', to_date);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

// ── GET SINGLE INVOICE ────────────────────────────────────────────────────────
async function getInvoice(id) {
  const [{ data: invoice, error }, { data: lineItems }, { data: pmts }] = await Promise.all([
    supabase.from('invoices')
      .select('*, brand:brands(id, name, primary_color, billing_contact_name, billing_contact_email)')
      .eq('id', id).single(),
    supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('sort_order'),
    supabase.from('payments').select('*, recorder:users!recorded_by(full_name)').eq('invoice_id', id).order('payment_date'),
  ]);

  if (error) throw new Error(error.message);
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

  return { ...invoice, line_items: lineItems || [], payments: pmts || [] };
}

// ── UPDATE INVOICE (draft only) ────────────────────────────────────────────────
async function updateInvoice(id, { type, line_items, vat_rate, payment_terms, notes, issued_date }, callerId) {
  const { data: existing } = await supabase.from('invoices').select('status, brand_id').eq('id', id).single();
  if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (existing.status !== 'draft') throw Object.assign(new Error('Only draft invoices can be edited directly'), { status: 409 });

  const updates = { updated_at: new Date().toISOString() };
  if (type)            updates.type = type;
  if (payment_terms)   updates.payment_terms = payment_terms;
  if (notes !== undefined) updates.notes = notes;

  if (line_items?.length) {
    const { subtotal, vat_amount, total_amount } = computeTotals(line_items, vat_rate ?? 0);
    Object.assign(updates, {
      subtotal, vat_amount, total_amount,
      vat_rate: parseFloat(vat_rate) || 0,
    });
    if (issued_date || payment_terms) {
      updates.issued_date = issued_date || existing.issued_date;
      updates.due_date    = computeDueDate(updates.issued_date, updates.payment_terms || existing.payment_terms);
    }

    // Replace line items
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
    await supabase.from('invoice_line_items').insert(
      line_items.map((item, i) => ({
        invoice_id:  id,
        description: item.description,
        quantity:    parseFloat(item.quantity) || 1,
        unit_price:  parseFloat(item.unit_price),
        sort_order:  i,
      }))
    );
  }

  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// ── SEND INVOICE ──────────────────────────────────────────────────────────────
async function sendInvoice(id, callerId) {
  const { data: invoice } = await supabase.from('invoices').select('status, total_amount').eq('id', id).single();
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (invoice.status !== 'draft') throw Object.assign(new Error('Only draft invoices can be sent'), { status: 409 });

  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_by: callerId, sent_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, brand:brands(name, billing_contact_email)')
    .single();

  if (error) throw new Error(error.message);

  // Notification hook (fire-and-forget — wire to your notify service)
  // notify.onInvoiceSent(data).catch(() => {});

  return data;
}

// ── CANCEL INVOICE ────────────────────────────────────────────────────────────
async function cancelInvoice(id, callerId) {
  const { data: existing } = await supabase.from('invoices').select('status').eq('id', id).single();
  if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (existing.status === 'paid') throw Object.assign(new Error('Paid invoices cannot be cancelled'), { status: 409 });

  const { data, error } = await supabase
    .from('invoices').update({ status: 'cancelled' }).eq('id', id).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// ── RECORD PAYMENT ────────────────────────────────────────────────────────────
async function recordPayment(invoiceId, { amount, payment_date, payment_method, reference, notes }, callerId) {
  if (!amount || parseFloat(amount) <= 0) {
    throw Object.assign(new Error('Payment amount must be greater than 0'), { status: 400 });
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, brand_id, total_amount, amount_paid, status, due_date')
    .eq('id', invoiceId)
    .single();

  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (['cancelled', 'paid'].includes(invoice.status)) {
    throw Object.assign(new Error(`Cannot record payment on a ${invoice.status} invoice`), { status: 409 });
  }

  const paidAmount = parseFloat(amount);

  // Insert payment record
  const { data: payment, error: pmtErr } = await supabase
    .from('payments')
    .insert({
      invoice_id:     invoiceId,
      brand_id:       invoice.brand_id,
      amount:         paidAmount,
      payment_date:   payment_date || new Date().toISOString().slice(0, 10),
      payment_method: payment_method || 'bank_transfer',
      reference:      reference || null,
      notes:          notes    || null,
      recorded_by:    callerId,
    })
    .select('*')
    .single();

  if (pmtErr) throw new Error(pmtErr.message);

  // Update invoice amount_paid + status
  const newAmountPaid = parseFloat(invoice.amount_paid) + paidAmount;
  const newStatus     = computeStatus(invoice.total_amount, newAmountPaid, invoice.due_date, invoice.status);
  const paidDate      = newStatus === 'paid' ? (payment_date || new Date().toISOString().slice(0, 10)) : null;

  const { data: updatedInvoice, error: updErr } = await supabase
    .from('invoices')
    .update({
      amount_paid: newAmountPaid,
      status:      newStatus,
      paid_date:   paidDate,
    })
    .eq('id', invoiceId)
    .select('*')
    .single();

  if (updErr) throw new Error(updErr.message);

  // Notification hook (fire-and-forget)
  // if (newStatus === 'paid') notify.onInvoicePaid(updatedInvoice).catch(() => {});

  return { payment, invoice: updatedInvoice };
}

// ── BRAND FINANCIAL SUMMARY (for Command Center) ──────────────────────────────
// Returns exactly the shape the Command Center financial dial expects:
// { state, overdue_amount, overdue_days, invoiced_mtd }
// Plus overdue_invoices array for the Signal Log.
async function getBrandFinancialSummary(brandId) {
  const now    = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, total_amount, amount_paid, due_date, issued_date')
    .eq('brand_id', brandId)
    .not('status', 'in', '("draft","cancelled")');

  if (error) throw new Error(error.message);
  if (!invoices?.length) {
    return {
      state:            'grey',
      overdue_amount:   0,
      overdue_days:     0,
      invoiced_mtd:     0,
      overdue_invoices: [],
    };
  }

  const overdueList = invoices.filter(i => i.status === 'overdue' || (
    i.status !== 'paid' && new Date(i.due_date) < now
  ));

  const overdueAmount = overdueList.reduce((sum, i) =>
    sum + (parseFloat(i.total_amount) - parseFloat(i.amount_paid)), 0
  );

  const overdueDays = overdueList.length > 0
    ? Math.max(...overdueList.map(i => Math.floor((now - new Date(i.due_date)) / 86_400_000)))
    : 0;

  const invoicedMtd = invoices
    .filter(i => i.issued_date >= monthStart)
    .reduce((sum, i) => sum + parseFloat(i.total_amount), 0);

  let state = 'green';
  if (overdueAmount > 0)         state = 'red';
  else if (invoicedMtd === 0)    state = 'grey';
  else {
    // Amber: any invoice due within 7 days
    const soonDue = invoices.some(i =>
      i.status === 'sent' &&
      new Date(i.due_date) > now &&
      new Date(i.due_date) < new Date(now.getTime() + 7 * 86_400_000)
    );
    if (soonDue) state = 'amber';
  }

  return {
    state,
    overdue_amount:   Math.round(overdueAmount * 100) / 100,
    overdue_days:     overdueDays,
    invoiced_mtd:     Math.round(invoicedMtd * 100) / 100,
    overdue_invoices: overdueList.slice(0, 4).map(i => ({
      reference:    i.invoice_number,
      amount:       fmtNaira(parseFloat(i.total_amount) - parseFloat(i.amount_paid)),
      days_overdue: Math.floor((now - new Date(i.due_date)) / 86_400_000),
    })),
  };
}

// ── AGENCY FINANCIAL SUMMARY (for /finance overview stats) ────────────────────
async function getAgencyFinancialSummary() {
  const now        = new Date();
  const today      = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('invoices')
    .select('status, amount, due_date, paid_date, issued_date')
    .not('status', 'in', '("draft","cancelled")');

  if (error) throw new Error(error.message);

  const all = data || [];
  const sum = (arr) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);

  const isOverdue = (i) =>
    i.status === 'overdue' ||
    (i.status !== 'paid' && i.due_date && i.due_date < today);

  const outstanding  = sum(all.filter(i => i.status !== 'paid'));
  const receivedMtd  = sum(all.filter(i => i.status === 'paid' && i.paid_date >= monthStart));
  const overdueCount = all.filter(isOverdue).length;

  const { count: draftsCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft');

  return {
    outstanding:   Math.round(outstanding  * 100) / 100,
    received_mtd:  Math.round(receivedMtd  * 100) / 100,
    overdue_count: overdueCount,
    drafts_count:  draftsCount || 0,
  };
}

// ── MARK OVERDUE (cron / sweep) ───────────────────────────────────────────────
// Call from your sweep runner daily. Updates sent invoices past due_date → overdue.
async function markOverdueInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .in('status', ['sent', 'partial'])
    .lt('due_date', today)
    .select('id, invoice_number, brand_id');

  if (error) throw new Error(error.message);

  // Notify accountant/MD for each newly overdue invoice (fire-and-forget)
  // for (const inv of data || []) {
  //   notify.onInvoiceOverdue(inv).catch(() => {});
  // }

  return { marked: (data || []).length };
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  sendInvoice,
  cancelInvoice,
  recordPayment,
  getBrandFinancialSummary,
  getAgencyFinancialSummary,
  markOverdueInvoices,
  FINANCE_ROLES,
};
