---
title: Next task 17 — Task Next sequential queue shipped (v3.81.0)
slug: next-task-17
version: v3.81.0
---

# Next task 17

User report: picking "Next 3 tasks" from the Task Next submenu must paste #1 → wait until Lovable finishes generating → paste #2 → wait → paste #3, instead of stuffing all three at once. Shipped in v3.81.0.

Root cause (one sentence): `runTaskNextLoop()` at `standalone-scripts/macro-controller/src/ui/task-next-ui.ts:185-219` was hard-capped to a single paste in v3.74.0 PASTE-ONLY mode and never received a sequential queue runner — so the submenu count rows in `prompt-dropdown.ts:988/1017` silently pasted once with no submit and no follow-up cycles.

Fix:
- New `standalone-scripts/macro-controller/src/ui/lovable-idle.ts` — `waitForLovableIdle()` shared predicate (Stop→Submit swap + Return-button gone, 800 ms debounce, 10 min timeout, Escape-cancellable).
- New `runTaskNextQueue(deps, n)` in `task-next-ui.ts`: paste → `form#chat-input.requestSubmit()` → await idle → repeat; fail-fast on any cycle; logs `[TaskNextQueue] cycle k/N done in …ms` and `logError('Task Next queue', …)` on every failure path.
- `prompt-dropdown.ts` submenu count rows + custom-count `▶` row route count > 1 to the queue, count ≤ 1 to the legacy paste-once.
- Split-button label and keyboard-handler presets unchanged (still paste-once).
- Source-level vitest: `standalone-scripts/macro-controller/src/__tests__/task-next-queue.test.ts`.
- Version: 3.80.0 → 3.81.0 across manifest, version.json, constants, shared-state, all standalone `instruction.ts`, payment-banner-hider, all readme pins.
- Changelog: top entry in `changelog.md`.
- Plan moved: `.lovable/plans/pending/01-task-next-queue-sequential.md` → `.lovable/plans/completed/01-task-next-queue-sequential.md` (Status flipped to `completed`).
- Issue resolved: `.lovable/issues/01-task-next-queue-sequential.md` (Status flipped to `resolved`).
