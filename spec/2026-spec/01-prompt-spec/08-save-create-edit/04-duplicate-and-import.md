# 04 — Duplicate, Import, Export

**Date:** 2026-06-02
**Task:** T59

## Duplicate

`PromptStore.duplicate(slug)`:

1. Load source prompt (default or user).
2. Generate new slug: `${slug}-copy`, then `-copy-2`, `-copy-3` on collision.
3. Title becomes `"<original title> (copy)"`.
4. `archivedAt` cleared, `version` reset to 1.
5. Always created in the **user namespace** even if source was a default.

## Import (single prompt)

Accepts a `prompt.md` + `info.json` pair, or a `.json` blob matching the prompt schema.

Pipeline:

1. Schema validate.
2. Slug collision → user is asked: **Skip / Overwrite / Rename**.
3. Persist; emit `{ kind: "imported", slug }`.

## Import (bundle .zip)

Per `03-prompt-source-format/05-import-export-zip.md`:

- Read manifest, iterate entries.
- Apply collision policy chosen once for the whole bundle (default: **Rename**).
- Atomic: all-or-nothing; on any schema failure the whole import aborts before any write.

## Export

- **Single:** download `{slug}.json` (info + body inline).
- **Selection or all:** download `prompts-<YYYYMMDD-HHmm>.zip` matching the bundle format.
- Exports never include `archivedAt`-set prompts unless the user explicitly opts in.

## Acceptance

- [ ] The implementation satisfies the `04 — Duplicate, Import, Export` contract in this file and the folder-level acceptance target: prompt create, edit, delete, duplicate, import, and archive flows are reversible and observable.
- [ ] Verification passes when `UT-crud-001..010` passes, and `node scripts/audit/check-acceptance.mjs --root=spec/2026-spec` reports this file has a machine-checkable acceptance contract.

<!-- audit: determinism+pitfalls footer -->

## Determinism Notes

- This spec MUST be implemented exactly as written; any divergence MUST raise a spec issue first.
- Numeric defaults (timeouts, retries, sizes) MUST be sourced from `reference/05-runtime-defaults.md` (e.g. `DELAY_MS = 5000 ms`, `MAX_RETRIES = 3`).
- All boolean toggles MUST have an explicit default of `false` unless the runtime-defaults table specifies otherwise.
- Implementations MUST treat undocumented states as a hard error and SHALL log via the namespace logger.

## Pitfalls

- **Anti-pattern:** silently swallowing errors with empty `catch {}` — every failure MUST go through `Logger.error()` with `Reason` + `ReasonDetail`.
- **Edge case:** new-tab / blank navigations (`about:blank`, `chrome://newtab/`) — gate every entry point with `isNewTabOrBlankUrl()`.
- **Counter-example:** hardcoding a timezone string (e.g. `Asia/Kuala_Lumpur`) — always render in the user's local timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Gotcha:** assuming Chrome `storage.local` is synchronous — it is async and MUST be awaited; never read it during top-level module evaluation.
