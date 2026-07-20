# Command Center — Patches to the Existing Codebase

Six small patches. Everything else in this package is new files.

---

## 1 · server.js — mount the route

```js
app.use('/api/agency/command', require('./routes/command.routes'));
```

## 2 · notification-sweeper.service.js — add the status watch (D6)

At the top:

```js
const { watchBrandStatus } = require('./brand-status-watch.service');
```

In the `sweeps` array inside `runSweep()` (add as the FIRST entry so
status transitions are detected before the digests read them):

```js
['brand_status', () => watchBrandStatus().then(r => stats.push(...Array(r.alerts).fill({ success: true })))],
```

That's the whole D6 automation: every sweep run detects transitions,
logs them to `brand_status_log`, and fires the `brand_status_changed`
email exactly once per At-Risk episode.

## 3 · Leadership digest — redFlags from the rule engine (blueprint §07)

In the sweeper's `sweepDigests()`, replace the hardcoded/absent
`redFlags` with:

```js
const { redFlagsSummary } = require('./brand-status-watch.service');
const redFlags = await redFlagsSummary(); // null when all clear
```

…and pass `redFlags` into the `leadership_digest` data object. The
digest and the Command Center now agree by construction — one source
of truth for "what's wrong."

## 4 · Sidebar — "⌘ Command" first for leadership + Brand Admins

In your sidebar nav config, add as the FIRST item for roles
`super_admin | admin | md | brand_admin`:

```tsx
{ href: '/command', label: 'Command', icon: Command } // lucide-react "Command"
```

(Brand Admins see the same page auto-scoped to their brands — no
separate route needed.)

## 5 · Default landing (D4)

Wherever login success redirects (login page and/or middleware),
change the destination for leadership roles:

```ts
const LANDING: Record<string, string> = {
  super_admin: '/command',
  admin: '/command',
  md: '/command',
};
router.push(LANDING[user.role] ?? '/dashboard');
```

The dashboard stays one click away in the nav — nothing is removed.

## 6 · /brands/[id] — honour ?tab= deep links (two-click rule)

In the brand page component, initialise the active tab from the URL:

```tsx
import { useSearchParams } from 'next/navigation';

const searchParams = useSearchParams();
const initialTab = searchParams.get('tab') ?? 'overview';
const [tab, setTab] = useState(initialTab);
```

Valid values used by the Command Center drawer: `tasks`, `briefs`,
`financials`, `goals`. Unknown values fall back to `overview`.

---

## Frontend API note

`frontend/src/components/command/types.ts` ships with a minimal
`authFetch` (reads `sabi_token` from localStorage, prefixes
`NEXT_PUBLIC_API_URL`). If your `api.ts` client already handles auth
and refresh, replace the two exported functions' internals with your
client — the response types stay identical.

## Table-name assumptions

The service queries: `brands (retainer_tier)`, `brand_admins`,
`brand_staff`, `staff_leave`, `invoices (amount, amount_label)`,
`strategies (start_date, end_date, expected_revenue)`, `tasks`,
`client_briefs (classification)`, `priority_goals (velocity_trend)`,
`client_satisfaction`, `weekly_scores (score_type, rolling_avg,
week_start)`. If any column differs in your final schema (e.g. goals
table name, velocity field), each is a one-line fix in
`command.service.js` — they're isolated inside `fetchAll()` and the
rule functions.
