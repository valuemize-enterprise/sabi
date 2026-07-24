/**
 * ════════════════════════════════════════════════════════════════
 * Task Import Service — Sabi Intelligence Suite
 * ════════════════════════════════════════════════════════════════
 *
 * Handles all server-side logic for the spreadsheet-to-Sabi import:
 *   1. Permission guard  — Brand Admin scoped to their brands
 *   2. User resolution   — maps names/emails from the sheet to real user IDs
 *   3. Normalization     — priority aliases, date formats, tags
 *   4. Bulk insert       — single Supabase call, full audit trail
 *
 * Every imported task lands as status 'todo'. This is intentional:
 * Sabi only scores verified tasks, so imports go through the normal
 * verification pipeline just like tasks created in the UI.
 */

'use strict';

const supabase = require("../config/supabase");

 // ← adjust to your db helper path

// ── Priority normalisation ────────────────────────────────────────
// Maps every common spreadsheet value to Sabi's three priority levels.
const PRIORITY_ALIASES = {
  high:   ['high', 'urgent', 'critical', 'asap', 'h', '1', 'p1', 'p0', 'must'],
  medium: ['medium', 'med', 'normal', 'moderate', 'mid', 'average', 'm', '2', 'p2'],
  low:    ['low', 'minor', 'nice to have', 'whenever', 'l', '3', 'p3', 'p4'],
};

function normalizePriority(raw) {
  if (!raw) return 'medium';
  const v = String(raw).toLowerCase().trim();
  for (const [level, aliases] of Object.entries(PRIORITY_ALIASES)) {
    if (aliases.includes(v)) return level;
  }
  return 'medium'; // safe default
}

// ── Date parsing ─────────────────────────────────────────────────
// Handles ISO (2026-08-15), US (08/15/2026), UK/NG (15/08/2026),
// and Excel serial numbers (numeric dates from XLSX parsing).
function parseDate(raw) {
  if (!raw && raw !== 0) return null;

  // Excel serial number (e.g. 46253 = 2026-08-15)
  if (typeof raw === 'number') {
    try {
      // Excel epoch starts 1900-01-01 (with off-by-one quirk)
      const date = new Date(Date.UTC(1900, 0, raw - 1));
      if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    } catch {}
    return null;
  }

  // Already a JS Date (from xlsx cellDates option)
  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
    return null;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO / standard: try direct parse first
  const direct = new Date(s);
  if (!isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);

  // DD/MM/YYYY or DD-MM-YYYY (Nigerian/UK convention)
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    const date = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }

  return null;
}

// ── Tag normalisation ─────────────────────────────────────────────
// Splits comma-separated strings into an array.
function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw).split(/[,;|]/).map(t => t.trim()).filter(Boolean);
}

// ── Permission check ─────────────────────────────────────────────
async function isBrandAdminForBrand(userId, brandId) {
  const { data } = await supabase.from('brand_admins')
    .select('brand_id')
    .eq('user_id', userId)
    .eq('brand_id', brandId);
  return (data || []).length > 0;
}

// ── Get brands this user can import into ─────────────────────────
async function getImportableBrands(caller) {
  const isLeadership = ['super_admin', 'admin', 'md'].includes(caller.role);

  if (isLeadership) {
    const { data } = await supabase.from('brands')
      .select('id, name').order('name');
    return data || [];
  }

  // Scoped to brands where user is brand_admin
  const { data: links } = await supabase.from('brand_admins')
    .select('brand:brands(id, name)')
    .eq('user_id', caller.id);

  return (links || [])
    .map(l => l.brand)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Resolve assignee names/emails → user IDs ─────────────────────
// Builds a lookup map from every user in the brand. Matches:
//   full name (case-insensitive), first name (if unique), email.
async function resolveBrandUsers(brandId) {
  const [{ data: staffLinks }, { data: adminLinks }] = await Promise.all([
    supabase.from('brand_staff')
      .select('user:users(id, full_name, email)')
      .eq('brand_id', brandId),
    supabase.from('brand_admins')
      .select('user:users(id, full_name, email)')
      .eq('brand_id', brandId),
  ]);

  const seen = new Set();
  const users = [];
  for (const link of [...(staffLinks || []), ...(adminLinks || [])]) {
    const u = link.user;
    if (!u || seen.has(u.id)) continue;
    seen.add(u.id);
    users.push(u);
  }

  const nameMap  = new Map(); // lowercase full name → user_id
  const firstMap = new Map(); // lowercase first name → user_id (only if unique)
  const emailMap = new Map(); // lowercase email → user_id
  const firstCount = new Map();

  for (const u of users) {
    const full  = (u.full_name || '').toLowerCase().trim();
    const first = full.split(' ')[0];
    const email = (u.email || '').toLowerCase().trim();

    if (full)  nameMap.set(full, u.id);
    if (email) emailMap.set(email, u.id);

    // Track first-name collisions so we don't misattribute
    firstCount.set(first, (firstCount.get(first) || 0) + 1);
    firstMap.set(first, u.id);
  }

  return {
    resolve(raw) {
      if (!raw) return null;
      const key = String(raw).toLowerCase().trim();
      if (nameMap.has(key))  return nameMap.get(key);
      if (emailMap.has(key)) return emailMap.get(key);
      const first = key.split(' ')[0];
      if ((firstCount.get(first) || 0) === 1) return firstMap.get(first) || null;
      return null;
    },
    userCount: users.length,
  };
}

// ── Main bulk import ──────────────────────────────────────────────
async function bulkImportTasks({ brandId, tasks, callerId }) {
  const resolver = await resolveBrandUsers(brandId);

  const toInsert  = [];
  const warnings  = [];
  const skipped   = [];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const rowNum = i + 1;

    // Skip empty-title rows
    const title = (t.title || '').trim();
    if (!title) {
      skipped.push({ row: rowNum, reason: 'No task title' });
      continue;
    }

    let assignee_id = null;
    let assignee_warning = null;

    if (t.assignee_name) {
      assignee_id = resolver.resolve(t.assignee_name);
      if (!assignee_id) {
        assignee_warning = `"${t.assignee_name}" was not found in this brand's team — task created unassigned`;
        warnings.push({ row: rowNum, task: title, issue: assignee_warning });
      }
    }

    toInsert.push({
      brand_id:    brandId,
      title,
      description: (t.description || '').trim() || null,
      status:      'todo',
      priority:    normalizePriority(t.priority),
      due_date:    parseDate(t.due_date),
      assignee_id,
      created_by:  callerId,
      tags:        normalizeTags(t.tags),
    });
  }

  if (toInsert.length === 0) {
    return {
      created: 0,
      warnings: warnings.length,
      skipped: skipped.length,
      tasks_created: [],
      warnings_detail: warnings,
      skipped_detail: skipped,
    };
  }

  const { data, error } = await supabase.from('tasks')
    .insert(toInsert)
    .select('id, title, assignee_id, priority, due_date, status');

  if (error) throw new Error(`Database insert failed: ${error.message}`);

  return {
    created:         (data || []).length,
    warnings:        warnings.length,
    skipped:         skipped.length,
    tasks_created:   data || [],
    warnings_detail: warnings,
    skipped_detail:  skipped,
  };
}

module.exports = { bulkImportTasks, isBrandAdminForBrand, getImportableBrands };
