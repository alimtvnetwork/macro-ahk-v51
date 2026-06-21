# Marco Chrome Extension v3.104.0

## Fixed

- **Move-to-Workspace now sends the Castle request token.** Lovable's
  `/projects/:id/move-to-workspace` PUT requires
  `x-castle-request-token` (Castle.io risk engine) or it replies
  `403 castle_denied`. The extension now mints a one-shot token via
  `window._castle('createRequestToken')` from MAIN world on every move
  call and forwards it to the API. Cookies (`__cuid`, `cid`) continue
  to ride along via the existing `withCredentials:true` axios client.
- **Observability.** Each move logs
  `Castle token: present (len=…)` / `MISSING — request may be blocked`
  and the Castle helper logs `request token resolved` / `timed out` /
  `window._castle missing`.

## Added

- New spec `standalone-scripts/macro-controller/spec/workspace-move/00-api-contract.md`
  capturing the v2 request shape, where the Castle token comes from,
  no-retry behaviour on `castle_denied`, and the full response matrix.

## Verification

- `node scripts/check-version-sync.mjs` → ✅ All versions in sync: 3.104.0.
- `bunx vitest run standalone-scripts/macro-controller/src/__tests__/` →
  35 files passed, 99 tests passed.
