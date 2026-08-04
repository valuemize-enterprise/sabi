// ═══════════════════════════════════════════════════════════════════
// alert-sweep.service.js
// Sabi Intelligence Suite — Phase C: People OS
//
// Time-based HR alerts. Run daily (or call POST /api/people/run-sweep).
// Each function is idempotent — safe to run multiple times per day.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const supabase = require('../config/supabase');
const { query } = require('../db/db');
const { send }  = require('./email-dispatch.service');

// ── Internship 1-month remaining alert ───────────────────────────

const sweepInternshipAlerts = async () => {
  const result = await query(
    `SELECT pr.id AS record_id, pr.user_id, pr.internship_type,
            pr.internship_end_date, u.email, u.full_name AS staff_name
     FROM people_records pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.employment_category = 'intern'
       AND pr.employment_status   = 'active'
       AND pr.internship_alert_sent = FALSE
       AND pr.internship_end_date IS NOT NULL
       AND pr.internship_end_date::date = (CURRENT_DATE + INTERVAL '1 month')::date`
  ).catch(e => {
    console.error('[alert-sweep] internship query failed:', e.message);
    return { rows: [] };
  });

  if (!result.rows.length) return { type: 'internship', sent: 0 };

  // Get HR users to notify
  const { data: hrUsers } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('role', ['hr', 'super_admin'])
    .eq('is_active', true);

  let sent = 0;
  for (const intern of result.rows) {
    const endDate  = new Date(intern.internship_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const typeLabel = intern.internship_type === 'nysc' ? 'NYSC' : intern.internship_type === 'siwes' ? 'SIWES' : 'Internship';

    // In-app notification to HR
    if (hrUsers?.length) {
      await supabase.from('notifications').insert(
        hrUsers.map(hr => ({
          user_id:  hr.id,
          type:     'internship_ending_soon',
          title:    `${typeLabel} Ending in 1 Month`,
          body:     `${intern.staff_name}'s ${typeLabel} programme ends on ${endDate}. Review their status: convert to full-time, extend, or initiate exit.`,
          metadata: { record_id: intern.record_id, user_id: intern.user_id, end_date: intern.internship_end_date },
        }))
      ).catch(e => console.error('[alert-sweep] intern notification failed:', e.message));

      // Email HR users
      for (const hr of (hrUsers || [])) {
        await send('internship_ending_alert', {
          to: { id: hr.id, email: hr.email },
          data: {
            recipientName: hr.full_name,
            staffName:     intern.staff_name,
            typeLabel,
            endDate,
            reviewLink:    `${process.env.APP_URL}/people`,
          },
          entityId: `${intern.record_id}:${hr.id}`,
          dedupe:   'once',
        }).catch(e => console.error('[alert-sweep] intern email failed:', e.message));
      }
    }

    // Mark alert as sent
    await supabase
      .from('people_records')
      .update({ internship_alert_sent: true })
      .eq('id', intern.record_id);

    sent++;
  }

  return { type: 'internship', sent };
};

// ── Probation ending in 7 days alert ─────────────────────────────

const sweepProbationAlerts = async () => {
  const result = await query(
    `SELECT pr.id AS record_id, pr.user_id, pr.probation_end,
            u.full_name AS staff_name, u.email
     FROM people_records pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.employment_status = 'probation'
       AND pr.probation_end IS NOT NULL
       AND pr.probation_end::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')::date
       AND NOT EXISTS (
         SELECT 1 FROM people_record_changes prc
         WHERE prc.record_id = pr.id
           AND prc.field_name = 'probation_alert'
           AND prc.changed_at >= CURRENT_DATE - INTERVAL '1 day'
       )`
  ).catch(e => {
    console.error('[alert-sweep] probation query failed:', e.message);
    return { rows: [] };
  });

  if (!result.rows.length) return { type: 'probation', sent: 0 };

  const { data: hrUsers } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('role', ['hr', 'super_admin'])
    .eq('is_active', true);

  let sent = 0;
  for (const person of result.rows) {
    const endDate   = new Date(person.probation_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const daysLeft  = Math.ceil((new Date(person.probation_end) - new Date()) / 86400000);

    if (hrUsers?.length) {
      await supabase.from('notifications').insert(
        hrUsers.map(hr => ({
          user_id:  hr.id,
          type:     'probation_ending_soon',
          title:    `Probation Ending in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}`,
          body:     `${person.staff_name}'s probation period ends on ${endDate}. Confirm completion, extend, or begin exit process.`,
          metadata: { record_id: person.record_id, user_id: person.user_id, end_date: person.probation_end },
        }))
      ).catch(e => console.error('[alert-sweep] probation notification failed:', e.message));
    }

    // Log the alert so we don't spam daily
    await query(
      `INSERT INTO people_record_changes (record_id, user_id, changed_by, field_name, old_value, new_value, reason, tier)
       VALUES ($1, $2, $2, 'probation_alert', NULL, 'sent', 'Auto-generated probation alert', 2)`,
      [person.record_id, person.user_id]
    ).catch(() => {});

    sent++;
  }

  return { type: 'probation', sent };
};

// ── Contract expiry alerts ────────────────────────────────────────

const sweepContractAlerts = async () => {
  const result = await query(
    `SELECT pr.id AS record_id, pr.user_id, pr.contract_end_date,
            pr.employment_type, u.full_name AS staff_name
     FROM people_records pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.employment_type = 'contract'
       AND pr.employment_status = 'active'
       AND pr.contract_end_date IS NOT NULL
       AND pr.contract_end_date::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')::date`
  ).catch(e => {
    console.error('[alert-sweep] contract query failed:', e.message);
    return { rows: [] };
  });

  if (!result.rows.length) return { type: 'contract', sent: 0 };

  const { data: hrUsers } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('role', ['hr', 'super_admin'])
    .eq('is_active', true);

  let sent = 0;
  for (const person of result.rows) {
    const endDate  = new Date(person.contract_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const daysLeft = Math.ceil((new Date(person.contract_end_date) - new Date()) / 86400000);
    const isCritical = daysLeft <= 7;

    if (hrUsers?.length) {
      await supabase.from('notifications').insert(
        hrUsers.map(hr => ({
          user_id:  hr.id,
          type:     isCritical ? 'contract_expiry_critical' : 'contract_expiry_soon',
          title:    isCritical
            ? `⚠ Contract Expiring in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}`
            : `Contract Renewal Due — ${person.staff_name}`,
          body:     `${person.staff_name}'s contract expires on ${endDate}. ${isCritical ? 'Immediate action required.' : 'Review and renew if needed.'}`,
          metadata: { record_id: person.record_id, user_id: person.user_id, end_date: person.contract_end_date, days_left: daysLeft },
        }))
      ).catch(e => console.error('[alert-sweep] contract notification failed:', e.message));
    }

    sent++;
  }

  return { type: 'contract', sent };
};

// ── Master sweep ──────────────────────────────────────────────────

const runFullSweep = async () => {
  console.log('[alert-sweep] Running full HR alert sweep…');

  const [internship, probation, contract] = await Promise.allSettled([
    sweepInternshipAlerts(),
    sweepProbationAlerts(),
    sweepContractAlerts(),
  ]);

  const summary = {
    internship: internship.status === 'fulfilled' ? internship.value : { error: internship.reason?.message },
    probation:  probation.status  === 'fulfilled' ? probation.value  : { error: probation.reason?.message },
    contract:   contract.status   === 'fulfilled' ? contract.value   : { error: contract.reason?.message },
    ran_at:     new Date().toISOString(),
  };

  console.log('[alert-sweep] Complete:', JSON.stringify(summary));
  return summary;
};

module.exports = {
  runFullSweep,
  sweepInternshipAlerts,
  sweepProbationAlerts,
  sweepContractAlerts,
};
