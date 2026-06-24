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

const agencyDashboard  = require('./routes/agency/dashboard.routes');
const agencyBrands     = require('./routes/agency/brands.routes');
const agencyClients    = require('./routes/agency/clients.routes');
const agencyStaff      = require('./routes/agency/staff.routes');
const agencyReports    = require('./routes/agency/reports.routes');
const agencyGoals      = require('./routes/agency/goals.routes');
const agencyCompetitors= require('./routes/agency/competitors.routes');
const agencyCalendar   = require('./routes/agency/calendar.routes');
const agencyTasks      = require('./routes/agency/tasks.routes');
const agencyAnalytics  = require('./routes/agency/analytics.routes');
const agencyAudience   = require('./routes/agency/audience.routes');

const clientDashboard  = require('./routes/client/dashboard.routes');
const clientReports    = require('./routes/client/reports.routes');
const clientGoals      = require('./routes/client/goals.routes');
const clientCompetitors= require('./routes/client/competitors.routes');
const clientAsk        = require('./routes/client/ask.routes');

const saAuth       = require('./routes/super-admin/auth.routes');
const saDashboard  = require('./routes/super-admin/dashboard.routes');
const saUsers      = require('./routes/super-admin/users.routes');
const saBrands     = require('./routes/super-admin/brands.routes');
const saAnalytics  = require('./routes/super-admin/analytics.routes');
const saEmails     = require('./routes/super-admin/emails.routes');
const saAudit      = require('./routes/super-admin/audit.routes');
const saSettings   = require('./routes/super-admin/settings.routes');

// ── Middleware ────────────────────────────────────────────────
const { errorHandler }    = require('./middleware/error.middleware');
const { requestLogger }   = require('./middleware/logger.middleware');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Core Middleware ───────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
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
    status: 'ok',
    service: 'Sabi Intelligence Suite API',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Agency Auth ───────────────────────────────────────────────
app.use('/api/auth',         agencyAuthRoutes);

// ── Client Auth ───────────────────────────────────────────────
app.use('/api/client/auth',  clientAuthRoutes);

// ── Super Admin Auth ──────────────────────────────────────────
app.use('/api/super-admin/auth', saAuth);

// ── Agency Routes ─────────────────────────────────────────────
app.use('/api/agency/dashboard',   agencyDashboard);
app.use('/api/agency/brands',      agencyBrands);
app.use('/api/agency/clients',     agencyClients);
app.use('/api/agency/staff',       agencyStaff);
app.use('/api/agency/reports',     agencyReports);
app.use('/api/agency/goals',       agencyGoals);
app.use('/api/agency/competitors', agencyCompetitors);
app.use('/api/agency/calendar',    agencyCalendar);
app.use('/api/agency/tasks',       agencyTasks);
app.use('/api/agency/analytics',   agencyAnalytics);
app.use('/api/agency/audience',    agencyAudience);

// ── Client Portal Routes ──────────────────────────────────────
app.use('/api/client/dashboard',   clientDashboard);
app.use('/api/client/reports',     clientReports);
app.use('/api/client/goals',       clientGoals);
app.use('/api/client/competitors', clientCompetitors);
app.use('/api/client/ask',         clientAsk);

// ── Super Admin Routes ────────────────────────────────────────
app.use('/api/super-admin/dashboard', saDashboard);
app.use('/api/super-admin/users',     saUsers);
app.use('/api/super-admin/brands',    saBrands);
app.use('/api/super-admin/analytics', saAnalytics);
app.use('/api/super-admin/emails',    saEmails);
app.use('/api/super-admin/audit',     saAudit);
app.use('/api/super-admin/settings',  saSettings);

// ── 404 Handler ───────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────
// Render free-tier cold start: respond to health checks immediately
let isReady = false;
const server = app.listen(PORT, () => {
  isReady = true;
  console.log(`\n🚀 Sabi Intelligence Suite API`);
  console.log(`   ➜ Local:    http://localhost:${PORT}`);
  console.log(`   ➜ Health:   http://localhost:${PORT}/health`);
  console.log(`   ➜ Env:      ${process.env.NODE_ENV || 'development'}\n`);
});

// Render cold-start: keep-alive on incoming requests
server.keepAliveTimeout = 65_000;
server.headersTimeout   = 66_000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = app;
