# Marco Chrome Extension v3.98.0

## Changed

- Synced `.lovable/plans/projects-modal-15-step-improvement.md` with reality:
  Tasks 4–10 (SQLite cache schema, write/read paths, TTL setting, fetch delay
  setting, search bar, filter chips, workspace + credits header) are already
  shipped in code. Cursor advanced to **Task 11 — workspace multi-select
  dropdown**.

No runtime behavior change in this release — version bumped purely so plan
state, changelog, and `version.json` stay in sync.

## Verification

- `node scripts/check-version-sync.mjs` → ✅ All versions in sync: 3.98.0.

---

(See `changelog.md` for full history.)
