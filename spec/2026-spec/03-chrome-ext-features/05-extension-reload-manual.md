# 05 — Extension Reload (Manual)

## Why this step exists

When users hit a stuck state (blank popup, stale injected script, after a
config change), the only safe recovery is to reload the extension itself —
not the page, not the tab, the extension. Without a one-click button in the
popup, users are pushed to `chrome://extensions` (which most users do not
even know exists) and we lose them. This step pins the contract for a
visible, idempotent, fail-safe "Reload Extension" button.

## Contract

1. **Surface**: every popup MUST expose a "Reload Extension" control. Place
   it in a Status/Health section (see step `07-status-and-health-panel.md`),
   not buried in a settings page.
2. **Single primitive**: only `chrome.runtime.reload()` is used. No
   workarounds (`chrome.management.setEnabled`, `chrome.tabs.reload`, etc.)
   unless a separate step explicitly authorizes them.
3. **Confirmation**: a reload destroys the SW, drops all in-flight messages,
   and closes the popup. The user MUST be warned with a non-blocking inline
   confirm ("Reload now? Unsaved settings panels will close.") — never an
   alert dialog.
4. **Pre-reload broadcast**: before calling `chrome.runtime.reload()` the
   background MUST broadcast `EVT_BEFORE_RELOAD` to every context so:
   - the in-page panel can persist its position (step 15),
   - any open log streams flush to SQLite (step 16),
   - the popup can render a "Reloading…" spinner.
5. **Reload reason log**: a Code Red row (`Reason="ManualReload"`) is written
   to the session log table *before* the reload, with `triggerSource`
   (`popup`, `options`, `panel`, `keyboard-shortcut`, `context-menu`).
6. **No-retry**: if `chrome.runtime.reload()` throws (extremely rare; usually
   means the worker is already torn down), log Code Red and surface the
   error. **Never** retry — see `mem://constraints/no-retry-policy`.
7. **Keyboard shortcut (optional)**: if exposed, default to `Ctrl+Alt+R`
   (Cmd+Alt+R on Mac), declared in `manifest.json#commands`. Shortcut MUST
   be disabled inside editable fields (matches recorder pattern in
   `mem://features/recorder-keyboard-shortcuts`).

## Message contract

```ts
// src/shared/messages.ts
export const MSG_RELOAD_EXTENSION = "ext/reload" as const;
export const EVT_BEFORE_RELOAD    = "ext/before-reload" as const;

export interface ReloadRequest {
  kind: typeof MSG_RELOAD_EXTENSION;
  triggerSource: "popup" | "options" | "panel" | "keyboard-shortcut" | "context-menu";
}
```

## Reference handler (background)

```ts
// src/background/reload.ts
import { MSG_RELOAD_EXTENSION, EVT_BEFORE_RELOAD, type ReloadRequest } from "@shared/messages";
import { Logger } from "@shared/logger";
import { BUILD_ID } from "@shared/constants";

export function bindReloadHandler(): void {
  chrome.runtime.onMessage.addListener((request: ReloadRequest, _sender, sendResponse) => {
    if (request?.kind !== MSG_RELOAD_EXTENSION) { return false; }

    Logger.info("Reload.Requested", {
      triggerSource: request.triggerSource,
      buildId: BUILD_ID,
    });

    // Notify every context (popup, content scripts, panel) BEFORE reloading.
    void chrome.runtime.sendMessage({ kind: EVT_BEFORE_RELOAD }).catch(() => {
      /* expected — some contexts may have no listener; never retry */
    });

    // Give listeners ~150 ms to flush, then reload. Single attempt only.
    setTimeout(() => {
      try {
        chrome.runtime.reload();
      } catch (caught: unknown) {
        const err = caught as CaughtError;
        Logger.error("Reload.Failed", {
          path: "src/background/reload.ts",
          missing: "chrome.runtime.reload() success",
          reason: err?.message ?? "unknown",
          buildId: BUILD_ID,
        });
      }
    }, 150);

    sendResponse({ ok: true });
    return true; // keep channel open
  });
}
```

`bindReloadHandler()` MUST be called synchronously from `background/index.ts`
top level (see step 02).

## Reference button (popup)

```tsx
// src/popup/components/ReloadButton.tsx
import { useState } from "react";
import { MSG_RELOAD_EXTENSION } from "@shared/messages";
import { getExtensionChrome } from "../lib/extension-env";

export function ReloadButton(props: { source: "popup" | "options" | "panel" }) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "reloading">("idle");
  const ext = getExtensionChrome();

  if (!ext) {
    return <button disabled title="Preview only — chrome.runtime unavailable">Reload Extension</button>;
  }

  const doReload = () => {
    setPhase("reloading");
    void ext.runtime.sendMessage({ kind: MSG_RELOAD_EXTENSION, triggerSource: props.source });
    // The popup will be torn down by the reload; no further action needed.
  };

  if (phase === "confirm") {
    return (
      <div role="alert" className="flex gap-2 items-center">
        <span>Reload now?</span>
        <button onClick={doReload}>Yes, reload</button>
        <button onClick={() => setPhase("idle")}>Cancel</button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("confirm")}
      disabled={phase === "reloading"}
      data-testid="reload-extension"
    >
      {phase === "reloading" ? "Reloading…" : "Reload Extension"}
    </button>
  );
}
```

## Pre-reload listeners

Each context that owns ephemeral state subscribes once at startup:

```ts
// src/content/panel/panel.ts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.kind === "ext/before-reload") {
    persistPanelPosition();           // step 15
    flushSessionLogBuffer();          // step 16
  }
});
```

There is **no acknowledgement back to the SW** — the SW does not wait. The
150 ms timeout above is the deadline; anything not flushed by then is lost.

## Pitfalls

- **Calling `chrome.runtime.reload()` directly from the popup.** It works,
  but skips the broadcast → panel position and log buffers are lost. Always
  route through the background handler.
- **Using `window.location.reload()` in the popup.** This reloads only the
  popup document, not the extension; SW stays stale.
- **Retrying on failure.** Forbidden by `mem://constraints/no-retry-policy`.
  If the reload primitive itself fails, the extension is already in an
  unrecoverable state; surface the error and let the user click again.
- **Reloading inside the SW startup path** to "recover" from a boot error.
  Causes an infinite reload loop. The boot-failure banner (step 14) is the
  correct response.
- **Forgetting to ignore the shortcut in editable fields.** A user typing
  "reload" into a recorder field must not nuke their work.

## Acceptance

- [ ] Popup renders a visible "Reload Extension" control wired to
      `MSG_RELOAD_EXTENSION`.
- [ ] Clicking it shows an inline confirm before reloading.
- [ ] Background handler logs `Reload.Requested` with `triggerSource` and
      `buildId` before broadcasting `EVT_BEFORE_RELOAD`.
- [ ] In-page panel, on receipt of `EVT_BEFORE_RELOAD`, persists its
      position and flushes log buffers within 150 ms.
- [ ] On reload failure, a Code Red row is written and surfaced; no retry
      occurs.
- [ ] Keyboard shortcut (if enabled) is ignored inside `INPUT`,
      `TEXTAREA`, and `contenteditable`.

## Tests to ship with this step

- Unit: `reload-handler.test.ts` — fakes `chrome.runtime.sendMessage` and
  `chrome.runtime.reload`, asserts the broadcast precedes the reload call
  and that a failure path writes the Code Red row.
- Component: `ReloadButton.test.tsx` — asserts idle → confirm → reloading
  state transitions, asserts disabled state in preview (no `chrome`).
- Manual E2E checklist:
  1. Load unpacked, open popup, click Reload, observe popup auto-closes and
     SW restarts (visible in `chrome://extensions`).
  2. Open an in-page panel, drag it to a non-default position, click Reload,
     reopen panel — position is restored.
