# Marco Chrome Extension v3.95.0

## Changed

- **Unified plan labels** across workspace badge, Credit Totals modal, and
  CSV export. New shared helper `formatPlanDisplayLabel()` in
  `credit-balance-update/plan-mapper.ts` is now the single source of truth.
  - `ktlo_2` → **Light 2**, `ktlo_3` → **Light 3**, `ktlo`/`lite` → **Lite**
  - `pro_0` → **Pro 0**, `pro_3` → **Pro 3**, `business` → **Business**, etc.

## Files changed

- `standalone-scripts/macro-controller/src/credit-balance-update/plan-mapper.ts`
  (added `formatPlanDisplayLabel`)
- `standalone-scripts/macro-controller/src/ws-list-renderer.ts`
  (`resolveTierBadgeLabel` now delegates to the shared helper)
- `standalone-scripts/macro-controller/src/ui/credit-totals-modal.ts`
  (modal Plan cell + CSV Plan column use the shared helper)
- Tests: `plan-mapper.test.ts`, `credit-totals-csv.test.ts`,
  `credit-totals-modal.test.ts`

## Verification

- `bunx vitest run plan-mapper credit-totals-csv credit-totals-modal` →
  **3 files, 64 tests passed**.
- `node scripts/check-version-sync.mjs` → ✅ All versions in sync: 3.95.0.

---

(See `changelog.md` for full history.)
