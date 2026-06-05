# Audit 07 — Status and Health Panel

- **Source spec**: `../07-status-and-health-panel.md`
- **Audit date**: 2026-06-05 (Asia/Kuala_Lumpur)
- **Audited against**: `mem://standards/timer-and-observer-teardown`,
  `mem://constraints/no-retry-policy`,
  `mem://standards/error-logging-via-namespace-logger.md`,
  `mem://features/new-tab-no-url-guard`,
  `mem://standards/verbose-logging-and-failure-diagnostics`,
  `mem://preferences/dark-only-theme`.

## Score: 72 / 100

| Dimension                       | Weight | Score |
|---------------------------------|-------:|------:|
| Clarity of contract             |     25 |    19 |
| Determinism (AI can implement)  |     25 |    16 |
| Completeness of acceptance      |     20 |    14 |
| Cross-references                |     15 |    11 |
| Pitfalls coverage               |     15 |    12 |
| **Total**                       |    100 |  **72** |

## Gap analysis

### G1 — `useStatusSnapshot` initial state is `/* initial */` placeholder (Critical)
The hook returns `useState<StatusSnapshot>(/* initial */)`. An AI implementing
this blindly will either pass `undefined` (runtime crash on `snap.tab.state`) or
invent a shape. **Fix:** specify the exact initial snapshot constant:

```ts
const INITIAL_SNAPSHOT: StatusSnapshot = {
  buildId: BUILD_ID,
  worker: { state: "sleeping" },
  tab:    { state: "n/a" },
  errors: { last24h: 0 },
  heartbeatIso: new Date(0).toISOString(),
};
```

### G2 — Conditional Hooks violation (Critical, blocks build)
`StatusPanel` early-returns before `useStatusSnapshot()`, violating the React
Rules of Hooks. The component will fail lint (`react-hooks/rules-of-hooks`) and
crash on environment toggles. **Fix:** call the hook first, then branch on
`isExtensionPopup()`; or split into `<PreviewPanel/>` and `<LivePanel/>`
sibling components rendered by a thin wrapper.

### G3 — `tone()` and `Pill`/`Row`/`RelativeTime`/`VersionBadge` not defined
Reference component imports four UI primitives and one helper that have no
contract. **Fix:** add an "Internal components" subsection listing each
component's props and the tone mapping table: `alive|injected|connected →
success`, `sleeping|not-injected → muted`, `error|disconnected → danger`,
`n/a → neutral`.

### G4 — Probe handler returns plain object, not `{ worker, tab, errors, heartbeatIso, buildId }` matching `StatusSnapshot`
The handler omits `buildId`; the hook patches it client-side. That works but is
undocumented. **Fix:** state explicitly that `buildId` is client-injected from
`@shared/constants` and never trusted from the SW reply (defends against stale
SW after reload — important per memory: build-aware cache invalidation).

### G5 — `Promise.race` with `setTimeout` leaks the timer
The losing branch never clears the timer; on a slow SW reply the timer fires
into a stale closure. **Fix:** wrap with an `AbortController` and clear the
timeout in a `finally`:

```ts
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort("probe-timeout"), TIMEOUT_MS);
try { ... } finally { clearTimeout(t); }
```

### G6 — Code-Red dedup key is under-specified
"Deduped by `(probeName, reason)` per session" — but session boundary is
undefined for a popup (open/close? SW lifetime? day?). **Fix:** define session
as "one SW lifetime" and store the dedup set in
`globalThis.__statusProbeDedup` inside the SW module; reset on SW startup.

### G7 — Dark-only theme not enforced in tokens
Component uses `bg-background`, `text-muted-foreground` — good — but `tone()`
is undefined and could leak raw colors (`text-red-500`). **Fix:** require
semantic tone classes (`bg-destructive/15 text-destructive`, `bg-success/15
text-success`) and forbid Tailwind palette colors per
`mem://preferences/dark-only-theme`.

### G8 — `openErrorsPanel` not defined; routing contract missing
The Errors row uses `onClick={openErrorsPanel}` with no import. The detail
link uses `href="#/popup/details"` — hash routing is not declared anywhere in
the popup. **Fix:** specify the popup router (hash vs memory router) and
export `openErrorsPanel()` from `src/popup/routes.ts` returning
`navigate("/errors")`.

### G9 — `countErrorsSince` source not specified
SQLite? IndexedDB? `chrome.storage.local`? Per
`mem://architecture/data-storage-layers` errors live in SQLite. **Fix:** state
"reads `error_events` table from session SQLite (step 16); falls back to `0`
with `Reason="ErrorStoreUnavailable"` Code Red on schema-missing".

### G10 — Heartbeat freshness threshold missing
The row shows `3s ago` but never says when it turns red. **Fix:** add: heartbeat
> 10 s old → tone `warning`; > 30 s → tone `danger` + force one `worker:
error` Code Red.

### G11 — Acceptance lacks a perf budget
"Render within 300 ms of popup open" appears once but no test asserts it.
**Fix:** add acceptance "`StatusPanel.perf.test.tsx` asserts first paint
< 50 ms with mocked probe and full snapshot < 300 ms".

### G12 — Missing pitfall: probe answers from a stale SW after auto-reload
Per `mem://architecture/injection-cache-management`, build-id mismatch must
invalidate. **Fix:** add pitfall: "If `reply.buildId !== BUILD_ID` (when ever
included), discard the snapshot and surface `worker: error` with
`Reason="BuildIdMismatch"`".

## Remaining audits (post this turn)

1. 09-injection-idempotency-sentinel
2. 10-reinject-and-uninject
3. 11-error-logging-discipline
4. 12-namespace-logger-contract
5. 13-error-routing-and-panel
6. 14-floating-button (spec pending)
7. 15-floating-in-page-panel (spec pending)
8. 16-storage-sqlite-pointer (spec pending)
9. 17-storage-indexeddb-pointer (spec pending)
10. 18-storage-chrome-local-pointer (spec pending)
11. 19-testing-matrix (spec pending)
12. 20-acceptance-criteria (spec pending)
