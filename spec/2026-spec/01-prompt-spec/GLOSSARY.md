# Glossary — 2026 Prompt Spec

**Updated:** 2026-06-03

| Term | Definition |
|---|---|
| **Prompt** | A reusable text body with a stable `id`, `slug`, `title`, optional `category`, and variable placeholders (`${Var}`). |
| **Category** | A flat grouping label attached to a Prompt; UI may filter on it. No nesting. |
| **PromptStore** | The interface defined in `02-data-model/03-store-interface.md` for CRUD on prompts. |
| **Loader** | Module that materializes Prompts from source (folder/ZIP/bundle) into the in-memory store. See `04-loader-contract/`. |
| **Host page** | The third-party web page (e.g. an AI chat UI) where Prompts are injected. |
| **Editor adapter** | Strategy that knows how to read/write a specific editor surface (`textarea`, `contenteditable`, rich editor). See `07-editor-adapters/`. |
| **Paste strategy** | One of `replace`, `append`, `prepend`, `insert-at-cursor`. See `06-injection-contract/02-paste-strategies.md`. |
| **Trigger** | The user gesture that opens the Prompt dropdown (default: typing `/` at line start). See `05-ui-contract/01-trigger.md`. |
| **Next loop** | Orchestrator that drives sequential queue execution by clicking the host Submit button between Prompts. |
| **Queue task** | A single scheduled execution of a Prompt: `{id, promptId, vars, status, retries}`. |
| **Delay engine** | Component that decides wait time between tasks (default + jitter + pause). |
| **Plan mode** | Authoring mode where the user previews a generated plan before execution. |
| **Failure log** | The mandatory diagnostic record (`Reason`, `ReasonDetail`, `SelectorAttempts[]`, `VariableContext[]`). |
| **`<NAMESPACE>`** | Placeholder for the host extension namespace (this spec is host-agnostic). |
| **Blind AI** | Hypothetical implementer with no prior project knowledge — the spec must be self-sufficient for them. |

<!-- audit: determinism+pitfalls footer -->

## Determinism Notes

- This spec MUST be implemented exactly as written; any divergence MUST raise a spec issue first.
- Numeric defaults (timeouts, retries, sizes) MUST be sourced from `reference/05-runtime-defaults.md` (e.g. `DELAY_MS = 5000 ms`, `MAX_RETRIES = 3`).
- All boolean toggles MUST have an explicit default of `false` unless the runtime-defaults table specifies otherwise.
- Implementations MUST treat undocumented states as a hard error and SHALL log via the namespace logger.

## Pitfalls

- **Anti-pattern:** silently swallowing errors with empty `catch {}` — every failure MUST go through `Logger.error()` with `Reason` + `ReasonDetail`.
- **Edge case:** new-tab / blank navigations (`about:blank`, `chrome://newtab/`) — gate every entry point with `isNewTabOrBlankUrl()`.
- **Counter-example:** hardcoding a timezone string (e.g. `Asia/Kuala_Lumpur`) — always render in the user's local timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **Gotcha:** assuming Chrome `storage.local` is synchronous — it is async and MUST be awaited; never read it during top-level module evaluation.
