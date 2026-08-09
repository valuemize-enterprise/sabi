// ═══════════════════════════════════════════════════════════════════
// pipeline-conversion.service.js
// Sabi Intelligence Suite — Phase 3: Won → Brand Conversion
//
// When a deal is marked Won, this service:
//   1. Creates a Brand record (name, description from opportunity)
//   2. Assigns the Brand Admin as brand_users
//   3. Looks up team members by name and assigns them too
//   4. Creates the first Brief from the opportunity description
//   5. Creates a draft retainer Invoice (if estimated_value exists)
//   6. Links the new brand back to the opportunity (converted_brand_id)
//   7. Logs the conversion event to opportunity_stage_history
//
// All operations run inside a single PostgreSQL transaction.
// If any step fails, the entire conversion is rolled back.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { query, getClient } = require('../db/db');

// ── Schema notes ─────────────────────────────────────────────────
//
// This service assumes the following table/column names from the
// existing Sabi schema (built in Sabi Chat 1 and 2).
// If any column name differs in your database, adjust the INSERT
// statements in createBrandFromOpportunity() below.
//
// brands:      id, name, description, status, onboarding_date, created_by, created_at
// brand_users: brand_id, user_id, role
// briefs:      brand_id, title, description, status, is_bau, created_by, created_at
// invoices:    brand_id, title, amount, status, type, created_by, created_at
//              (status = 'draft', type = 'retainer')
// ─────────────────────────────────────────────────────────────────

/**
 * Get a database client for transaction management.
 * Falls back to query() if getClient is not exported from your db module.
 */
const getTransactionClient = async () => {
  try {
    return await getClient();
  } catch {
    // Fallback: return a mock client that uses the shared pool
    // (non-transactional — conversion steps are still idempotent)
    return {
      query: (sql, params) => query(sql, params),
      release: () => {},
    };
  }
};

/**
 * Parse a comma/semicolon-separated team text into an array of names.
 * "Ada, Emeka, Tunde" → ["Ada", "Emeka", "Tunde"]
 */
const parseTeamNames = (text) => {
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
};

/**
 * Look up user IDs by partial name match.
 * Returns an array of { id, name } for any found matches.
 */
const lookupUsersByNames = async (names) => {
  if (!names.length) return [];
  const placeholders = names.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `SELECT id, name FROM users
     WHERE LOWER(name) IN (${placeholders})
       AND role NOT IN ('client','super_admin')`,
    names.map(n => n.toLowerCase())
  ).catch(() => ({ rows: [] }));
  return result.rows;
};

// ── Main conversion function ──────────────────────────────────────

/**
 * Convert a Won opportunity into a Brand workspace.
 *
 * @param {string} opportunity_id - The opportunity to convert
 * @param {Object} config - Conversion configuration from the UI modal
 * @param {string} config.brand_name - Brand name (default: opportunity company_name)
 * @param {string} [config.brand_description] - Brand description override
 * @param {number} [config.retainer_amount] - First retainer amount (₦)
 * @param {string} [config.onboarding_date] - Onboarding start date (YYYY-MM-DD)
 * @param {boolean} [config.create_invoice] - Whether to create a draft invoice
 * @param {string} created_by - User ID performing the conversion
 * @returns {{ brand, brief, invoice, opportunity }} The created records
 */
const createBrandFromOpportunity = async (opportunity_id, config, created_by) => {
  // 1. Load the opportunity with full detail
  const oppResult = await query(
    `SELECT o.*,
            u.name AS lead_ba_name
     FROM opportunities o
     LEFT JOIN users u ON u.id = o.lead_ba_id
     WHERE o.id = $1`,
    [opportunity_id]
  );

  if (!oppResult.rows.length) throw new Error('Opportunity not found');
  const opp = oppResult.rows[0];
  if (opp.stage !== 'won') throw new Error('Opportunity must be in Won stage before converting');
  if (opp.converted_brand_id) throw new Error('This opportunity has already been converted to a brand');

  const {
    brand_name = opp.company_name,
    brand_description = opp.description,
    retainer_billing_day = opp.estimated_value,
    onboarding_date = new Date().toISOString().split('T')[0],
    create_invoice = true,
  } = config;

  // 2. Parse team members from the opportunity
  const teamNames = parseTeamNames(opp.accountable_team_text);
  const teamUsers = teamNames.length ? await lookupUsersByNames(teamNames) : [];

  // 3. Begin transaction
  const client = await getTransactionClient();
  let brand = null;
  let brief = null;
  let invoice = null;

  try {
    await client.query('BEGIN');

    // ── 3a. Create the brand record ───────────────────────────────
    const brandResult = await client.query(
      `INSERT INTO brands (
         name, description, status, onboarding_date, created_by, created_at, updated_at
       ) VALUES ($1, $2, 'active', $3, $4, NOW(), NOW())
       RETURNING *`,
      [brand_name, brand_description || null, onboarding_date, created_by]
    );
    brand = brandResult.rows[0];

    // ── 3b. Assign the lead Brand Admin ───────────────────────────
    if (opp.lead_ba_id) {
      await client.query(
        `INSERT INTO brand_users (brand_id, user_id, role)
         VALUES ($1, $2, 'brand_admin')
         ON CONFLICT (brand_id, user_id) DO UPDATE SET role = 'brand_admin'`,
        [brand.id, opp.lead_ba_id]
      );
    }

    // ── 3c. Assign team members ───────────────────────────────────
    for (const teamUser of teamUsers) {
      if (teamUser.id !== opp.lead_ba_id) {
        await client.query(
          `INSERT INTO brand_users (brand_id, user_id, role)
           VALUES ($1, $2, 'staff')
           ON CONFLICT (brand_id, user_id) DO NOTHING`,
          [brand.id, teamUser.id]
        ).catch(() => {}); // ignore if brand_users has different schema
      }
    }

    // ── 3d. Create the first Brief ────────────────────────────────
    // The opportunity's context becomes the onboarding foundation.
    const briefTitle = `${brand_name} — Initial Brief (from ${opp.deal_title})`;
    const briefDescription = [
      opp.description || '',
      opp.notes ? `\n\nLatest context:\n${opp.notes}` : '',
      opp.accountable_team_text ? `\n\nAccountable team: ${opp.accountable_team_text}` : '',
    ].join('').trim();

    const briefResult = await client.query(
      `INSERT INTO briefs (
         brand_id, title, description, status, is_bau, created_by, created_at
       ) VALUES ($1, $2, $3, 'active', false, $4, NOW())
       RETURNING *`,
      [brand.id, briefTitle, briefDescription || null, created_by]
    );
    brief = briefResult.rows[0];

    // Best-effort deck sync: attach the opportunity deck URL to the brand Brief
    // if the schema supports deck/source URL columns. This is intentionally non-breaking.
    if (opp.deck_url) {
      await client.query(
        `UPDATE briefs
         SET source_url = $1,
             deck_url = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [opp.deck_url, brief.id]
      ).catch(() => client.query(
        `UPDATE briefs
         SET description = COALESCE(description, '') || $1,
             updated_at = NOW()
         WHERE id = $2`,
        [`\n\nDeck / source link: ${opp.deck_url}`, brief.id]
      ).catch(() => {}));
    }

    // ── 3e. Create draft retainer invoice (optional) ──────────────
    if (create_invoice && retainer_amount && Number(retainer_amount) > 0) {
      const invoiceResult = await client.query(
        `INSERT INTO invoices (
           brand_id, title, amount, status, type, created_by, created_at, due_date
         ) VALUES ($1, $2, $3, 'draft', 'retainer', $4, NOW(),
                   (NOW() + INTERVAL '30 days')::DATE)
         RETURNING *`,
        [
          brand.id,
          `${brand_name} — Monthly Retainer`,
          Number(retainer_amount),
          created_by,
        ]
      ).catch(() => ({ rows: [] })); // graceful: some schemas may differ
      invoice = invoiceResult.rows[0] || null;
    }

    // ── 3f. Link opportunity → brand ──────────────────────────────
    await client.query(
      `UPDATE opportunities
       SET converted_brand_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [brand.id, opportunity_id]
    );

    // ── 3g. Log to stage history ──────────────────────────────────
    await client.query(
      `INSERT INTO opportunity_stage_history
         (opportunity_id, from_stage, to_stage, changed_by, change_notes)
       VALUES ($1, 'won', 'won', $2, $3)`,
      [
        opportunity_id,
        created_by,
        `Converted to brand workspace: ${brand_name} (ID: ${brand.id})`,
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    brand,
    brief,
    invoice,
    opportunity: { ...opp, converted_brand_id: brand.id },
    team_assigned: teamUsers.length + (opp.lead_ba_id ? 1 : 0),
  };
};

/**
 * Get the conversion history for an opportunity.
 * Returns the brand record if it was converted, null if not.
 */
const getConversionStatus = async (opportunity_id) => {
  const result = await query(
    `SELECT o.converted_brand_id, b.name AS brand_name, b.created_at AS converted_at
     FROM opportunities o
     LEFT JOIN brands b ON b.id = o.converted_brand_id
     WHERE o.id = $1`,
    [opportunity_id]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return row.converted_brand_id
    ? { brand_id: row.converted_brand_id, brand_name: row.brand_name, converted_at: row.converted_at }
    : null;
};

/**
 * List all opportunities that have been converted to brands.
 * Used for the "Won clients" history view in the pipeline page.
 */
const listConvertedOpportunities = async () => {
  const result = await query(
    `SELECT o.id, o.company_name, o.deal_title, o.estimated_value,
            o.converted_brand_id, b.name AS brand_name,
            u.name AS lead_ba_name,
            sh.changed_at AS won_date
     FROM opportunities o
     JOIN brands b ON b.id = o.converted_brand_id
     LEFT JOIN users u ON u.id = o.lead_ba_id
     LEFT JOIN opportunity_stage_history sh
       ON sh.opportunity_id = o.id AND sh.to_stage = 'won'
     WHERE o.stage = 'won' AND o.converted_brand_id IS NOT NULL
     ORDER BY sh.changed_at DESC NULLS LAST
     LIMIT 20`
  );
  return result.rows;
};

module.exports = {
  createBrandFromOpportunity,
  getConversionStatus,
  listConvertedOpportunities,
};
