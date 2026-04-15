# Phase 2: Auth + Persistence - Research

**Researched:** 2026-03-21
**Domain:** Authentication (Better Auth), Database (Turso/libSQL), ORM (Drizzle), Next.js 16 App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Auth library:** Better Auth — TypeScript-first, modern, has first-class email/password support and a Drizzle adapter
- **Database:** Turso (SQLite, edge) — serverless, zero-infra, generous free tier; well-suited for demo/MVP
- **ORM:** Drizzle ORM — lightweight, TypeScript-first, first-class Turso/libSQL support; Better Auth's Drizzle adapter integrates directly
- **Auth UX Entry Point:** Dedicated `/login` and `/signup` pages — standalone routes, not modals or inline overlays
- **Post-auth redirect:** Home page (scenario picker)
- **Unauthenticated access:** Auth required upfront — no guest sessions, no trial drill before signup; unauthenticated users attempting to access drills are redirected to `/login`
- **Session history display (PERS-03):** Past sessions displayed as score cards in a grid layout on a dedicated `/history` page, linked from home page nav; each card shows date, scenario name, level, and fluency/grammar/confidence scores; chronological order (most recent first)

### Claude's Discretion
- Exact card visual design (colors, typography, score display format)
- Navigation component structure (where the sign-in link and history link live exactly)
- Form validation UX details for login/signup (inline errors vs. submit-time errors)
- Session saving mechanism (triggered in existing `/api/evaluate` route or a new `/api/sessions` endpoint)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can create an account with email and password | Better Auth `emailAndPassword.enabled: true` + `authClient.signUp.email()` client call |
| AUTH-02 | User can log in and stay logged in across browser sessions | Better Auth cookie-based sessions (7-day default) + `authClient.signIn.email({ rememberMe: true })` |
| AUTH-03 | User can log out from any page | `authClient.signOut()` callable from any client component with nav access |
| AUTH-04 | User's progress and history are accessible from any device after logging in | All data stored in Turso with non-nullable `userId` FK — any device login returns same data |
| PERS-01 | Session summaries (scenario, level, turn count, evaluation scores, date) saved on session end | Hook into `/api/evaluate` post-evaluation, or new `/api/sessions` POST endpoint; save to `sessions` table with `userId` FK |
| PERS-02 | User's current inferred proficiency level persists across sessions and restored at session start | `users` table extended with `proficiencyLevel` field; drill page reads it on load |
| PERS-03 | User can view a history of their past sessions | `/history` page fetches sessions for authenticated user ordered by date desc; score card grid UI |
</phase_requirements>

---

## Summary

This phase installs Better Auth 1.5 with email/password authentication, Drizzle ORM 0.45 connected to a Turso SQLite database, and implements session persistence. The stack is tightly integrated: Better Auth generates its own schema tables (user, session, account, verification) via CLI, and the Drizzle adapter means the same `db` instance serves both auth and custom application tables.

The project runs Next.js 16, which renamed `middleware.ts` to `proxy.ts`. Route protection uses `proxy.ts` for lightweight optimistic cookie checks plus `auth.api.getSession({ headers: await headers() })` in individual page server components for real validation. API routes protecting user data call `auth.api.getSession` with request headers directly.

The key design constraint is that every application table row — sessions, user progress — must have a non-nullable `userId` from the first migration. No orphaned data is created at any point. This is enforced by making `userId` NOT NULL with a foreign key to the Better Auth `user` table in the Drizzle schema.

**Primary recommendation:** Use Better Auth CLI (`npx auth@latest generate`) to scaffold the auth schema, define custom app tables (`drill_sessions`, `user_progress`) alongside in the same Drizzle schema file with `userId` as a non-nullable FK, run `npx drizzle-kit migrate` to apply, then wire up the route handler, client, and proxy.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.5.5 | Auth server + client | TypeScript-first, Drizzle adapter built-in, email/password, cookie sessions |
| drizzle-orm | 0.45.1 | ORM + query builder | First-class libSQL/Turso support; used by Better Auth adapter |
| @libsql/client | 0.17.2 | Turso database client | Official libSQL client; required by drizzle-orm/libsql |
| drizzle-kit | 0.31.10 | Migrations + schema push | Turso dialect support; Better Auth schema generation integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | latest (already in Node 20+) | Env var loading for drizzle.config.ts | Only needed if env vars not loaded by Next.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth | Auth.js (NextAuth) | Auth.js has more community examples but inferior TypeScript support and no Drizzle-first integration |
| Turso | Neon (PostgreSQL) | Neon is PostgreSQL (more familiar) but Turso has lower latency for edge/serverless demo use |
| Drizzle | Prisma | Prisma is heavier, requires separate binary; Drizzle is closer to raw SQL |

**Installation:**
```bash
npm install better-auth drizzle-orm @libsql/client
npm install -D drizzle-kit
```

**Version verification (confirmed 2026-03-21):**
- `better-auth@1.5.5` — confirmed via `npm view better-auth version`
- `drizzle-orm@0.45.1` — confirmed via `npm view drizzle-orm version`
- `@libsql/client@0.17.2` — confirmed via `npm view @libsql/client version`
- `drizzle-kit@0.31.10` — confirmed via `npm view drizzle-kit version`

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── index.ts         # Drizzle db client (Turso connection)
│   └── schema.ts        # All tables: Better Auth tables + app tables
├── lib/
│   ├── auth.ts          # Better Auth server instance (betterAuth config)
│   ├── auth-client.ts   # Better Auth client instance (createAuthClient)
│   ├── zod-schemas.ts   # Extend with SignupSchema, LoginSchema (already exists)
│   └── logger.ts        # Already exists
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/
│   │           └── route.ts   # Better Auth route handler
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   └── history/
│       └── page.tsx
└── proxy.ts             # Route protection (Next.js 16 — replaces middleware.ts)
drizzle.config.ts        # Drizzle Kit configuration (Turso dialect)
```

### Pattern 1: Better Auth Server Configuration
**What:** Single `auth` instance exported from `src/lib/auth.ts` — used by route handler and server-side session access
**When to use:** Always. All auth configuration lives here.
```typescript
// src/lib/auth.ts
// Source: https://www.better-auth.com/docs/adapters/drizzle
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});
```

### Pattern 2: Better Auth Route Handler (Next.js 16)
**What:** Catch-all route at `/api/auth/[...all]` that delegates to Better Auth
**When to use:** Required — Better Auth handles all its own API calls through this handler
```typescript
// src/app/api/auth/[...all]/route.ts
// Source: https://www.better-auth.com/docs/installation
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { POST, GET } = toNextJsHandler(auth);
```

### Pattern 3: Drizzle + Turso Client
**What:** Single `db` export from `src/db/index.ts` used everywhere
**When to use:** All database queries, including Better Auth adapter
```typescript
// src/db/index.ts
// Source: https://orm.drizzle.team/docs/tutorials/drizzle-with-turso
import { drizzle } from "drizzle-orm/libsql";
export const db = drizzle({
  connection: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

### Pattern 4: Drizzle Config (Turso dialect)
**What:** `drizzle.config.ts` at project root with `turso` dialect
**When to use:** Required for `drizzle-kit generate` / `drizzle-kit migrate` to work
```typescript
// drizzle.config.ts
// Source: https://orm.drizzle.team/docs/tutorials/drizzle-with-turso
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

### Pattern 5: Custom App Schema with Non-Nullable userId
**What:** Application tables in `src/db/schema.ts` alongside Better Auth generated tables
**When to use:** All app data — sessions, progress — must have userId FK from day one
```typescript
// src/db/schema.ts (app tables — Better Auth tables added via CLI generate)
// Source: https://orm.drizzle.team/docs/get-started/turso-new
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const drillSessions = sqliteTable("drill_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),          // Non-nullable FK to BA user table
  scenarioId: text("scenario_id").notNull(),
  level: text("level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
  turnCount: integer("turn_count").notNull(),
  fluencyScore: real("fluency_score").notNull(),
  grammarScore: real("grammar_score").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
});

export const userProgress = sqliteTable("user_progress", {
  userId: text("user_id").primaryKey(),       // 1:1 with Better Auth user
  proficiencyLevel: text("proficiency_level", {
    enum: ["beginner", "intermediate", "advanced"],
  }).notNull().default("beginner"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### Pattern 6: Auth Client (Browser-Side)
**What:** `createAuthClient()` exported from `src/lib/auth-client.ts` — used in React components
**When to use:** Client components for sign-in, sign-up, sign-out, and `useSession` hook
```typescript
// src/lib/auth-client.ts
// Source: https://www.better-auth.com/docs/installation
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});
```

### Pattern 7: Server-Side Session Access
**What:** `auth.api.getSession({ headers: await headers() })` in server components and API routes
**When to use:** Any server component or API route that needs the current user
```typescript
// In a Server Component or API Route
// Source: https://better-auth.com/docs/integrations/next
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  return <div>Welcome {session.user.name}</div>;
}
```

### Pattern 8: Next.js 16 Proxy (Optimistic Route Guard)
**What:** `proxy.ts` at project root for lightweight cookie-presence check and redirect
**When to use:** Fast redirect for obviously unauthenticated users — NOT a security gate (always validate in the page/route too)
```typescript
// proxy.ts (Next.js 16 — replaces middleware.ts)
// Source: https://better-auth.com/docs/integrations/next + https://nextjs.org/docs/app/getting-started/proxy
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/drill/:path*", "/history"],
};
```

### Pattern 9: Client-Side Auth Calls
**What:** Sign-up, sign-in, sign-out via the `authClient` in React client components
```typescript
// Source: https://www.better-auth.com/docs/authentication/email-password
// Sign Up
const { data, error } = await authClient.signUp.email({
  name: "Display Name",
  email: "user@example.com",
  password: "password1234",
  callbackURL: "/",
});

// Sign In
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "password1234",
  rememberMe: true,
  callbackURL: "/",
});

// Sign Out (from nav component)
await authClient.signOut({
  fetchOptions: { onSuccess: () => router.push("/login") },
});

// Reactive session in client component
const { data: session, isPending } = authClient.useSession();
```

### Pattern 10: Session Save on Evaluation Complete
**What:** After `evaluateConversation()` returns successfully in `/api/evaluate`, look up authenticated user and insert drill session row
**When to use:** PERS-01 implementation — hook into the existing evaluate route
```typescript
// In /api/evaluate/route.ts — after successful evaluation
// Source: project pattern from src/app/api/evaluate/route.ts
const session = await auth.api.getSession({ headers: request.headers });
if (session) {
  await db.insert(drillSessions).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    scenarioId: validatedScenarioId,
    level: proficiencyLevel,       // passed in request body (extend EvaluateSchema)
    turnCount: messages.length,
    fluencyScore: evaluation.fluency,
    grammarScore: evaluation.grammar,
    confidenceScore: evaluation.confidence,
    completedAt: new Date(),
  });
}
```

### Anti-Patterns to Avoid
- **Using `getSessionCookie` as the only security check:** It only verifies cookie presence, not validity. Always follow proxy with real `auth.api.getSession` validation in the server component or route.
- **Keeping `middleware.ts` in a Next.js 16 project:** Must be renamed to `proxy.ts` with `export function proxy(...)`. The old name causes a silent no-op.
- **Running `npx auth@latest generate` without reviewing output:** The CLI generates schema files that may conflict with existing schema. Review and merge manually into `src/db/schema.ts`.
- **Calling `auth.api.getSession` in a Next.js proxy/middleware with a DB call:** Proxy runs in Edge Runtime with limited APIs. Use cookie check only in proxy; full session validation belongs in server components.
- **Creating app tables before Better Auth tables:** The Better Auth `user` table must exist before `drill_sessions.userId` FK can reference it. Generate and apply auth schema first, then add app tables.
- **Nullable userId in any app table:** Every row must have a non-nullable `userId`. Never add `optional()` to the userId field.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/argon2 wrapper | Better Auth built-in (scrypt) | Memory-hard by default, salted, versioned secret rotation |
| Session token generation | UUID or random string sessions | Better Auth session management | CSRF protection, cookie security, SameSite, httpOnly all handled |
| CSRF protection | Custom token verification | Better Auth (SameSite=Lax + origin checks) | Easy to get wrong; BA implements fetch metadata headers |
| Cookie management | Manual Set-Cookie headers | Better Auth + nextCookies plugin | Session refresh, expiry, secure flag per env all handled |
| Auth schema migration | Manual CREATE TABLE SQL | `npx auth@latest generate` + drizzle-kit | Gets all required fields correct including indexes |
| Form validation for auth | Custom email/password checks | Zod schemas (project pattern) + BA client errors | BA returns structured errors; Zod validates before sending |

**Key insight:** Better Auth handles the entire auth surface area (hashing, sessions, CSRF, cookies). Custom implementations of any of these introduce security vulnerabilities and maintenance burden.

---

## Common Pitfalls

### Pitfall 1: `auth.api.getSession` Returns Null in Server Components (Cookie Cache)
**What goes wrong:** `auth.api.getSession({ headers: await headers() })` returns `null` in React Server Components even when a valid session cookie exists — tracked in GitHub issues #7008 and #4188.
**Why it happens:** When cookie caching is enabled, server components cannot set cookies; the cache refresh fails silently.
**How to avoid:** Disable the cookie cache in the auth config for server components, or use the `nextCookies()` plugin to automatically handle cookie-setting. Alternative: don't enable cookie caching until needed.
**Warning signs:** Works in client components via `useSession()` but server component session check always redirects even when logged in.

### Pitfall 2: `middleware.ts` vs `proxy.ts` (Next.js 16)
**What goes wrong:** Route protection does nothing — unauthenticated users can access protected routes.
**Why it happens:** The project uses Next.js 16.1.1. In Next.js 16, `middleware.ts` is renamed to `proxy.ts` and the exported function must be named `proxy` (not `middleware`). The old filename is silently ignored.
**How to avoid:** Create `proxy.ts` at project root (alongside `src/`). Export `export function proxy(request: NextRequest)`. Run the codemod `npx @next/codemod@canary middleware-to-proxy .` if migrating.
**Warning signs:** `middleware.ts` exists, no errors, but protected routes are freely accessible.

### Pitfall 3: Schema Generation Overwrites Custom Tables
**What goes wrong:** Running `npx auth@latest generate` overwrites or conflicts with existing `src/db/schema.ts`.
**Why it happens:** The CLI generates a complete schema file; it doesn't merge with existing content.
**How to avoid:** Run the CLI first to see what it generates, then manually add the generated table definitions to the existing schema file (or have it output to a separate file and import both).
**Warning signs:** Custom `drillSessions` or `userProgress` tables disappear after re-running generate.

### Pitfall 4: Turso Env Var Naming
**What goes wrong:** Database connection fails with an unhelpful "connection refused" or undefined URL error.
**Why it happens:** Drizzle docs and Turso docs use slightly different env var names. Drizzle tutorial uses `TURSO_CONNECTION_URL`; Turso docs use `TURSO_DATABASE_URL`.
**How to avoid:** Pick one name consistently and use it in both `drizzle.config.ts` and `src/db/index.ts`. Use `TURSO_DATABASE_URL` (matches Turso's own docs).
**Warning signs:** Works locally with hardcoded values but fails with env vars.

### Pitfall 5: EvaluateSchema Missing `proficiencyLevel` for PERS-01
**What goes wrong:** Session save in `/api/evaluate` has no proficiency level to store — the existing `EvaluateSchema` doesn't include it.
**Why it happens:** The current schema only has `scenarioId` and `messages`. The level is tracked client-side in drill state but not sent to evaluate.
**How to avoid:** Extend `EvaluateSchema` in `src/lib/zod-schemas.ts` to include `proficiencyLevel` — this is already defined as `ProficiencyLevelSchema` in that file.
**Warning signs:** Session rows saved with null or hardcoded level.

### Pitfall 6: BETTER_AUTH_URL Must Match Deployment URL
**What goes wrong:** Auth callbacks fail in production — sign-in redirects break or sessions don't set correctly.
**Why it happens:** `BETTER_AUTH_URL` defaults to localhost in dev but must be the actual deployed URL in production.
**How to avoid:** Set `BETTER_AUTH_URL` explicitly in both `.env.local` and production environment variables.
**Warning signs:** Works locally, breaks on Vercel or other hosts.

### Pitfall 7: `drizzleAdapter` Import Path
**What goes wrong:** `Module not found: @better-auth/drizzle-adapter` or wrong export.
**Why it happens:** The adapter is imported from `"better-auth/adapters/drizzle"` (built-in subpath), not from a separate `@better-auth/drizzle-adapter` package (which some older docs reference).
**How to avoid:** Use `import { drizzleAdapter } from "better-auth/adapters/drizzle"`. Do NOT install `@better-auth/drizzle-adapter` separately.
**Warning signs:** `Cannot find module '@better-auth/drizzle-adapter'` install error.

---

## Code Examples

Verified patterns from official sources:

### Complete auth.ts Configuration
```typescript
// src/lib/auth.ts
// Source: https://www.better-auth.com/docs/adapters/drizzle
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
});

export type Session = typeof auth.$Infer.Session;
```

### Schema Generation Workflow
```bash
# Step 1: Generate Better Auth tables (review output before applying)
npx auth@latest generate

# Step 2: Add custom app tables to src/db/schema.ts manually

# Step 3: Generate Drizzle migration
npx drizzle-kit generate

# Step 4: Apply migration to Turso
npx drizzle-kit migrate
```

### Protecting an API Route (PERS-01 pattern)
```typescript
// In any API route handler
// Source: https://better-auth.com/docs/integrations/next
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  // ... proceed with userId
}
```

### History Page Data Fetch
```typescript
// src/app/history/page.tsx
// Source: project patterns + Drizzle query pattern
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { drillSessions } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";

export default async function HistoryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sessions = await db
    .select()
    .from(drillSessions)
    .where(eq(drillSessions.userId, session.user.id))
    .orderBy(desc(drillSessions.completedAt));

  return <SessionHistoryGrid sessions={sessions} />;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` with `export function proxy()` | Next.js 16 | Must rename and update export |
| `@better-auth/drizzle-adapter` (separate package) | `better-auth/adapters/drizzle` (built-in) | Better Auth ~1.4 | No separate install needed |
| Drizzle `dialect: "sqlite"` for Turso | `dialect: "turso"` in drizzle.config.ts | Drizzle Kit ~0.21 | Correct Turso-specific migration support |
| Lucia Auth | Better Auth | 2024 — Lucia deprecated | Lucia author deprecated it and recommends rolling your own or using Better Auth |

**Deprecated/outdated:**
- `middleware.ts` export name: replaced by `proxy.ts` in Next.js 16 — old docs show middleware, new projects use proxy
- Lucia Auth: the Lucia auth library author deprecated it in late 2024; many blog posts still reference it
- `@better-auth/drizzle-adapter` separate package: consolidated into Better Auth core

---

## Open Questions

1. **Better Auth schema generation output location**
   - What we know: `npx auth@latest generate` creates a schema file
   - What's unclear: Whether the CLI respects a custom output path or always writes to a default location
   - Recommendation: Run `npx auth@latest generate --help` during Wave 0 to confirm output path before building the schema merge step into the plan

2. **EvaluateSchema extension for proficiency level**
   - What we know: The current schema doesn't include `proficiencyLevel`; the client does track this state
   - What's unclear: Whether extending EvaluateSchema is sufficient or if the drill page needs to pass it differently
   - Recommendation: Extend `EvaluateSchema` with `proficiencyLevel: ProficiencyLevelSchema` — it's already defined in `zod-schemas.ts`

3. **Session save: `/api/evaluate` hook vs new `/api/sessions` endpoint**
   - What we know: CONTEXT.md leaves this as Claude's discretion
   - What's unclear: Whether saving inline in `/api/evaluate` creates unacceptable coupling or if a dedicated endpoint is cleaner
   - Recommendation: Hook into `/api/evaluate` for PERS-01 simplicity (avoids a second network call from the client); add a dedicated `/api/sessions` route only if GET for history is needed server-side (the `/history` page uses direct DB access from server component, so GET `/api/sessions` is unnecessary)

4. **Turso database creation**
   - What we know: Turso requires creating a database and getting credentials from their dashboard or CLI
   - What's unclear: Whether the planner should include a Turso CLI setup step or treat it as user prerequisite
   - Recommendation: Include a Wave 0 task for Turso CLI setup (`turso db create mothertongue && turso db tokens create mothertongue`) with the env vars needed

---

## Validation Architecture

> nyquist_validation is enabled (not explicitly false in config.json)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists, node environment) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User can sign up with email and password | unit | `npm test -- src/lib/auth.test.ts -t "AUTH-01"` | ❌ Wave 0 |
| AUTH-02 | Session persists (cookie-based, 7-day) | unit | `npm test -- src/lib/auth.test.ts -t "AUTH-02"` | ❌ Wave 0 |
| AUTH-03 | Sign-out terminates session | unit | `npm test -- src/lib/auth.test.ts -t "AUTH-03"` | ❌ Wave 0 |
| AUTH-04 | Cross-device access via userId FK | integration | manual-only (requires live Turso + two sessions) | N/A |
| PERS-01 | Session summary saved after evaluate | unit | `npm test -- src/app/api/evaluate/route.test.ts -t "PERS-01"` | ❌ Wave 0 |
| PERS-02 | Proficiency level persists and restores | unit | `npm test -- src/db/user-progress.test.ts -t "PERS-02"` | ❌ Wave 0 |
| PERS-03 | History page shows past sessions | integration | manual-only (requires live data; smoke test login + /history) | N/A |

**Note on AUTH-04 and PERS-03:** Cross-device session access and visual history verification are inherently manual for this phase. Unit tests cover the data layer (userId FK, DB insert/select) but end-to-end device testing is manual.

**Note on Better Auth server internals:** The Better Auth library itself is not unit-testable in isolation (it requires a real database). Tests should mock `auth.api.getSession` and test the application code around it — the same pattern used in Phase 1 for `evaluateConversation`.

### Sampling Rate
- **Per task commit:** `npm test -- src/lib/auth.test.ts src/app/api/evaluate/route.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/auth.test.ts` — covers AUTH-01, AUTH-02, AUTH-03 (mock `auth.api.getSession`, test route handlers)
- [ ] `src/app/api/evaluate/route.test.ts` — covers PERS-01 (extend existing evaluate route test for session save)
- [ ] `src/db/user-progress.test.ts` — covers PERS-02 (test DB read/write for proficiency level)
- [ ] `src/db/index.ts` — database client (new file, no test infrastructure exists yet)
- [ ] Framework install: already installed (vitest 4.1.0 present)
- [ ] Env vars: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` needed in `.env.local`

---

## Sources

### Primary (HIGH confidence)
- `https://www.better-auth.com/docs/installation` — Better Auth installation, route handler setup
- `https://www.better-auth.com/docs/adapters/drizzle` — drizzleAdapter import path, schema generation, provider config
- `https://www.better-auth.com/docs/authentication/email-password` — emailAndPassword config, client API (signUp, signIn, signOut)
- `https://better-auth.com/docs/integrations/next` — Next.js 16 proxy.ts integration, getSession server pattern, nextCookies plugin
- `https://www.better-auth.com/docs/concepts/session-management` — cookie-based sessions, 7-day expiry, cookie encoding options
- `https://www.better-auth.com/docs/concepts/database` — Better Auth default tables (user, session, account, verification)
- `https://www.better-auth.com/docs/reference/security` — CSRF, cookie security, scrypt hashing, rate limiting
- `https://orm.drizzle.team/docs/tutorials/drizzle-with-turso` — drizzle.config.ts turso dialect, db client, schema definition, migration commands
- `https://nextjs.org/docs/app/getting-started/proxy` — proxy.ts convention, Next.js 16, matcher config

### Secondary (MEDIUM confidence)
- `npm view better-auth version` (1.5.5), `npm view drizzle-orm version` (0.45.1), `npm view @libsql/client version` (0.17.2), `npm view drizzle-kit version` (0.31.10) — verified 2026-03-21
- `https://github.com/better-auth/better-auth/issues/7008` — cookie cache + server component null session bug (confirmed real GitHub issue)
- `https://github.com/better-auth/better-auth/issues/4188` — getSession null in server components

### Tertiary (LOW confidence)
- WebSearch result: Lucia Auth deprecated late 2024 — confirmed via multiple sources, not yet verified against Lucia's own site

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-21; adapter import path verified against official docs
- Architecture: HIGH — patterns verified against official Better Auth and Next.js docs; Next.js 16 proxy.ts confirmed from nextjs.org
- Pitfalls: HIGH (pitfalls 2, 7) / MEDIUM (pitfalls 1, 3, 4, 5, 6) — pitfall 1 verified via GitHub issues; others from official docs + community

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (30 days — Better Auth and Next.js are active projects; verify versions if executing later)
