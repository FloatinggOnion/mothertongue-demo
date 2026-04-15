---
phase: 1
slug: gemini-stabilization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Wave 0 installs) |
| **Config file** | `vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `yarn test src/services/gemini.test.ts` |
| **Full suite command** | `yarn test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn test src/services/gemini.test.ts`
- **After every plan wave:** Run `yarn test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke tests on all 5 API routes
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | INFRA-02 | unit | `yarn test src/services/gemini.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | INFRA-01 | unit | `yarn test src/services/gemini.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-02 | unit | `yarn test src/services/gemini.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | INFRA-01 | manual smoke | `curl -X POST localhost:3000/api/evaluate -H "Content-Type: application/json" -d '{...}'` | N/A | ⬜ pending |
| 1-03-01 | 03 | 1 | INFRA-03 | unit | `yarn test src/app/drill` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 1 | INFRA-04 | manual smoke | `curl` smoke tests on all 5 routes | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — test framework config (`test: { environment: 'node', include: ['src/**/*.test.ts'] }`)
- [ ] `src/services/gemini.test.ts` — stubs for INFRA-01 (evaluateConversation throws on parse failure) and INFRA-02 (callGemini retries 3x on 429, not on 400)
- [ ] `package.json` devDependencies — `yarn add -D vitest @vitest/coverage-v8`

*Wave 0 must be complete before per-task sampling commands are runnable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| FeedbackCard renders error state + Retry button | INFRA-01 | No DOM test env (no jsdom/happy-dom configured) | Open drill page, force evaluate API to return 500 (or disconnect network), verify error state renders inside FeedbackCard shell with "Retry evaluation" button |
| "Retrying... (attempt X of 3)" shows during backoff | INFRA-02 | Requires real timing/UI observation | Mock 429 response or throttle network; verify frontend shows retry indicator after 3s, updates after ~10s |
| /api/chat returns 400 with field-level error | INFRA-04 | No integration test harness | `curl -X POST localhost:3000/api/chat -H "Content-Type: application/json" -d '{}'` → expect `{"error":"scenarioId is required"}` |
| /api/evaluate returns 400 on empty messages | INFRA-04 | No integration test harness | `curl -X POST localhost:3000/api/evaluate -H "Content-Type: application/json" -d '{"scenarioId":"x","messages":[]}'` → expect 400 |
| /api/tts returns 400 on missing text | INFRA-04 | No integration test harness | `curl -X POST localhost:3000/api/tts -H "Content-Type: application/json" -d '{}'` → expect `{"error":"text is required"}` |
| /api/transcribe returns 400 on missing audio | INFRA-04 | FormData — no integration harness | `curl -X POST localhost:3000/api/transcribe` (no body) → expect `{"error":"audio is required"}` |
| /api/suggestions returns 400 on missing fields | INFRA-04 | No integration test harness | `curl -X POST localhost:3000/api/suggestions -H "Content-Type: application/json" -d '{}'` → expect 400 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
