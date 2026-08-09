/**
 * Client Portal Service — Sabi Finance Phase 3
 *
 * Gives clients a read-only view of their own invoices and payment history.
 *
 * Auth flow:
 *   1. Accountant calls sendPortalInvite(brandId, email) → writes token to DB, sends email
 *   2. Client clicks link → hits GET /api/client-portal/auth?token=xxx
 *   3. Backend validates token → creates session → returns JWT
 *   4. Client uses JWT (role: 'client', brand_id: '...') to view their invoices
 *   5. JWT expires in 30 days; client can request a new invite at any time
 */

'use strict';

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { sendRawEmail } = require('./email.service');

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET || process.env.JWT_SECRET || 'sabi-portal-secret';

// ── Send portal invite ────────────────────────────────────────────────────────
async function sendPortalInvite(brandId, email, callerId) {
  if (!email?.includes('@')) throw Object.assign(new Error('Valid email required'), { status: 400 });

  const { data: brand } = await supabase.from('brands').select('id, name').eq('id', brandId).single();
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 });

  // Create a token (valid 72 hours)
  const { data: tokenRow, error } = await supabase
    .from('client_portal_tokens')
    .insert({ brand_id: brandId, email, created_by: callerId })
    .select('token')
    .single();

  if (error) throw new Error(error.message);

  const link = `${process.env.FRONTEND_URL || 'https://sabi.cerebre.media'}/portal/login?token=${tokenRow.token}`;

  // Send invite email — via the shared Resend dispatcher
  await sendRawEmail({
    to:      email,
    subject: `View your invoices — ${brand.name} · Cerebre Media Africa`,
    html:    buildInviteEmail(brand.name, link),
  });

  return { sent: true, email, brand_name: brand.name, expires_in: '72 hours' };
}

// ── Validate magic-link token → create session → return JWT ──────────────────
async function authenticateToken(rawToken) {
  if (!rawToken) throw Object.assign(new Error('Token is required'), { status: 400 });

  const { data: tokenRow, error } = await supabase
    .from('client_portal_tokens')
    .select('id, brand_id, email, expires_at, used_at')
    .eq('token', rawToken)
    .single();

  if (error || !tokenRow) throw Object.assign(new Error('Invalid or expired link. Request a new invite from your account manager.'), { status: 401 });
  if (tokenRow.used_at) throw Object.assign(new Error('This link has already been used. Request a new invite.'), { status: 401 });
  if (new Date(tokenRow.expires_at) < new Date()) throw Object.assign(new Error('This link has expired (72-hour window). Request a new invite.'), { status: 401 });

  // Mark token as used
  await supabase.from('client_portal_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id);

  // Create session
  const { data: session } = await supabase.from('client_portal_sessions')
    .insert({ brand_id: tokenRow.brand_id, email: tokenRow.email })
    .select('id')
    .single();

  // Issue JWT scoped to this brand + email
  const portalJwt = jwt.sign(
    {
      role:       'client',
      brand_id:   tokenRow.brand_id,
      email:      tokenRow.email,
      session_id: session?.id,
    },
    PORTAL_SECRET,
    { expiresIn: '30d' }
  );

  return { token: portalJwt, email: tokenRow.email, brand_id: tokenRow.brand_id };
}

// ── Verify portal JWT (middleware helper) ─────────────────────────────────────
function verifyPortalToken(rawJwt) {
  try {
    const decoded = jwt.verify(rawJwt, PORTAL_SECRET);
    if (decoded.role !== 'client') throw new Error('Not a portal token');
    return decoded;
  } catch (err) {
    throw Object.assign(new Error('Portal session expired. Request a new access link.'), { status: 401 });
  }
}

// ── Get invoices for a client brand ──────────────────────────────────────────
async function getClientInvoices(brandId) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, type, status,
      subtotal, vat_amount, total_amount, amount_paid,
      issued_date, due_date, paid_date, payment_terms,
      client_note
    `)
    .eq('brand_id', brandId)
    .not('status', 'in', '("cancelled","draft")')
    .order('issued_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── Get a single invoice with line items (for client view) ────────────────────
async function getClientInvoiceDetail(invoiceId, brandId) {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, type, status, subtotal, vat_amount, vat_rate, total_amount, amount_paid, issued_date, due_date, paid_date, payment_terms, client_note')
    .eq('id', invoiceId)
    .eq('brand_id', brandId)  // scoped — client can only see their own brand
    .not('status', 'in', '("cancelled","draft")')
    .single();

  if (error || !invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .select('description, quantity, unit_price, amount')
    .eq('invoice_id', invoiceId)
    .order('sort_order');

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, payment_date, payment_method, reference')
    .eq('invoice_id', invoiceId)
    .order('payment_date');

  return { ...invoice, line_items: lineItems || [], payments: payments || [] };
}

// ── Get brand info for client portal header ───────────────────────────────────
async function getClientBrandInfo(brandId) {
  const { data } = await supabase
    .from('brands')
    .select('name, primary_color, logo_url, website')
    .eq('id', brandId)
    .single();
  return data;
}

// ── Invite email HTML ─────────────────────────────────────────────────────────
function buildInviteEmail(brandName, link) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#F0F2F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:520px;margin:0 auto;padding:28px 16px">
  <div style="background:#fff;border-radius:14px;overflow:hidden">
    <div style="background:linear-gradient(145deg,#3B0F8C,#5B21B6);padding:28px">
      <div style="font-size:18px;font-weight:700;color:#fff">Cerebre Media Africa</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px">Client Invoice Portal — ${brandName}</div>
    </div>
    <div style="padding:28px">
      <p style="font-size:14px;color:#374151;margin-bottom:16px">You have been invited to view and download your invoices from Cerebre Media Africa.</p>
      <p style="font-size:13px;color:#6B7280;margin-bottom:24px">Click the link below to access your invoice portal. The link expires in 72 hours.</p>
      <a href="${link}" style="display:inline-block;background:#5B21B6;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none">View my invoices →</a>
      <p style="font-size:11px;color:#9CA3AF;margin-top:20px">If you did not expect this email, please ignore it.</p>
    </div>
  </div>
</div>
</body></html>`;
}

module.exports = {
  sendPortalInvite,
  authenticateToken,
  verifyPortalToken,
  getClientInvoices,
  getClientInvoiceDetail,
  getClientBrandInfo,
};
