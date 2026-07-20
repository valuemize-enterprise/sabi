/**
 * ═══════════════════════════════════════════════════════════════
 * Brand Status Watch — D6
 * ═══════════════════════════════════════════════════════════════
 * Runs inside the notification sweep (every run — idempotent).
 *
 * Flow per brand:
 *   1. Live status from the Command Center rule engine
 *   2. Compare against latest row in brand_status_log
 *   3. Changed?  → insert transition row (this insert IS the spam gate)
 *   4. New status = at_risk? → email Admins/MD + that brand's Brand
 *      Admin(s) with the reason chips and the two-click fix path.
 *
 * Recovery needs no email by default — the Monday leadership digest
 * celebrates recoveries; alerts are reserved for deterioration.
 * Because a transition only inserts once, a brand that stays at
 * risk for three weeks generates exactly ONE alert — the daily
 * nagging for the underlying causes is already handled by the
 * task/brief/invoice sweeps.
 *
 * Also exported: redFlagsSummary() — feeds the leadership digest's
 * redFlags field from the same rule engine (blueprint Section 07).
 */

'use strict';

const supabase = require('../config/supabase');
const { computeCommand } = require('./command.service');
const dispatch = require('./email-dispatch.service');

async function latestLoggedStatus(brandId) {
  const { data } = await supabase.from('brand_status_log')
    .select('status').eq('brand_id', brandId)
    .order('changed_at', { ascending: false }).limit(1);
  return data?.[0]?.status || null;
}

async function alertRecipients(brandId) {
  const [{ data: leaders }, { data: bas }] = await Promise.all([
    supabase.from('users').select('id, email, full_name')
      .in('role', ['super_admin', 'admin', 'md']).eq('is_active', true),
    supabase.from('staff_brand_assignments')
      .select('staff_id, users!staff_id(id, email, full_name)')
      .contains('roles_on_brand', ['brand_admin']).eq('brand_id', brandId),
  ]);
  const seen = new Set(); const out = [];
  for (const u of [...(leaders || []), ...(bas || []).map(r => r.users).filter(Boolean)]) {
    if (!seen.has(u.id)) { seen.add(u.id); out.push(u); }
  }
  return out;
}

/** Main entry — call from the sweeper on every run. */
async function watchBrandStatus() {
  const { brands } = await computeCommand(); // full scope; cache-friendly
  let transitions = 0, alerts = 0;

  for (const b of brands) {
    const prev = await latestLoggedStatus(b.id);
    if (prev === b.status) continue;

    // The insert is the gate: one row per transition, ever.
    const { error } = await supabase.from('brand_status_log').insert({
      brand_id: b.id, status: b.status, prev_status: prev, reasons: b.reasons,
    });
    if (error) { console.error('[status-watch] log insert failed:', error.message); continue; }
    transitions++;

    if (b.status === 'at_risk') {
      const recipients = await alertRecipients(b.id);
      const topReasons = b.reasons.slice(0, 4).map(r => r.label);
      await dispatch.sendToMany('brand_status_changed', recipients, {
        entityId: b.id,
        dedupe: 'always', // safe: gated by the transition insert above
        data: {
          brandName: b.name,
          prevStatus: prev || 'healthy',
          reasons: topReasons,
          reasonCount: b.reasons.length,
        },
      });
      alerts += recipients.length;
    }
  }
  if (transitions) console.log(`[status-watch] ${transitions} transitions, ${alerts} alert emails`);
  return { transitions, alerts };
}

/** One-line red-flags summary for the Monday leadership digest. */
async function redFlagsSummary() {
  const { brands } = await computeCommand();
  const risky = brands.filter(b => b.status === 'at_risk');
  if (!risky.length) return null;
  return risky
    .map(b => `${b.name}: ${b.reasons.filter(r => r.severity === 'red').map(r => r.label).join(', ') || 'multiple issues'}`)
    .join(' · ');
}

module.exports = { watchBrandStatus, redFlagsSummary };
