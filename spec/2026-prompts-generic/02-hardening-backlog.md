# Spec-hardening backlog (post-T120)

Opened 2026-06-02 (Asia/Kuala_Lumpur). The 120-task `2026-prompts-generic`
spec is complete; this is the follow-on punch-list.

- [x] H1 — Banlist linter (`scripts/lint-spec-banlist.mjs`) — enforces T24 vocabulary ban.
- [ ] H2 — Wire H1 into `npm run lint` / CI as a non-blocking advisory first, then required.
- [ ] H3 — Top-level `spec/2026-prompts-generic/README.md` mirroring the T120 read-order.
- [ ] H4 — JSON-Schema validator for `info.json` examples in `30-prompt-source-format/`.
- [ ] H5 — Mermaid render check for `*.mmd` files (`scripts/lint-spec-mermaid.mjs`).
- [ ] H6 — Generate printable PDF of the full spec into `/mnt/documents/`.
- [ ] H7 — Cross-link audit: every `T###` reference resolves to a real file.
- [ ] H8 — Acceptance-bullet inventory: extract all `- [ ]` items into one master checklist.
- [ ] H9 — Reference-snippet typecheck harness (compile snippets in isolated `tsconfig`).
- [ ] H10 — Port the spec's `PromptStore` + queue engine into a host wiring proof-of-concept.
