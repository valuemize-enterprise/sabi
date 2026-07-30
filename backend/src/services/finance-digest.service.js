/**
 * Finance Digest Service — Sabi Finance Phase 2
 *
 * Every Monday morning ARIA reads the week's financial data and writes
 * a concise digest for the accountant and MD. No hunting through tables —
 * one email with everything that matters.
 *
 * Covers:
 *   - Payments received last week (total + per brand)
 *   - New overdue invoices since last digest
 *   - Brands approaching retainer renewal this week
 *   - Outstanding balance summary
 *   - One ARIA insight / recommendation
 *
 * Wire into your cron job:
 *   0 7 * * 1  →  node -e "require('./services/finance-digest.service').sendWeeklyDigest()"
 */

'use strict';

const { supabase }    = require('../config/supabase');
const { getSummary }  = require('./invoice.service');

const ANTHROPIC_API   = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL    = 'claude-sonnet-4-6';

// ── Gather weekly data ────────────────────────────────────────────────────────
async function gatherWeeklyData() {
  const now       = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const todayStr     = now.toISOString().slice(0, 10);

  // Payments received last week
  const { data: weekPayments } = await supabase
    .from('payments')
    .select('amount, payment_date, brand:brands(name), invoice:invoices(invoice_number, type)')
    .gte('payment_date', weekStartStr)
    .lt('payment_date', todayStr)
    .order('payment_date', { ascending: false });

  const weekTotal = (weekPayments || []).reduce((s, p) => s + Number(p.amount), 0);

  // New overdue invoices (past due_date, status not paid/cancelled/draft)
  const { data: newOverdue } = await supabase
    .from('invoices')
    .select('invoice_number, total_amount, amount_paid, due_date, brand:brands(name)')
    .in('status', ['sent', 'viewed', 'partial'])
    .lt('due_date', todayStr)
    .gte('due_date', weekStartStr); // became overdue this week

  // Brands with retainer due this coming week
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const { data: upcomingRetainers } = await supabase
    .from('brands')
    .select('id, name, retainer_amount, retainer_billing_day')
    .eq('status', 'active')
    .not('retainer_amount', 'is', null)
    .filter('retainer_billing_day', 'gte', now.getDate())
    .filter('retainer_billing_day', 'lte', nextWeek.getDate());

  // Overall summary
  const summary = await getSummary();

  // Top overdue brands (any age)
  const { data: allOverdue } = await supabase
    .from('invoices')
    .select('invoice_number, total_amount, amount_paid, due_date, brand:brands(name)')
    .in('status', ['sent', 'viewed', 'partial', 'overdue'])
    .lt('due_date', todayStr)
    .order('due_date', { ascending: true })
    .limit(5);

  return {
    week_start:          weekStartStr,
    week_end:            todayStr,
    payments_received:   weekPayments || [],
    week_total:          weekTotal,
    payment_count:       (weekPayments || []).length,
    new_overdue:         newOverdue || [],
    upcoming_retainers:  upcomingRetainers || [],
    all_overdue:         allOverdue || [],
    summary,
  };
}

// ── ARIA narrative ────────────────────────────────────────────────────────────
async function getAriaInsight(data) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return 'ARIA insight unavailable — ANTHROPIC_API_KEY not set.';

  const prompt = `You are the ARIA financial intelligence engine for Cerebre Media Africa, a Lagos marketing agency.

Write ONE practical sentence of financial intelligence for the accountant based on this week's data.
Be specific, actionable, and direct. No bullet points, no asterisks, no markdown. Mention numbers.

Week's data:
- Payments received: ₦${data.week_total.toLocaleString()} across ${data.payment_count} payments
- New invoices that became overdue: ${data.new_overdue.length}
- Total agency outstanding balance: ₦${data.summary.outstanding.toLocaleString()}
- Overdue invoice count: ${data.summary.overdue_count}
- Retainers due this week: ${data.upcoming_retainers.length}
${data.new_overdue.length > 0 ? `- Brands newly overdue: ${data.new_overdue.map(i => i.brand?.name).join(', ')}` : ''}

Write the single ARIA insight sentence:`;

  try {
    const res  = await fetch(ANTHROPIC_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const json = await res.json();
    return json.content?.[0]?.text?.trim() || '';
  } catch { return ''; }
}

// ── Build HTML digest email ───────────────────────────────────────────────────
function buildDigestHtml(data, ariaInsight) {
  const naira = n => `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
  const fmtDate = d => new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

  const paymentRows = data.payments_received.slice(0, 8).map(p => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151">${p.brand?.name || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151">${p.invoice?.invoice_number || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:13px;font-weight:600;color:#059669;text-align:right">${naira(p.amount)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#9CA3AF;text-align:right">${fmtDate(p.payment_date)}</td>
    </tr>`).join('');

  const overdueRows = data.all_overdue.slice(0, 5).map(inv => {
    const daysOD = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
    const outstanding = Number(inv.total_amount) - Number(inv.amount_paid);
    return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151">${inv.brand?.name || '—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#6B7280">${inv.invoice_number}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:13px;font-weight:600;color:#DC2626;text-align:right">${naira(outstanding)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#DC2626;text-align:right">${daysOD}d overdue</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#F0F2F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}</style>
</head><body>
<div style="max-width:580px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:14px;overflow:hidden">

    <!-- Header -->
    <div style="background:linear-gradient(145deg,#3B0F8C,#5B21B6);padding:24px 28px">
      <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">ARIA · Weekly Finance Digest</div>
      <div style="font-size:20px;font-weight:700;color:#fff">Week ending ${fmtDate(data.week_end)}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px">Cerebre Media Africa · Sabi Intelligence Suite</div>
    </div>

    <div style="padding:24px 28px">

      <!-- Summary stats -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          ${[
            { label: 'Received this week', value: naira(data.week_total), color: '#059669', bg: '#ECFDF5', bd: '#A7F3D0' },
            { label: 'Total outstanding',  value: naira(data.summary.outstanding), color: '#D97706', bg: '#FFFBEB', bd: '#FDE68A' },
            { label: 'Overdue invoices',   value: String(data.summary.overdue_count), color: data.summary.overdue_count > 0 ? '#DC2626' : '#9CA3AF', bg: data.summary.overdue_count > 0 ? '#FFF5F5' : '#F9FAFB', bd: data.summary.overdue_count > 0 ? '#FECACA' : '#E5E7EB' },
          ].map(s => `<td style="padding:4px"><div style="background:${s.bg};border:1px solid ${s.bd};border-radius:10px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:800;color:${s.color}">${s.value}</div><div style="font-size:10px;color:#9CA3AF;margin-top:3px;text-transform:uppercase;letter-spacing:0.06em">${s.label}</div></div></td>`).join('')}
        </tr>
      </table>

      ${ariaInsight ? `
      <!-- ARIA Insight -->
      <div style="background:#EDE9FE;border-left:3px solid #5B21B6;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px">
        <div style="font-size:10px;font-weight:700;color:#5B21B6;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">ARIA Insight</div>
        <div style="font-size:13px;color:#374151;line-height:1.6">${ariaInsight}</div>
      </div>` : ''}

      ${data.payments_received.length > 0 ? `
      <!-- Payments received -->
      <div style="margin-bottom:20px">
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:10px">Payments received this week (${data.payment_count})</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#F9FAFB">
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E5E7EB">Brand</th>
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E5E7EB">Invoice</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E5E7EB">Amount</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #E5E7EB">Date</th>
          </tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>` : '<div style="background:#F9FAFB;border-radius:8px;padding:14px;text-align:center;font-size:13px;color:#9CA3AF;margin-bottom:20px">No payments received this week</div>'}

      ${data.all_overdue.length > 0 ? `
      <!-- Overdue invoices -->
      <div style="margin-bottom:20px">
        <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:10px">Overdue invoices requiring action</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#FFF5F5">
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #FECACA">Brand</th>
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #FECACA">Invoice</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #FECACA">Outstanding</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #FECACA">Age</th>
          </tr></thead>
          <tbody>${overdueRows}</tbody>
        </table>
      </div>` : ''}

      ${data.upcoming_retainers.length > 0 ? `
      <!-- Upcoming retainers -->
      <div style="background:#EDE9FE;border-radius:10px;padding:14px 16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:#5B21B6;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Retainers due this week</div>
        ${data.upcoming_retainers.map(b => `<div style="font-size:13px;color:#374151;padding:3px 0">
          <strong>${b.name}</strong> — ₦${Number(b.retainer_amount).toLocaleString()} due on day ${b.retainer_billing_day}
        </div>`).join('')}
      </div>` : ''}

      <!-- CTA -->
      <div style="text-align:center;padding-top:8px">
        <a href="${process.env.FRONTEND_URL || 'https://sabi.cerebre.media'}/finance" style="display:inline-block;background:#5B21B6;color:#fff;padding:11px 24px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none">Open Finance Portal →</a>
      </div>
    </div>

    <div style="text-align:center;padding:16px;font-size:11px;color:#9CA3AF">
      Cerebre Media Africa · Sabi Intelligence Suite · <a href="${process.env.FRONTEND_URL || 'https://sabi.cerebre.media'}/finance/reports" style="color:#5B21B6">View full reports</a>
    </div>
  </div>
</div>
</body></html>`;
}

// ── Send the digest ───────────────────────────────────────────────────────────
async function sendWeeklyDigest() {
  console.log('[finance-digest] Building weekly digest…');

  const [data, recipients] = await Promise.all([
    gatherWeeklyData(),
    supabase.from('users').select('email').in('role', ['accountant', 'md', 'super_admin']).eq('status', 'active'),
  ]);

  const ariaInsight = await getAriaInsight(data);
  const html        = buildDigestHtml(data, ariaInsight);
  const subject     = `Sabi Finance Digest — Week ending ${new Date(data.week_end).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })}`;

  const emails = (recipients.data || []).map(u => u.email).filter(Boolean);

  if (!emails.length) {
    console.warn('[finance-digest] No accountant/MD emails found — digest not sent');
    return { sent: 0 };
  }

  // Replace with your actual email dispatcher
  // For each email:
  // await sendEmail({ to, subject, html });
  console.log(`[finance-digest] Would send to: ${emails.join(', ')}`);
  console.log(`[finance-digest] Week total: ₦${data.week_total.toLocaleString()}, overdue: ${data.summary.overdue_count}`);

  return { sent: emails.length, week_total: data.week_total, overdue_count: data.summary.overdue_count };
}

module.exports = { sendWeeklyDigest, gatherWeeklyData };
