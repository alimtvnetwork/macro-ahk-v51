# Marco Chrome Extension v3.99.0

## Added

- Projects Modal Task 11: workspace multi-select chips now hide/show whole
  workspace blocks from the Projects dialog filter row.
- The Projects dialog summary now reports visible/total workspace count, and
  Clear all filters resets workspace visibility along with search/open/repo
  filters.

## Changed

- Advanced `.lovable/plans/projects-modal-15-step-improvement.md` to Task 12 —
  credits-used filter.

## Verification

- `bunx vitest run standalone-scripts/macro-controller/src/__tests__/projects-modal-csv.test.ts` → 1 file, 5 tests passed.
- `node scripts/check-version-sync.mjs` → ✅ All versions in sync: 3.99.0.

---

(See `changelog.md` for full history.)
