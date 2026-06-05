# Audit 08 — Script Injection Lifecycle

- **Source spec**: `../08-script-injection-lifecycle.md`
- **Audit date**: 2026-06-05 (Asia/Kuala_Lumpur)
- **Audited against**: `mem://architecture/script-injection-lifecycle`,
  `mem://architecture/injection-context-awareness`,
  `mem://architecture/message-relay-system`,
  `mem://features/new-tab-no-url-guard`,
  `mem://constraints/no-retry-policy`,
  `mem://architecture/injection-cache-management`,
  `mem://architecture/self-healing-script-storage`,
  `mem://architecture/dynamic-script-loading`,
  `mem://constraints/no-storage-pascalcase-migration`.

## Score: 70 / 100

| Dimension                       | Weight | Score |
|---------------------------------|-------:|------:|
| Clarity of contract             |     25 |    19 |
| Determinism (AI can implement)  |     25 |    15 |
| Completeness of acceptance      |     20 |    13 |
| Cross-references                |     15 |    11 |
| Pitfalls coverage               |     15 |    12 |
| **Total**                       |    100 |  **70** |

## Gap analysis

### G1 — `chrome.scripting.executeScript` files vs func mode unspecified (Critical)
`executeFile()` uses `{ files: [file] }` where `file` is a TypeScript source path
like `src/content/bootstrap-namespace.iife.ts`. Chrome rejects non-built paths;
files MUST be web-accessible resources from `dist/` and listed in
`web_accessible_resources`. **Fix:** require the resolver to return **built
bundle paths relative to extension root** (e.g. `assets/content/bootstrap-
namespace-<hash>.iife.js`) and reference step 02's
`web_accessible_resources` rules.

### G2 — `world: "MAIN"` + `files:` is supported, but the bootstrap is `.iife.ts` (Critical)
Chrome only accepts `.js`. **Fix:** explicitly state "all `files[]` entries
MUST be `.js` artifacts emitted by Vite; never source `.ts`".

### G3 — Relay event name conflicts across contexts
`RELAY_EVENT = "riseupasia:macro-ext:relay"` is dispatched on `window` in the
isolated world, but listeners also live in MAIN world. Isolated and MAIN
worlds **do not share `window` event listeners** when the event is dispatched
on `window` (they share the DOM, so this actually works) — but `CustomEvent
.detail` is cloned via structured clone *across worlds for DOM events*,
losing functions and prototypes. **Fix:** mandate `JSON`-safe envelopes only,
add a contract type `PageToIsolatedEnvelope { source: "page"|"isolated";
kind: string; buildId: string; payload: unknown }` matching the relay memory
note in Audit 02 G6, and reference `mem://architecture/message-relay-system`.

### G4 — `chrome.tabs.sendMessage` at stage 5 has no receiver contract
The IIFE bundle runs in MAIN world; `chrome.tabs.sendMessage` reaches the
ISOLATED-world relay only. **Fix:** state explicitly "`injection/link-runtime`
is handled by the isolated relay, which re-broadcasts as `CustomEvent` to MAIN
world; MAIN-world IIFEs subscribe via
`window.addEventListener(RELAY_EVENT, ...)`".

### G5 — Sentinel signature drift
`isAlreadyInjected(tabId)` is called here but step 09 is the source of truth.
The signature is repeated without import path. **Fix:** specify import
`from "./sentinel"` and add note "sentinel returns `boolean | "build-mismatch"`;
treat `"build-mismatch"` as not-injected and proceed".

### G6 — `force: true` skips sentinel but not uninject
Forcing re-injection on top of an existing namespace risks the "different
build id" path called out in Stage 2 rules. **Fix:** add: "if `force` and a
prior namespace exists, the pipeline MUST first call `uninjectFromTab()` from
step 10 before stage 1".

### G7 — Plan does not include relay or bootstrap files
`InjectionPlan` only carries `mainWorldFiles` and `cspFallbackFiles`. Relay and
bootstrap paths are hardcoded in `injector.ts`. That couples the injector to
specific filenames and breaks the "instruction-driven seeding" memory. **Fix:**
extend `InjectionPlan` with `bootstrapFile`, `relayFile`, both sourced from the
build manifest at `assets/instruction.json`.

### G8 — `MissingDynamicModule` vs `MissingBundlePath` taxonomy unclear
Both are missing-file conditions. **Fix:** define the canonical reason table:
- `NewTabOrBlankUrl` — guarded URL
- `MissingBundlePath` — resolver could not find a planned file
- `MissingDynamicModule` — runtime `require()` for an unregistered id
- `RelayInstallFailed` — stage 3 throw
- `BootstrapFailed` — stage 2 throw
- `IifeFailed` — stage 4 throw (carry failing `file`)
- `CspBlocked` — stage 6 detected CSP violation
- `BuildIdMismatch` — prior namespace from different build

### G9 — No instruction for `chrome.scripting.executeScript` failure shapes
Chrome throws `Cannot access contents of url "chrome://..."` and similar.
Spec swallows all errors into `InjectionStageFailed`. **Fix:** require mapping
of known Chrome error message substrings to canonical Reasons, with the raw
message preserved in `ReasonDetail`.

### G10 — Acceptance lacks idempotency assertion paired with `force`
**Fix:** add "calling `injectIntoTab` twice with `force: false` MUST result in
exactly one set of `chrome.scripting.executeScript` calls (assert via spy)".

### G11 — Pitfall missing: storage PascalCase migration risk
Stage 1 talks about reading `StoredProject` keys. Per
`mem://constraints/no-storage-pascalcase-migration` rewriting keys is banned.
**Fix:** add pitfall: "Resolver may READ existing camelCase `StoredProject`
keys; it MUST NOT rewrite, normalize, or migrate them to PascalCase".

### G12 — Pitfall missing: SW unregistration of `onMessage` after reload
After auto-reload (step 06), the prior SW's `onMessage` listeners die; old
content scripts still post messages. **Fix:** add pitfall: "Relay MUST detect
`chrome.runtime.id` becoming undefined (`Extension context invalidated`) and
tear itself down rather than logging perpetually".

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
