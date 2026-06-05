# Final Score — Blind-AI Audit of `spec/2026-spec/`

**Date:** 2026-06-05
**Method:** see `00-method.md`. Heuristic scoring across 229 markdown files.

## Composite

| Metric | Value |
| --- | --- |
| Files audited | 229 |
| Repo composite score | **80.73 / 100** |
| Files ≥ 90 (pass bar) | 107 |
| Files < 60 (red) | 0 |
| Pass-rate | 46.7% |

## Per-folder

| Folder | Files | Mean | <60 | ≥90 |
| --- | --- | --- | --- | --- |
| `01-prompt-spec` | 131 | 77.4 | 0 | 53 |
| `02-ci-cd-spec-for-chrome-extensions` | 20 | 79.0 | 0 | 9 |
| `03-chrome-ext-features` | 35 | 81.5 | 0 | 7 |
| `03-db-and-sqlite-integration-with-chrome-extension` | 42 | **91.1** | 0 | 37 |
| top-level `README.md` | 1 | 90.0 | 0 | 1 |

## Top-5 remaining blockers (repo-wide)

1. **Pass-bar gap** — 122 files still in 60–89; need targeted determinism + cross-ref uplift to clear 90.
2. **`01-prompt-spec` long tail** — 78 files below 90; biggest absolute headroom for composite uplift.
3. **`02-ci-cd-spec` mean (79.0)** — needs per-topic MUST/pitfall pass on the remaining 11 files.
4. **`03-chrome-ext-features` mean (81.5)** — only 7/35 at ≥90; pitfalls remain generic.
5. **Pitfalls specificity** — DB folder now has per-topic pitfalls; other folders still use the generic 4-rule footer.

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
