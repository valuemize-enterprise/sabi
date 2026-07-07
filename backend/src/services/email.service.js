/**
 * Email Service — Sabi Intelligence Suite
 * Powered by Resend (https://resend.com)
 *
 * Usage:
 *   const email = require('../services/email.service');
 *   await email.sendWelcomeStaff({ name:'Amaka', email:'amaka@cerebre.media', tempPassword:'Abc123!' });
 *   await email.sendReportPublished({ clientName:'John', brandName:'FiberOne', reportUrl:'...' });
 */

'use strict';

const { Resend }  = require('resend');
const fs          = require('fs');
const path        = require('path');

const resend      = new Resend(process.env.RESEND_API_KEY);
const FROM        = process.env.EMAIL_FROM    || 'Sabi Intelligence <noreply@cerebre.media>';
const REPLY_TO    = process.env.EMAIL_REPLY_TO|| 'hello@cerebre.media';
const TEMPLATES   = path.join(__dirname, '../emails');
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || 'https://sabi.cerebre.media';

// ── Template renderer ─────────────────────────────────────────
// Replaces {{KEY}} placeholders with values from a data object
function render(templateFile, data = {}) {
  const filePath = path.join(TEMPLATES, templateFile);
  if (!fs.existsSync(filePath)) throw new Error(`Email template not found: ${templateFile}`);
  let html = fs.readFileSync(filePath, 'utf-8');
  Object.entries(data).forEach(([key, val]) => {
    html = html.replaceAll(`{{${key}}}`, String(val ?? ''));
  });
  return html;
}

// ── Generic send helper ───────────────────────────────────────
async function send({ to, subject, template, data }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to} (${subject})`);
    return { skipped: true };
  }
  try {
    const html = render(template, { APP_URL, ...data });
    const result = await resend.emails.send({
      from:     FROM,
      reply_to: REPLY_TO,
      to,
      subject,
      html,
    });
    console.log(`[email] ✓ Sent "${subject}" to ${to}`);
    return result;
  } catch (err) {
    // Never crash the main request — just log
    console.error(`[email] ✗ Failed to send "${subject}" to ${to}:`, err.message);
    return { error: err.message };
  }
}

// ════════════════════════════════════════════════════════════════
// PUBLIC METHODS — one per email trigger
// ════════════════════════════════════════════════════════════════

/**
 * New staff account created — sends login credentials
 * Trigger: POST /api/agency/staff  (after account creation)
 */
async function sendWelcomeStaff({ name, email, role, tempPassword }) {
  return send({
    to: email,
    subject: 'Welcome to Sabi Intelligence Suite — Your Login Details',
    template: 'welcome-staff.html',
    data: {
      name,
      role:        role?.replace(/_/g, ' '),
      email,
      tempPassword,
      loginUrl:    `${APP_URL}/login`,
    },
  });
}

/**
 * New client account created — sends portal login credentials
 * Trigger: POST /api/agency/clients  OR  POST /api/super-admin/clients
 */
async function sendWelcomeClient({ name, email, brandName, tempPassword }) {
  return send({
    to: email,
    subject: `Welcome to Your ${brandName} Brand Portal`,
    template: 'welcome-client.html',
    data: {
      name,
      brandName,
      email,
      tempPassword,
      loginUrl: `${APP_URL}/client/login`,
    },
  });
}

/**
 * Report published to client portal
 * Trigger: PUT /api/agency/reports/:id/publish
 */
async function sendReportPublished({ clientName, clientEmail, brandName, reportTitle, reportUrl, period }) {
  return send({
    to: clientEmail,
    subject: `New Report Ready: ${reportTitle}`,
    template: 'report-published.html',
    data: {
      clientName,
      brandName,
      reportTitle,
      reportUrl: reportUrl || `${APP_URL}/client/reports`,
      period:    period    || '',
    },
  });
}

/**
 * Password reset — sends new temporary password
 * Trigger: POST /api/agency/staff/:id/reset-password
 *           PUT  /api/super-admin/clients/:id/reset-password
 */
async function sendPasswordReset({ name, email, tempPassword, isClient = false }) {
  return send({
    to: email,
    subject: 'Your Sabi Password Has Been Reset',
    template: 'password-reset.html',
    data: {
      name,
      email,
      tempPassword,
      loginUrl: isClient ? `${APP_URL}/client/login` : `${APP_URL}/login`,
      portalLabel: isClient ? 'Client Portal' : 'Internal Portal',
    },
  });
}

/**
 * Deliverable approved — notify the staff member who uploaded it
 * Trigger: PUT /api/agency/deliverables/:id/approve
 */
async function sendDeliverableApproved({ staffName, staffEmail, brandName, deliverableTitle }) {
  return send({
    to: staffEmail,
    subject: `✓ Deliverable Approved — ${deliverableTitle}`,
    template: 'deliverable-approved.html',
    data: {
      staffName,
      brandName,
      deliverableTitle,
      deliverableUrl: `${APP_URL}/brands`,
    },
  });
}

/**
 * Goal achieved — notify the brand's account manager
 * Trigger: when a goal's current_value reaches target_value
 */
async function sendGoalAchieved({ staffName, staffEmail, brandName, goalTitle, targetValue, unit }) {
  return send({
    to: staffEmail,
    subject: `🎯 Goal Achieved — ${goalTitle}`,
    template: 'goal-achieved.html',
    data: {
      staffName,
      brandName,
      goalTitle,
      targetValue,
      unit: unit || '',
      brandsUrl: `${APP_URL}/brands`,
    },
  });
}

module.exports = {
  sendWelcomeStaff,
  sendWelcomeClient,
  sendReportPublished,
  sendPasswordReset,
  sendDeliverableApproved,
  sendGoalAchieved,
};
