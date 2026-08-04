'use strict';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * Phase D — Leave Email Templates
 *
 * APPEND these to the end of:
 *   backend/src/services/email-templates.js
 * — just before the `module.exports = { T, base, C };` line.
 *
 * New templates:
 *   T.leave_request_submitted  → HR + MD: a staff member submitted leave
 *   T.leave_request_confirmed  → Staff: acknowledgement their request was received
 * ═══════════════════════════════════════════════════════════════════════
 */


// ── T.leave_request_submitted ─────────────────────────────────────
// Fires when any staff member submits a leave request.
// Recipients: all active HR, Super Admin, and MD users.
//
// Data shape:
//   d.recipientName  — the HR/MD receiving the email
//   d.staffName      — who submitted the request
//   d.staffRole      — their role label (e.g. "Copywriter")
//   d.leaveType      — "Annual" | "Sick" | "Compassionate" | "Study" | "Other"
//   d.startDate      — formatted start date string
//   d.endDate        — formatted end date string
//   d.daysCount      — number of days (string or number)
//   d.reason         — optional reason note (may be empty string)
//   d.reviewUrl      — link to People OS leave tab

T.leave_request_submitted = (d) => ({
  category: 'leave',
  subject:  `🏖 Leave Request — ${esc(d.staffName)} (${esc(d.daysCount)} day${Number(d.daysCount) !== 1 ? 's' : ''})`,
  preheader: `${esc(d.staffName)} has requested ${esc(d.leaveType)} leave from ${esc(d.startDate)} to ${esc(d.endDate)}.`,
  html: base(
    C.volt,
    '🏖️',
    'Leave Request Submitted',
    esc(d.staffName),

    greeting(d.recipientName) +

    p(
      `<strong>${esc(d.staffName)}</strong> ` +
      `<span style="color:#64748b;">(${esc(d.staffRole)})</span> ` +
      `has submitted a leave request that needs your review.`
    ) +

    // ── Request detail card ───────────────────────────────────────
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="
          background: rgba(109,40,217,0.08);
          border: 1px solid rgba(109,40,217,0.22);
          border-radius: 10px;
          padding: 20px 22px;
        ">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">

            <!-- Leave type row -->
            <tr>
              <td colspan="3" style="padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0 0 4px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:#64748b;">Leave Type</p>
                <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:800; color:#c4b5fd;">${esc(d.leaveType)} Leave</p>
              </td>
            </tr>

            <!-- Date range row -->
            <tr>
              <td width="40%" style="padding-top:14px; padding-right:12px; vertical-align:top;">
                <p style="margin:0 0 3px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">From</p>
                <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:700; color:#f1f5f9;">${esc(d.startDate)}</p>
              </td>
              <td width="20%" style="padding-top:14px; text-align:center; vertical-align:middle;">
                <p style="margin:0; font-family:'JetBrains Mono',monospace; font-size:18px; color:#374151;">→</p>
              </td>
              <td width="40%" style="padding-top:14px; padding-left:12px; vertical-align:top;">
                <p style="margin:0 0 3px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">To</p>
                <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:700; color:#f1f5f9;">${esc(d.endDate)}</p>
              </td>
            </tr>

            <!-- Duration row -->
            <tr>
              <td colspan="3" style="padding-top:14px; border-top:1px solid rgba(255,255,255,0.06);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" style="vertical-align:top;">
                      <p style="margin:0 0 3px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Duration</p>
                      <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:800; color:#10b981;">
                        ${esc(String(d.daysCount))} <span style="font-size:14px; font-weight:400; color:#64748b;">day${Number(d.daysCount) !== 1 ? 's' : ''}</span>
                      </p>
                    </td>
                    ${d.reason ? `
                    <td width="50%" style="vertical-align:top; padding-left:16px; border-left:1px solid rgba(255,255,255,0.06);">
                      <p style="margin:0 0 3px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Reason</p>
                      <p style="margin:0; font-family:'Inter',sans-serif; font-size:13px; color:#cbd5e1; line-height:1.5;">${esc(d.reason)}</p>
                    </td>` : ''}
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>` +

    cta('Review Leave Request in Sabi', d.reviewUrl) +

    p(
      `Approve or decline this request in People OS → Leave. ` +
      `Approving the request will update ${esc(d.staffName)}'s employment status to "On Leave" automatically on their first day.`
    ) +

    p(
      `<span style="font-size:12px; color:#64748b; font-style:italic;">` +
      `You received this because you have HR, Super Admin, or MD access in Sabi.` +
      `</span>`
    )
  ),
});


// ── T.leave_request_confirmed ─────────────────────────────────────
// Fires to the staff member after they submit their leave request.
// Confirms receipt and tells them to wait for approval.
//
// Data shape:
//   d.recipientName  — the staff member
//   d.leaveType      — "Annual" | "Sick" | etc.
//   d.startDate      — formatted start date
//   d.endDate        — formatted end date
//   d.daysCount      — number of days
//   d.reviewUrl      — link to their My Requests page in Sabi

T.leave_request_confirmed = (d) => ({
  category: 'leave',
  subject:  `Your Leave Request Has Been Received`,
  preheader: `We've received your ${esc(d.leaveType)} leave request (${esc(d.daysCount)} days). Pending HR approval.`,
  html: base(
    C.mint,
    '✅',
    'Leave Request Received',
    'Pending approval',

    greeting(d.recipientName) +

    p(
      `Your leave request has been submitted and is now pending approval from HR. ` +
      `You will receive a notification as soon as it is reviewed.`
    ) +

    // ── Summary card ─────────────────────────────────────────────
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="
          background: rgba(16,185,129,0.07);
          border: 1px solid rgba(16,185,129,0.22);
          border-radius: 10px;
          padding: 20px 22px;
        ">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="33%" style="vertical-align:top; padding-right:10px;">
                <p style="margin:0 0 4px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Type</p>
                <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:700; color:#f1f5f9;">${esc(d.leaveType)}</p>
              </td>
              <td width="33%" style="vertical-align:top; padding-right:10px;">
                <p style="margin:0 0 4px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Dates</p>
                <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:13px; font-weight:600; color:#f1f5f9;">${esc(d.startDate)}</p>
                <p style="margin:2px 0 0; font-family:'JetBrains Mono',monospace; font-size:10px; color:#64748b;">to ${esc(d.endDate)}</p>
              </td>
              <td width="33%" style="vertical-align:top;">
                <p style="margin:0 0 4px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:#64748b;">Duration</p>
                <p style="margin:0; font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:800; color:#10b981;">
                  ${esc(String(d.daysCount))}<span style="font-size:13px; font-weight:400; color:#64748b;"> day${Number(d.daysCount) !== 1 ? 's' : ''}</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` +

    cta('View My Leave Requests', d.reviewUrl) +

    p(
      `<span style="font-size:12px; color:#64748b; font-style:italic;">` +
      `If your leave is urgent, contact your HR manager directly. ` +
      `Do not make travel or other arrangements until your request has been formally approved.` +
      `</span>`
    )
  ),
});
