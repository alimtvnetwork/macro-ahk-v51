---
title: Next 3 steps (Plan 01 Step 9 — failure-log schema lock)
slug: next-task-25
---

# Next Task 25 — Plan 01 Step 9 (credit-fetch failure-log schema)

User invoked the v5 "Next ${N} Steps" prompt (N implied = 3). Implementation this turn:

1. **Step 9 — failure-log schema rename.** `CreditFailureLogPayload.Path` → `SourceUrl` in `credit-balance-types.ts` and `credit-balance-fetcher.ts` so every `/credit-balance` error funnelled via `logError('CreditBalanceUpdate.fetch', …)` matches the mandated schema (`Reason, ReasonDetail, WorkspaceId, BearerPrefix, ElapsedMs, SourceUrl`).
2. **Regression test** — added `standalone-scripts/macro-controller/src/__tests__/credit-fetch-failure-schema.test.ts` (5 tests) covering MissingToken / AuthError-401 / Http5xx / NetworkError + legacy-`Path` rejection.
3. **Version bump + docs** — 3.87.0 → 3.88.0 across manifest, constants, 10 `instruction.ts`, shared-state, payment-banner-hider index; changelog, RELEASE_NOTES, readme pin updated; plan log appended.

Verification: `bunx vitest run …/credit-fetch-failure-schema.test.ts …/credit-balance-fetcher.test.ts` → 2 files, 9 tests passed; `node scripts/check-version-sync.mjs` → ✅ All versions in sync: 3.88.0.
