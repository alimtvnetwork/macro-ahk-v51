# Error Surface Catalog

Closed set. Every user-visible error maps to exactly one code.

| Code | Surface | Message template | Recovery |
|---|---|---|---|
| E-01 | Toast | "Prompt failed to load: {detail}" | Retry button |
| E-02 | Banner | "Prompt source unreachable" | Reload source |
| E-03 | Toast | "Variable {name} missing — using default" | none (info) |
| E-04 | Toast | "Paste verification failed ({strategy})" | Retry once |
| E-05 | Banner | "Editor not supported on this page" | Disable dropdown |
| E-06 | Toast | "Queue full ({capacity})" | Open queue |
| E-07 | Banner | "Submit button not found" | Re-detect / settings |
| E-08 | Toast | "Task cancelled" | none |
| E-09 | Toast | "Task held — retry exhausted" | View failure log |
| E-10 | Banner | "Plan-mode preview failed to render" | Switch to next mode |
| E-11 | Toast | "Settings reset to defaults" | none |
| E-12 | Banner | "Storage quota exceeded" | Export + prune |
| E-13 | Toast | "Import skipped {count} invalid prompts" | View errors |
| E-14 | Toast | "Cannot trigger inside password field" | none |
| E-15 | Banner | "Host override schema invalid" | View settings |
