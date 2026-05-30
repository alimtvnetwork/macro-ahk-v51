# Issue 124 — Loop Play/Pause Gate & Project-Locked Error Handling

**Version target:** v3.37.0
**Owner modules:** `standalone-scripts/macro-controller/src/ws-adjacent.ts`, `ws-move.ts`, new `loop-run-state.ts`, new `project-lock-detector.ts`

---

## 1. Problem

Two related gaps when the macro loop moves between workspaces:

1. **No run-state gate before moving.** Adjacent move (up/down) fires as soon as the user clicks, even while a Lovable run is still streaming in the current workspace. Result: half-finished runs are abandoned.
2. **`project locked` errors are silently lost.** When the destination workspace returns "project is locked", the error is logged but never persisted, so the next move repeats the same failure.
3. **No auto-resume after a successful move.** The user must manually click Play after every move-down/up.

## 2. Behaviour contract

### 2.1 Pre-move gate (move-down / move-up / move-to)

Run-state is detected via the chat composer's primary submit button (`#chatinput-send-message-button`, XPath `…/form/div[2]/div/button[3]`). The same button toggles its inner icon:

- **Run active** → button renders a **STOP icon** (filled rounded square SVG) inside `span[7]` at `…/button[3]/span[7]`. SVG path starts with `d="M20.75 17…"`.
- **Run idle** → same `button[3]` renders the **Send/Run (up-arrow) icon** (path `d="M11 19V7.415…"`) and is `disabled` only when the textarea is empty.

Before issuing the move API call:
1. Probe `SEND_OR_STOP_BUTTON_XPATH` = `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]`. If the STOP icon (`STOP_ICON_XPATH` = `…/button[3]/span[7]` containing the square-path SVG) is **not** present → idle → proceed with the move.
2. If the STOP icon is present → run is streaming → **do not move**. Show toast `"Waiting for current run to finish…"` and poll every `RUN_GATE_POLL_MS = 1000` ms up to `RUN_GATE_TIMEOUT_MS = 120_000` ms until STOP disappears.
3. On timeout → log + toast `"Run still active after 2 min — move cancelled"`. No retry, no backoff (per `mem://constraints/no-retry-policy`).

### 2.2 Project-locked detection & persistence

When the move API or the post-move project-load surfaces a "project locked" condition:
1. Detect via the response body (`error`/`message` containing `"project is locked"`, `"project_locked"`, or HTTP 423) **or** a DOM banner matching the optional locked-banner XPath (§5).
2. Persist the error into a new SQLite table `LoopProjectLockEvent` with columns:
   - `EventId INTEGER PK AUTOINCREMENT`
   - `WorkspaceId TEXT NOT NULL`
   - `ProjectId TEXT NOT NULL`
   - `DetectedAtMs INTEGER NOT NULL`
   - `Reason TEXT NOT NULL` — short code: `api-423`, `api-body-locked`, `dom-banner`
   - `ReasonDetail TEXT NOT NULL` — full server message or banner text
3. After persisting, re-enter the §2.1 wait loop on the destination workspace until STOP disappears.

### 2.3 Auto-press Run (Send) after successful move

After `moveToWorkspace` resolves successfully and the destination URL loads:
1. Wait for `SEND_OR_STOP_BUTTON_XPATH` to be present AND for the STOP icon to be ABSENT via `pollUntil({ intervalMs: 500, timeoutMs: 15_000 })`.
2. Click the submit button once (it acts as Run when idle). Log `LoopRun.autoRun ws=<id> outcome=ok`.
3. On timeout, log `LoopRun.autoRun outcome=run-button-not-ready` (no retry) and continue.

> Note: there is no separate Play/Pause control in Lovable's composer. The same `button[3]` toggles its inner icon between STOP (running) and Send/Run (idle). Detection is icon-based.

## 3. New modules

```
standalone-scripts/macro-controller/src/
  loop-run-state/
    index.ts            # public API: isStopVisible(), isRunIdle(), waitForRunIdle(), pressRun()
    selectors.ts        # SEND_OR_STOP_BUTTON_XPATH, STOP_ICON_XPATH, LOCKED_BANNER_XPATH (see §5)
    poll.ts             # pollUntil helper (re-export from existing poll-util)
  project-lock/
    detector.ts         # detectProjectLocked(response, dom) → ProjectLockEvent | null
    store.ts            # SQLite upsert/list for LoopProjectLockEvent
    types.ts            # ProjectLockEvent, ProjectLockReason
```

## 4. Wiring

- `ws-adjacent.ts → moveToAdjacentWorkspace()`: gate via `waitForRunIdle()` BEFORE calling `moveToWorkspace`.
- `ws-move.ts → moveToWorkspace()` (existing): after post-move `fetchAndPersist` credit refresh, call `pressRun()`.
- `ws-move.ts → executeMove() / executeSwitchContext()`: on error path, run `detectProjectLocked` + `project-lock.store.persist()`; then re-enter the gate.

## 5. Selectors (provided)

| Constant | XPath / Source | Status |
|----------|----------------|--------|
| `SEND_OR_STOP_BUTTON_XPATH` | `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]` | ✅ provided |
| `STOP_ICON_XPATH` | `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]/span[7]` (presence = run active; SVG path begins `M20.75 17`) | ✅ provided |
| `SEND_BUTTON_ID` | `#chatinput-send-message-button` (preferred stable hook; XPaths are fallback) | ✅ provided |
| `LOCKED_BANNER_XPATH` | DOM banner for "project is locked" | ❌ optional — API check is sufficient fallback |

Detection rule: `isRunActive = exists(STOP_ICON_XPATH) && svg-path-d starts with "M20.75 17"`. `isRunIdle = !isRunActive`.

## 6. Tests (ship with feature)

- `loop-run-state/__tests__/run-state.test.ts` — `isStopVisible` true when STOP svg present; false when send-arrow svg present; `waitForRunIdle` resolves immediately when idle, polls until STOP disappears, rejects on timeout.
- `loop-run-state/__tests__/press-run.test.ts` — `pressRun` clicks once when idle; no-op + log when STOP visible; no retry.
- `project-lock/__tests__/detector.test.ts` — recognises HTTP 423, body `project_locked`, body `"project is locked"`, optional DOM banner; returns null otherwise.
- `project-lock/__tests__/store.test.ts` — persist + list ordering; idempotent on duplicate event within 1s.
- `ws-adjacent.integration.test.ts` — move-down with STOP visible blocks → polls → moves once STOP disappears; locked response is persisted and triggers re-wait.

## 7. Acceptance

- [ ] Move-down while a run is streaming waits and only moves after Play appears.
- [ ] A `project is locked` response writes one row to `LoopProjectLockEvent` and does not silently swallow.
- [ ] After every successful move, Play is auto-clicked when it appears within 15s.
- [ ] All four new test files pass.
- [ ] Feature flag `Loop.RunStateGate.Enabled` controls activation; defaults OFF until XPaths are populated.

---

## 5-step task plan

1. **Spec + ambiguity log** *(this turn)*: write this spec, log XPath ambiguity, no code changes.
2. **`loop-run-state` module + tests**: `selectors.ts` (placeholders behind flag), `index.ts` with `isPlayVisible/waitForPlayReady/pressPlay/pressPause`, unit tests for gate + press.
3. **`project-lock` module + tests**: detector (API + DOM), SQLite store, unit tests.
4. **Wiring + integration tests**: gate inside `moveToAdjacentWorkspace`, auto-Play inside `moveToWorkspace`, locked-error catch path; integration test.
5. **Activate flag + version bump v3.37.0**: flip `Loop.RunStateGate.Enabled = true` once user supplies real XPaths; bump manifest/constants/changelog.
