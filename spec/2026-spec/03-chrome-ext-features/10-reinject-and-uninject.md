# 10 — Re-inject and Uninject

## Why this step exists

Step 08 defines how to inject and step 09 prevents duplicate injection. The
remaining failure mode is stale or broken injected state: an old build marker is
present, a relay listener is duplicated, a floating panel is stuck, or a runtime
module failed after partial setup. The fix is not to overwrite the sentinel and
inject again. The fix is an explicit, observable teardown path, followed by a
fresh injection only when teardown succeeds.

This step defines the two recovery actions exposed by the popup Status panel:
`Uninject` and `Re-inject`.

## Contract

1. **Single background entry points.** UI sends messages to the service worker;
   popup/options/content code must not perform teardown or force injection
   directly.
2. **Uninject is teardown-first.** Remove listeners, timers, observers, relay
   handlers, UI nodes, runtime registries, and CSS nodes before clearing the
   sentinel attributes from step 09.
3. **Re-inject is two-phase.** `Re-inject` always runs `uninjectFromTab()` first;
   only a successful uninject may call `injectIntoTab({ force: true })`.
4. **Stale build uses re-inject.** `StaleInjectionBuild` from step 09 is resolved
   only by the explicit re-inject flow. Normal injection must not overwrite a
   stale sentinel.
5. **No retry.** Each phase is attempted once. If uninject fails, do not inject.
   If force-inject fails, do not retry or reload the extension.
6. **New-tab guard first.** `isNewTabOrBlankUrl()` runs before teardown probes or
   `chrome.scripting.executeScript()` calls.
7. **Typed result only.** Both flows return `UninjectResult` /
   `ReinjectResult`; UI renders the result and must not infer success from
   missing exceptions.
8. **Code Red on failure.** Every failed phase logs exact `path`, `missing`,
   `Reason`, `ReasonDetail`, tab id, URL, build id, and teardown step.

## Message contract

```ts
// src/shared/messages.ts
export const MSG_UNINJECT_TAB = "injection/uninject-tab" as const;
export const MSG_REINJECT_TAB = "injection/reinject-tab" as const;
export const EVT_BEFORE_UNINJECT = "injection/before-uninject" as const;
export const EVT_AFTER_UNINJECT = "injection/after-uninject" as const;

export interface UninjectTabMessage {
  kind: typeof MSG_UNINJECT_TAB;
  tabId: number;
  url: string;
  triggerSource: "popup" | "status-panel" | "keyboard-shortcut";
}

export interface ReinjectTabMessage {
  kind: typeof MSG_REINJECT_TAB;
  tabId: number;
  url: string;
  triggerSource: "popup" | "status-panel" | "keyboard-shortcut";
}
```

Keyboard shortcuts are optional. If implemented, they must be ignored inside
editable fields, matching the recorder shortcut rule.

## Result contracts

```ts
// src/background/injection/teardown-types.ts
export type TeardownStep =
  | "guarded"
  | "probe-sentinel"
  | "broadcast-before-uninject"
  | "runtime-teardown"
  | "relay-teardown"
  | "panel-teardown"
  | "style-teardown"
  | "sentinel-clear"
  | "broadcast-after-uninject"
  | "done";

export interface UninjectSuccess {
  ok: true;
  tabId: number;
  step: "done";
  removedScriptIds: string[];
  buildId: string;
}

export interface UninjectFailure {
  ok: false;
  tabId: number;
  step: TeardownStep;
  reason: string;
  reasonDetail: string;
  buildId: string;
}

export type UninjectResult = UninjectSuccess | UninjectFailure;

export interface ReinjectResult {
  ok: boolean;
  tabId: number;
  uninject: UninjectResult;
  inject?: InjectionResult;
  reason?: string;
  reasonDetail?: string;
}
```

## Teardown ownership

Each injected runtime module must register cleanup with one page-level teardown
registry. The uninject command calls that registry exactly once.

```ts
// src/content/runtime-teardown.iife.ts
(() => {
  const runtime = RiseupAsiaMacroExt.Runtime;

  runtime.registerTeardown("keyboard-shortcuts", () => {
    document.removeEventListener("keydown", runtime.handlers.keyboardShortcut);
  });

  runtime.registerTeardown("status-heartbeat", () => {
    window.clearInterval(runtime.timers.heartbeatIntervalId);
  });

  runtime.registerTeardown("dom-observers", () => {
    runtime.observers.panelObserver?.disconnect();
  });
})();
```

Rules:

- Every `setInterval`, `setTimeout`, `MutationObserver`, and event listener
  created by injected code must register teardown at creation time.
- Teardown callbacks run in reverse registration order so dependent modules
  shut down before shared services.
- A teardown callback must be idempotent; calling it twice should be a no-op.
- A teardown callback must not create new timers, observers, or listeners.

## Uninject implementation

```ts
// src/background/injection/uninjector.ts
import { BUILD_ID } from "@shared/constants";
import { Logger } from "@shared/logger";
import { isNewTabOrBlankUrl } from "@shared/url-utils";
import { clearInjectionSentinel, probeInjectionSentinel } from "./sentinel";
import type { UninjectResult, TeardownStep } from "./teardown-types";

export async function uninjectFromTab(request: UninjectTabMessage): Promise<UninjectResult> {
  let step: TeardownStep = "guarded";

  try {
    if (isNewTabOrBlankUrl(request.url)) {
      return {
        ok: false,
        tabId: request.tabId,
        step,
        reason: "NewTabOrBlankUrl",
        reasonDetail: `Uninject skipped for url=${request.url}`,
        buildId: BUILD_ID,
      };
    }

    step = "probe-sentinel";
    const sentinel = await probeInjectionSentinel(request.tabId);

    if (!sentinel.injected) {
      return {
        ok: true,
        tabId: request.tabId,
        step: "done",
        removedScriptIds: [],
        buildId: BUILD_ID,
      };
    }

    step = "broadcast-before-uninject";
    await chrome.tabs.sendMessage(request.tabId, { kind: EVT_BEFORE_UNINJECT, buildId: BUILD_ID });

    step = "runtime-teardown";
    await executeTeardown(request.tabId, "runtime");

    step = "relay-teardown";
    await executeTeardown(request.tabId, "relay");

    step = "panel-teardown";
    await executeTeardown(request.tabId, "panel");

    step = "style-teardown";
    await executeTeardown(request.tabId, "styles");

    step = "sentinel-clear";
    await clearInjectionSentinel(request.tabId);

    step = "broadcast-after-uninject";
    await chrome.tabs.sendMessage(request.tabId, { kind: EVT_AFTER_UNINJECT, buildId: BUILD_ID });

    return {
      ok: true,
      tabId: request.tabId,
      step: "done",
      removedScriptIds: sentinel.scriptIds,
      buildId: BUILD_ID,
    };
  } catch (caught) {
    const err = caught as CaughtError;
    Logger.error("Injection.UninjectFailed", {
      path: "src/background/injection/uninjector.ts",
      missing: "complete injected runtime teardown",
      Reason: "UninjectStepFailed",
      ReasonDetail: err?.message ?? `Uninject failed at step=${step}`,
      tabId: request.tabId,
      url: request.url,
      triggerSource: request.triggerSource,
      step,
      buildId: BUILD_ID,
      SelectorAttempts: [],
      VariableContext: [],
    });

    return {
      ok: false,
      tabId: request.tabId,
      step,
      reason: "UninjectStepFailed",
      reasonDetail: err?.message ?? `Uninject failed at step=${step}`,
      buildId: BUILD_ID,
    };
  }
}
```

## Clearing sentinel attributes

Clearing the sentinel is a dedicated helper and must happen after teardown
succeeds.

```ts
// src/background/injection/sentinel.ts
export async function clearInjectionSentinel(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [ATTR_INJECTED, ATTR_BUILD_ID, ATTR_INSTALLED_AT, ATTR_SCRIPT_IDS],
    func: (
      injectedAttr: string,
      buildAttr: string,
      installedAtAttr: string,
      scriptIdsAttr: string,
    ): void => {
      const root = document.documentElement;
      root.removeAttribute(injectedAttr);
      root.removeAttribute(buildAttr);
      root.removeAttribute(installedAtAttr);
      root.removeAttribute(scriptIdsAttr);
    },
  });
}
```

If clearing fails, the uninject result is failed. Do not hide the failure by
claiming the page is clean.

## Re-inject implementation

```ts
// src/background/injection/reinjector.ts
import { injectIntoTab } from "./injector";
import { uninjectFromTab } from "./uninjector";
import type { ReinjectResult } from "./teardown-types";

export async function reinjectIntoTab(request: ReinjectTabMessage): Promise<ReinjectResult> {
  const uninject = await uninjectFromTab({
    kind: MSG_UNINJECT_TAB,
    tabId: request.tabId,
    url: request.url,
    triggerSource: request.triggerSource,
  });

  if (!uninject.ok) {
    return {
      ok: false,
      tabId: request.tabId,
      uninject,
      reason: "UninjectBeforeReinjectFailed",
      reasonDetail: uninject.reasonDetail,
    };
  }

  const inject = await injectIntoTab({
    tabId: request.tabId,
    url: request.url,
    triggerSource: request.triggerSource,
    force: true,
  });

  return {
    ok: inject.ok,
    tabId: request.tabId,
    uninject,
    inject,
    reason: inject.ok ? undefined : "ForceInjectFailed",
    reasonDetail: inject.ok ? undefined : inject.reasonDetail,
  };
}
```

Rules:

- `force: true` bypasses the same-build no-op check, but it does not bypass the
  new-tab guard or Code Red logging.
- `force: true` is allowed only inside this re-inject flow and manual diagnostic
  tooling. Auto-injection must not use force.
- If uninject succeeds and force-inject fails, the final status is
  `not-injected` with the force-inject error visible in the Status panel.

## UI behavior

The Status & Health panel from step 07 exposes:

- `Inject` when sentinel is missing.
- `Re-inject` when sentinel is present or stale.
- `Uninject` when sentinel is present.

Button behavior:

- Disable the clicked button while the message is in flight.
- Show the typed `reasonDetail` on failure.
- Never show a blank panel while a tab is transitioning.
- Never call `window.location.reload()` as part of re-inject/uninject.

## What uninject removes

The cleanup pass must remove or deactivate:

- floating panels and their shadow roots,
- extension-owned style tags and CSS sentinels,
- keyboard shortcut listeners,
- message relay listeners and correlation maps,
- mutation observers,
- intervals, timeouts, animation frames, idle callbacks,
- runtime registries and dynamic module handles,
- page heartbeat timers,
- step 09 sentinel attributes.

Injected JavaScript code cannot be unloaded from the JS engine after execution;
therefore uninject means "all extension-owned behavior is disabled and all DOM
markers are removed", not that browser memory rewinds to a pre-injection state.

## Pitfalls

- **Clearing sentinel first** — this makes Status say `not-injected` while old
  listeners still run. Clear sentinel last.
- **Re-injecting after failed uninject** — this creates exactly the duplicate
  listener/panel problem this step prevents. Stop after failed uninject.
- **Using page reload as cleanup** — `chrome.tabs.reload()` changes user state
  and is not an uninject implementation.
- **Letting teardown errors disappear** — failures must surface in Status and
  Code Red logs with the failed teardown step.
- **Force-inject from auto-injector** — auto paths must be conservative. Force
  belongs to explicit user recovery only.
- **Leaving relay listeners installed** — duplicated relays cause duplicate
  database/token requests and confusing correlation ids.

## Acceptance

- [ ] `Uninject` removes runtime behavior before clearing sentinel attributes.
- [ ] `Re-inject` runs uninject first and calls force inject only after success.
- [ ] Failed uninject stops the flow; no injection is attempted.
- [ ] Stale build is resolved only by explicit re-inject, not normal injection.
- [ ] New-tab/blank URLs return guarded results before teardown probes.
- [ ] Every failed teardown logs Code Red with path, missing item, `Reason`,
      `ReasonDetail`, tab id, URL, build id, step, `SelectorAttempts`, and
      `VariableContext`.
- [ ] Status panel buttons reflect the current sentinel state and never blank
      during transition.

## Tests to ship with this step

- Unit: `uninjector.test.ts` — asserts teardown order and sentinel clearing last.
- Unit: `reinjector.test.ts` — asserts force inject runs only after successful
  uninject.
- Unit: `reinjector-failure.test.ts` — asserts failed uninject prevents inject.
- Unit: `uninject-new-tab-guard.test.ts` — asserts guarded URLs do not call
  sentinel probe or scripting teardown.
- Component: `StatusPanel.inject-actions.test.tsx` — asserts Inject/Re-inject/
  Uninject button states and failure rendering.
- Manual Chrome E2E: inject → uninject → verify sentinel removed and no panel,
  relay, heartbeat, shortcut, or observer remains; then re-inject and verify a
  single clean runtime is present.