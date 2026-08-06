'use strict';

// ═══════════════════════════════════════════════════════════════════
// pipeline.service.js
// Sabi Intelligence Suite — New Business Pipeline
// Rewritten to use Supabase JS client throughout.
// No raw pg / query() calls.
// ═══════════════════════════════════════════════════════════════════

const supabase = require('../config/supabase');

// ── Helpers ───────────────────────────────────────────────────────

const getCurrentWeekStart = () => {
  const d   = new Date();
  const day  = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

const daysSince = (ts) => {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
};

const stalenessLevel = (days) => {
  if (days < 7)  return 'green';
  if (days <= 14) return 'amber';
  return 'red';
};

const buildStalenessMessage = (opp) => {
  const days = Number(opp.days_in_stage);
  const stageLabel = {
    introduction: 'Introduction', proposal: 'Proposal',
    pitch: 'Pitch',               second_pitch: 'Second Pitch',
    decision: 'Decision',         agreement: 'Agreement',
    onboarded: 'Onboarded',       lost_paused: 'Lost / Paused',
  }[opp.stage] || opp.stage;

  if (opp.stage === 'pitch' && days > 14) {
    return `${opp.company_name} — pitch was shared ${days} days ago with no update logged. Recommend a follow-up call before Friday's report.`;
  }
  if (opp.stage === 'decision' && days > 28) {
    return `${opp.company_name} — ${opp.deal_title} has been in Decision for ${days} days. Escalate to MD if not closing this week.`;
  }
  return `${opp.company_name} — ${days} days in "${stageLabel}" without a stage update.`;
};

// ── Opportunities ─────────────────────────────────────────────────

const listOpportunities = async ({
  stage, business_bringer_id, service_scope, sort_by = 'updated_at', sort_dir = 'desc',
} = {}) => {

  let q = supabase
    .from('opportunities')
    .select(`
      *,
      bringer:users!business_bringer_id ( full_name, email ),
      weekly_notes:opportunity_weekly_notes ( week_start, notes )
    `)
    .order(sort_by, { ascending: sort_dir === 'asc' });

  if (stage)               q = q.eq('stage', stage);
  if (business_bringer_id) q = q.eq('business_bringer_id', business_bringer_id);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const now = Date.now();

  return (data || []).map(row => {
    const days = row.stage_changed_at
      ? Math.floor((now - new Date(row.stage_changed_at).getTime()) / 86400000)
      : 0;

    const sortedNotes = (row.weekly_notes || [])
      .sort((a, b) => (b.week_start > a.week_start ? 1 : -1));

    return {
      ...row,
      lead_ba_name:  row.bringer?.full_name  || null,
      lead_ba_email: row.bringer?.email      || null,
      notes_count:   row.weekly_notes?.length || 0,
      latest_note:   sortedNotes[0]?.notes   || null,
      days_in_stage: days,
      staleness:     stalenessLevel(days),
      // remove nested objects from top-level
      bringer:       undefined,
      weekly_notes:  undefined,
    };
  });
};

// ─────────────────────────────────────────────────────────────────

const getOpportunityById = async (id) => {
  const { data: opp, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      bringer:users!business_bringer_id ( full_name, email ),
      brand:brands!converted_brand_id ( name )
    `)
    .eq('id', id)
    .single();

  if (error || !opp) return null;

  const [histRes, notesRes] = await Promise.all([
    supabase
      .from('opportunity_stage_history')
      .select('*, changer:users!changed_by ( full_name )')
      .eq('opportunity_id', id)
      .order('changed_at', { ascending: true }),

    supabase
      .from('opportunity_weekly_notes')
      .select('*, author:users!added_by ( full_name )')
      .eq('opportunity_id', id)
      .order('week_start', { ascending: false }),
  ]);

  const days = opp.stage_changed_at
    ? Math.floor((Date.now() - new Date(opp.stage_changed_at).getTime()) / 86400000)
    : 0;

  return {
    ...opp,
    lead_ba_name:        opp.bringer?.full_name   || null,
    lead_ba_email:       opp.bringer?.email        || null,
    converted_brand_name: opp.brand?.name          || null,
    days_in_stage:       days,
    staleness:           stalenessLevel(days),
    stage_history:       (histRes.data  || []).map(r => ({ ...r, changed_by_name: r.changer?.full_name || null })),
    weekly_notes:        (notesRes.data || []).map(r => ({ ...r, added_by_name:   r.author?.full_name  || null })),
    bringer:             undefined,
    brand:               undefined,
  };
};

// ─────────────────────────────────────────────────────────────────

const createOpportunity = async (data, created_by) => {
  const {
    company_name, deal_title, description, service_scope = [],
    source, stage = 'introduction', estimated_value,
    date_briefed, client_deadline, agency_deadline,
    business_bringer_id, accountable_team_text, notes,
  } = data;

  const { data: opp, error } = await supabase
    .from('opportunities')
    .insert({
      company_name, deal_title,
      description:            description            || null,
      service_scope:          service_scope,
      source:                 source                 || null,
      stage,
      estimated_value:        estimated_value        || null,
      date_briefed:           date_briefed           || null,
      client_deadline:        client_deadline        || null,
      agency_deadline:        agency_deadline        || null,
      business_bringer_id:    business_bringer_id    || null,
      accountable_team_text:  accountable_team_text  || null,
      notes:                  notes                  || null,
      created_by,
      stage_changed_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // Log initial stage entry
  await supabase.from('opportunity_stage_history').insert({
    opportunity_id: opp.id,
    from_stage:     null,
    to_stage:       opp.stage,
    changed_by:     created_by,
    change_notes:   'Opportunity created',
  });

  return opp;
};

// ─────────────────────────────────────────────────────────────────

const updateOpportunity = async (id, data) => {
  const allowed = [
    'company_name', 'deal_title', 'description', 'service_scope',
    'source', 'estimated_value', 'date_briefed', 'client_deadline',
    'agency_deadline', 'business_bringer_id', 'accountable_team_text',
    'notes', 'lost_reason', 'lost_notes',
  ];

  const update = {};
  for (const field of allowed) {
    if (data[field] !== undefined) update[field] = data[field];
  }

  if (!Object.keys(update).length) throw new Error('No valid fields to update');

  const { data: opp, error } = await supabase
    .from('opportunities')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return opp;
};

// ─────────────────────────────────────────────────────────────────

const changeStage = async (
  id, new_stage, changed_by,
  { change_notes, lost_reason, lost_notes, converted_brand_id } = {}
) => {
  const { data: current, error: fetchErr } = await supabase
    .from('opportunities')
    .select('stage')
    .eq('id', id)
    .single();

  if (fetchErr || !current) throw new Error('Opportunity not found');

  const from_stage = current.stage;
  if (from_stage === new_stage) return getOpportunityById(id);

  const update = {
    stage:            new_stage,
    stage_changed_at: new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };

  if (new_stage === 'agreement' && converted_brand_id) {
    update.converted_brand_id = converted_brand_id;
  }
  if (new_stage === 'lost_paused') {
    if (lost_reason) update.lost_reason = lost_reason;
    if (lost_notes)  update.lost_notes  = lost_notes;
  }

  const { error: updateErr } = await supabase
    .from('opportunities')
    .update(update)
    .eq('id', id);

  if (updateErr) throw new Error(updateErr.message);

  await supabase.from('opportunity_stage_history').insert({
    opportunity_id: id,
    from_stage,
    to_stage:    new_stage,
    changed_by,
    change_notes: change_notes || null,
  });

  return getOpportunityById(id);
};

// ─────────────────────────────────────────────────────────────────

const deleteOpportunity = async (id) => {
  const { error } = await supabase
    .from('opportunities')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
};

// ── Weekly Notes ──────────────────────────────────────────────────

const getWeeklyNotes = async (opportunity_id) => {
  const { data, error } = await supabase
    .from('opportunity_weekly_notes')
    .select('*, author:users!added_by ( full_name )')
    .eq('opportunity_id', opportunity_id)
    .order('week_start', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map(r => ({
    ...r,
    added_by_name: r.author?.full_name || null,
    author: undefined,
  }));
};

// ─────────────────────────────────────────────────────────────────

const upsertWeeklyNote = async (opportunity_id, { week_start, notes, aria_draft }, added_by) => {
  const week = week_start || getCurrentWeekStart();

  const { data, error } = await supabase
    .from('opportunity_weekly_notes')
    .upsert(
      { opportunity_id, week_start: week, notes: notes || null, aria_draft: aria_draft || null, added_by },
      { onConflict: 'opportunity_id,week_start' }
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  if (notes) {
    await supabase
      .from('opportunities')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', opportunity_id);
  }

  return data;
};

// ── Analytics ─────────────────────────────────────────────────────
// Computed in JavaScript from fetched rows — avoids raw SQL aggregations.

const getAnalytics = async () => {
  const { data: all, error } = await supabase
    .from('opportunities')
    .select('id, stage, estimated_value, stage_changed_at, created_at, updated_at');

  if (error) throw new Error(error.message);

  const now   = Date.now();
  const rows  = all || [];

  const active = rows.filter(o => !['agreement', 'onboarded', 'lost_paused'].includes(o.stage));
  const won    = rows.filter(o => ['agreement', 'onboarded'].includes(o.stage));
  const closed = rows.filter(o => ['agreement', 'onboarded', 'lost_paused'].includes(o.stage));

  // Deals by stage
  const stageOrder = ['introduction', 'proposal', 'pitch', 'second_pitch', 'decision'];
  const byStageMap = {};
  for (const o of active) {
    if (!byStageMap[o.stage]) byStageMap[o.stage] = { count: 0, value: 0 };
    byStageMap[o.stage].count += 1;
    byStageMap[o.stage].value += Number(o.estimated_value || 0);
  }
  const by_stage = stageOrder
    .filter(s => byStageMap[s])
    .map(s => ({ stage: s, count: byStageMap[s].count, value: byStageMap[s].value }));

  // Staleness
  const staleness = { green: 0, amber: 0, red: 0 };
  for (const o of active) {
    const days = o.stage_changed_at
      ? Math.floor((now - new Date(o.stage_changed_at).getTime()) / 86400000) : 0;
    staleness[stalenessLevel(days)] += 1;
  }

  // Weighted forecast
  const weights = { decision: 0.70, second_pitch: 0.50, pitch: 0.30, proposal: 0.15, introduction: 0.05 };
  const weighted_forecast = active.reduce((sum, o) => {
    return sum + (Number(o.estimated_value || 0) * (weights[o.stage] || 0));
  }, 0);

  // Totals
  const total_pipeline_value = active.reduce((s, o) => s + Number(o.estimated_value || 0), 0);
  const avg_deal_size        = active.length ? total_pipeline_value / active.length : 0;

  // Win rate (all time — quarter filtering needs stage_history)
  const win_rate_pct = closed.length
    ? Math.round((won.length / closed.length) * 1000) / 10
    : 0;

  // Avg days to close (won deals — from created_at to updated_at as proxy)
  const closeTimes = won
    .filter(o => o.created_at && o.updated_at)
    .map(o => (new Date(o.updated_at) - new Date(o.created_at)) / 86400000);
  const avg_days_to_close = closeTimes.length
    ? Math.round((closeTimes.reduce((s, d) => s + d, 0) / closeTimes.length) * 10) / 10
    : null;

  return {
    active_count:        active.length,
    total_pipeline_value,
    avg_deal_size,
    by_stage,
    win_rate_pct,
    won_count:           won.length,
    closed_count:        closed.length,
    avg_days_to_close,
    staleness,
    weighted_forecast,
  };
};

// ── Staleness Alerts ──────────────────────────────────────────────

const getStalenessAlerts = async () => {
  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      id, company_name, deal_title, stage, stage_changed_at,
      notes, business_bringer_id,
      bringer:users!business_bringer_id ( full_name )
    `)
    .not('stage', 'in', '(onboarded,lost_paused)')
    .not('stage_changed_at', 'is', null)
    .order('stage_changed_at', { ascending: true });

  if (error) throw new Error(error.message);

  const now = Date.now();

  return (data || [])
    .map(r => {
      const days_in_stage = Math.floor(
        (now - new Date(r.stage_changed_at).getTime()) / 86400000
      );
      return {
        ...r,
        lead_ba_name:  r.bringer?.full_name || null,
        days_in_stage,
        staleness:     stalenessLevel(days_in_stage),
        alert_message: buildStalenessMessage({ ...r, days_in_stage }),
        bringer:       undefined,
      };
    })
    .filter(r => r.days_in_stage > 7);
};

// ─────────────────────────────────────────────────────────────────

module.exports = {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  changeStage,
  deleteOpportunity,
  getWeeklyNotes,
  upsertWeeklyNote,
  getAnalytics,
  getStalenessAlerts,
  getCurrentWeekStart,
  stalenessLevel,
  buildStalenessMessage,
};