/**
 * Finance Email Service — Sabi Finance Module Phase 1
 *
 * Sends four email types using the existing Sabi email dispatch system.
 * Each function accepts an invoice + optional payment and fires the right template.
 *
 * Usage:
 *   const financeEmail = require('./finance-email.service');
 *   await financeEmail.sendInvoiceEmail(invoice);
 *   await financeEmail.sendPaymentConfirmation(invoice, payment);
 *   await financeEmail.sendPaymentReminder(invoice, 7);
 *   await financeEmail.sendEscalationNotice(invoice, mdEmail);
 */

'use strict';

// ── Plug into your existing email dispatch ────────────────────────────────────
// Replace this import with whatever your app uses:
// const { sendEmail } = require('./email.service');
// const { notify }    = require('../utils/notify');
// For now we export the HTML templates so you can plug them into any dispatcher.
const sendEmail = async ({ to, subject, html }) => {
  // Replace this with your actual email dispatcher, e.g.:
  // await transporter.sendMail({ from: 'Cerebre <noreply@cerebre.media>', to, subject, html });
  console.log(`[finance-email] Sending "${subject}" to ${to}`);
};

// ── Formatting ────────────────────────────────────────────────────────────────
function naira(amount) {
  return `₦${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Base email wrapper ────────────────────────────────────────────────────────
function wrap(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F0F2F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width: 580px; margin: 0 auto; padding: 28px 16px; }
  .card { background: #fff; border-radius: 14px; overflow: hidden; }
  .header { background: linear-gradient(145deg, #3B0F8C, #5B21B6); padding: 28px 32px; }
  .header h1 { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.02em; margin-bottom: 4px; }
  .header p { font-size: 13px; color: rgba(255,255,255,0.7); }
  .body { padding: 28px 32px; }
  .label { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .value { font-size: 14px; color: #111827; font-weight: 500; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
  .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  .table th { text-align: left; padding: 8px 10px; background: #F9FAFB; color: #6B7280; font-weight: 600; border-bottom: 1px solid #E5E7EB; }
  .table td { padding: 10px; border-bottom: 1px solid #F3F4F6; color: #374151; }
  .table td:last-child { text-align: right; font-weight: 600; }
  .totals { background: #F9FAFB; border-radius: 8px; padding: 14px 16px; margin: 16px 0; }
  .totals-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; color: #6B7280; }
  .totals-row.total { font-size: 16px; font-weight: 700; color: #111827; margin-top: 8px; padding-top: 8px; border-top: 1px solid #E5E7EB; }
  .btn { display: inline-block; background: #5B21B6; color: #fff; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; margin: 16px 0; }
  .note { background: #EDE9FE; border-left: 3px solid #5B21B6; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #374151; margin: 16px 0; }
  .warning { background: #FFFBEB; border-left: 3px solid #D97706; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #374151; margin: 16px 0; }
  .danger { background: #FFF5F5; border-left: 3px solid #DC2626; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #374151; margin: 16px 0; }
  .footer { text-align: center; padding: 20px; font-size: 11px; color: #9CA3AF; }
  p { font-size: 14px; color: #6B7280; line-height: 1.7; margin-bottom: 12px; }
  h2 { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 16px; }
  .success-banner { background: #ECFDF5; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
  .success-banner .amount { font-size: 22px; font-weight: 700; color: #059669; }
  .success-banner p { color: #065F46; font-size: 13px; margin: 0; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    ${content}
  </div>
  <div class="footer">
    Cerebre Media Africa · Sabi Intelligence Suite · Lagos, Nigeria<br/>
    <a href="https://cerebre.media" style="color:#5B21B6;">cerebre.media</a>
  </div>
</div>
</body>
</html>`;
}

function lineItemsTable(lineItems) {
  const rows = (lineItems || []).map(li => `
    <tr>
      <td>${li.description}</td>
      <td style="text-align:right;color:#6B7280">${Number(li.quantity)}</td>
      <td style="text-align:right;color:#6B7280">${naira(li.unit_price)}</td>
      <td>${naira(li.amount)}</td>
    </tr>`).join('');

  return `<table class="table">
    <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function invoiceTotals(invoice) {
  const hasVat = Number(invoice.vat_amount) > 0;
  return `<div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${naira(invoice.subtotal)}</span></div>
    ${hasVat ? `<div class="totals-row"><span>VAT (${(Number(invoice.vat_rate) * 100).toFixed(1)}%)</span><span>${naira(invoice.vat_amount)}</span></div>` : ''}
    <div class="totals-row total"><span>Total due</span><span>${naira(invoice.total_amount)}</span></div>
    ${Number(invoice.amount_paid) > 0 ? `<div class="totals-row" style="color:#059669"><span>Amount paid</span><span>− ${naira(invoice.amount_paid)}</span></div>` : ''}
    ${Number(invoice.amount_paid) > 0 ? `<div class="totals-row total" style="color:#DC2626"><span>Balance outstanding</span><span>${naira(Number(invoice.total_amount) - Number(invoice.amount_paid))}</span></div>` : ''}
  </div>`;
}

// ── 1. Invoice sent ───────────────────────────────────────────────────────────
async function sendInvoiceEmail(invoice) {
  const to      = invoice.brand?.billing_contact_email;
  const name    = invoice.brand?.billing_contact_name || invoice.brand?.name || 'Valued Client';
  const subject = `Invoice ${invoice.invoice_number} from Cerebre Media Africa`;

  if (!to) {
    console.warn(`[finance-email] No billing email for brand ${invoice.brand_id} — invoice ${invoice.invoice_number} not sent`);
    return;
  }

  const html = wrap(`
    <div class="header">
      <h1>Invoice ${invoice.invoice_number}</h1>
      <p>From Cerebre Media Africa · ${fmtDate(invoice.issued_date)}</p>
    </div>
    <div class="body">
      <p>Dear ${name},</p>
      <p>Please find attached your invoice for services rendered. Payment is due by <strong>${fmtDate(invoice.due_date)}</strong>.</p>

      <div class="grid">
        <div><div class="label">Invoice number</div><div class="value">${invoice.invoice_number}</div></div>
        <div><div class="label">Type</div><div class="value" style="text-transform:capitalize">${invoice.type}</div></div>
        <div><div class="label">Issued</div><div class="value">${fmtDate(invoice.issued_date)}</div></div>
        <div><div class="label">Due date</div><div class="value">${fmtDate(invoice.due_date)}</div></div>
      </div>

      ${lineItemsTable(invoice.line_items)}
      ${invoiceTotals(invoice)}

      ${invoice.client_note ? `<div class="note"><strong>Note:</strong> ${invoice.client_note}</div>` : ''}

      <h2>Payment details</h2>
      <p>Please make payment via bank transfer to:</p>
      <div class="note">
        <strong>Account name:</strong> Cerebre Media Africa Ltd<br/>
        <strong>Bank:</strong> [Your Bank Name]<br/>
        <strong>Account number:</strong> [Your Account Number]<br/>
        <strong>Reference:</strong> ${invoice.invoice_number}
      </div>
      <p>Please include the invoice number as your payment reference so we can match your payment immediately.</p>
    </div>
  `);

  await sendEmail({ to, subject, html });
}

// ── 2. Payment received confirmation ─────────────────────────────────────────
async function sendPaymentConfirmation(invoice, payment) {
  const to      = invoice.brand?.billing_contact_email;
  const name    = invoice.brand?.billing_contact_name || invoice.brand?.name || 'Valued Client';
  const subject = `Payment received — Invoice ${invoice.invoice_number}`;
  const isFullyPaid = Number(invoice.amount_paid) >= Number(invoice.total_amount) - 0.01;

  if (!to) return;

  const html = wrap(`
    <div class="header">
      <h1>Payment received</h1>
      <p>Invoice ${invoice.invoice_number} · ${fmtDate(payment.payment_date)}</p>
    </div>
    <div class="body">
      <div class="success-banner">
        <div>
          <div class="amount">${naira(payment.amount)}</div>
          <p>Payment confirmed on ${fmtDate(payment.payment_date)}</p>
        </div>
      </div>

      <p>Dear ${name},</p>
      <p>We have received your payment of <strong>${naira(payment.amount)}</strong> against invoice ${invoice.invoice_number}. Thank you.</p>

      ${payment.reference ? `<p><strong>Payment reference:</strong> ${payment.reference}</p>` : ''}
      ${invoiceTotals(invoice)}
      ${isFullyPaid
        ? '<div class="note">✓ This invoice is now fully paid. Thank you for your prompt payment.</div>'
        : `<div class="warning">The remaining balance of <strong>${naira(Number(invoice.total_amount) - Number(invoice.amount_paid))}</strong> is still outstanding and due by ${fmtDate(invoice.due_date)}.</div>`
      }
    </div>
  `);

  await sendEmail({ to, subject, html });
}

// ── 3. Payment reminder (Day 7) ───────────────────────────────────────────────
async function sendPaymentReminder(invoice) {
  const to      = invoice.brand?.billing_contact_email;
  const name    = invoice.brand?.billing_contact_name || invoice.brand?.name || 'Valued Client';
  const subject = `Friendly reminder — Invoice ${invoice.invoice_number} due ${fmtDate(invoice.due_date)}`;
  const overdue = new Date(invoice.due_date) < new Date();

  if (!to) return;

  const html = wrap(`
    <div class="header">
      <h1>${overdue ? 'Invoice overdue' : 'Payment reminder'}</h1>
      <p>Invoice ${invoice.invoice_number}</p>
    </div>
    <div class="body">
      <p>Dear ${name},</p>
      <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> for <strong>${naira(Number(invoice.total_amount) - Number(invoice.amount_paid))}</strong> ${overdue ? `was due on <strong>${fmtDate(invoice.due_date)}</strong> and remains unpaid.` : `is due on <strong>${fmtDate(invoice.due_date)}</strong>.`}</p>

      ${invoiceTotals(invoice)}

      <div class="note">
        <strong>To pay now:</strong> Transfer to Cerebre Media Africa Ltd and use <strong>${invoice.invoice_number}</strong> as your reference.
      </div>

      <p>If payment has already been made, please disregard this message or reply to confirm your payment reference so we can update our records.</p>
      <p>If you have any questions, please reply to this email or contact your Account Manager.</p>
    </div>
  `);

  await sendEmail({ to, subject, html });
}

// ── 4. Escalation notice (Day 14+) — also notifies MD ────────────────────────
async function sendEscalationNotice(invoice, mdEmail) {
  const clientEmail = invoice.brand?.billing_contact_email;
  const name        = invoice.brand?.billing_contact_name || invoice.brand?.name || 'Valued Client';
  const brandName   = invoice.brand?.name;
  const daysOverdue = Math.floor((Date.now() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));

  // Email to client
  if (clientEmail) {
    const subject = `Urgent: Invoice ${invoice.invoice_number} is ${daysOverdue} days overdue`;
    const html = wrap(`
      <div class="header" style="background: linear-gradient(145deg, #7F1D1D, #DC2626);">
        <h1>Invoice overdue — ${daysOverdue} days</h1>
        <p>Invoice ${invoice.invoice_number} · Required immediate attention</p>
      </div>
      <div class="body">
        <p>Dear ${name},</p>
        <div class="danger">
          Invoice <strong>${invoice.invoice_number}</strong> for <strong>${naira(Number(invoice.total_amount) - Number(invoice.amount_paid))}</strong>
          was due on <strong>${fmtDate(invoice.due_date)}</strong> and is now <strong>${daysOverdue} days overdue</strong>.
        </div>
        <p>To avoid any disruption to services, please arrange payment immediately. If you are experiencing any difficulties, please contact us right away so we can discuss options.</p>
        ${invoiceTotals(invoice)}
        <div class="note">
          <strong>Pay now:</strong> Transfer to Cerebre Media Africa Ltd · Reference: <strong>${invoice.invoice_number}</strong><br/>
          <strong>Contact:</strong> Reply to this email or call your Account Manager
        </div>
      </div>
    `);
    await sendEmail({ to: clientEmail, subject, html });
  }

  // Internal escalation to MD
  if (mdEmail) {
    const subject = `[Finance escalation] ${brandName} — Invoice ${invoice.invoice_number} ${daysOverdue}d overdue`;
    const html = wrap(`
      <div class="header" style="background: linear-gradient(145deg, #7F1D1D, #DC2626);">
        <h1>Finance escalation</h1>
        <p>Action required — ${brandName}</p>
      </div>
      <div class="body">
        <p>This is an automated escalation. Invoice <strong>${invoice.invoice_number}</strong> from <strong>${brandName}</strong> is <strong>${daysOverdue} days overdue</strong>.</p>
        <div class="grid">
          <div><div class="label">Brand</div><div class="value">${brandName}</div></div>
          <div><div class="label">Invoice</div><div class="value">${invoice.invoice_number}</div></div>
          <div><div class="label">Outstanding</div><div class="value" style="color:#DC2626">${naira(Number(invoice.total_amount) - Number(invoice.amount_paid))}</div></div>
          <div><div class="label">Days overdue</div><div class="value" style="color:#DC2626">${daysOverdue}</div></div>
        </div>
        <div class="danger">Client has been notified via email. Please follow up via phone or WhatsApp if no response within 24 hours.</div>
      </div>
    `);
    await sendEmail({ to: mdEmail, subject, html });
  }
}

module.exports = {
  sendInvoiceEmail,
  sendPaymentConfirmation,
  sendPaymentReminder,
  sendEscalationNotice,
};
