/**
 * Sabi Intelligence Suite — Express Backend
 * A product of Cerebre Media Africa
 * ─────────────────────────────────────────
 * Entry point. Mounts all route groups, middleware, and error handlers.
 */

'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');

// ── Route imports ─────────────────────────────────────────────
const agencyAuthRoutes     = require('./routes/auth.routes');
const clientAuthRoutes     = require('./routes/client/auth.routes');
const superAdminAuthRoutes = require('./routes/super-admin/auth.routes');

// ── Agency Routes ─────────────────────────────────────────────
const agencyDashboard     = require('./routes/agency/dashboard.routes');
const agencyBrands        = require('./routes/agency/brands.routes');
const agencyClients       = require('./routes/agency/clients.routes');
const agencyStaff         = require('./routes/agency/staff.routes');
const agencyReports       = require('./routes/agency/reports.routes');
const agencyGoals         = require('./routes/agency/goals.routes');
const agencyCompetitors   = require('./routes/agency/competitors.routes');
const agencyCalendar      = require('./routes/agency/calendar.routes');
const agencyTasks         = require('./routes/agency/tasks.routes');
const agencyAnalytics     = require('./routes/agency/analytics.routes');
const agencyAudience      = require('./routes/agency/audience.routes');
const agencyStrategies    = require('./routes/agency/strategies.routes');    // NEW
const agencyWorkLogs      = require('./routes/agency/work-logs.routes');     // NEW
const agencyDeliverables  = require('./routes/agency/deliverables.routes');  // NEW
const agencyNotifications = require('./routes/agency/notifications.routes'); // NEW
const agencyBrandTeam     = require('./routes/agency/brand-team.routes');    // NEW
const agencyAsk           = require('./routes/agency/ask.routes');    

const agencyBriefs      = require('./routes/agency/briefs.routes');
const agencyTasksV2     = require('./routes/agency/tasks-v2.routes');     // replaces old tasks
const agencySocialRpts  = require('./routes/agency/social-reports.routes');
const clientBriefs      = require('./routes/client/briefs.routes');
const inviteRoutes      = require('./routes/auth/invite.routes');
const ariaService       = require('./services/aria/aria-strategy.service'); // NEW

// ── Client Portal Routes ──────────────────────────────────────
const clientDashboard     = require('./routes/client/dashboard.routes');
const clientReports       = require('./routes/client/reports.routes');
const clientGoals         = require('./routes/client/goals.routes');
const clientCompetitors   = require('./routes/client/competitors.routes');
const clientAsk           = require('./routes/client/ask.routes');
const clientTeam          = require('./routes/client/team.routes');          // NEW
const clientWorkLogs      = require('./routes/client/work-logs.routes');     // NEW
const clientDeliverables  = require('./routes/client/deliverables.routes');  // NEW
const clientNotifications = require('./routes/client/notifications.routes'); // NEW
const clientSatisfaction  = require('./routes/client/satisfaction.routes');  // NEW
const clientMoments       = require('./routes/client/moments.routes');       // NEW
const clientProofOfValue  = require('./routes/client/proof-of-value.routes');// NEW
const clientBrandIdentity = require('./routes/client/brand-identity.routes');// NEW
const clientStrategies    = require('./routes/client/strategies.routes');    // NEW

// ── Super Admin Routes ────────────────────────────────────────
const saAuth       = require('./routes/super-admin/auth.routes');
const saDashboard  = require('./routes/super-admin/dashboard.routes');
const saUsers      = require('./routes/super-admin/users.routes');
const saBrands     = require('./routes/super-admin/brands.routes');
const saAnalytics  = require('./routes/super-admin/analytics.routes');
const saEmails     = require('./routes/super-admin/emails.routes');
const saAudit      = require('./routes/super-admin/audit.routes');
const saClients    = require('./routes/super-admin/clients.routes');         // NEW
const saSettings   = require('./routes/super-admin/settings.routes');

const systemNotifications = require('./routes/system.notifications.routes');

const agencyProfileRoutes      = require('./routes/agency/profile.routes');
const agencyBrandIdentityRoutes= require('./routes/agency/brand-identity.routes');

const financialsRoutes          = require('./routes/agency/financials.routes');
const briefClassificationRoutes = require('./routes/agency/brief-classification.routes');
const coreFunctionsRoutes       = require('./routes/agency/core-functions.routes');
const staffLeaveRoutes          = require('./routes/agency/staff-leave.routes');

const taskVerificationRoutes    = require('./routes/agency/task-verification.routes');
const contributionClaimsRoutes  = require('./routes/agency/contribution-claims.routes');
const weeklyRatingsRoutes       = require('./routes/agency/weekly-ratings.routes');
const scoringRoutes             = require('./routes/agency/scoring.routes');

const agencyTargetsRoutes       = require('./routes/agency/agency-targets.routes');
const pulseRoutes               = require('./routes/agency/pulse.routes');
const leaderboardRoutes         = require('./routes/agency/leaderboard.routes');

  const { profileFormRouter } = require('./routes/profile-form.routes');
   

// ── People OS Routes ─────────────────────────────────────────
const { peopleRouter, leaveRouter } = require('./routes/people.routes');


// ── Middleware ────────────────────────────────────────────────
const { errorHandler }  = require('./middleware/error.middleware');
const { requestLogger } = require('./middleware/logger.middleware');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Core Middleware ───────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));


app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
      .split(',').map(o => o.trim());
    if (!origin || allowed.includes(origin) || allowed.includes('*')) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'Sabi Intelligence Suite API',
    version:   process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Auth ──────────────────────────────────────────────────────
app.use('/api/auth',             agencyAuthRoutes);
app.use('/api/client/auth',      clientAuthRoutes);
app.use('/api/super-admin/auth', superAdminAuthRoutes);

// ── Agency Routes ─────────────────────────────────────────────
app.use('/api/agency/dashboard',    agencyDashboard);
app.use('/api/agency/brands',       agencyBrands);
app.use('/api/agency/clients',      agencyClients);
app.use('/api/agency/staff',        agencyStaff);
app.use('/api/agency/reports',      agencyReports);
app.use('/api/agency/goals',        agencyGoals);
app.use('/api/agency/competitors',  agencyCompetitors);
app.use('/api/agency/calendar',     agencyCalendar);
app.use('/api/agency/tasks',        agencyTasks);
app.use('/api/agency/analytics',    agencyAnalytics);
app.use('/api/agency/audience',     agencyAudience);
app.use('/api/agency/strategies',   agencyStrategies);    // NEW
app.use('/api/agency/work-logs',    agencyWorkLogs);      // NEW
app.use('/api/agency/deliverables', agencyDeliverables);  // NEW
app.use('/api/agency/notifications',agencyNotifications); // NEW
app.use('/api/agency/ask',          agencyAsk);           // NEW

// Brand team — uses mergeParams to access :brandId inside the router
app.use('/api/agency/brands/:brandId/team', (req, _res, next) => {
  next();
}, agencyBrandTeam);                                      // NEW

// ── Client Portal Routes ──────────────────────────────────────
app.use('/api/client/dashboard',    clientDashboard);
app.use('/api/client/reports',      clientReports);
app.use('/api/client/goals',        clientGoals);
app.use('/api/client/competitors',  clientCompetitors);
app.use('/api/client/ask',          clientAsk);
app.use('/api/client/team',         clientTeam);          // NEW
app.use('/api/client/work-logs',    clientWorkLogs);      // NEW
app.use('/api/client/deliverables', clientDeliverables);  // NEW
app.use('/api/client/notifications',clientNotifications); // NEW
app.use('/api/client/satisfaction', clientSatisfaction);  // NEW
app.use('/api/client/moments',      clientMoments);       // NEW
app.use('/api/client/proof-of-value',clientProofOfValue); // NEW
app.use('/api/client/brand/identity', clientBrandIdentity);// NEW
app.use('/api/client/strategies',    clientStrategies);    // NEW

// ── Super Admin Routes ────────────────────────────────────────
app.use('/api/super-admin/dashboard', saDashboard);
app.use('/api/super-admin/users',     saUsers);
app.use('/api/super-admin/brands',    saBrands);
app.use('/api/super-admin/analytics', saAnalytics);
app.use('/api/super-admin/emails',    saEmails);
app.use('/api/super-admin/audit',     saAudit);
app.use('/api/super-admin/clients',   saClients);         // NEW
app.use('/api/super-admin/settings',  saSettings);

// ── Command Center ──────────────────────────────────────────
app.use('/api/agency/command', require('./routes/command.routes'));

// ── System Notifications (sweep + test) ──────────────────────
app.use('/api/system/notifications',  systemNotifications);


app.use('/api/agency/briefs',           agencyBriefs);
app.use('/api/agency/tasks',            agencyTasksV2);      // replaces old agencyTasks
app.use('/api/agency/social-reports',   agencySocialRpts);
app.use('/api/agency/staff',                    agencyProfileRoutes);
app.use('/api/agency/brands/:id/identity',      agencyBrandIdentityRoutes);

// Client
app.use('/api/client/briefs',           clientBriefs);

// Invitations (public routes — no auth middleware)
app.use('/api/auth/invite',             inviteRoutes);

// Phase 1 — financials, brief classification, core functions, staff leave
app.use('/api/agency',                  financialsRoutes);
app.use('/api/agency',                  briefClassificationRoutes);
app.use('/api/agency/core-functions',   coreFunctionsRoutes);
app.use('/api/agency/staff-leave',      staffLeaveRoutes);

// Phase 2 — task verification, contribution claims, weekly ratings, scoring
app.use('/api/agency/tasks',            taskVerificationRoutes);
app.use('/api/agency/contribution-claims', contributionClaimsRoutes);
app.use('/api/agency/weekly-ratings',   weeklyRatingsRoutes);
app.use('/api/agency/scores',           scoringRoutes);

// Phase 3 — agency targets, MD weekly pulse, leaderboard
app.use('/api/agency/targets',          agencyTargetsRoutes);
app.use('/api/agency/pulse',            pulseRoutes);
app.use('/api/agency/leaderboard',      leaderboardRoutes);

// Phase 4 — People OS
app.use('/api/people',                  peopleRouter);
app.use('/api/leave',                   leaveRouter);
app.use('/api/people',                  profileFormRouter);

// ── 404 Handler ───────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    data: null
  });
});

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────
// Render free-tier cold start: respond to health checks immediately
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Sabi Intelligence Suite API`);
  console.log(`   ➜ Local:   http://localhost:${PORT}`);
  console.log(`   ➜ Health:  http://localhost:${PORT}/health`);
  console.log(`   ➜ Env:     ${process.env.NODE_ENV || 'development'}\n`);
});

// Render cold-start: keep-alive on incoming requests
server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;

// ── Fallback sweeper while server is awake (hourly) ──────────
// Primary trigger should still be the cron ping — this only covers gaps.
const { runSweep } = require('./services/notification-sweeper.service');
let lastSweep = 0;
setInterval(() => {
  if (Date.now() - lastSweep > 50 * 60 * 1000) {
    lastSweep = Date.now();
    runSweep().catch(e => console.error('[sweep]', e.message));
  }
}, 10 * 60 * 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = app;