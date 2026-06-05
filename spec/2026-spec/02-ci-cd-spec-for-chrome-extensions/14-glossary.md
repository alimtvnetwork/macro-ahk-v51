# 14 — Glossary

> Terms used throughout the spec.

Part of [`spec/2026-spec/02-ci-cd-spec-for-chrome-extensions/`](./README.md).

---

## §39. Glossary

- **Strict mode** — installer was given an explicit version or downloaded from a
  release URL; no fallback allowed.
- **Discovery mode** — installer was run bare; may fall through to latest.
- **Probe** — non-downloading HEAD request, parallel and capped.
- **Slug** — lowercase hyphenated extension name from `manifest.json`.
- **Release artifact** — any file uploaded to a GitHub Release page.
- **Unpacked load** — installing a directory via `chrome://extensions`.

## Acceptance

- [ ] The implementation satisfies the `14 — Glossary` contract in this file and the folder-level acceptance target: Chrome-extension CI/CD, installer, release, operations, and audit contracts remain enforceable.
- [ ] Verification passes when `npm run test:cicd-spec` passes, and `node scripts/audit/check-acceptance.mjs --root=spec/2026-spec` reports this file has a machine-checkable acceptance contract.

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
