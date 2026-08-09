/**
 * Invoice Service — Sabi Finance Module Phase 1
 *
 * Business rules:
 *  - Invoices can only be edited when status = 'draft'
 *  - Cancelling a paid invoice is blocked
 *  - Payment cannot exceed outstanding balance
 *  - When amount_paid >= total_amount → auto-mark 'paid' + set paid_date
 *  - When amount_paid > 0 but < total_amount → auto-mark 'partial'
 *  - Overdue is computed dynamically (due_date < today + status not paid/cancelled)
 */

'use strict';

const supabase  = require('../config/supabase');

const FINANCE_ROLES = new Set(['super_admin', 'admin', 'md', 'accountant']);

// ── Helpers ───────────────────────────────────────────────────────────────────

const TERMS_DAYS = {
  due_on_receipt: 0, net_7: 7, net_14: 14, net_30: 30, net_60: 60,
};

function dueDateFromTerms(terms, issuedDate) {
  const issued = new Date(issuedDate || Date.now());
  const days   = TERMS_DAYS[terms] ?? 30;
  issued.setDate(issued.getDate() + days);
  return issued.toISOString().slice(0, 10);
}

function computeStatus(invoice) {
  if (['paid', 'cancelled', 'draft'].includes(invoice.status)) return invoice.status;
  if (new Date(invoice.due_date) < new Date(new Date().toDateString())) return 'overdue';
  return invoice.status;
}

function computeTotals(lineItems, vatRate = 0.075, includeVat = true) {
  const subtotal   = lineItems.reduce((s, li) => s + Number(li.amount), 0);
  const vatAmount  = includeVat ? Math.round(subtotal * vatRate * 100) / 100 : 0;
  const total      = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vat_amount: vatAmount, total_amount: total };
}

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .like('invoice_number', `CMA-${year}-%`);
  const seq = String((count || 0) + 1).padStart(4, '0');
  return `CMA-${year}-${seq}`;
}

// ── Create invoice ────────────────────────────────────────────────────────────
async function createInvoice(data, callerId) {
  const {
    brand_id, type = 'retainer', payment_terms = 'net_30',
    issued_date, due_date, notes, client_note,
    line_items = [], vat_rate = 0.075, include_vat = true, brief_id,
  } = data;

  if (!brand_id) throw Object.assign(new Error('brand_id is required'), { status: 400 });
  if (!line_items.length) throw Object.assign(new Error('At least one line item is required'), { status: 400 });

  // Compute line item amounts
  const items = line_items.map((li, i) => ({
    description: li.description?.trim(),
    quantity:    Number(li.quantity) || 1,
    unit_price:  Number(li.unit_price) || 0,
    amount:      Math.round((Number(li.quantity) || 1) * (Number(li.unit_price) || 0) * 100) / 100,
    sort_order:  i,
  }));

  if (items.some(li => !li.description)) {
    throw Object.assign(new Error('All line items must have a description'), { status: 400 });
  }

  const { subtotal, vat_amount, total_amount } = computeTotals(items, vat_rate, include_vat);
  const invoice_number = await generateInvoiceNumber();
  const resolved_due = due_date || dueDateFromTerms(payment_terms, issued_date);

  // Insert invoice
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      brand_id, brief_id: brief_id || null,
      invoice_number, type, status: 'draft',
      subtotal, vat_rate: include_vat ? vat_rate : 0,
      vat_amount, total_amount, amount_paid: 0,
      issued_date: issued_date || new Date().toISOString().slice(0, 10),
      due_date: resolved_due, payment_terms,
      notes: notes || null, client_note: client_note || null,
      created_by: callerId,
    })
    .select('*')
    .single();

  if (invErr) throw new Error(invErr.message);

  // Insert line items
  const { error: liErr } = await supabase
    .from('invoice_line_items')
    .insert(items.map(li => ({ ...li, invoice_id: invoice.id })));

  if (liErr) throw new Error(liErr.message);

  return { ...invoice, line_items: items };
}

// ── Get invoice with line items + payments ────────────────────────────────────
async function getInvoice(invoiceId) {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`*, brand:brands(id, name, billing_contact_name, billing_contact_email, primary_color)`)
    .eq('id', invoiceId)
    .single();

  if (error) throw new Error(error.message);
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

  const [{ data: lineItems }, { data: pmts }] = await Promise.all([
    supabase.from('invoice_line_items').select('*').eq('invoice_id', invoiceId).order('sort_order'),
    supabase.from('payments').select('*, recorder:users!recorded_by(full_name)').eq('invoice_id', invoiceId).order('created_at'),
  ]);

  return {
    ...invoice,
    status:     computeStatus(invoice),
    line_items: lineItems || [],
    payments:   pmts || [],
  };
}

// ── List invoices ─────────────────────────────────────────────────────────────
async function listInvoices({ brand_id, status, type, from_date, to_date, limit = 50, offset = 0 }, caller) {
  let query = supabase
    .from('invoices')
    .select(`*, brand:brands(id, name)`, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Brand admins only see their own brands
  if (!FINANCE_ROLES.has(caller.role)) {
    const { data: myBrands } = await supabase
      .from('staff_brand_assignments')
      .select('brand_id')
      .eq('staff_id', caller.id)
      .eq('role_on_brand', 'brand_admin');
    const ids = (myBrands || []).map(b => b.brand_id);
    if (!ids.length) return { invoices: [], total: 0 };
    query = query.in('brand_id', ids);
  }

  if (brand_id) query = query.eq('brand_id', brand_id);
  if (type)     query = query.eq('type', type);
  if (from_date) query = query.gte('issued_date', from_date);
  if (to_date)   query = query.lte('issued_date', to_date);

  // Status filter — handle 'overdue' specially
  if (status === 'overdue') {
    query = query
      .in('status', ['sent', 'viewed', 'partial'])
      .lt('due_date', new Date().toISOString().slice(0, 10));
  } else if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    invoices: (data || []).map(inv => ({ ...inv, status: computeStatus(inv) })),
    total: count || 0,
  };
}

// ── Update invoice (draft only) ───────────────────────────────────────────────
async function updateInvoice(invoiceId, data, callerId) {
  const { data: existing } = await supabase
    .from('invoices').select('status').eq('id', invoiceId).single();

  if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (existing.status !== 'draft') {
    throw Object.assign(new Error('Only draft invoices can be edited'), { status: 400 });
  }

  const allowed = ['type', 'payment_terms', 'due_date', 'issued_date', 'notes', 'client_note'];
  const updates = {};
  allowed.forEach(k => { if (data[k] !== undefined) updates[k] = data[k]; });

  // Recompute totals if line items provided
  if (data.line_items?.length) {
    const items = data.line_items.map((li, i) => ({
      description: li.description?.trim(),
      quantity:    Number(li.quantity) || 1,
      unit_price:  Number(li.unit_price) || 0,
      amount:      Math.round((Number(li.quantity) || 1) * (Number(li.unit_price) || 0) * 100) / 100,
      sort_order:  i,
    }));

    const { subtotal, vat_amount, total_amount } = computeTotals(items, data.vat_rate ?? 0.075, data.include_vat ?? true);
    Object.assign(updates, { subtotal, vat_amount, total_amount });

    // Replace line items
    await supabase.from('invoice_line_items').delete().eq('invoice_id', invoiceId);
    await supabase.from('invoice_line_items').insert(items.map(li => ({ ...li, invoice_id: invoiceId })));
  }

  const { data: updated, error } = await supabase
    .from('invoices').update(updates).eq('id', invoiceId).select('*').single();

  if (error) throw new Error(error.message);
  return updated;
}

// ── Send invoice ──────────────────────────────────────────────────────────────
async function sendInvoice(invoiceId, callerId) {
  const invoice = await getInvoice(invoiceId);
  if (invoice.status === 'paid') throw Object.assign(new Error('Invoice is already paid'), { status: 400 });
  if (invoice.status === 'cancelled') throw Object.assign(new Error('Invoice is cancelled'), { status: 400 });

  const { data: updated, error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString(), sent_by: callerId })
    .eq('id', invoiceId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return { ...updated, line_items: invoice.line_items, brand: invoice.brand };
}

// ── Record payment ────────────────────────────────────────────────────────────
async function recordPayment(invoiceId, paymentData, callerId) {
  const invoice = await getInvoice(invoiceId);

  if (['paid', 'cancelled', 'draft'].includes(invoice.status)) {
    throw Object.assign(new Error(`Cannot record payment on a ${invoice.status} invoice`), { status: 400 });
  }

  const amount    = Number(paymentData.amount);
  const remaining = Number(invoice.total_amount) - Number(invoice.amount_paid);

  if (amount <= 0) throw Object.assign(new Error('Payment amount must be greater than 0'), { status: 400 });
  if (amount > remaining + 0.01) {
    throw Object.assign(new Error(`Payment (₦${amount.toLocaleString()}) exceeds outstanding balance (₦${remaining.toLocaleString()})`), { status: 400 });
  }

  // Insert payment
  const { data: payment, error: pmtErr } = await supabase
    .from('payments')
    .insert({
      invoice_id:     invoiceId,
      brand_id:       invoice.brand_id,
      amount,
      payment_date:   paymentData.payment_date || new Date().toISOString().slice(0, 10),
      payment_method: paymentData.payment_method || 'bank_transfer',
      reference:      paymentData.reference || null,
      notes:          paymentData.notes || null,
      recorded_by:    callerId,
    })
    .select('*')
    .single();

  if (pmtErr) throw new Error(pmtErr.message);

  // Update invoice amount_paid + status
  const newPaid    = Number(invoice.amount_paid) + amount;
  const isFullyPaid = newPaid >= Number(invoice.total_amount) - 0.01;
  const newStatus  = isFullyPaid ? 'paid' : 'partial';

  await supabase.from('invoices').update({
    amount_paid: newPaid,
    status:      newStatus,
    paid_date:   isFullyPaid ? paymentData.payment_date || new Date().toISOString().slice(0, 10) : null,
  }).eq('id', invoiceId);

  return { payment, fully_paid: isFullyPaid, new_status: newStatus };
}

// ── Cancel invoice ────────────────────────────────────────────────────────────
async function cancelInvoice(invoiceId) {
  const { data: inv } = await supabase.from('invoices').select('status').eq('id', invoiceId).single();
  if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (inv.status === 'paid') throw Object.assign(new Error('Cannot cancel a paid invoice'), { status: 400 });

  const { data, error } = await supabase
    .from('invoices').update({ status: 'cancelled' }).eq('id', invoiceId).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

// ── Auto-draft: retainer invoice ──────────────────────────────────────────────
async function autoDraftRetainer(brandId, callerId) {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('id, name, retainer_amount, payment_terms, billing_contact_name')
    .eq('id', brandId)
    .single();

  if (error || !brand) throw Object.assign(new Error('Brand not found'), { status: 404 });
  if (!brand.retainer_amount) {
    throw Object.assign(new Error('Set the brand\'s retainer_amount before auto-drafting a retainer invoice'), { status: 400 });
  }

  const now     = new Date();
  const month   = now.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
  const terms   = brand.payment_terms || 'net_30';

  return createInvoice({
    brand_id:      brandId,
    type:          'retainer',
    payment_terms: terms,
    line_items:    [{
      description: `Monthly Retainer — ${brand.name} · ${month}`,
      quantity:    1,
      unit_price:  brand.retainer_amount,
      amount:      brand.retainer_amount,
    }],
    client_note: `Monthly retainer invoice for ${month}. Thank you for your continued business.`,
  }, callerId);
}

// ── Auto-draft: from brief ────────────────────────────────────────────────────
async function autoDraftFromBrief(briefId, callerId) {
  const { data: brief, error } = await supabase
    .from('briefs')
    .select('id, title, brand_id, expected_revenue, brand:brands(name, payment_terms)')
    .eq('id', briefId)
    .single();

  if (error || !brief) throw Object.assign(new Error('Brief not found'), { status: 404 });

  return createInvoice({
    brand_id:      brief.brand_id,
    brief_id:      briefId,
    type:          'project',
    payment_terms: brief.brand?.payment_terms || 'net_30',
    line_items:    [{
      description: `Project: ${brief.title}`,
      quantity:    1,
      unit_price:  brief.expected_revenue || 0,
      amount:      brief.expected_revenue || 0,
    }],
    client_note: `Invoice for project: ${brief.title}`,
  }, callerId);
}

// ── Finance summary (overview stats) ─────────────────────────────────────────
async function getSummary() {
  const today   = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [invoicesRes, paymentsRes] = await Promise.all([
    supabase.from('invoices')
      .select('id, status, total_amount, amount_paid, due_date, type, brand_id')
      .not('status', 'in', '("cancelled")'),
    supabase.from('payments')
      .select('amount, payment_date')
      .gte('payment_date', monthStart),
  ]);

  const invoices = invoicesRes.data || [];
  const pmts     = paymentsRes.data || [];

  const outstanding = invoices
    .filter(i => ['sent', 'viewed', 'partial'].includes(i.status))
    .reduce((s, i) => s + Number(i.total_amount) - Number(i.amount_paid), 0);

  const receivedMtd = pmts.reduce((s, p) => s + Number(p.amount), 0);

  const overdueCount = invoices.filter(i =>
    ['sent', 'viewed', 'partial'].includes(i.status) && i.due_date < today
  ).length;

  const nextRetainer = invoices
    .filter(i => i.type === 'retainer' && ['draft', 'sent'].includes(i.status) && i.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return { outstanding, received_mtd: receivedMtd, overdue_count: overdueCount, next_retainer: nextRetainer || null };
}

// ── Per-brand financial summary ───────────────────────────────────────────────
async function getBrandFinancials(brandId) {
  const [{ data: invoices }, { data: pmts }] = await Promise.all([
    supabase.from('invoices').select('status, total_amount, amount_paid, due_date, created_at')
      .eq('brand_id', brandId).not('status', 'eq', 'cancelled'),
    supabase.from('payments').select('amount, payment_date')
      .eq('brand_id', brandId).order('payment_date', { ascending: false }).limit(1),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const totalBilled    = (invoices || []).reduce((s, i) => s + Number(i.total_amount), 0);
  const totalReceived  = (invoices || []).reduce((s, i) => s + Number(i.amount_paid), 0);
  const outstanding    = totalBilled - totalReceived;
  const overdueAmount  = (invoices || [])
    .filter(i => ['sent','viewed','partial'].includes(i.status) && i.due_date < today)
    .reduce((s, i) => s + (Number(i.total_amount) - Number(i.amount_paid)), 0);

  return {
    total_billed:    totalBilled,
    total_received:  totalReceived,
    outstanding,
    overdue_amount:  overdueAmount,
    last_payment:    pmts?.[0]?.payment_date || null,
  };
}

// ── Get all brands list (for dropdowns) ──────────────────────────────────────
async function getBrands() {
  const { data, error: brandError } = await supabase
    .from('brands')
    .select('id, name, industry, status, retainer_billing_day, payment_terms, billing_contact_name, billing_contact_email, account_manager_id, clarity_score')
    .eq('status', 'active')
    .order('name');
  if (brandError) throw new Error(brandError.message);
  return data || [];
}

module.exports = {
  createInvoice, getInvoice, listInvoices, updateInvoice,
  sendInvoice, recordPayment, cancelInvoice,
  autoDraftRetainer, autoDraftFromBrief,
  getSummary, getBrandFinancials, getBrands,
  FINANCE_ROLES,
};
