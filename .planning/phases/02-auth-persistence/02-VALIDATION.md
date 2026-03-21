---
phase: 2
slug: auth-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (exists, node environment) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/lib/auth.test.ts src/app/api/evaluate/route.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-W0-auth-test | W0 | 0 | AUTH-01,02,03 | unit stub | `npm test -- src/lib/auth.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-evaluate-test | W0 | 0 | PERS-01 | unit stub | `npm test -- src/app/api/evaluate/route.test.ts` | ❌ W0 | ⬜ pending |
| 02-W0-progress-test | W0 | 0 | PERS-02 | unit stub | `npm test -- src/db/user-progress.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-AUTH-01 | 01 | 1 | AUTH-01 | unit | `npm test -- src/lib/auth.test.ts -t "AUTH-01"` | ❌ W0 | ⬜ pending |
| 02-01-AUTH-02 | 01 | 1 | AUTH-02 | unit | `npm test -- src/lib/auth.test.ts -t "AUTH-02"` | ❌ W0 | ⬜ pending |
| 02-01-AUTH-03 | 01 | 1 | AUTH-03 | unit | `npm test -- src/lib/auth.test.ts -t "AUTH-03"` | ❌ W0 | ⬜ pending |
| 02-02-PERS-01 | 02 | 1 | PERS-01 | unit | `npm test -- src/app/api/evaluate/route.test.ts -t "PERS-01"` | ❌ W0 | ⬜ pending |
| 02-02-PERS-02 | 02 | 1 | PERS-02 | unit | `npm test -- src/db/user-progress.test.ts -t "PERS-02"` | ❌ W0 | ⬜ pending |
| 02-02-AUTH-04 | 02 | 1 | AUTH-04 | manual | see Manual-Only below | N/A | ⬜ pending |
| 02-03-PERS-03 | 03 | 1 | PERS-03 | manual | see Manual-Only below | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/auth.test.ts` — stubs for AUTH-01, AUTH-02, AUTH-03 (mock `auth.api.getSession`, test route handlers)
- [ ] `src/app/api/evaluate/route.test.ts` — extend existing evaluate route test with PERS-01 session save stub
- [ ] `src/db/user-progress.test.ts` — stubs for PERS-02 (DB read/write for proficiency level)
- [ ] `.env.local` — must contain `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-device session access | AUTH-04 | Requires two live browser sessions with real Turso DB | Log in on device A, log in on device B with same credentials, verify same history and level visible |
| History page shows past sessions | PERS-03 | Requires live data from completed sessions | Complete a drill, end session, navigate to /history, verify session card appears with correct scores |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
