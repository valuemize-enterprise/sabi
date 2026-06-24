# Sabi Intelligence Suite — Deployment Guide
**A product of Cerebre Media Africa**

---

## Overview

| Layer     | Technology             | Hosting        |
|-----------|------------------------|----------------|
| Frontend  | Next.js 14 + TypeScript| Vercel         |
| Backend   | Node.js / Express      | Render         |
| Database  | PostgreSQL             | Supabase       |
| AI Engine | ARIA (Claude API)      | Anthropic      |
| Cache     | Redis                  | Upstash        |
| Storage   | Object Storage         | Cloudflare R2  |

---

## Step 1: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it: **sabi-intelligence-suite**
3. Copy your project URL and **service role key** (NOT the anon key)
4. Open the **SQL Editor** and run the entire contents of:
   ```
   backend/src/db/schema.sql
   ```
5. Confirm all tables are created: users, brands, clients, reports, goals, competitors, calendar_events, tasks, aria_sessions, clarity_score_history, audience_profiles, audit_logs, platform_settings

---

## Step 2: Generate JWT Secrets

Run this in your terminal — generate 3 separate secrets:
```bash
node -e "const c=require('crypto'); console.log(c.randomBytes(64).toString('hex'))"
```
Run it 3 times. Save the outputs as:
- `JWT_SECRET` (agency staff)
- `JWT_CLIENT_SECRET` (client portal)
- `JWT_SA_SECRET` (super admin)

---

## Step 3: Hash Super Admin Password

The super admin password is hardcoded in `backend/src/config/super-admin.config.js`.

Default credentials:
- Email: `cerebreplus@gmail.com`
- Password: `Cerebre234$M`

To change the password:
```bash
cd backend
npm install
node -e "const b=require('bcryptjs'); console.log(b.hashSync('YourNewPassword!',12))"
```
Paste the output as `passwordHash` in `super-admin.config.js`, then redeploy.

---

## Step 4: Deploy Backend to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Node Version:** 20
5. Add Environment Variables (one by one in the Render dashboard):

```
NODE_ENV=production
PORT=4000
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,https://sabi.cerebre.media
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
JWT_CLIENT_SECRET=your-client-jwt-secret
JWT_SA_SECRET=your-sa-jwt-secret
ANTHROPIC_API_KEY=sk-ant-your-key
ARIA_MODEL=claude-sonnet-4-6
ARIA_MAX_TOKENS=2048
```

6. Add a **Deploy Hook** URL from Render → copy it → add as GitHub secret `RENDER_DEPLOY_HOOK_URL`
7. Deploy. Note your Render URL (e.g. `https://sabi-backend.onrender.com`)

---

## Step 5: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend`
4. Add Environment Variables:

```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
NEXT_PUBLIC_APP_NAME=Sabi Intelligence Suite
NEXT_PUBLIC_COMPANY_NAME=Cerebre Media Africa
```

5. Deploy. Note your Vercel URL.
6. Go back to Render → update `ALLOWED_ORIGINS` to include your Vercel URL

---

## Step 6: Set Up CI/CD (GitHub Actions)

Add these secrets to your GitHub repo (Settings → Secrets → Actions):

| Secret                    | Value                              |
|---------------------------|------------------------------------|
| `RENDER_DEPLOY_HOOK_URL`  | From Render → your service → Settings → Deploy Hook |
| `VERCEL_TOKEN`            | From vercel.com → Settings → Tokens |
| `VERCEL_ORG_ID`           | From `.vercel/project.json` after first deploy |
| `VERCEL_PROJECT_ID`       | From `.vercel/project.json` after first deploy |
| `NEXT_PUBLIC_API_URL`     | Your Render backend URL |
| `NEXT_PUBLIC_APP_URL`     | Your Vercel frontend URL |

After setup, every push to `main` auto-deploys both services.

---

## Step 7: Verify Deployment

### Backend health check:
```
GET https://your-backend.onrender.com/health
```
Expected: `{ "status": "ok", "service": "Sabi Intelligence Suite API" }`

### Super admin test:
```
POST https://your-backend.onrender.com/api/super-admin/auth/login
Body: { "email": "cerebreplus@gmail.com", "password": "Cerebre234$M" }
```

### Frontend portals:
- Agency: `https://your-app.vercel.app/login`
- Client: `https://your-app.vercel.app/client/login`
- Super Admin: `https://your-app.vercel.app/super-admin/login`

---

## Super Admin Credentials

```
Email:    cerebreplus@gmail.com
Password: Cerebre234$M
```

⚠️ Change the password after first login by updating `super-admin.config.js` and redeploying.

---

## Adding Your First Brand & Staff Member

1. Log in as Super Admin → create the first agency staff account (CEO or MD)
2. Log in as that staff member (use temp password, then set new password)
3. Create a brand under Agency Portal → Brands
4. Create a client under Agency Portal → Clients (linked to the brand)
5. Run ClarityScore™ on the brand: Brands → Brand Detail → Refresh ClarityScore

---

## ARIA (AI Engine) Features

All ARIA features require `ANTHROPIC_API_KEY` to be set. They will gracefully fail (not crash) if the key is missing.

| Feature              | Route                                           |
|----------------------|-------------------------------------------------|
| ClarityScore™        | `POST /api/agency/brands/:id/refresh-clarity`   |
| NarrativeAI™         | `POST /api/agency/reports/:id/generate-narrative`|
| VelocityTracker™     | `POST /api/agency/goals/:id/track-velocity`     |
| DepthView™           | `POST /api/agency/competitors/depth-view`       |
| IntelliPulse™        | `POST /api/agency/competitors/:id/pulse`        |
| MomentMap™           | `POST /api/agency/calendar/recommend`           |
| Proof of Value™      | `POST /api/agency/tasks/:id/complete`           |
| AudienceIQ™ (NEW)   | `POST /api/agency/audience/generate`            |
| Ask ARIA             | `POST /api/client/ask/message`                  |

---

## Known Render Free Tier Issue

Render's free tier spins down after 15 minutes of inactivity. The first request after spin-down takes ~30 seconds.

**Fix:** Upgrade to Render Starter ($7/mo) or set up an uptime monitor (UptimeRobot) that pings `/health` every 10 minutes.

---

## Bug Audit Summary

15 bugs identified and fixed in this build. See `BUG_AUDIT.js` for full documentation.

Critical fixes:
- Auth token key standardized (`sabi_token` / `sabi_client_token` / `sabi_sa_token`)
- Next.js middleware no longer reads localStorage (server context)
- Zustand stores have isolated persist keys (no session collision)
- Super admin password now properly bcrypt-verified
- `globals.css` created (was missing — all pages were unstyled)

---

*Sabi Intelligence Suite · Cerebre Media Africa · Lagos, Nigeria*
