// ═══════════════════════════════════════════════════════════════════
// backend/src/db/db.js
//
// Raw PostgreSQL query wrapper for the Sabi pipeline services.
// Uses pg (node-postgres) with your Supabase DATABASE_URL.
//
// The rest of the Sabi backend uses the Supabase JS client
// (config/supabase.js). This file exists alongside it — it gives
// the pipeline services (Phase 0–3) the query() and getClient()
// functions they need for complex SQL and atomic transactions.
//
// REQUIRED ENV VARIABLE:
//   DATABASE_URL=postgresql://postgres:[your-db-password]@[your-supabase-host]:5432/postgres
//
// Where to get it:
//   Supabase Dashboard → Your Project → Settings → Database
//   → Connection string → URI → copy the "Connection string" value
//   (use the "Session" mode connection string, port 5432)
// ═══════════════════════════════════════════════════════════════════

'use strict';

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error(
    '[db/db.js] DATABASE_URL is not set. ' +
    'Go to Supabase Dashboard → Settings → Database → Connection string → URI ' +
    'and add DATABASE_URL to your .env file.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL in production
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  // Keep pool small — this is for pipeline queries alongside the
  // Supabase JS client which manages its own connections
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log connection errors so they surface clearly
pool.on('error', (err) => {
  console.error('[db/db.js] Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Run a parameterised SQL query.
 * Usage: const result = await query('SELECT * FROM table WHERE id = $1', [id]);
 *        result.rows — array of row objects
 *        result.rowCount — number of rows affected
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a raw client from the pool — required for transactions.
 * Always release() the client in a finally block.
 *
 * Usage:
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     await client.query('INSERT INTO ...');
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 */
const getClient = () => pool.connect();

module.exports = { query, getClient };
