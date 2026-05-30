# Ambiguity 124 — Loop Run-State XPaths — RESOLVED

**Spec:** `spec/22-app-issues/124-loop-play-pause-gate-and-project-locked-handling.md`
**Status:** ✅ Resolved 2026-05-30. User clarified that Lovable's composer uses a single toggling submit button, not separate Play/Pause controls.

## Resolution

| Constant | Value |
|----------|-------|
| `SEND_BUTTON_ID` | `#chatinput-send-message-button` |
| `SEND_OR_STOP_BUTTON_XPATH` | `/html/body/div[2]/main/div/div[2]/div/div/div/div[1]/div/div[2]/form/div[2]/div/button[3]` |
| `STOP_ICON_XPATH` | `…/button[3]/span[7]` — SVG path begins `M20.75 17` (rounded square) |
| Send/Run icon (idle) | inside same `button[3]`, SVG path begins `M11 19V7.415` (up-arrow) |
| `LOCKED_BANNER_XPATH` | Not provided — API/body detection is sufficient fallback |

## Detection rule

- `isRunActive  = exists(STOP_ICON_XPATH)` (square SVG present)
- `isRunIdle    = !isRunActive`
- `pressRun()`  = click `SEND_OR_STOP_BUTTON_XPATH` only when `isRunIdle`

All Issue 124 tasks (2-5) are now unblocked.
