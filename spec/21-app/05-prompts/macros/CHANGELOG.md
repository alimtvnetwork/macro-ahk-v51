# Prompt Macros — CHANGELOG

All notable changes to the Prompt Macros subsystem.
Dates in **Asia/Kuala_Lumpur**. Format: [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] — 2026-06-02

### Added

- **Prompts subsystem v2**: Macros (chained prompts) — `prompt`, `next-loop`, `audit`, `fix-from-audit`, `final-audit`, `loop-if`, `set-var`, `notify` step kinds.
- **Variables / Templating**: `{{ VarName }}` mustache-lite syntax with 5-tier resolution (step → run → macro → user → default).
- **Macro-Prompts folder**: `standalone-scripts/macro-prompts/<slug>/` with aggregator emitting `src/generated/macro-prompts.ts`.
- **JSON Save / Export / Import / Replace**: atomic round-trip, checksummed, schema-versioned (`MACRO_SCHEMA_VERSION=1`).
- **UI**: Prompts button, Prompts panel, MacroBuilder, RunBanner, VariableInputDialog, keyboard shortcuts (Ctrl+Alt+P / ; / .).
- **Engine**: state machine, score extraction, audit folder writer, variable interpolator, message contract, single-run-per-tab concurrency, three-tier watchdog (per-step 60s, total 30m, loop 25), event stream with persist-before-broadcast.
- **Guards**: forbidden-writes UUID allow-list, loop safety cap, no-Supabase enforcement (3 layers), new-tab guard, variable-injection safety (6 defenses).
- **Observability**: `RiseupAsiaMacroExt.Logger`, `MacroMetrics` SQLite table, mandatory failure-log schema, diagnostics ZIP integration (30-day window, 5MB cap, sensitive redaction), three-layer UI error surface.
- **Testing**: unit (8 modules), component (7 components), e2e (8 Playwright scenarios), per-module coverage targets.

### Security

- All variable values masked when name matches `/token|secret|password|apiKey|bearer/i`.
- Path-traversal blocked in `WriteTo` (UUID-bounded allow-list `spec/audit/<runId>/`).
- No retry / no exponential backoff on webhook delivery (single-attempt).
