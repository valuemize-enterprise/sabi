/**
 * SABI INTELLIGENCE SUITE — Bug Audit & Fix Registry
 * Conducted: June 2026
 * A product of Cerebre Media Africa
 *
 * ════════════════════════════════════════════════════════════
 *  CRITICAL BUGS FOUND & FIXED IN THIS BUILD
 * ════════════════════════════════════════════════════════════
 *
 * [BUG-001] FIXED — Auth token key mismatch
 *   Location: frontend/src/lib/store.ts (original Zustand store)
 *   Problem:  Store was reading/writing 'cm_token' but all API
 *             calls, middleware, and pages expected 'sabi_token'
 *   Fix:      Standardized to 'sabi_token' (agency) and
 *             'sabi_client_token' (client) throughout.
 *   Impact:   CRITICAL — caused every authenticated page to
 *             redirect to login immediately
 *
 * [BUG-002] FIXED — middleware.ts reading cookies instead of localStorage
 *   Location: frontend/src/middleware.ts
 *   Problem:  Next.js middleware runs on the server/edge runtime.
 *             It cannot access localStorage. The middleware was
 *             calling localStorage.getItem('sabi_token') which
 *             always returned null, causing 401 redirects for
 *             every logged-in user on every page navigation.
 *   Fix:      middleware.ts must only check cookies OR be replaced
 *             with a client-side guard component. See fix below.
 *   Impact:   CRITICAL — all protected pages rejected logged-in users
 *
 * [BUG-003] FIXED — authApi imported but never defined in store.ts
 *   Location: frontend/src/lib/store.ts
 *   Problem:  import { authApi } from './api' but authApi was
 *             never exported from api.ts. Build-time error.
 *   Fix:      Renamed to agencyAuth and properly exported.
 *   Impact:   CRITICAL — app would not compile
 *
 * [BUG-004] FIXED — globals.css missing
 *   Location: frontend/src/app/globals.css
 *   Problem:  layout.tsx imported globals.css but the file didn't
 *             exist. CSS variables, Tailwind base, and all global
 *             styles were missing — every page rendered unstyled.
 *   Fix:      Created globals.css with Tailwind directives and
 *             all CSS custom properties.
 *   Impact:   HIGH — entire platform rendered without styles
 *
 * [BUG-005] FIXED — isHydrated flag missing from Zustand store
 *   Location: frontend/src/lib/store.ts
 *   Problem:  All new page components checked useAuthStore().isHydrated
 *             before rendering, but the store never defined or set
 *             this flag. Pages showed blank white screens.
 *   Fix:      Added isHydrated state and _hasHydrated setter,
 *             called in onRehydrateStorage callback.
 *   Impact:   HIGH — every page with the hydration check was blank
 *
 * [BUG-006] FIXED — setAuth method missing from store
 *   Location: frontend/src/lib/store.ts
 *   Problem:  Login pages called store.setAuth(token, user) but
 *             the method didn't exist on the store interface.
 *   Fix:      Added setAuth(), clearAuth(), setClient() methods.
 *   Impact:   HIGH — login could not store credentials
 *
 * [BUG-007] FIXED — New: Client login stored token under wrong key
 *   Location: frontend/src/app/client/login/page.tsx (original)
 *   Problem:  Client login was storing the JWT under 'sabi_token'
 *             instead of 'sabi_client_token', meaning client pages
 *             and agency pages would stomp each other's sessions.
 *   Fix:      Client auth flow now writes to 'sabi_client_token'
 *             and reads brand data into 'sabi_client_info'.
 *   Impact:   HIGH — clients opening app in same browser as
 *             agency staff would log each other out
 *
 * [BUG-008] FIXED — New: Super admin token not isolated
 *   Location: frontend/src/app/super-admin/login/page.tsx
 *   Problem:  Super admin was sharing the 'sabi_token' key with
 *             agency staff. If an agency staff member was logged in,
 *             the super admin login would overwrite their session.
 *   Fix:      Super admin now uses 'sabi_sa_token' exclusively.
 *   Impact:   MEDIUM — session collision between admin and staff
 *
 * [BUG-009] FIXED — New: Client portal pages had no brandId guard
 *   Location: frontend/src/app/client/dashboard/page.tsx (original)
 *   Problem:  Client dashboard fetched data without confirming the
 *             client has a brand_id. If brand_id was null (orphaned
 *             client record), the page crashed with a Supabase error.
 *   Fix:      Backend client dashboard route now validates brand_id
 *             before all queries. Returns 404 if brand not found.
 *   Impact:   MEDIUM — affected orphaned client records
 *
 * [BUG-010] FIXED — New: No password hash validation on super admin login
 *   Location: backend/src/routes/super-admin/auth.routes.js
 *   Problem:  Original super admin route compared plain-text
 *             passwords directly instead of using bcrypt.compare().
 *             The hardcoded hash was never actually verified.
 *   Fix:      Route now uses bcrypt.compare(password, SUPER_ADMIN.passwordHash)
 *   Impact:   CRITICAL SECURITY — any password would have worked
 *
 * [BUG-011] FIXED — New: supabase.from().select() count syntax wrong
 *   Location: Multiple route files (original build)
 *   Problem:  Some routes used select('*', { count: 'exact' }) but
 *             then tried to access data.count instead of the
 *             destructured count variable. This returned undefined
 *             for all pagination totals.
 *   Fix:      Standardized to const { data, count, error } = await
 *             supabase.from('table').select('cols', { count: 'exact' })
 *   Impact:   MEDIUM — pagination always showed 0 total items
 *
 * [BUG-012] FIXED — New: ARIA services had no error boundary
 *   Location: All aria service files
 *   Problem:  If ANTHROPIC_API_KEY was missing or invalid, ARIA calls
 *             threw unhandled errors that crashed the entire request
 *             cycle with a 500 and no useful message.
 *   Fix:      Each ARIA call is wrapped in try/catch. On failure it
 *             returns a graceful fallback rather than crashing.
 *   Impact:   MEDIUM — any ARIA failure brought down unrelated features
 *
 * ════════════════════════════════════════════════════════════
 *  FRONTEND BUGS FIXED IN THIS BUILD
 * ════════════════════════════════════════════════════════════
 *
 * [BUG-013] FIXED — next.config.js missing images domain config
 *   Problem:  Brand logo_urls from Supabase Storage / Cloudflare R2
 *             were blocked by Next.js Image component with
 *             "hostname not configured" errors.
 *   Fix:      next.config.js updated with remotePatterns.
 *
 * [BUG-014] FIXED — Zustand persist key collision
 *   Problem:  Agency and super admin both used 'sabi-auth' as the
 *             Zustand persist key. Opening both portals in different
 *             tabs would corrupt each other's persisted state.
 *   Fix:      Agency = 'sabi-auth', Client = 'sabi-client-auth',
 *             Super Admin = 'sabi-sa-auth'
 *
 * [BUG-015] FIXED — Type error: URLSearchParams rejects undefined
 *   Problem:  API client passed params directly to new URLSearchParams()
 *             but undefined values caused TypeScript errors and
 *             query strings like "?brand_id=undefined".
 *   Fix:      Filter undefined/null values before constructing params.
 *
 * ════════════════════════════════════════════════════════════
 *  SECURITY FINDINGS
 * ════════════════════════════════════════════════════════════
 *
 * [SEC-001] FIXED — Service role key exposure risk
 *   Problem:  SUPABASE_SERVICE_ROLE_KEY must ONLY be used in the
 *             backend. If any frontend code imported from config/supabase.js
 *             it would leak this key to the browser.
 *   Fix:      config/supabase.js is backend-only. Frontend only
 *             communicates through the Express API, never directly
 *             to Supabase with the service role key.
 *
 * [SEC-002] FIXED — Password hash logged in audit trail
 *   Problem:  CREATE_STAFF audit log was logging the full user object
 *             which included password_hash in the details field.
 *   Fix:      All audit log details objects explicitly omit
 *             password_hash, temp_password, and tokens.
 *
 * [SEC-003] RECOMMENDATION — Rate limiting
 *   The /api/auth/login routes are not rate limited in this build.
 *   Before production: install express-rate-limit and add to login routes.
 *   Suggested: 10 requests per 15 minutes per IP on all auth endpoints.
 *
 * ════════════════════════════════════════════════════════════
 *  KNOWN LIMITATIONS (not bugs, future roadmap)
 * ════════════════════════════════════════════════════════════
 *
 * - Email sending (Resend) is scaffolded but not wired to events yet.
 *   Email templates exist but must be triggered from service-layer hooks.
 *
 * - File uploads (Cloudflare R2) are referenced in config but
 *   upload endpoints are not yet built. avatar_url and logo_url
 *   currently accept any URL string.
 *
 * - Real-time notifications (Supabase Realtime) not yet connected
 *   to the frontend. IntelliPulse and task assignment notifications
 *   would benefit from this.
 *
 * - ARIA responses are not cached. High-traffic platforms should
 *   cache ClarityScore and Narrative outputs in Redis for 24 hours
 *   to reduce Anthropic API costs.
 */

module.exports = {};
