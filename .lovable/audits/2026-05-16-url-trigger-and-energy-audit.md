# URL-Trigger & Energy Audit — 2026-05-16

**Scope**: every place in the codebase that reads, matches, or reacts to a URL change in the Chrome extension and the macro-controller page script.

**User contract (the rule this audit measures against)**

> "When we check the website URL, make sure we only check it if the website is loaded once, or a refresh is pressed, or a tab is changed. These three conditions only — and never run in a loop that wastes browser energy."

So the **only** valid triggers for a URL-correctness check are:

1. **T1 — Initial page load** (`webNavigation.onCompleted` with `transitionType ∈ { 'link', 'typed', 'auto_bookmark', 'generated', 'reload' }` *or* `tabs.onUpdated` with `changeInfo.status === 'complete'`).
2. **T2 — Reload / refresh** (same as T1 but `transitionType === 'reload'`; `tabs.onUpdated` will still fire `status: 'complete'`).
3. **T3 — Tab change / focus switch** (`tabs.onActivated`).

Anything else — including SPA pushState bursts, MutationObserver ticks, polling intervals, per-call ad-hoc reads — must be either *gated* by one of T1/T2/T3 or *internally bounded* (idempotent, debounced, capped).

---

## Summary of findings

| # | Severity | Trigger | File | Issue |
|---|----------|---------|------|-------|
| U-1 | 🔴 P0 | T1/T2/T3 ALL MISSING | `src/background/auto-injector.ts:114` | `webNavigation.onCompleted.addListener(...)` is **commented out** (v7.26). T1 and T2 have no extension-side handler at all. T3 was never wired up. Auto-injection silently became "manual-only", but ~30 imports + the entire pipeline still ship and run their setup code on every SW boot. Dead path. |
| U-2 | 🟠 P1 | SPA bursts (not T1/T2/T3) | `src/background/spa-reinject.ts:47` | `webNavigation.onHistoryStateUpdated` fires for **every** `pushState`/`replaceState`. The only guard is `MIN_INJECTION_AGE_MS = 2000` against `record.timestamp`. A site that calls `history.pushState` 5× in 200 ms (Lovable's editor does this when query params change) launches 5 marker probes via `chrome.scripting.executeScript` — 5 cross-process round-trips for the same URL. No URL-change dedup, no in-flight guard. |
| U-3 | 🟠 P1 | T3 missing | (nowhere) | No `chrome.tabs.onActivated` listener anywhere in `src/background/`. The user's third trigger is unimplemented. Tab switching never re-evaluates the URL → injection state, so a user who Cmd-Tab'd to a stale tab gets stale guidance from popup until they manually reload. |
| U-4 | 🟡 P2 | Ad-hoc polling | `standalone-scripts/macro-controller/src/workspace-detection.ts:36` + 10 call-sites | `extractProjectIdFromUrl()` reads `window.location.href` *on every call*. Called from `credit-balance.ts`, `ws-move.ts`, `ws-context-menu.ts`, `page-workspace-responder.ts`, `startup-global-handlers.ts`, `startup.ts` (×3), `workspace-observer.ts`, `ui/auth-diag-rows.ts`, `core/WorkspaceManager.ts`, `rename-preset-store.ts`. No shared cache and no URL-change event — each consumer re-parses on demand. Individually cheap, collectively a code-smell that violates "check once per load/refresh/tab-change". |
| U-5 | 🟡 P2 | T1/T2/T3 missing inside page | `standalone-scripts/macro-controller/src/` (no `popstate`/SPA hook) | The page-injected macro-controller never listens for `popstate`, never monkey-patches `pushState`/`replaceState`, and never re-validates that it is still on a `/projects/{id}` URL after an SPA route change. Combined with U-1 (no auto-reinject on `onCompleted`), the script can outlive its valid URL context — e.g. user navigates from `/projects/abc` to `/dashboard` via SPA → MacroController UI keeps running with a stale `state.projectId`. The `startup-domain-guard.ts` only runs at boot. |
| U-6 | 🟢 P3 | Hot reload | `src/background/hot-reload.ts:60` | 1 s polling loop, **already gated** to dev builds (`isDevBuild()` checks `manifest.version_name.includes("dev")`). PERF-1 fix is correctly in place. Not a regression. |
| U-7 | 🟢 P3 | Keepalive | `src/background/keepalive.ts:26` | 30 s alarm, not URL-related. Within MV3 norms. |
| U-8 | 🟡 P2 | Cookie storm | `src/background/cookie-watcher.ts:198,230` | `chrome.cookies.onChanged` → `chrome.tabs.query({ url: TARGET_TAB_PATTERNS })` runs **per cookie change**. Two queries per event (`handleCookieUpdated` + downstream `handleCookieRemoved`). No debounce — a session refresh that rotates ~3 cookies in <100 ms triggers ~6 tab queries. Not a URL check per se, but it's URL-pattern matching driven by a non-T1/T2/T3 trigger. |
| U-9 | 🟢 P3 | Tab-active queries | `src/background/handlers/*.ts` (≥10 sites) | Each handler does its own `chrome.tabs.query({ active: true, currentWindow: true })` whenever a message comes in. Caller-initiated, not looped — acceptable, but a shared "current tab + URL" helper would reduce surface area. |

---

## Detailed analysis

### U-1 — Auto-injection trigger fully disabled

**Code** (`src/background/auto-injector.ts:108-115`):

```ts
export function registerAutoInjector(): void {
    // v7.26: Auto-injection DISABLED — scripts must be injected manually via popup Run button,
    // keyboard shortcut (Ctrl+Shift+Down), or context menu. Version-based re-injection is
    // handled by the script's own idempotency guard (data-version marker check).
    console.log("[auto-injector] Auto-injection DISABLED (v7.26) — manual injection only");
    // chrome.webNavigation.onCompleted.addListener(handleNavigationCompleted);
}
```

**Why it violates the rule**: T1 (load) and T2 (refresh) have **zero** background-side response. The user's contract says "the extension should check the URL on load/refresh/tab change" — currently it does none of these automatically.

**Why it's also wasteful**: `handleNavigationCompleted` + `processPageNavigation` + the entire `evaluateUrlMatches → deduplicateScripts → resolveScriptBindings → ensureBuiltinScriptsExist → filterAutoInjectOnly → injectResolvedScripts` pipeline (369 lines) and the modules it transitively imports are still bundled into the SW. Boot cost paid every cold start for code that never runs.

**Recommended fix shape** (do not implement until the user approves):

- Re-enable a single combined listener:
  - `chrome.webNavigation.onCompleted` (T1 + T2) → idempotent by URL fingerprint per tab.
  - `chrome.tabs.onActivated` (T3) → only re-check, never re-inject, unless the URL fingerprint changed since the last check for that tab.
- Add a per-tab "last URL fingerprint + injected-at" record (already exists in `state-manager.setTabInjection`). Skip if `fingerprint === lastFingerprint` AND `now - lastInjectedAt < DEDUP_TTL_MS` (suggest 5 s).
- Or, if manual-only is intentionally permanent, **delete the file** + its registration in `service-worker-main.ts:registrations[]` to stop paying the dead-import cost.

### U-2 — SPA re-inject has no URL-change dedup

`spa-reinject.ts` registers `onHistoryStateUpdated`. Its only guard is `MIN_INJECTION_AGE_MS = 2000` — i.e. it refuses to re-probe if the *last successful injection* is younger than 2 s. That guard does **not** stop a burst:

```
t=0ms   pushState → handleHistoryStateUpdated → schedule probe at t=500
t=50ms  pushState → handleHistoryStateUpdated → schedule probe at t=550
t=100ms pushState → handleHistoryStateUpdated → schedule probe at t=600
```

Each scheduled probe issues `chrome.scripting.executeScript({world:"MAIN", func: probeMarkerIds})` — a cross-process round-trip. On Lovable's editor, query-param updates are common and trigger several `pushState` calls per UI interaction.

**Fix shape**:

- Track `lastProbedUrl[tabId]` and skip when `details.url === lastProbedUrl[tabId]` and `now - lastProbedAt[tabId] < DEDUP_TTL_MS`.
- Or coalesce: cancel pending `setTimeout` if a newer event arrives for the same tab (debounce trailing).

### U-3 — `tabs.onActivated` not wired

No file in `src/background/` registers `chrome.tabs.onActivated`. T3 is silently absent. Symptom: after switching tabs, the popup/status display continues to show the previously active tab's injection state until a manual refresh fires `webNavigation.onCompleted` (which itself is disabled — see U-1).

**Fix shape**:

```ts
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    // T3 = read-only URL re-evaluation. Never re-inject from T3 alone;
    // only refresh popup/badge state.
    void refreshTabStateForUrl(tabId, tab.url);
});
```

### U-4 — `extractProjectIdFromUrl()` is called 10+ places

Each call re-runs:
1. `window.location.href` read.
2. 4 regex tests + `new URL(...)` parse.

Per-call CPU is trivial (~µs), but the design implies "every consumer treats the URL as freely pollable". A "URL changed since last navigation" event + a single cached `state.currentProjectId` would centralize the contract and make U-1/U-3 fixes one-line consumers.

**Fix shape**:

- Add `state.currentUrl` + `state.currentProjectId` in `shared-state.ts`.
- Update on `popstate` + monkey-patched `pushState`/`replaceState` (page-side) and on extension-side T1/T2/T3 events.
- Convert all 10+ `extractProjectIdFromUrl()` call-sites to read `state.currentProjectId`.

### U-5 — Page script has no SPA route-change handler

`standalone-scripts/macro-controller/src/` searches show **no** `popstate`, **no** monkey-patched `pushState`/`replaceState`, **no** `hashchange` listener. The script trusts that `startup-domain-guard.ts` at boot saw a valid URL and never re-checks. Combined with U-1, an SPA route away from `/projects/{id}` leaves a fully alive UI bound to a stale `state.projectId`.

**Fix shape**:

- Inside the IIFE startup, monkey-patch `pushState`/`replaceState` once and dispatch a synthetic `marco:urlchange` `CustomEvent` on `window`.
- A single subscriber re-validates the domain guard. If URL no longer matches a project page → teardown UI + intervals (the v2.243.0 L-1…L-5 teardown plumbing already exists).

### U-8 — Cookie watcher fan-out

Every cookie change for a session/refresh cookie triggers `chrome.tabs.query({ url: TARGET_TAB_PATTERNS })` (6 URL patterns matched against every tab in every window). No debounce. Auth refresh = 2-3 cookies = 4-6 tab queries in <100 ms.

**Fix shape**: debounce `handleCookieChange` per cookie name with a 200 ms trailing window.

---

## Energy/MV3 impact summary

| Cost | Today | After all fixes |
|------|-------|-----------------|
| SW wake on every pushState | yes (probe + `executeScript`) | only on URL change |
| SW wake on tab switch | no (silently wrong) | yes — cheap state refresh, no injection |
| SW wake on cookie storm | 4-6× per refresh | 1× per refresh (debounced) |
| Dead `auto-injector` pipeline imported at boot | yes | no (delete or re-enable) |
| Page-side ad-hoc URL re-reads per second | up to ~10 (across modules) | 0 between URL changes |

---

## What this audit does **not** do

- It does not modify any code.
- It does not propose API contracts — only fix *shapes*.
- It does not bump version, write changelog, or update memory.

Implementation is gated on the user's "next" — at that point we tackle U-1, U-2, U-3 (the three issues that map 1:1 to the user-stated rule) first, then U-5, U-4, U-8 as cleanup.

---

## Cross-references

- `mem://standards/timer-and-observer-teardown` — v2.243.0 audit L-1…L-5 (sibling: timer leaks)
- `mem://performance/idle-loop-audit-2026-04-25` — PERF-1 (hot-reload), still respected here
- `mem://constraints/no-retry-policy` — any fix must remain fail-fast / bounded
- `spec/22-app-issues/check-button/11-popup-injection-missing-guard.md` (NR-11-A) — self-heal contract referenced in `auto-injector.ts` and `spa-reinject.ts`

---

## Resolution — v2.244.0 (2026-05-16)

| ID | Status | Fix |
|----|--------|-----|
| U-1 | ✅ Fixed | New `src/background/url-trigger.ts` wires T1 `webNavigation.onCompleted` with `tabDecisionCache` dedup gate. Legacy `auto-injector.ts` left in manual-only mode (unchanged); URL evaluation now flows through the new gate. |
| U-2 | ✅ Fixed | `spa-reinject.ts` now stores per-tab `lastProbedFingerprint` and skips probe+executeScript when the SPA event resolves to the same fingerprint. |
| U-3 | ✅ Fixed | `url-trigger.ts` registers `chrome.tabs.onActivated` (T3) and evaluates on cache miss only. |
| U-4 | 🟡 Deferred (P2) | `extractProjectIdFromUrl()` call-sites unchanged in this loop; centralization tracked as follow-up. Page-side scripts can now consume the sentinel’s `data-projects` instead. |
| U-5 | 🟡 Deferred (P2) | macro-controller `popstate` teardown is a separate refactor inside the standalone script; sentinel `data-fp` change is the signal hook to add when that work lands. |
| U-6 | ✅ Already OK | Hot-reload remains dev-gated. |
| U-7 | ✅ Already OK | Keepalive untouched. |
| U-8 | ✅ Fixed | `cookie-watcher.ts` wraps `onChanged` in 200 ms trailing debounce keyed by cookie name. |

**Memory**: `mem://architecture/url-trigger-sentinel-cache`
**Changelog**: `changelog.md` → v2.244.0
