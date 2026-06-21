# Marco Chrome Extension v3.84.0

## Added

- `onCreditResolved(listener)` pub-sub on the credit-fetch controller — emitted once per `/credit-balance` completion (success or failure) after cache + in-flight cleanup.

## Fixed

- Workspace credit bars now repaint automatically when `/credit-balance` returns. `ws-list-renderer.ts` subscribes to `onCreditResolved`, debounces (120ms) parallel fan-out resolves into one render, invalidates the dropdown hash, and re-populates. (Plan 01 / Step 7, RCA #4)

## Verification

- `bunx vitest run` on credit-fetch-controller / credit-button-fanout / credit-summary-resolver-pending → **3 files, 23 tests passed**.
- `node scripts/check-version-sync.mjs` → `✅ All versions in sync: 3.84.0`.
