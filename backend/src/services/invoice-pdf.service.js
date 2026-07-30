/**
 * Invoice PDF Service — Sabi Finance Phase 3
 *
 * Generates a professional A4 PDF invoice using pdfkit.
 * No Chromium required — pure Node.js.
 *
 * npm install pdfkit
 *
 * Usage:
 *   const { generateInvoicePDF } = require('./invoice-pdf.service');
 *   const stream = await generateInvoicePDF(invoice);
 *   res.setHeader('Content-Type', 'application/pdf');
 *   res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
 *   stream.pipe(res);
 */

'use strict';

const PDFDocument = require('pdfkit');

// ── Brand colours ─────────────────────────────────────────────────────────────
const PURPLE  = '#5B21B6';
const DARK    = '#111827';
const GRAY    = '#6B7280';
const LGRAY   = '#F9FAFB';
const BLACK   = '#000000';
const GREEN   = '#059669';
const RED     = '#DC2626';

// ── Formatting ────────────────────────────────────────────────────────────────
function naira(n) {
  return `NGN ${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Main PDF generator ────────────────────────────────────────────────────────
async function generateInvoicePDF(invoice) {
  return new Promise((resolve) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title:    `Invoice ${invoice.invoice_number}`,
      Author:   'Cerebre Media Africa',
      Subject:  `Invoice for ${invoice.brand?.name || 'client'}`,
    }});

    const buffers = [];
    doc.on('data',  chunk => buffers.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(buffers)));

    const W = doc.page.width  - 100; // usable width
    const L = 50;                     // left margin

    // ── Header bar ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(PURPLE);

    doc.fill('#fff').fontSize(22).font('Helvetica-Bold')
      .text('CEREBRE', L, 22, { continued: true })
      .font('Helvetica').text(' MEDIA AFRICA', { continued: false });

    doc.fontSize(9).fill('rgba(255,255,255,0.7)')
      .text('360° Digital Marketing Agency · Lagos, Nigeria', L, 48);

    doc.fill('#fff').fontSize(28).font('Helvetica-Bold')
      .text('INVOICE', doc.page.width - 180, 22);

    doc.fontSize(10).font('Helvetica').fill('rgba(255,255,255,0.8)')
      .text(invoice.invoice_number, doc.page.width - 180, 54);

    // ── Invoice metadata grid ─────────────────────────────────────────────────
    let y = 110;

    // Left: Bill To
    doc.fontSize(8).font('Helvetica-Bold').fill(GRAY).text('BILL TO', L, y);
    doc.fontSize(12).font('Helvetica-Bold').fill(DARK)
      .text(invoice.brand?.name || '—', L, y + 14);
    if (invoice.brand?.billing_contact_name) {
      doc.fontSize(10).font('Helvetica').fill(GRAY)
        .text(invoice.brand.billing_contact_name, L, y + 30);
    }
    if (invoice.brand?.billing_contact_email) {
      doc.fontSize(10).font('Helvetica').fill(GRAY)
        .text(invoice.brand.billing_contact_email, L, y + 44);
    }

    // Right: Invoice details
    const rX = L + W - 160;
    const detailRows = [
      ['Invoice Number', invoice.invoice_number],
      ['Invoice Date',   fmtDate(invoice.issued_date)],
      ['Due Date',       fmtDate(invoice.due_date)],
      ['Payment Terms',  (invoice.payment_terms || 'net_30').replace(/_/g, ' ')],
      ['Invoice Type',   (invoice.type || 'retainer').toUpperCase()],
    ];

    detailRows.forEach(([label, value], i) => {
      const rowY = y + i * 18;
      doc.fontSize(8).font('Helvetica').fill(GRAY).text(label, rX, rowY);
      doc.fontSize(8).font('Helvetica-Bold').fill(DARK).text(String(value), rX + 90, rowY, { align: 'right', width: 70 });
    });

    // ── Status badge ──────────────────────────────────────────────────────────
    const status    = invoice.status || 'draft';
    const badgeColor = status === 'paid' ? GREEN : status === 'overdue' ? RED : PURPLE;
    doc.roundedRect(L, y + 64, 70, 20, 4).fill(badgeColor);
    doc.fontSize(8).font('Helvetica-Bold').fill('#fff')
      .text(status.toUpperCase(), L + 5, y + 68, { width: 60, align: 'center' });

    // ── Divider ───────────────────────────────────────────────────────────────
    y = 220;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).stroke('#E5E7EB');

    // ── Line items table ──────────────────────────────────────────────────────
    y += 16;
    const colWidths  = [240, 60, 90, 90]; // description, qty, unit price, amount
    const colX       = [L, L + 240, L + 300, L + 390];
    const headers    = ['Description', 'Qty', 'Unit Price', 'Amount'];

    // Header row
    doc.rect(L, y, W, 22).fill(LGRAY);
    headers.forEach((h, i) => {
      const align = i > 0 ? 'right' : 'left';
      doc.fontSize(8).font('Helvetica-Bold').fill(GRAY)
        .text(h, colX[i], y + 7, { width: colWidths[i], align });
    });

    y += 22;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).stroke('#E5E7EB');

    // Data rows
    (invoice.line_items || []).forEach((li, idx) => {
      const rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFF';
      const rowH  = 30;
      doc.rect(L, y, W, rowH).fill(rowBg);

      doc.fontSize(9).font('Helvetica').fill(DARK)
        .text(li.description, colX[0], y + 9, { width: colWidths[0] - 10 });
      doc.text(String(Number(li.quantity) || 1), colX[1], y + 9, { width: colWidths[1], align: 'right' });
      doc.text(naira(li.unit_price), colX[2], y + 9, { width: colWidths[2], align: 'right' });
      doc.font('Helvetica-Bold').text(naira(li.amount), colX[3], y + 9, { width: colWidths[3], align: 'right' });

      y += rowH;
    });

    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).stroke('#E5E7EB');

    // ── Totals block ──────────────────────────────────────────────────────────
    y += 16;
    const tX       = L + W - 220;
    const tW       = 220;
    const hasVAT   = Number(invoice.vat_amount) > 0;
    const hasPaid  = Number(invoice.amount_paid) > 0;

    const totalsData = [
      ['Subtotal', naira(invoice.subtotal), GRAY, 'Helvetica'],
    ];
    if (hasVAT) totalsData.push([`VAT (${(Number(invoice.vat_rate || 0.075) * 100).toFixed(1)}%)`, naira(invoice.vat_amount), GRAY, 'Helvetica']);
    totalsData.push(['Total', naira(invoice.total_amount), DARK, 'Helvetica-Bold']);
    if (hasPaid) {
      totalsData.push(['Amount Paid', `(${naira(invoice.amount_paid)})`, GREEN, 'Helvetica']);
      totalsData.push(['Balance Due', naira(Number(invoice.total_amount) - Number(invoice.amount_paid)), RED, 'Helvetica-Bold']);
    }

    // Totals box
    doc.rect(tX - 10, y - 6, tW + 10, totalsData.length * 22 + 12).fill(LGRAY);

    totalsData.forEach(([label, value, color, font], i) => {
      const rowY = y + i * 22;
      if (label === 'Total' || label === 'Balance Due') {
        doc.moveTo(tX - 10, rowY - 2).lineTo(tX - 10 + tW + 10, rowY - 2).lineWidth(0.5).stroke('#E5E7EB');
      }
      doc.fontSize(9).font('Helvetica').fill(GRAY).text(label, tX, rowY, { width: 110 });
      doc.fontSize(9).font(font).fill(color).text(value, tX, rowY, { width: tW - 10, align: 'right' });
    });

    y += totalsData.length * 22 + 24;

    // ── Client note ───────────────────────────────────────────────────────────
    if (invoice.client_note) {
      doc.fontSize(8).font('Helvetica-Bold').fill(GRAY).text('NOTE', L, y);
      doc.fontSize(9).font('Helvetica').fill(DARK)
        .text(invoice.client_note, L, y + 12, { width: W * 0.6, lineGap: 3 });
      y += 44;
    }

    // ── Payment details ───────────────────────────────────────────────────────
    y = Math.max(y, doc.page.height - 220);
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).stroke('#E5E7EB');
    y += 14;

    doc.fontSize(8).font('Helvetica-Bold').fill(GRAY).text('PAYMENT DETAILS', L, y);
    y += 14;

    const bankDetails = [
      ['Account Name',   'Cerebre Media Africa Ltd'],
      ['Bank',           process.env.BANK_NAME           || '[Bank Name]'],
      ['Account Number', process.env.BANK_ACCOUNT_NUMBER || '[Account Number]'],
      ['Sort Code',      process.env.BANK_SORT_CODE      || '[Sort Code]'],
      ['Reference',      invoice.invoice_number],
    ];

    bankDetails.forEach(([label, value]) => {
      doc.fontSize(8).font('Helvetica').fill(GRAY).text(label, L, y, { continued: true })
        .font('Helvetica-Bold').fill(DARK).text(`  ${value}`);
      y += 14;
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.moveTo(L, footerY - 10).lineTo(L + W, footerY - 10).lineWidth(0.5).stroke('#E5E7EB');
    doc.fontSize(8).font('Helvetica').fill(GRAY)
      .text(
        'Cerebre Media Africa Ltd · Lagos, Nigeria · hello@cerebre.media · cerebre.media',
        L, footerY, { width: W, align: 'center' }
      );

    doc.end();
  });
}

module.exports = { generateInvoicePDF };
