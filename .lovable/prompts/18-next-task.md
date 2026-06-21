---
title: Next task 18 — credit-bar call-site audit (Plan Step 2) (v3.81.1)
slug: next-task-18
version: v3.81.1
---

# Next task 18

Plan.md Step 2 ("Audit call sites of raw credit fields") delivered. Saved at `.lovable/audits/2026-06-21-credit-field-call-sites.md`.

Headline: **5 P0 + 3 P1 + 2 P2 legacy-direct UI sites** read raw `ws.available / ws.totalCredits / ws.dailyLimit` instead of going through `resolveCreditSummary(ws)`. The P0s are inside `ws-list-renderer.ts` (lines 455, 466, 499, 724-756, 774-775) and `ui/credit-totals-modal.ts` (lines 165-167, 233, 501-514) — these are the exact surfaces that render `0/0` for new-free / Lite / Cancelled workspaces because nothing in those code paths can trigger the on-demand `/credit-balance` fetch.

Plan Step 3 (renderer migration) must cover all 5 P0 + 3 P1 sites in one PR. P2 export paths can stay raw provided the export entry point awaits the Step 4 resolver fan-out — verify with a unit test.

Version: patch bump 3.81.0 → 3.81.1 (docs-only deliverable, no runtime change).
