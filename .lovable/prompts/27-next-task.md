---
title: Next 3 steps (Refill-priority × CreditResolved regression)
slug: next-task-27
---

# Next Task 27 — Refill-priority resolver-repaint lock

User invoked the v5 "Next ${N} Steps" prompt (N implied = 3). Implementation this turn:

1. **Read the wire** — confirmed `ws-list-renderer.ts:1143-1145` already subscribes via `onCreditResolved` and re-runs `populateLoopWorkspaceDropdown()` which calls `sortByRefillPriority` (line 783). My prior-turn claim that "R Nd doesn't update on CreditResolved" was wrong; the wiring is complete.
2. **Lock it with a regression** — added `standalone-scripts/macro-controller/src/__tests__/refill-priority-credit-resolved.test.ts`. Seeds Ktlo (available=0) + Pro (available=50), asserts Pro sorts first; writes a 500-credit `CreditFetchResult` to the resolver cache via `__writeCreditBalanceUpdateMemoryCacheForTests`, then asserts the Ktlo workspace floats to the top (score 9×500 vs 9×50). Caught one bug while writing (cache freshness check used real `Date.now()`, not the test clock — fixed by basing fixture on `Date.now()`).
3. **Version bump + docs** — 3.89.0 → 3.90.0 across manifest, constants, 8 `instruction.ts`, shared-state, payment-banner-hider index, readme pins; changelog + RELEASE_NOTES updated; plan log appended.

Verification: `bunx vitest run …/refill-priority-credit-resolved.test.ts` → **1/1 passed**; `✅ All versions in sync: 3.90.0`.
