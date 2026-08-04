// ═══════════════════════════════════════════════════════════════════
// workforce.service.js
// Sabi Intelligence Suite — Phase D: MD Dashboard
//
// Aggregates all four workforce snapshot widgets in one round trip.
// Called by the Command Centre below the 8 dials — polled every 60s.
// Also feeds the HR & Workforce goal category in Agency Goals.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const supabase      = require('../config/supabase');
const { query }     = require('../db/db');

// ── Headcount ─────────────────────────────────────────────────────
// Core staff + support staff + interns, all active.

const getHeadcount = async () => {
  const [coreRes, supportRes] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE employment_category = 'core'   AND employment_status = 'active') AS core,
         COUNT(*) FILTER (WHERE employment_category = 'intern' AND employment_status = 'active') AS intern
       FROM people_records`
    ).catch(() => ({ rows: [{ core: 0, intern: 0 }] })),

    query(
      `SELECT COUNT(*) AS support
       FROM support_staff_directory
       WHERE status = 'active'`
    ).catch(() => ({ rows: [{ support: 0 }] })),
  ]);

  const core    = Number(coreRes.rows[0]?.core    || 0);
  const intern  = Number(coreRes.rows[0]?.intern  || 0);
  const support = Number(supportRes.rows[0]?.support || 0);

  return {
    id:      'headcount',
    icon:    '👥',
    label:   'Total Staff',
    primary: core + support + intern,
    unit:    'people',
    detail: [
      { label: 'Core',    count: core    },
      { label: 'Support', count: support },
      { label: 'Intern',  count: intern  },
    ],
    href: '/people',
  };
};

// ── Upcoming birthdays ─────────────────────────────────────────────
// Names + dates for the current calendar month.
// Pulls from both people_records and support_staff_directory.

const getUpcomingBirthdays = async () => {
  const now         = new Date();
  const month       = now.getMonth() + 1;       // 1-12
  const today       = now.getDate();

  const [staffRes, supportRes] = await Promise.all([
    query(
      `SELECT u.full_name AS name, pr.date_of_birth AS dob
       FROM people_records pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.employment_status = 'active'
         AND pr.date_of_birth IS NOT NULL
         AND EXTRACT(MONTH FROM pr.date_of_birth) = $1
       ORDER BY EXTRACT(DAY FROM pr.date_of_birth) ASC`,
      [month]
    ).catch(() => ({ rows: [] })),

    query(
      `SELECT full_name AS name, date_of_birth AS dob
       FROM support_staff_directory
       WHERE status = 'active'
         AND date_of_birth IS NOT NULL
         AND EXTRACT(MONTH FROM date_of_birth) = $1
       ORDER BY EXTRACT(DAY FROM date_of_birth) ASC`,
      [month]
    ).catch(() => ({ rows: [] })),
  ]);

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabel = monthNames[now.getMonth()];

  const combined = [
    ...staffRes.rows,
    ...supportRes.rows,
  ].map(row => ({
    name: row.name,
    day:  new Date(row.dob).getUTCDate(),
    hasPassed: new Date(row.dob).getUTCDate() < today,
  })).sort((a, b) => a.day - b.day);

  const upcoming = combined.filter(b => !b.hasPassed);

  return {
    id:      'birthdays',
    icon:    '🎂',
    label:   `Birthdays in ${monthLabel}`,
    primary: combined.length,
    unit:    combined.length === 1 ? 'birthday' : 'birthdays',
    detail:  combined.map(b => ({
      label: b.name,
      count: b.day,
      sub:   `${b.day} ${monthLabel}${b.hasPassed ? ' · past' : ''}`,
    })),
    upcoming: upcoming.length,
    href: '/people?tab=insights',
  };
};

// ── Live leave snapshot ────────────────────────────────────────────
// How many people are on approved leave today + how many pending.

const getLeaveSnapshot = async () => {
  const today = new Date().toISOString().split('T')[0];

  const result = await query(
    `SELECT
       COUNT(*) FILTER (
         WHERE status = 'approved'
           AND start_date::date <= $1::date
           AND end_date::date   >= $1::date
       ) AS on_leave,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending
     FROM leave_requests`,
    [today]
  ).catch(() => ({ rows: [{ on_leave: 0, pending: 0 }] }));

  const onLeave = Number(result.rows[0]?.on_leave || 0);
  const pending = Number(result.rows[0]?.pending  || 0);

  // Fetch names of who's currently on leave for the expanded tooltip
  const namesResult = await query(
    `SELECT u.full_name AS name, lr.leave_type, lr.end_date
     FROM leave_requests lr
     JOIN users u ON u.id = lr.user_id
     WHERE lr.status = 'approved'
       AND lr.start_date::date <= $1::date
       AND lr.end_date::date   >= $1::date
     ORDER BY lr.end_date ASC
     LIMIT 10`,
    [today]
  ).catch(() => ({ rows: [] }));

  return {
    id:      'leave',
    icon:    '🏖️',
    label:   'Live Leave',
    primary: onLeave,
    unit:    onLeave === 1 ? 'on leave' : 'on leave',
    pending,
    detail:  namesResult.rows.map(r => ({
      label: r.name,
      sub:   `${r.leave_type} · back ${new Date(r.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      count: null,
    })),
    href: '/people?tab=leave',
  };
};

// ── Vacancies ─────────────────────────────────────────────────────

const getVacancyCount = async () => {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'open')   AS open_count,
       COUNT(*) FILTER (WHERE status = 'filled'
                         AND date_filled >= DATE_TRUNC('year', NOW())) AS filled_this_year
     FROM vacancies`
  ).catch(() => ({ rows: [{ open_count: 0, filled_this_year: 0 }] }));

  const openCount       = Number(result.rows[0]?.open_count       || 0);
  const filledThisYear  = Number(result.rows[0]?.filled_this_year  || 0);

  // Fetch role names for the tooltip
  const rolesResult = await query(
    `SELECT role_name, department, date_opened
     FROM vacancies
     WHERE status = 'open'
     ORDER BY date_opened ASC
     LIMIT 5`
  ).catch(() => ({ rows: [] }));

  return {
    id:      'vacancies',
    icon:    '📋',
    label:   'Open Positions',
    primary: openCount,
    unit:    openCount === 1 ? 'vacancy' : 'vacancies',
    filledThisYear,
    detail:  rolesResult.rows.map(r => ({
      label: r.role_name,
      sub:   `${r.department || 'No dept'} · open since ${new Date(r.date_opened).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      count: null,
    })),
    href: '/people?tab=alerts',
  };
};

// ── Master aggregator ─────────────────────────────────────────────

const getWorkforceSnapshot = async () => {
  const [headcount, birthdays, leave, vacancies] = await Promise.all([
    getHeadcount().catch(e => ({
      id: 'headcount', icon: '👥', label: 'Total Staff',
      primary: 0, error: e.message,
    })),
    getUpcomingBirthdays().catch(e => ({
      id: 'birthdays', icon: '🎂', label: 'Birthdays',
      primary: 0, error: e.message,
    })),
    getLeaveSnapshot().catch(e => ({
      id: 'leave', icon: '🏖️', label: 'Live Leave',
      primary: 0, error: e.message,
    })),
    getVacancyCount().catch(e => ({
      id: 'vacancies', icon: '📋', label: 'Open Positions',
      primary: 0, error: e.message,
    })),
  ]);

  return {
    widgets:    [headcount, birthdays, leave, vacancies],
    fetched_at: new Date().toISOString(),
  };
};

module.exports = {
  getWorkforceSnapshot,
  getHeadcount,
  getUpcomingBirthdays,
  getLeaveSnapshot,
  getVacancyCount,
};
