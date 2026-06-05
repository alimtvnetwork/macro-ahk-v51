# 13 — Error Routing and Errors Panel

## Why this step exists

Steps 11 and 12 make errors structured and persistent. This step makes them
visible and actionable. If errors only sit in SQLite or DevTools, users still
experience a blank popup, a stuck injected panel, or a failed macro with no
clear next action. The extension needs one routing path from logger write →
unresolved count update → UI badge → Errors panel → diagnostics export.

## Contract

1. **SQLite is source of truth.** Error rows are read from the same log store
   written by the namespace logger. Do not maintain a separate error database.
2. **Unresolved count is computed in background.** Popup, options, and panel UI
   request counts from the background; they do not scan storage independently.
3. **Broadcast on change.** Every new error row, resolved error, cleared error,
   or imported diagnostic update broadcasts `ERROR_COUNT_CHANGED` to active
   extension contexts.
4. **Status panel links to Errors panel.** The step 07 Errors row opens this
   panel and shows the last-24h count.
5. **Errors panel is never blank.** Loading, no-error, error-loading, and
   preview/no-chrome states all render explicit UI.
6. **No polling as primary sync.** UI listens for broadcasts first. Slow polling
   is only an eventual-consistency fallback for disconnected contexts.
7. **Casing normalization is mandatory.** The panel, badges, and exports must
   normalize PascalCase SQLite rows and camelCase frontend rows.
8. **No retry loops.** Failed fetches show a typed failure and wait for the next
   natural refresh or user action. No recursive retry or exponential backoff.

## Message contract

```ts
// src/shared/messages.ts
export const MSG_GET_ERROR_SUMMARY = "errors/get-summary" as const;
export const MSG_GET_ERROR_ROWS = "errors/get-rows" as const;
export const MSG_RESOLVE_ERROR = "errors/resolve" as const;
export const MSG_CLEAR_RESOLVED_ERRORS = "errors/clear-resolved" as const;
export const ERROR_COUNT_CHANGED = "errors/count-changed" as const;

export interface ErrorCountChangedMessage {
  kind: typeof ERROR_COUNT_CHANGED;
  unresolvedCount: number;
  last24hCount: number;
  buildId: string;
  occurredAtIso: string;
}
```

Rules:

- Broadcast payloads contain counts only, not full error details.
- Detail rows are fetched on demand by the Errors panel.
- A context that cannot receive broadcasts must still reach eventual consistency
  through slow polling.

## Error row contract

```ts
// src/shared/errors/types.ts
export interface ErrorPanelRow {
  id: string;
  timestampIso: string;
  namespace: string;
  message: string;
  path: string;
  missing: string;
  Reason: string;
  ReasonDetail: string;
  sourceContext: "background" | "popup" | "options" | "content-isolated" | "page-main";
  tabId: number | null;
  url: string | null;
  stage: string | null;
  triggerSource: string | null;
  resolved: boolean;
  repeatCount: number;
  SelectorAttempts: SelectorAttemptLog[];
  VariableContext: VariableContextLog[];
}

export interface ErrorSummary {
  unresolvedCount: number;
  last24hCount: number;
  newestErrorIso: string | null;
  byReason: Array<{ Reason: string; count: number }>;
  byNamespace: Array<{ namespace: string; count: number }>;
}
```

Rules:

- Every row shown in the panel must include Code Red fields from step 11.
- If a legacy row lacks a field, render `null` plus a reason badge such as
  `LegacyLogMissingReasonDetail`; never crash or render a blank line.
- `repeatCount` defaults to `1` when absent.

## Background routing handler

```ts
// src/background/errors/error-routing-handler.ts
import { BUILD_ID } from "@shared/constants";
import { ERROR_COUNT_CHANGED, MSG_GET_ERROR_ROWS, MSG_GET_ERROR_SUMMARY } from "@shared/messages";
import { normalizeLogRow } from "@shared/logging/normalize-log-row";

export function bindErrorRoutingHandler(): void {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.kind === MSG_GET_ERROR_SUMMARY) {
      void getErrorSummary().then(sendResponse);
      return true;
    }

    if (request?.kind === MSG_GET_ERROR_ROWS) {
      void getErrorRows(request).then(sendResponse);
      return true;
    }

    return false;
  });
}

export async function broadcastErrorCountChanged(): Promise<void> {
  const summary = await getErrorSummary();
  const message = {
    kind: ERROR_COUNT_CHANGED,
    unresolvedCount: summary.unresolvedCount,
    last24hCount: summary.last24hCount,
    buildId: BUILD_ID,
    occurredAtIso: new Date().toISOString(),
  };

  await chrome.runtime.sendMessage(message).catch(() => {
    // Some contexts may be closed. Do not retry; tabs broadcast handles pages.
  });

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }
    void chrome.tabs.sendMessage(tab.id, message).catch(() => {
      // Expected for tabs without the extension relay. No retry.
    });
  }
}
```

Rules:

- `bindErrorRoutingHandler()` is registered synchronously during background
  startup.
- `broadcastErrorCountChanged()` is called immediately after a persisted error
  insert, resolve, or clear operation.
- Failed broadcasts are not Code Red by themselves; closed contexts are normal.
- Failed summary computation is Code Red because the UI cannot trust counts.

## Summary computation

```ts
// src/background/errors/error-store.ts
export async function getErrorSummary(): Promise<ErrorSummary> {
  const since = Date.now() - 86_400_000;
  const rows = await logStore.getErrorRows({ since, includeResolved: false });
  const normalized = rows.map(normalizeLogRow);

  return {
    unresolvedCount: normalized.filter((row) => !row.resolved).length,
    last24hCount: normalized.length,
    newestErrorIso: normalized[0]?.timestampIso ?? null,
    byReason: countBy(normalized, "Reason"),
    byNamespace: countBy(normalized, "namespace"),
  };
}
```

Rules:

- Use the database timestamp for 24h filtering, not the UI clock.
- Normalize casing before counting.
- Exclude resolved rows from unresolved counts.
- Include resolved rows only when the panel filter requests them.

## UI panel contract

The Errors panel is reachable from:

- Status & Health panel Errors row from step 07,
- popup footer/detail route,
- options Activity Log link,
- floating panel badge when injected runtime is present.

Required sections:

1. **Summary header** — unresolved count, last-24h count, newest error relative
   time, and build id.
2. **Filters** — severity/error level, namespace, reason, source context,
   resolved/unresolved.
3. **Error list** — rows grouped by newest first, showing namespace, Reason,
   path, missing item, stage, source context, and repeat count.
4. **Details drawer** — full `ReasonDetail`, selector attempts, variable
   context, URL, tab id, trigger source, and timestamp.
5. **Actions** — copy error JSON, mark resolved, clear resolved, export
   diagnostics.

## Reference component

```tsx
// src/popup/errors/ErrorsPanel.tsx
import { useErrorRows } from "./useErrorRows";
import { useErrorSummary } from "./useErrorSummary";

export function ErrorsPanel() {
  const summary = useErrorSummary();
  const rows = useErrorRows();

  if (summary.state === "preview") {
    return <section role="status">Preview mode — error store unavailable.</section>;
  }

  if (summary.state === "loading") {
    return <section role="status">Loading errors…</section>;
  }

  if (summary.state === "failed") {
    return <section role="alert">{summary.reasonDetail}</section>;
  }

  if (rows.items.length === 0) {
    return <section role="status">No unresolved errors.</section>;
  }

  return (
    <section aria-label="Errors">
      <header>
        <strong>{summary.data.unresolvedCount}</strong>
        <span>unresolved</span>
      </header>
      {rows.items.map((row) => (
        <article key={row.id} data-reason={row.Reason}>
          <h3>{row.namespace}</h3>
          <p>{row.Reason}</p>
          <code>{row.path}</code>
          <button type="button" onClick={() => rows.openDetails(row.id)}>Details</button>
        </article>
      ))}
    </section>
  );
}
```

Rules:

- The panel uses semantic sections/articles and keyboard-focusable row actions.
- Text must fit inside the popup width; long paths wrap or truncate with a
  tooltip, never overflow horizontally.
- The panel must not require DevTools to understand the error.

## Broadcast hook

```ts
// src/popup/errors/useErrorSummary.ts
export function useErrorSummary(): ErrorSummaryState {
  useEffect(() => {
    const onMessage = (message: ErrorCountChangedMessage): void => {
      if (message?.kind !== ERROR_COUNT_CHANGED) {
        return;
      }
      setSummary((current) => mergeCounts(current, message));
    };

    chrome.runtime.onMessage.addListener(onMessage);

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void refreshSummary();
      }
    }, 30_000);

    const teardown = (): void => {
      chrome.runtime.onMessage.removeListener(onMessage);
      window.clearInterval(intervalId);
    };

    window.addEventListener("pagehide", teardown, { once: true });

    return teardown;
  }, []);
}
```

Rules:

- Broadcast updates are immediate.
- Slow polling floor is 30 seconds and must pause while `document.hidden`.
- `pagehide` teardown is mandatory.
- Poll failure renders a typed warning but does not spam Code Red repeatedly.

## Resolving and clearing errors

Resolving an error means the user or system marks it no longer active. It does
not delete the original log row.

Rules:

- `MSG_RESOLVE_ERROR` sets `resolved=true`, `resolvedAtIso`, and
  `resolvedBy="user" | "system"`.
- `MSG_CLEAR_RESOLVED_ERRORS` may delete or archive only resolved rows.
- Unresolved Code Red rows are never deleted by a blanket clear action.
- Every resolve/clear operation broadcasts `ERROR_COUNT_CHANGED` after the
  database write completes.

## Diagnostics export

The Errors panel export action uses the existing diagnostics ZIP format and
must include:

- summary counts,
- unresolved rows,
- resolved rows when filter includes them,
- injection events,
- per-script final status,
- build id and extension version,
- normalized casing for both raw SQLite and UI-rendered rows.

The export must preserve Code Red fields and diagnostic arrays so a support
person can diagnose the issue without a screenshot.

## Pitfalls

- **Counting in the popup from stale rows** — the background owns counts and
  broadcasts changes.
- **Polling every second** — broadcasts are primary; slow polling is fallback.
- **Deleting unresolved errors** — clearing resolved rows must not hide active
  failures.
- **Rendering raw SQLite rows directly** — PascalCase/camelCase mismatch causes
  blank activity lines. Normalize first.
- **Treating closed-tab broadcast failures as Code Red** — closed contexts are
  normal. Log only summary/write failures.
- **Showing counts with no detail path** — every badge/count must link to a row
  list or detail panel.

## Acceptance

- [ ] New error inserts trigger `ERROR_COUNT_CHANGED` with unresolved and 24h
      counts.
- [ ] Status panel Errors row opens the Errors panel and shows last-24h count.
- [ ] Errors panel renders loading, empty, failed, preview, list, and details
      states without blank UI.
- [ ] Rows display namespace, Reason, ReasonDetail, path, missing item, stage,
      source context, selector attempts, and variable context.
- [ ] Resolve and clear-resolved actions update SQLite first, then broadcast
      updated counts.
- [ ] UI hooks teardown message listeners and polling timers on `pagehide`.
- [ ] Diagnostics export includes normalized logs and Code Red diagnostic arrays.

## Tests to ship with this step

- Unit: `error-summary.test.ts` — asserts counts exclude resolved rows and use
  last-24h filtering.
- Unit: `error-broadcast.test.ts` — asserts insert/resolve/clear operations
  broadcast `ERROR_COUNT_CHANGED` after DB write.
- Hook: `useErrorSummary.test.ts` — asserts broadcast update, 30s fallback poll,
  hidden pause, and `pagehide` teardown.
- Component: `ErrorsPanel.test.tsx` — asserts loading, empty, failed, preview,
  list, and details states render.
- Export: `diagnostics-export-errors.test.ts` — asserts exported rows include
  Code Red fields, selector attempts, variable context, and normalized casing.