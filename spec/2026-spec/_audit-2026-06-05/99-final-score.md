# Final Score — Blind-AI Audit of `spec/2026-spec/`

**Date:** 2026-06-05
**Method:** see `00-method.md`. Heuristic scoring across 229 markdown files.

## Composite

| Metric | Value |
| --- | --- |
| Files audited | 229 |
| Repo composite score | **77.07 / 100** |
| Files ≥ 90 (pass bar) | 73 |
| Files < 60 (red) | 0 |
| Pass-rate | 31.9% |

## Per-folder

| Folder | Files | Mean | <60 | ≥90 |
| --- | --- | --- | --- | --- |
| `01-prompt-spec` | 131 | 77.4 | 0 | 53 |
| `02-ci-cd-spec-for-chrome-extensions` | 20 | 79.0 | 0 | 9 |
| `03-chrome-ext-features` | 35 | **81.5** | 0 | 7 |
| `03-db-and-sqlite-integration-with-chrome-extension` | 42 | 71.1 | 0 | 3 |
| top-level `README.md` | 1 | 90.0 | 0 | 1 |

## Top-5 remaining blockers (repo-wide)

1. **Pass-bar gap** — 156 files sit in 60–89; need targeted determinism + cross-ref uplift to clear 90.
2. **DB+SQLite folder mean (71.1)** — lowest folder mean; needs more numeric defaults + MUST rules.
3. **Determinism breadth** — auto-footer adds 4 MUST rules per file; bespoke per-topic MUSTs still needed.
4. **Pitfalls specificity** — auto-footer pitfalls are generic; replace with per-topic counter-examples.
5. **Score-90 cliff** — only 73 files ≥ 90; majority sit at 75–85 because pitfalls/determinism are generic.

## Fix-to-100 path (rough ETA, 1 dev)

| Wave | Steps (from `30-remediation-backlog.md`) | ETA |
| --- | --- | --- |
| P0 pitfalls + determinism | 1–5 | 1.5 days |
| P1 dangling + thin + schema | 6–15 | 2 days |
| P2 cross-folder consistency | 16–25 | 1 day |
| P3 machine-check + CI gates | 26–30 | 0.5 day |
| **Total** | **30** | **~5 days** |

Expected composite score after all 30: **≥ 92** (extrapolated; rerun `scripts/audit/audit-scan.py` to confirm).

## Self-audit note

`01-prompt-spec` carries the most files; even a +15pt uplift there moves the composite materially. Delay determinism and failure-handling pitfalls were improved; acceptance, dangling-link, numeric-constant, and scorer tests are green.
