# Sabi Intelligence Suite

**AI-powered marketing intelligence platform** — A product of Cerebre Media Africa, Lagos, Nigeria.

Sabi helps brands and agency partners track performance, set goals, analyse competitors, generate AI-powered reports, and measure ROI — all powered by **ARIA** (Advanced Reporting & Intelligence Analyst), an Anthropic Claude-driven engine.

---

## Tech Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js 14 (App Router), TypeScript, React 18, Tailwind CSS 3, Zustand 4, Recharts 2, Lucide React | Vercel |
| Backend | Node.js, Express 4.x | Render |
| Database | PostgreSQL (via Supabase) | Supabase |
| AI Engine | Anthropic Claude (Sonnet 4-6) | Anthropic API |
| Cache | Redis (via Upstash, optional) | Upstash |
| File Storage | Cloudflare R2 (optional) | Cloudflare |
| Email | Resend (scaffolded) | Resend |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Agency   │  │ Client   │  │ Super Admin          │  │
│  │ Portal   │  │ Portal   │  │ (within Agency UI)   │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       │              │                   │              │
│       └──────────────┼───────────────────┘              │
│                      │                                  │
│              ┌───────┴────────┐                         │
│              │   API Client   │  api.ts                 │
│              │ (3 auth tokens)│                         │
│              └───────┬────────┘                         │
└──────────────────────┼──────────────────────────────────┘
                       │ HTTP / JSON
┌──────────────────────┼──────────────────────────────────┐
│           Express.js Backend (REST API)                  │
│  ┌─────────┐ ┌──────────┐ ┌───────────────────────┐    │
│  │ Agency  │ │ Client   │ │ Super Admin           │    │
│  │ Routes  │ │ Routes   │ │ Routes                │    │
│  └────┬────┘ └────┬─────┘ └───────┬───────────────┘    │
│       │            │               │                     │
│  ┌────┴────────────┴───────────────┴────┐               │
│  │         Auth Middleware              │                │
│  │   (JWT verify + RBAC permissions)    │               │
│  └─────────────────┬───────────────────┘                │
│  ┌─────────────────┴───────────────────┐                │
│  │           ARIA AI Engine            │                │
│  │  ┌───────┐ ┌────────┐ ┌──────────┐ │                │
│  │  │Clarity │ │Narrative│ │Velocity  │ │               │
│  │  │Score   │ │AI      │ │Tracker   │ │               │
│  │  ├────────┤ ├────────┤ ├──────────┤ │               │
│  │  │Depth   │ │Intelli │ │MomentMap │ │               │
│  │  │View    │ │Pulse   │ │          │ │               │
│  │  ├────────┤ ├────────┤ ├──────────┤ │               │
│  │  │Audience│ │Proof of│ │Ask ARIA  │ │               │
│  │  │IQ      │ │Value   │ │(chat)    │ │               │
│  │  └────────┘ └────────┘ └──────────┘ │               │
│  └─────────────────┬───────────────────┘                │
│  ┌─────────────────┴───────────────────┐                │
│  │         Supabase (service_role)     │                │
│  │         PostgreSQL Database         │                │
│  └─────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘
```

The backend uses a **service-role Supabase client** — the frontend never calls Supabase directly. All database access goes through Express routes.

Three **isolated authentication domains** with separate JWT secrets and localStorage keys prevent session collision between agency staff, clients, and super admins.

---

## Directory Structure

```
sabi/
├── backend/
│   ├── src/
│   │   ├── server.js                 # Express entry point
│   │   ├── config/                   # Supabase, RBAC roles, SA config
│   │   ├── db/schema.sql             # Full PostgreSQL schema (14 tables)
│   │   ├── middleware/               # Auth, error, logger
│   │   ├── routes/                   # agency/, client/, super-admin/
│   │   ├── services/aria/            # 10 AI service modules
│   │   └── utils/                    # JWT, response helpers
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                      # Next.js App Router pages
│   │   │   ├── (internal)/           # Agency & Super Admin (protected)
│   │   │   ├── client/               # Client portal (protected)
│   │   │   ├── login/                # Agency login
│   │   │   └── set-password/         # First-time password reset
│   │   ├── components/               # AuthGuard, UI kit, sidebars
│   │   └── lib/                      # API client (api.ts), Zustand stores
│   ├── package.json
│   └── .env.example
├── deploy/
│   ├── render.yaml                   # Render blueprint (backend)
│   ├── vercel.json                   # Vercel config (frontend)
│   └── .github/workflows/            # CI/CD pipelines
├── BUG_AUDIT.js                      # Bug registry
└── DEPLOYMENT_GUIDE.md               # Setup instructions
```

---

## Features

### Agency Portal
- **Dashboard** — Aggregated stats, ClarityScore rankings, quick actions
- **Brands** — Full CRUD with ClarityScore analysis, client management, goals, competitors
- **ARIA Engine** — ClarityScore, NarrativeAI, VelocityTracker, DepthView, IntelliPulse, MomentMap, AudienceIQ, Proof of Value
- **Reports** — Create, generate AI narratives, publish
- **Goals** — Track with VelocityTracker acceleration analysis
- **Competitors** — Head-to-head comparisons, pulse monitoring
- **Calendar** — Event management with MomentMap cultural recommendations
- **Tasks** — Kanban board with Proof of Value completion analysis
- **Staff & Clients** — User management with RBAC
- **Ask ARIA** — Conversational AI assistant
- **Settings** — Platform config, email templates, API keys, audit log

### Client Portal
- **Dashboard** — ClarityScore, goals progress, recent reports
- **Ask ARIA** — Multi-turn AI chat with brand context
- **Reports, Goals, Competitors, Strategies** — Read-only views
- **Moments, Platforms, Deliverables, Tasks** — Brand deliverables
- **Proof of Value** — ROI/attribution view
- **Satisfaction** — Feedback submission
- **Team** — View agency team members

### Super Admin
- Platform-level analytics and audit trails
- Multi-brand user management
- Platform settings and email configuration

---

## ARIA AI Engine

The **Advanced Reporting & Intelligence Analyst** powers 10 AI features via Anthropic Claude:

| Service | Description |
|---------|-------------|
| ClarityScore | 7-dimensional brand health assessment (0-1000, S/A/B/C/D grade) |
| NarrativeAI | Executive narrative generation for reports |
| VelocityTracker | Goal acceleration trajectory analysis |
| DepthView | Head-to-head competitive comparison matrix |
| IntelliPulse | Competitor activity intelligence feed |
| MomentMap | Nigerian cultural calendar marketing recommendations |
| AudienceIQ | Nigerian consumer psychographic profiling |
| Proof of Value | Task-to-metric attribution analysis |
| Ask ARIA | Multi-turn conversational AI assistant |

All ARIA calls degrade gracefully when the API key is not configured.

---

## Authentication & RBAC

Three isolated auth domains with 15 roles in a hierarchy:

```
super_admin > ceo > managing_director > creative_director >
strategy_director > account_director > account_manager >
senior_strategist > strategist > creative_lead > copywriter >
social_media_manager > analytics_specialist > client_success > client
```

Permissions include `MANAGE_USERS`, `CREATE_BRAND`, `CREATE_REPORT`, `PUBLISH_REPORT`, `USE_ARIA`, `VIEW_ANALYTICS`, `MANAGE_PLATFORM`, and more.

---

## Database

14 tables in PostgreSQL (via Supabase):
`users`, `brands`, `clients`, `staff_brand_assignments`, `reports`, `goals`, `competitors`, `calendar_events`, `tasks`, `aria_sessions`, `clarity_score_history`, `audience_profiles`, `audit_logs`, `platform_settings`

All tables have Row-Level Security enabled, but the backend accesses them via the `service_role` key (bypassing RLS).

---

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project
- Anthropic API key

### Backend Setup

```bash
cd backend
cp .env.example .env    # Fill in your values
npm install
npm run dev             # Starts on port 4000
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env    # Fill in your values
npm install
npm run dev             # Starts on port 3000
```

### Environment Variables

**Backend** — `backend/.env`:
`NODE_ENV`, `PORT`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `JWT_CLIENT_SECRET`, `JWT_SA_SECRET`, `JWT_EXPIRES_IN`, `ANTHROPIC_API_KEY`, `ARIA_MODEL`, `ARIA_MAX_TOKENS`

Optional: `UPSTASH_REDIS_*`, `R2_*`, `RESEND_*`, `EMAIL_*`

**Frontend** — `frontend/.env`:
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL`

---

## Deployment

- **Backend**: Deployed to Render via `deploy/render.yaml`. CI/CD via `.github/workflows/deploy-backend.yml`
- **Frontend**: Deployed to Vercel via `deploy/vercel.json`. CI/CD via `.github/workflows/deploy-frontend.yml`
- See `DEPLOYMENT_GUIDE.md` for step-by-step instructions

---

## License

Proprietary — Cerebre Media Africa
