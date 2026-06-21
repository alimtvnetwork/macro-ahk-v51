---
title: Next 3 steps (Plan inventory correction)
slug: next-task-29
---

# Next Task 29 — Plan inventory correction

Root cause: the plan inventory still treated completed prompt-macro plans as pending because two complete files were left outside `completed/` and the only genuinely open plan had no current-cursor header.

Implementation this turn:

1. **Read first:** `.lovable/plan.md`, `.lovable/coding-guidelines.md`, `.lovable/plans/projects-modal-15-step-improvement.md`, `.lovable/plans/prompt-macros-50-step.md`, `.lovable/plans/spec-prompt-macros-audit-100.md`, and the relevant planning/versioning memories.
2. **Archived completed plans:** moved `prompt-macros-50-step.md` → `.lovable/plans/completed/06-prompt-macros-50-step.md` and `spec-prompt-macros-audit-100.md` → `.lovable/plans/completed/07-spec-prompt-macros-audit-100.md`, then added explicit `STATUS: ✅ COMPLETED` headers to both.
3. **Pinned the active cursor:** updated `projects-modal-15-step-improvement.md` to state it is the only active plan and that Task 1 is the next cursor: write `standalone-scripts/macro-controller/spec/projects-modal/00-overview.md` before implementation.
4. **Release bookkeeping:** bumped version 3.91.0 → 3.92.0 across manifest/constants/scripts/version.json/readme pins, updated `changelog.md`, `RELEASE_NOTES.md`, and appended `.lovable/plan.md`.

Verification:

- Before: `ls .lovable/plans/` showed 3 apparent pending files.
- After: `ls .lovable/plans/` shows only `projects-modal-15-step-improvement.md` plus `completed/` and `subtasks/` folders.
- Version sync target: `node scripts/check-version-sync.mjs` should report `✅ All versions in sync: 3.92.0`.

Next remaining items:

1. Projects Modal Task 1 — write `standalone-scripts/macro-controller/spec/projects-modal/00-overview.md` explaining current git fetch / last communication flow and target behavior.
2. Projects Modal Task 2 — investigate/log the actual `sdk.api.projects.get` URL/method behind the HTTP 405 and document the endpoint decision.
3. Projects Modal Task 3 — fix CSV project-name resolution so real names are used when available and IDs are not emitted as names.