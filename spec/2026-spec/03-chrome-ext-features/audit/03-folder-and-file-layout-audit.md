# Audit 03 — `03-folder-and-file-layout.md`

- **Spec under audit:** `spec/2026-spec/03-chrome-ext-features/03-folder-and-file-layout.md`
- **Auditor focus:** How blindly can an AI/LLM organize a Chrome extension repo from this layout without putting files in the wrong context, breaking imports, or producing an unloadable `dist/` bundle?
- **Scoring rubric (0–100):**
  - Clarity of contract (25)
  - Determinism / unambiguous wording (25)
  - Completeness of acceptance criteria (20)
  - Cross-references resolvable from within the repo (15)
  - Pitfalls + counter-examples (15)

## Critical score: **79 / 100**

| Dimension | Score | Notes |
|---|---:|---|
| Clarity of contract | 22 / 25 | Canonical tree, decision table, cross-context import table, and `dist/` layout are easy to follow. |
| Determinism | 19 / 25 | Mostly deterministic, but optional folders, React/plain DOM duality, and generated artifact rules need sharper pass/fail wording. |
| Completeness of acceptance | 15 / 20 | Good checklist and test ideas, but missing exact script names, alias list validation, and source-to-output manifest mapping checks. |
| Cross-references | 12 / 15 | Good references to later steps and memory, but some later step files are pending and folder names are not fully aligned with current project memory. |
| Pitfalls | 11 / 15 | Useful pitfalls, but lacks examples for alias drift, copied `dist/`, and accidental shared-folder impurity. |

## Gap analysis (detailed)

### G1 — `src/` top-level folder count is inconsistent (MEDIUM)

Acceptance says `src/` has the **seven** top-level folders listed above, but the list contains eight names when `options?` is counted:

1. `shared`
2. `background`
3. `content`
4. `injected`
5. `popup`
6. `options?`
7. `storage`
8. `platform`

The `?` means optional, but a blind AI may fail the check because the number and list do not match.

**Fix:** Rewrite acceptance as:

```md
- [ ] `src/` has exactly these required folders: `shared`, `background`, `content`, `injected`, `popup`, `storage`, `platform`.
- [ ] `src/options` MAY exist only when an options page is declared in `manifest.json`.
```

### G2 — Canonical tree is generic but project memory is product-specific (HIGH)

The tree uses names like `window.MyExt`, `data-*`, and generic `my-extension/`, while project memory and later specs require product-specific contracts such as `RiseupAsiaMacroExt`, `isNewTabOrBlankUrl()`, Code Red logging, and namespace logger usage.

This creates a blind-implementation risk: AI may build a clean generic extension layout that violates the actual repo's naming and logging rules.

**Fix:** Add a product-binding note:

> In this repo, generic examples MUST be concretized as `RiseupAsiaMacroExt.*`; forks may rename the namespace but must keep the same folder boundaries and contracts.

### G3 — `shared/` purity rule lacks mechanical boundaries (HIGH)

The spec says `src/shared/` must be pure and have no `chrome.*`, but acceptance does not require a check that blocks browser APIs, DOM APIs, or React imports from shared code.

Blind AI can easily put `navigator.clipboard`, `chrome.runtime`, `document`, or React components in `shared/` because shared helpers are tempting.

**Fix:** Add a static audit requirement:

```text
scripts/audit-shared-purity.mjs
Fails if files under src/shared import react/react-dom, reference chrome.*, window, document, localStorage, sessionStorage, navigator.clipboard, or browser.*.
Allows only explicit type-only ambient declarations in src/shared/types.ts if needed.
```

### G4 — Path alias contract is incomplete (MEDIUM)

The spec recommends aliases (`@shared`, `@background`, `@content`, `@popup`) but does not define the complete canonical alias list or require matching entries in both `tsconfig.json` and bundler config.

AI may configure TypeScript aliases that compile in tests but fail in Vite/Rollup, or vice versa.

**Fix:** Add exact alias table:

| Alias | Target |
|---|---|
| `@shared/*` | `src/shared/*` |
| `@background/*` | `src/background/*` |
| `@content/*` | `src/content/*` |
| `@injected/*` | `src/injected/*` |
| `@popup/*` | `src/popup/*` |
| `@storage/*` | `src/storage/*` |
| `@platform/*` | `src/platform/*` |

Acceptance should require identical alias mappings in `tsconfig.json` and the bundler config.

### G5 — `dist/` preservation rule risks stale artifacts if not bounded (MEDIUM)

The spec says `emptyOutDir: false` so generated artifacts survive rebuild. Project memory agrees with build artifact preservation, but the spec does not define which files are allowed to survive and which stale build files must be removed.

Blind AI may leave obsolete `background.old.js`, stale content bundles, or wrong manifest references in `dist/`.

**Fix:** Add a post-build manifest reachability audit:

- Every file referenced by `dist/manifest.json` exists.
- Every entry chunk in `dist/` is referenced by manifest, popup/options HTML, or known asset manifest.
- Stale previous build entrypoints are reported with exact path and reason.

### G6 — `dist/` is shown inside the repo tree but pitfall says not to check it in (LOW)

The canonical tree includes `dist/` at root, while pitfalls say "Mixing build artifacts into source folders (e.g. checking in `dist/`)". A blind AI could infer `dist/` should exist in source control.

**Fix:** Add a line under `dist/`:

> `dist/` is generated build output. It may exist locally, but source changes MUST NOT be made inside it and it SHOULD NOT be committed unless release policy explicitly requires artifacts.

### G7 — Cross-context import table needs explicit allowed communication APIs (MEDIUM)

The table says direct imports are forbidden, but it does not fully define the approved replacement for each forbidden path. Blind AI may invent a custom event or direct storage polling.

**Fix:** Expand table with approved communication:

| Forbidden direct import | Approved communication |
|---|---|
| popup → background | `chrome.runtime.sendMessage` typed messages |
| content → background | `chrome.runtime.sendMessage` from ISOLATED |
| background → content | `chrome.tabs.sendMessage` or `chrome.scripting.executeScript` |
| content ↔ injected | validated `window.postMessage` envelope |
| injected → background | injected → content relay → background |

### G8 — Naming rule for React components conflicts with dark/no-React project memory (LOW)

The spec allows `popup.tsx` and React component filenames, but project memory says UI framework selection rejected React and modular UIManager architecture is used. Because this spec is generic, React allowance is fine in isolation, but not fine for this repo if blindly applied.

**Fix:** Add repo-specific implementation note:

> For this repo, prefer plain TypeScript UI modules unless an existing React surface already owns the area. Do not introduce React solely because this generic tree shows `.tsx` examples.

### G9 — Test co-location rule may conflict with existing test conventions (LOW)

The rule says tests live in `__tests__/` next to code and never beside it. If the existing repo already has central `scripts/__tests__` or root test patterns, blind AI may move tests unnecessarily.

**Fix:** Add a migration-safe clause:

> New tests follow this convention; existing tests are not moved unless the feature being edited owns that area and the move is part of the same tested change.

### G10 — File-size split rule is too soft for automation (LOW)

"A background handler that grows past ~250 lines must be split" uses `~`, which is not machine-enforceable.

**Fix:** Replace with exact wording:

> A non-test background handler MUST NOT exceed 300 physical lines. Prefer splitting at 250 lines. The lint/audit threshold is 300.

### G11 — Manifest source location may not match generated-manifest workflows (MEDIUM)

The spec says root `manifest.json` is source-of-truth and copied, not regenerated. Project memory references instruction-driven seeding and compile-instruction generators. If this repo generates manifest snapshots from `instruction.ts`, the spec can conflict with actual architecture.

**Fix:** Add one of these explicit modes:

1. **Root-manifest mode:** `manifest.json` is source and copied.
2. **Generated-manifest mode:** `src/instruction.ts` is source; `manifest.json` is generated and verified.

Then mark which mode this repo uses. Do not leave both implied.

## Blocker list for blind AI implementation

1. Required folder count is inconsistent because `options?` is optional but counted ambiguously (G1).
2. Generic namespace examples can drift from required `RiseupAsiaMacroExt` contracts (G2).
3. Shared-folder purity is stated but not enforceable without a static check (G3).
4. Path aliases are suggested but not fully specified across TypeScript and bundler config (G4).
5. Root `manifest.json` source-of-truth rule may conflict with generated-manifest workflows (G11).

## Recommendation

This is a strong layout spec and is close to blindly implementable. Tighten it by fixing the required folder list, adding repo-specific namespace notes, defining the full alias map, adding shared-purity and dist-reachability audits, and explicitly choosing root-manifest mode vs generated-manifest mode. Those changes would raise the score to ~91/100.

## Remaining audit items

1. 04-version-display-and-build-stamp
2. 05-extension-reload-manual
3. 06-extension-reload-auto-on-file-change
4. 07-status-and-health-panel
5. 08-script-injection-lifecycle
6. 09-injection-idempotency-sentinel
7. 10-reinject-and-uninject
8. 11-error-logging-discipline
9. 12-namespace-logger-contract
10. 13-error-routing-and-panel
11. 14-boot-failure-banner (spec pending)
12. 15-floating-in-page-panel (spec pending)
13. 16-storage-sqlite-pointer (spec pending)
14. 17-storage-indexeddb-pointer (spec pending)
15. 18-storage-chrome-local-pointer (spec pending)
16. 19-testing-matrix (spec pending)
17. 20-acceptance-criteria (spec pending)