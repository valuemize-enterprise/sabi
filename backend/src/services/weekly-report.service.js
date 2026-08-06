'use strict';

// ═══════════════════════════════════════════════════════════════════
// weekly-report.service.js
// Sabi Intelligence Suite — Weekly Intelligence Report
// Rewritten to use Supabase JS client throughout.
// No raw pg / query() calls.
// ═══════════════════════════════════════════════════════════════════

const supabase = require('../config/supabase');
const { notify } = require('../services/notification.service');

// ── Week helpers ──────────────────────────────────────────────────

const getCurrentWeek = () => {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    week_start: mon.toISOString().split('T')[0],
    week_end:   sun.toISOString().split('T')[0],
  };
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const weekEnd = (week_start) => {
  const sun = new Date(week_start);
  sun.setDate(sun.getDate() + 6);
  return sun.toISOString().split('T')[0];
};

// ── Weekly Report (container) ─────────────────────────────────────

const getOrCreateReport = async (week_start) => {
  const we = weekEnd(week_start);

  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('week_start', week_start)
    .single()
    .catch(() => ({ data: null }));

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('weekly_reports')
    .insert({ week_start, week_end: we })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return created;
};

// ── Brand Admin's brand list ──────────────────────────────────────

const getBrandAdminBrands = async (brand_admin_id, week_start, user_role) => {
  const isLeadership = ['admin', 'md', 'super_admin'].includes(user_role);

  // 1. Fetch brand-user assignments
  let buQuery = supabase
    .from('brand_users')
    .select('brand_id, user_id, role, brand:brands!brand_id(id, name, logo_url), user:users!user_id(id, full_name, email)')
    .eq('role', 'brand_admin');

  if (!isLeadership) buQuery = buQuery.eq('user_id', brand_admin_id);

  const { data: brandUsers, error: buErr } = await buQuery;
  if (buErr) throw new Error(buErr.message);
  if (!brandUsers?.length) return [];

  // 2. Fetch weekly report + entries for this week
  const { data: report } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('week_start', week_start)
    .single()
    .catch(() => ({ data: null }));

  let entriesByBrand = {};
  if (report) {
    const { data: entries } = await supabase
      .from('weekly_report_entries')
      .select('id, brand_id, brand_admin_id, is_submitted, submitted_at, aria_generated_at')
      .eq('report_id', report.id);

    for (const e of (entries || [])) {
      entriesByBrand[`${e.brand_id}:${e.brand_admin_id}`] = e;
    }
  }

  // 3. Merge
  return (brandUsers || []).map(bu => {
    const entry = entriesByBrand[`${bu.brand_id}:${bu.user_id}`] || null;
    const status = !entry
      ? 'not_started'
      : entry.is_submitted
      ? 'submitted'
      : entry.aria_generated_at
      ? 'draft'
      : 'not_started';

    return {
      id:               bu.brand?.id      || bu.brand_id,
      name:             bu.brand?.name    || null,
      logo_url:         bu.brand?.logo_url || null,
      brand_admin_id:   bu.user_id,
      brand_admin_name: bu.user?.full_name || null,
      entry_id:         entry?.id          || null,
      is_submitted:     entry?.is_submitted || false,
      submitted_at:     entry?.submitted_at || null,
      aria_generated_at: entry?.aria_generated_at || null,
      status,
    };
  });
};

// ── Entry (per brand per week) ────────────────────────────────────

const getOrCreateEntry = async (report_id, brand_id, brand_admin_id) => {
  const { data: existing } = await supabase
    .from('weekly_report_entries')
    .select(`
      *,
      brand:brands!brand_id ( name ),
      admin:users!brand_admin_id ( full_name )
    `)
    .eq('report_id', report_id)
    .eq('brand_id', brand_id)
    .eq('brand_admin_id', brand_admin_id)
    .single()
    .catch(() => ({ data: null }));

  if (existing) {
    return {
      ...existing,
      brand_name:       existing.brand?.name     || null,
      brand_admin_name: existing.admin?.full_name || null,
    };
  }

  const { error } = await supabase
    .from('weekly_report_entries')
    .insert({ report_id, brand_id, brand_admin_id });

  if (error) throw new Error(error.message);
  return getOrCreateEntry(report_id, brand_id, brand_admin_id);
};

// ─────────────────────────────────────────────────────────────────

const getEntryWithComments = async (entry_id) => {
  const { data: entry, error } = await supabase
    .from('weekly_report_entries')
    .select(`
      *,
      brand:brands!brand_id ( name ),
      admin:users!brand_admin_id ( full_name ),
      report:weekly_reports!report_id ( week_start, week_end )
    `)
    .eq('id', entry_id)
    .single();

  if (error || !entry) return null;

  const { data: comments } = await supabase
    .from('report_comments')
    .select('*, author:users!author_id ( full_name, role )')
    .eq('entry_id', entry_id)
    .order('created_at', { ascending: true });

  return {
    ...entry,
    brand_name:       entry.brand?.name      || null,
    brand_admin_name: entry.admin?.full_name  || null,
    week_start:       entry.report?.week_start || null,
    week_end:         entry.report?.week_end   || null,
    comments: (comments || []).map(c => ({
      ...c,
      author_name: c.author?.full_name || null,
      author_role: c.author?.role      || null,
    })),
  };
};

// ─────────────────────────────────────────────────────────────────

const updateEntry = async (entry_id, sections) => {
  const allowed = [
    'edited_payment', 'edited_achievements', 'edited_todos',
    'edited_goals', 'edited_social', 'edited_pipeline',
    'brand_admin_notes',
  ];

  const update = {};
  for (const field of allowed) {
    if (sections[field] !== undefined) update[field] = sections[field];
  }

  if (!Object.keys(update).length) throw new Error('No valid fields provided');

  const { data, error } = await supabase
    .from('weekly_report_entries')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', entry_id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// ─────────────────────────────────────────────────────────────────

const saveAriaDrafts = async (entry_id, drafts) => {
  // Only update fields that have a value — preserves existing drafts
  const update = { aria_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() };

  if (drafts.aria_draft_payment)      update.aria_draft_payment      = drafts.aria_draft_payment;
  if (drafts.aria_draft_achievements) update.aria_draft_achievements = drafts.aria_draft_achievements;
  if (drafts.aria_draft_todos)        update.aria_draft_todos        = drafts.aria_draft_todos;
  if (drafts.aria_draft_goals)        update.aria_draft_goals        = drafts.aria_draft_goals;
  if (drafts.aria_draft_social)       update.aria_draft_social       = drafts.aria_draft_social;
  if (drafts.aria_draft_pipeline)     update.aria_draft_pipeline     = drafts.aria_draft_pipeline;

  const { data, error } = await supabase
    .from('weekly_report_entries')
    .update(update)
    .eq('id', entry_id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// ─────────────────────────────────────────────────────────────────

const submitEntry = async (entry_id, brand_admin_id) => {
  const entry = await getEntryWithComments(entry_id);
  if (!entry) throw new Error('Entry not found');
  if (entry.brand_admin_id !== brand_admin_id) throw new Error('Not authorized');
  if (entry.is_submitted) throw new Error('Already submitted');

  // Where BA left a section blank, fall back to the ARIA draft
  const coalesce = (edited, draft) =>
    (edited && edited.trim()) ? edited : (draft || null);

  const { data, error } = await supabase
    .from('weekly_report_entries')
    .update({
      edited_payment:      coalesce(entry.edited_payment,      entry.aria_draft_payment),
      edited_achievements: coalesce(entry.edited_achievements, entry.aria_draft_achievements),
      edited_todos:        coalesce(entry.edited_todos,        entry.aria_draft_todos),
      edited_goals:        coalesce(entry.edited_goals,        entry.aria_draft_goals),
      edited_social:       coalesce(entry.edited_social,       entry.aria_draft_social),
      edited_pipeline:     coalesce(entry.edited_pipeline,     entry.aria_draft_pipeline),
      is_submitted:        true,
      submitted_at:        new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    })
    .eq('id', entry_id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // after is_submitted = true update...
await notify(
  brand_admin_id,
  'info',
  'Report Submitted',
  `Your weekly report for ${entry.brand_name || 'your brand'} has been submitted for MD review.`,
  { entry_id }
);
  return data;
};

// ── Raw data gathering (for ARIA context) ─────────────────────────

const safeSelect = async (queryFn) => {
  try {
    const { data } = await queryFn();
    return data || [];
  } catch {
    return [];
  }
};

const gatherWeekData = async (brand_id, brand_admin_id, week_start, week_end) => {
  const weekEndTs = `${week_end}T23:59:59.999Z`;

  const [
    tasks_completed,
    tasks_open,
    invoices_this_week,
    payments_this_week,
    briefs_active,
    goals,
    pipeline_notes,
    overdue_invoices,
  ] = await Promise.all([

    // Tasks completed this week
    safeSelect(() => supabase
      .from('tasks')
      .select('title, description, proof_link, assignee:users!assigned_to(full_name)')
      .eq('brand_id', brand_id)
      .in('status', ['done', 'verified'])
      .gte('updated_at', week_start)
      .lte('updated_at', weekEndTs)
      .order('updated_at', { ascending: false })
      .limit(20)
    ),

    // Open tasks
    safeSelect(() => supabase
      .from('tasks')
      .select('title, description, status, due_date, assignee:users!assigned_to(full_name)')
      .eq('brand_id', brand_id)
      .in('status', ['todo', 'to_do', 'in_progress', 'in_verification'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(15)
    ),

    // Invoices this week
    safeSelect(() => supabase
      .from('invoices')
      .select('invoice_number, amount, status, due_date, description')
      .eq('brand_id', brand_id)
      .gte('created_at', week_start)
      .lte('created_at', weekEndTs)
      .order('created_at', { ascending: false })
    ),

    // Payments this week
    safeSelect(() => supabase
      .from('payments')
      .select('amount, payment_date, reference, invoice:invoices!invoice_id(invoice_number, brand_id)')
      .gte('payment_date', week_start)
      .lte('payment_date', week_end)
      .order('payment_date', { ascending: false })
    ).then(rows =>
      // Filter to this brand (can't filter nested relation directly in PostgREST)
      rows.filter(r => r.invoice?.brand_id === brand_id)
    ),

    // Active briefs
    safeSelect(() => supabase
      .from('briefs')
      .select('title, status, is_bau, created_at, description')
      .eq('brand_id', brand_id)
      .not('status', 'in', '(closed,cancelled,archived)')
      .order('created_at', { ascending: false })
      .limit(10)
    ),

    // Brand goals
    safeSelect(() => supabase
      .from('brand_goals')
      .select('title, description, progress_pct, status, target_value, current_value, deadline')
      .eq('brand_id', brand_id)
      .not('status', 'in', '(completed,cancelled)')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(8)
    ),

    // Pipeline notes for this BA's opportunities
    safeSelect(() => supabase
      .from('opportunities')
      .select(`
        company_name, deal_title, stage, estimated_value, stage_changed_at,
        weekly_notes:opportunity_weekly_notes!opportunity_id(notes, week_start)
      `)
      .eq('business_bringer_id', brand_admin_id)
      .not('stage', 'in', '(onboarded,lost_paused)')
      .order('stage_changed_at', { ascending: true })
    ).then(rows => {
      const now = Date.now();
      return rows.map(r => {
        const note = (r.weekly_notes || []).find(n => n.week_start === week_start);
        return {
          company_name:  r.company_name,
          deal_title:    r.deal_title,
          stage:         r.stage,
          estimated_value: r.estimated_value,
          weekly_note:   note?.notes || null,
          note_week:     note?.week_start || null,
          days_in_stage: r.stage_changed_at
            ? Math.floor((now - new Date(r.stage_changed_at).getTime()) / 86400000)
            : null,
        };
      });
    }),

    // Overdue invoices
    safeSelect(() => supabase
      .from('invoices')
      .select('invoice_number, amount, due_date, status')
      .eq('brand_id', brand_id)
      .in('status', ['sent', 'overdue'])
      .lt('due_date', new Date().toISOString().split('T')[0])
      .order('due_date', { ascending: true })
    ),
  ]);

  return {
    week_start,
    week_end,
    tasks_completed:    flattenAssignee(tasks_completed),
    tasks_open:         flattenAssignee(tasks_open),
    invoices_this_week,
    payments_this_week: payments_this_week.map(r => ({ ...r, invoice: undefined, invoice_number: r.invoice?.invoice_number })),
    overdue_invoices,
    briefs_active,
    goals,
    pipeline_notes,
  };
};

// Flatten embedded assignee join: { assignee: { full_name } } → { assigned_to_name }
const flattenAssignee = (rows) =>
  rows.map(r => ({ ...r, assigned_to_name: r.assignee?.full_name || null, assignee: undefined }));

// ── MD Consolidated View ──────────────────────────────────────────

const getConsolidatedView = async (week_start) => {
  const { data: report } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('week_start', week_start)
    .single()
    .catch(() => ({ data: null }));

  if (!report) {
    return { report: null, entries: [], submission_summary: { total: 0, submitted: 0, draft: 0, not_started: 0 } };
  }

  // Fetch entries with brand + admin info
  const { data: entries, error } = await supabase
    .from('weekly_report_entries')
    .select(`
      *,
      brand:brands!brand_id ( name, logo_url ),
      admin:users!brand_admin_id ( full_name, email )
    `)
    .eq('report_id', report.id)
    .order('is_submitted', { ascending: false });

  if (error) throw new Error(error.message);

  // Fetch comment counts per entry
  const entryIds = (entries || []).map(e => e.id);
  let commentCounts = {};

  if (entryIds.length) {
    const { data: comments } = await supabase
      .from('report_comments')
      .select('entry_id, resolved, flagged')
      .in('entry_id', entryIds);

    for (const c of (comments || [])) {
      if (!commentCounts[c.entry_id]) commentCounts[c.entry_id] = { unresolved: 0, flagged: 0 };
      if (!c.resolved) commentCounts[c.entry_id].unresolved += 1;
      if (c.flagged && !c.resolved) commentCounts[c.entry_id].flagged += 1;
    }
  }

  const enriched = (entries || []).map(e => ({
    ...e,
    brand_name:               e.brand?.name     || null,
    logo_url:                 e.brand?.logo_url  || null,
    brand_admin_name:         e.admin?.full_name || null,
    brand_admin_email:        e.admin?.email     || null,
    unresolved_comment_count: commentCounts[e.id]?.unresolved || 0,
    flagged_count:            commentCounts[e.id]?.flagged    || 0,
    brand:                    undefined,
    admin:                    undefined,
  }));

  const total       = enriched.length;
  const submitted   = enriched.filter(e => e.is_submitted).length;
  const draft       = enriched.filter(e => !e.is_submitted && e.aria_generated_at).length;
  const not_started = total - submitted - draft;

  return {
    report,
    entries: enriched,
    submission_summary: { total, submitted, draft, not_started },
  };
};

// ─────────────────────────────────────────────────────────────────

const listReports = async (limit = 12) => {
  const { data: reports, error } = await supabase
    .from('weekly_reports')
    .select('*, entries:weekly_report_entries(id, is_submitted)')
    .order('week_start', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (reports || []).map(r => ({
    ...r,
    total_brands:    r.entries?.length || 0,
    submitted_count: r.entries?.filter(e => e.is_submitted).length || 0,
    entries:         undefined,
  }));
};

// ── Comments ──────────────────────────────────────────────────────

const addComment = async (entry_id, section, comment, author_id, flagged = false) => {
  const { data, error } = await supabase
    .from('report_comments')
    .insert({ entry_id, section, author_id, comment, flagged })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const resolveComment = async (comment_id, resolved_by) => {
  const { data, error } = await supabase
    .from('report_comments')
    .update({
      resolved:    true,
      resolved_by,
      resolved_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', comment_id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// ── Submission status helpers ─────────────────────────────────────

const getWeekSubmissionStatus = async (week_start) => {
  const { data: report } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('week_start', week_start)
    .single()
    .catch(() => ({ data: null }));

  if (!report) return { total: 0, submitted: 0, week_start };

  const { data: entries } = await supabase
    .from('weekly_report_entries')
    .select('id, is_submitted')
    .eq('report_id', report.id);

  const total     = entries?.length || 0;
  const submitted = entries?.filter(e => e.is_submitted).length || 0;

  return { total, submitted, week_start };
};

// ─────────────────────────────────────────────────────────────────

module.exports = {
  getCurrentWeek,
  formatDate,
  getOrCreateReport,
  getBrandAdminBrands,
  getOrCreateEntry,
  getEntryWithComments,
  updateEntry,
  saveAriaDrafts,
  submitEntry,
  gatherWeekData,
  getConsolidatedView,
  listReports,
  addComment,
  resolveComment,
  getWeekSubmissionStatus,
};