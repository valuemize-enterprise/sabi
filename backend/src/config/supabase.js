/**
 * Supabase Client Configuration
 * Uses the SERVICE ROLE key (bypasses RLS) — backend only, never expose to frontend
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
    detectSessionInUrl: false,
  },
  db: { schema: 'public' },
});

module.exports = supabase;
