# Stack Research

**Domain:** Adaptive language learning app — persistence + adaptive difficulty additions
**Researched:** 2026-03-20
**Confidence:** MEDIUM-HIGH (core picks verified via multiple sources; version numbers from npm; some Gemini-specific patterns from official docs)

---

## Context

This is an additive stack — the existing Next.js 16 + TypeScript + Gemini + Google Cloud TTS core stays
unchanged. This file covers only the new dependencies required for:

1. Session persistence (user identity, progress, history across sessions)
2. Adaptive difficulty inference (LLM-driven level tracking stored server-side)
3. Freeform chat mode (no new infra needed — Gemini already handles it)
4. Multi-language support (schema-level concern, no new libraries)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Neon Serverless Postgres | hosted | Primary database | Native Vercel integration (Vercel Postgres IS Neon); serverless-safe HTTP driver eliminates TCP connection pooling issues; generous free tier (0.5 GB, 100 CU-hours/month); auto-scale to zero. PostgreSQL gives full relational power for progress tracking queries. |
| Drizzle ORM | 0.45.1 | Database access layer | 90% smaller bundle than Prisma — critical for Vercel serverless cold starts. TypeScript-first schema definition (no separate .prisma language). SQL-transparent query builder avoids magic. Works with Neon's serverless driver natively. Community has shifted to Drizzle as the default for new Next.js/Vercel projects in 2025. |
| Better Auth | 1.5.5 | Authentication + session management | Auth.js v5 remains perpetually in beta and its team has merged into Better Auth. Better Auth ships stable 1.x, has first-class Next.js + App Router support, built-in Drizzle adapter, email/password + OAuth providers, and session management out of the box. Type-safe throughout. Active release cadence (1.5.5 published within last week of research). |
| @neondatabase/serverless | 1.0.2 | Neon HTTP/WebSocket driver | Required to connect to Neon from Vercel serverless functions without TCP. Uses HTTP for single queries (lower latency), WebSockets for transactions. Drizzle integrates with this driver directly. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | latest (peer) | Schema migrations CLI | Use `drizzle-kit generate` + `drizzle-kit migrate` for all schema changes. Replaces manual SQL migration files. Required at dev time only. |
| zod | ^3.x (already common) | Runtime schema validation for API routes | Validate request bodies in Next.js route handlers before DB writes. Also used with Gemini structured output schema definitions. Already likely present or trivial to add. |
| Zustand | ^5.x | In-session client state | Manages ephemeral in-session state: current conversation turns, real-time difficulty level, TTS playback state. NOT used for persistence (that's the DB). Use with `"use client"` components only; avoid persist middleware with localStorage due to SSR hydration complexity in Next.js. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit | Schema migration CLI | Run `drizzle-kit generate` after schema changes, `drizzle-kit migrate` to apply. Configure via `drizzle.config.ts` pointing at `DATABASE_URL`. |
| Neon CLI (optional) | Database branching | Create preview branches per PR. Useful if Vercel preview environments are used. Not required for MVP. |

---

## Installation

```bash
# Database + ORM
yarn add drizzle-orm @neondatabase/serverless
yarn add -D drizzle-kit

# Authentication
yarn add better-auth

# Client state (if not already present)
yarn add zustand

# Validation (likely already available via Next.js ecosystem)
yarn add zod
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Drizzle ORM | Prisma | If team strongly prefers schema-first .prisma files and automated migration DX over bundle size. Prisma is still valid — just heavier for serverless cold starts. Avoid on Vercel Edge Runtime. |
| Better Auth | Auth.js v5 (next-auth beta) | Auth.js v5 is the predecessor and now maintained by the Better Auth team. Only use it if an existing codebase already has it wired up. For a greenfield auth layer, Better Auth is strictly superior. |
| Better Auth | Clerk | Clerk is excellent for teams that want zero-config auth with a hosted dashboard. It charges per MAU at scale and is overkill for a solo/small-team learning app. Adds 3rd-party dependency to auth critical path. |
| Neon | Supabase Postgres | Choose Supabase if you want built-in Auth + Realtime + Storage as a full BaaS. Overkill here — we already have Gemini for AI and Better Auth for sessions. Supabase's additional surface area adds complexity without benefit. |
| Neon | PlanetScale | PlanetScale runs MySQL (Vitess), not PostgreSQL. Drizzle supports both, but the ecosystem around PostgreSQL is richer for this use case. PlanetScale also removed its free tier in 2024. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| SQLite / embedded DB | Vercel serverless filesystem is ephemeral and not shared across function instances. Write operations will silently fail or produce split state. | Neon serverless Postgres |
| Prisma on Vercel Edge | Prisma's Rust query engine binary cannot run in Edge Runtime. Drizzle has zero native dependencies and runs everywhere. | Drizzle ORM |
| Auth.js v5 (next-auth@5 beta) | Still labeled beta after 2+ years; team has merged into Better Auth project. No clear stable release timeline. | Better Auth 1.x |
| Zustand persist + localStorage for progress | SSR hydration mismatches are common and subtle. Progress data belongs in the database — not localStorage. Use Zustand only for ephemeral in-session UI state. | Store progress in Postgres via API routes |
| Direct Gemini calls for difficulty persistence | Gemini has no memory between requests — level inferences must be stored in the DB after each session evaluation. Don't try to reconstruct level from conversation history on each load. | Persist `proficiency_level` + `session_history` in DB |
| Redux / Redux Toolkit | Massive boilerplate for what is essentially a single-user conversation state store. No server state synchronization benefit this app needs. | Zustand |

---

## Stack Patterns by Variant

**For adaptive difficulty inference:**
- Use Gemini structured output (`responseSchema` with a JSON schema) to extract a difficulty score (0–100 or enum) from each session evaluation
- Store the score in a `user_progress` table alongside session transcript summary
- On next session load, read the stored score and inject it into the Gemini system prompt — no re-inference from raw history needed
- The existing `callGemini()` wrapper in `src/services/gemini.ts` can be extended with a `responseSchema` config option; the `@google/genai` SDK already supports this

**For session identity (no password required for MVP):**
- Better Auth supports anonymous/guest sessions via its plugin system — users can start learning immediately and optionally register later to persist progress
- Use JWT session strategy (no DB session table needed) if immediate session invalidation is not a requirement for MVP

**For multi-language support:**
- Add a `language` column (`'yoruba' | 'igbo' | 'hausa'`) to all progress/session tables from the start
- Drizzle's enum or text columns with TypeScript union types enforce this at the ORM layer
- No new libraries needed

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| drizzle-orm@0.45.1 | @neondatabase/serverless@1.0.2 | Use `drizzle(neon(process.env.DATABASE_URL))` from `drizzle-orm/neon-http`. Confirmed working pattern in Neon + Vercel templates. |
| better-auth@1.5.5 | drizzle-orm@0.45.1 | Better Auth ships a first-party Drizzle adapter. Schema generation via `npx better-auth generate`. |
| better-auth@1.5.5 | Next.js 16 App Router | Better Auth's Next.js integration uses a single `auth.ts` export with `createAuthClient()` on the client side. Compatible with Server Components and Route Handlers. |
| zustand@5.x | React 19 | Zustand 5 dropped legacy React support; targets React 18+ (React 19 compatible). |
| @neondatabase/serverless@1.0.2 | Node.js ≥19 | Required for `fetch` built-in support. Next.js 16 on Vercel runs Node.js 20+ — no issue. |

---

## Adaptive Difficulty: Implementation Pattern (No New Library Required)

The existing Gemini integration already performs session evaluation (fluency/grammar/confidence scores). The adaptive difficulty layer is a persistence + prompt-injection problem, not a new AI model problem:

1. **After each session:** Call Gemini structured output to produce `{ level: 'beginner' | 'intermediate' | 'advanced', confidence: 0–1, notes: string }` from the session transcript
2. **Write to DB:** `UPDATE user_progress SET proficiency_level = $1, last_session_at = NOW() WHERE user_id = $2 AND language = $3`
3. **On session start:** Read `proficiency_level` from DB, inject into system prompt — replaces the current hardcoded `'beginner'`
4. **Dynamic escalation:** After each turn, the existing Gemini context window carries conversation history; no extra inference needed for turn-level difficulty — escalation is prompt-guided

This means adaptive difficulty adds zero new npm dependencies beyond the DB layer.

---

## Environment Variables to Add

```bash
# Neon database connection
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname?sslmode=require

# Better Auth secret (32+ char random string)
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://your-domain.vercel.app  # or http://localhost:3000 in dev
```

---

## Sources

- [Drizzle vs Prisma 2026 — makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — Drizzle as default recommendation, bundle size data (MEDIUM confidence, single source but consistent with multiple others)
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — version 0.45.1 confirmed (HIGH confidence)
- [Better Auth npm](https://www.npmjs.com/package/better-auth) — version 1.5.5 confirmed (HIGH confidence)
- [@neondatabase/serverless npm](https://www.npmjs.com/package/@neondatabase/serverless) — version 1.0.2 confirmed (HIGH confidence)
- [Neon connection pooling docs](https://neon.com/docs/connect/connection-pooling) — PgBouncer transaction mode, HTTP driver behavior (HIGH confidence, official docs)
- [Auth.js is now part of Better Auth — GitHub Discussion](https://github.com/nextauthjs/next-auth/discussions/13252) — Auth.js v5 perpetual beta context (HIGH confidence, official project discussion)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) — App Router compatibility (HIGH confidence, official docs)
- [Vercel Postgres is built on Neon — community.vercel.com](https://community.vercel.com/t/how-to-choose-between-supabase-planetscale-and-neon-for-vercel-projects/36413) — Neon as Vercel's native Postgres (HIGH confidence)
- [Gemini structured outputs — ai.google.dev](https://ai.google.dev/gemini-api/docs/structured-output) — responseSchema support, JSON Schema, Zod compatibility (HIGH confidence, official docs)
- [Zustand persist + Next.js hydration issues — GitHub Discussion](https://github.com/pmndrs/zustand/discussions/1382) — localStorage persist pitfalls in SSR (HIGH confidence, maintainer-confirmed)

---

*Stack research for: Mothertongue — persistence + adaptive difficulty additions*
*Researched: 2026-03-20*
