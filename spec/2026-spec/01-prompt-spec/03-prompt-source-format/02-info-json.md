# T32 · `info.json` contract

**Created:** 2026-06-02

The metadata sidecar for an on-disk prompt. Validated by
`prompt.schema.json` from `02-data-model/05-json-schema.md` after the
loader fills in `body` from `prompt.md`.

## Required fields in `info.json`

`info.json` carries **every Prompt field except `body`**:

```json
{
  "id":          "default-next-tasks",
  "slug":        "next-tasks",
  "title":       "Next Tasks",
  "version":     "1.0.0",
  "author":      "Prompts Feature Defaults",
  "categories":  ["automation"],
  "isDefault":   true,
  "order":       13,
  "createdAt":   "2026-03-21T00:00:00Z",
  "updatedAt":   "2026-03-21T00:00:00Z"
}
```

## Rules

1. Keys are `camelCase` (matches `Prompt` shape).
2. The loader MUST reject the prompt with `SchemaInvalid` if any
   required field is missing.
3. `slug` MUST equal the folder's `<slug>` suffix (case-sensitive); a
   mismatch is `SlugCollision` with `ReasonDetail = "folder slug ≠ info.json slug"`.
4. `order` MUST equal the folder prefix as an integer; mismatches are
   logged as a warning but do not fail the load (folder prefix is
   advisory, see T31).
5. Unknown extra keys are preserved on round-trip but ignored by the
   feature.

## Cross-reference

- Body comes from `prompt.md` (T33).
- Default-vs-user merge rules: T34.
- Round-trip zip format: T35.

## Acceptance

- [ ] The implementation satisfies the `T32 · info.json contract` contract in this file and the folder-level acceptance target: prompt source files round-trip through parse and emit without semantic drift.
- [ ] Verification passes when `UT-source-001..008` passes, and `node scripts/audit/check-acceptance.mjs --root=spec/2026-spec` reports this file has a machine-checkable acceptance contract.

<!-- audit: determinism+pitfalls footer -->

## Determinism (MUST)

- **MUST** keep `info.json` at the prompt folder root with exactly the keys defined in `02-info-json.md`; extra keys fail `schemas/prompt.schema.json`.
- **MUST** read `prompt.md` body as UTF-8 with explicit BOM strip; trailing whitespace is preserved verbatim (paste-fidelity).
- **MUST** import/export bundles as ZIP with `prompts-bundle.json` manifest validated by `schemas/prompts-bundle.schema.json` before any disk write.
- **MUST** treat the `default/` folder as read-only at runtime; user edits clone into `user/` and never modify defaults in place.

## Pitfalls / Counter-examples

- ❌ Detecting prompt type by file extension. ✅ Read `info.json#kind` — the source of truth.
- ❌ Auto-rewriting `info.json` with a "last modified" timestamp. ✅ See `mem://constraints/readme-txt-prohibitions` SP-1..SP-7 — no auto time stamps in source files.
- ❌ Streaming a ZIP import directly into IndexedDB without schema validation. ✅ Validate the full bundle in memory first; a single bad entry rejects the whole import.
- ❌ Trimming the prompt body to "clean up" whitespace. ✅ Body is paste-fidelity; trim only at the editor surface, never at the loader.
- ❌ Hardcoding the import path. ✅ Use `STORAGE_PROMPTS_ROOT` constant.
