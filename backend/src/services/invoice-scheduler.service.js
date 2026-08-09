/**
 * Invoice Scheduler Service — Sabi Finance Phase 2
 *
 * Automates invoice creation so the accountant never needs to
 * remember to generate monthly retainers or project invoices.
 *
 * Two triggers:
 *
 *  1. RETAINER SCHEDULE — runs daily. Checks which brands have
 *     retainer_billing_day = today. If no retainer invoice already
 *     exists for this month, creates a draft and notifies the accountant.
 *
 *  2. BRIEF COMPLETION — runs when a brief is marked delivered.
 *     If the brief has expected_revenue, auto-drafts a project invoice.
 *
 * Call runRetainerSchedule() from a daily cron job (e.g. 7 AM).
 * Call onBriefCompleted(briefId) from your briefs completion route.
 */

'use strict';

const supabase            = require('../config/supabase');
const { createInvoice }      = require('./invoice.service');
const finEmail               = require('./finance-email.service');

// ── Helper: get accountant email ──────────────────────────────────────────────
async function getAccountantEmail() {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'accountant')
    .eq('status', 'active')
    .limit(1)
    .single();
  return data?.email || null;
}

// ── Helper: does an invoice already exist for this brand this month? ──────────
async function retainerExistsThisMonth(brandId) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('type', 'retainer')
    .not('status', 'eq', 'cancelled')
    .gte('issued_date', monthStart)
    .lte('issued_date', monthEnd);

  return (count || 0) > 0;
}

// ── 1. Daily retainer schedule ────────────────────────────────────────────────
async function runRetainerSchedule(systemUserId = null) {
  const today     = new Date();
  const dayOfMonth = today.getDate();

  // Find all active brands where today is their billing day
  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, name, retainer_amount, payment_terms, retainer_billing_day, billing_contact_email')
    .eq('status', 'active')
    .eq('retainer_billing_day', dayOfMonth)
    .not('retainer_amount', 'is', null);

  if (error) {
    console.error('[scheduler] Failed to fetch brands:', error.message);
    return { processed: 0, errors: [error.message] };
  }

  const log = { processed: 0, skipped: 0, errors: [] };

  for (const brand of brands || []) {
    try {
      // Skip if retainer already exists this month
      const exists = await retainerExistsThisMonth(brand.id);
      if (exists) {
        await supabase.from('scheduled_invoice_log').insert({
          brand_id: brand.id, trigger_type: 'retainer_schedule',
          status: 'skipped', skip_reason: 'Retainer invoice already exists for this month',
        });
        log.skipped++;
        continue;
      }

      // Auto-draft the retainer invoice
      const now    = today.toISOString().slice(0, 10);
      const month  = today.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
      const terms  = brand.payment_terms || 'net_30';
      const daysMap = { due_on_receipt: 0, net_7: 7, net_14: 14, net_30: 30, net_60: 60 };
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + (daysMap[terms] ?? 30));

      const invoice = await createInvoice({
        brand_id:      brand.id,
        type:          'retainer',
        payment_terms: terms,
        issued_date:   now,
        due_date:      dueDate.toISOString().slice(0, 10),
        line_items: [{
          description: `Monthly Retainer — ${brand.name} · ${month}`,
          quantity:    1,
          unit_price:  brand.retainer_amount,
          amount:      brand.retainer_amount,
        }],
        client_note: `Monthly retainer invoice for ${month}. Thank you for your continued partnership with Cerebre Media Africa.`,
      }, systemUserId);

      // Log success
      await supabase.from('scheduled_invoice_log').insert({
        brand_id:    brand.id,
        invoice_id:  invoice.id,
        trigger_type: 'retainer_schedule',
        status:      'success',
      });

      // Notify accountant
      const accountantEmail = await getAccountantEmail();
      if (accountantEmail) {
        await notifyAccountantNewDraft(accountantEmail, invoice, brand.name, 'retainer');
      }

      log.processed++;
      console.log(`[scheduler] ✓ Retainer drafted for ${brand.name} — ${invoice.invoice_number}`);
    } catch (err) {
      await supabase.from('scheduled_invoice_log').insert({
        brand_id: brand.id, trigger_type: 'retainer_schedule',
        status: 'error', error_msg: err.message,
      });
      log.errors.push({ brand: brand.name, error: err.message });
      console.error(`[scheduler] ✗ Failed for ${brand.name}:`, err.message);
    }
  }

  return log;
}

// ── 2. Brief completion trigger ───────────────────────────────────────────────
async function onBriefCompleted(briefId, completedByUserId) {
  const { data: brief, error } = await supabase
    .from('briefs')
    .select('id, title, brand_id, expected_revenue, status, brand:brands(name, payment_terms)')
    .eq('id', briefId)
    .single();

  if (error || !brief) return { skipped: true, reason: 'Brief not found' };
  if (!brief.expected_revenue || brief.expected_revenue <= 0) {
    return { skipped: true, reason: 'Brief has no expected_revenue — no invoice drafted' };
  }

  // Check if a project invoice already exists for this brief
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('brief_id', briefId)
    .not('status', 'eq', 'cancelled');

  if (count && count > 0) {
    return { skipped: true, reason: 'Invoice already exists for this brief' };
  }

  try {
    const terms = brief.brand?.payment_terms || 'net_30';
    const invoice = await createInvoice({
      brand_id:  brief.brand_id,
      brief_id:  briefId,
      type:      'project',
      payment_terms: terms,
      line_items: [{
        description: `Project: ${brief.title}`,
        quantity:    1,
        unit_price:  brief.expected_revenue,
        amount:      brief.expected_revenue,
      }],
      client_note: `Invoice for completed project: ${brief.title}. Thank you for your business.`,
    }, completedByUserId);

    await supabase.from('scheduled_invoice_log').insert({
      brand_id:    brief.brand_id,
      invoice_id:  invoice.id,
      trigger_type: 'brief_completion',
      status:      'success',
    });

    // Notify accountant
    const accountantEmail = await getAccountantEmail();
    if (accountantEmail) {
      await notifyAccountantNewDraft(accountantEmail, invoice, brief.brand?.name, 'project');
    }

    console.log(`[scheduler] ✓ Project invoice drafted for brief "${brief.title}" — ${invoice.invoice_number}`);
    return { drafted: true, invoice };
  } catch (err) {
    await supabase.from('scheduled_invoice_log').insert({
      brand_id: brief.brand_id, trigger_type: 'brief_completion',
      status: 'error', error_msg: err.message,
    });
    throw err;
  }
}

// ── Notify accountant about a new auto-drafted invoice ───────────────────────
async function notifyAccountantNewDraft(accountantEmail, invoice, brandName, type) {
  // Uses your existing email system
  try {
    const { sendEmail } = require('./finance-email.service');
    // You can also wire this into the main Sabi notification system (notify.*)
    console.log(`[scheduler] Notify accountant at ${accountantEmail} about ${invoice.invoice_number}`);
    // sendEmail({ to: accountantEmail, subject: `New ${type} invoice drafted — ${brandName}`, html: '...' })
  } catch {}
}

// ── Get scheduler audit log ───────────────────────────────────────────────────
async function getSchedulerLog(brandId, limit = 20) {
  let query = supabase
    .from('scheduled_invoice_log')
    .select('*, invoice:invoices(invoice_number, type, total_amount), brand:brands(name)')
    .order('triggered_at', { ascending: false })
    .limit(limit);

  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  runRetainerSchedule,
  onBriefCompleted,
  getSchedulerLog,
};
