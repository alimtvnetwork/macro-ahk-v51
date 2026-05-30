# Issue 127 — Plan button no-op + Task Next dropdown overflow + missing Plan mode

**Status:** Queued
**Reporter:** User (screenshot attached in chat 2026-05-30)
**Target version:** v3.38.0 (bundled with Issues 124/125/126)
**Owner module:** `standalone-scripts/macro-controller/src/lovable-toolbar/` (Prompts dock + Task Next menu)

---

## 1. Symptoms

### Bug A — "Plan" button does not work
- The Plan toggle (next to Prompts / Chat in the Lovable composer toolbar that the extension injects/augments) does **not** activate Plan mode.
- Clicking it produces no visible state change: no toggled style, no Plan-mode badge, no change in composer placeholder/submit behavior.
- There is also **no Plan-mode entry** in the extension's own mode selector — only Chat/Build are exposed. Plan should be a first-class mode (parity with Lovable's native Plan mode).

### Bug B — "Task Next" dropdown overflows to the left, clipped by viewport
- See screenshot: opening the **Task Next** picker (anchored under the Prompts pill) renders the menu **leftward**, which gets clipped by the page edge at narrow widths.
- Expected: menu should flip to **open rightward** (or be constrained inside viewport) when there is insufficient space on the left, matching the behavior we already implemented for other dock menus.
- Custom row (`Custom: # ▶`) and Settings row are partially cut off as a result.

---

## 2. Root cause hypotheses (to confirm in Task 1)

### Bug A — Plan button
- Likely one of:
  1. The Plan button DOM element changed in Lovable's UI (new `data-mode="plan"` attribute or new XPath). Our click handler is bound to a stale selector and silently no-ops.
  2. Click handler exists but never dispatches the `mode-change` event the composer listens to. Need to mirror Chat→Build handler shape.
  3. The mode-selector enum in `mode-selector/types.ts` only has `'chat' | 'build'` — Plan was never added.

### Bug B — Task Next dropdown
- `task-next-menu/position.ts` (or equivalent) computes `left = anchorRect.left - menuWidth` unconditionally instead of using the shared `flipIfClipped(anchorRect, menuSize, viewport)` helper that Prompts/Queue menus use.
- Probably missing `position: fixed` + viewport clamp; or `transform-origin` set so menu grows leftward without overflow detection.

---

## 3. Identifiers (selectors / XPaths)

> **TODO in Task 1:** capture exact selectors from live DOM. Provisional based on screenshot DOM patterns:

```ts
// Plan button (Lovable native composer)
// XPath candidate: //button[@data-mode="plan"] | //button[normalize-space()="Plan"]
export const SEL_PLAN_BUTTON = '[data-mode="plan"], button[aria-label="Plan mode"]';

// Sample HTML (placeholder — verify):
// <button data-mode="plan" aria-pressed="false" class="...">Plan</button>

// Task Next trigger pill
export const SEL_TASK_NEXT_TRIGGER = '[data-marco-task-next-trigger]';

// Task Next menu root
export const SEL_TASK_NEXT_MENU = '[data-marco-task-next-menu]';
```

Add concrete XPaths + HTML snippets here once Task 1 inspection lands.

---

## 4. Acceptance criteria

### Bug A
1. Clicking Plan toggles `aria-pressed="true"` on the native button AND emits the same internal event our Chat/Build handlers emit.
2. Extension `mode-selector` exposes Plan as a third option with its own icon + tooltip ("Plan mode — outline before executing").
3. Selecting Plan in the extension menu also reflects on the native button (two-way sync), same contract as Chat↔Build today.
4. Regression: Chat and Build continue to work; switching between modes never leaves a stale `aria-pressed`.

### Bug B
1. Task Next menu opens **rightward by default** when anchor is in the left half of the viewport; flips leftward only when right side would clip.
2. Menu is fully visible at viewport widths ≥ 360 px; never overflows past `window.innerWidth` or `0` on either side.
3. Vertical placement falls back upward when bottom would clip (same helper as Prompts menu).
4. Custom row and Settings row are always visible without horizontal scroll.

---

## 5. Files to touch

```
standalone-scripts/macro-controller/src/lovable-toolbar/
├── mode-selector/
│   ├── types.ts                  # add 'plan' to ModeId union
│   ├── plan-mode-handler.ts      # NEW: click + sync logic mirroring chat/build
│   ├── selectors.ts              # add SEL_PLAN_BUTTON + XPath fallback
│   └── __tests__/plan-mode-handler.test.ts   # NEW
├── task-next-menu/
│   ├── position.ts               # use flipIfClipped() shared helper
│   ├── render.ts                 # ensure position:fixed + transform-origin
│   └── __tests__/position.test.ts            # NEW or extend
└── shared/
    └── flip-if-clipped.ts        # confirm helper exists; extract if duplicated
```

Plus:
- `manifest.json` — version bump (bundled into v3.38.0)
- `changelog.md` (root + macro-controller) — entries under v3.38.0

---

## 6. 5-step task plan

1. **Inspection + spec finalization** — Open Lovable composer in dev, capture exact Plan button DOM (`outerHTML`, full XPath, attributes, event listeners via DevTools). Capture Task Next menu's computed style + bounding box at narrow viewport. Update §3 with concrete identifiers. Confirm hypotheses in §2.
2. **Bug B fix — Task Next position** — Refactor `task-next-menu/position.ts` to call shared `flipIfClipped()`. Add unit tests for: (a) anchor in left half → opens right, (b) anchor in right half → opens left, (c) anchor near bottom → opens upward, (d) viewport < menu width → clamps inside.
3. **Bug A fix — Plan button binding** — Add `'plan'` to `ModeId` union. Implement `plan-mode-handler.ts` mirroring Chat/Build: click native button → dispatch synthetic event → update extension mode-selector state. Add unit tests asserting (a) click toggles `aria-pressed`, (b) state sync both directions, (c) stale selector falls back to XPath.
4. **Integration test** — Add jsdom integration test wiring `mode-selector` + `plan-mode-handler` together; assert switching chat→plan→build→plan never leaves >1 button pressed and never loses sync.
5. **Version bump + changelog** — Roll into the queued v3.38.0 bump (with Issues 124/125/126). Add changelog entries: "Fixed Plan button no-op", "Added Plan mode to extension mode selector", "Fixed Task Next dropdown viewport overflow".

---

## 7. Non-goals

- Do not redesign the mode selector UI; only add Plan as a third entry using existing styling.
- Do not modify Lovable's native Plan-mode behavior; we only ensure our toggle wires up to it.
- Do not change Task Next menu *contents* (Next 1/2/3/.../Custom/Settings rows stay identical) — positioning only.
