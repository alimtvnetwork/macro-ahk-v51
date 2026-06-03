# Empty States

| Surface | Trigger | Copy | Primary action |
|---|---|---|---|
| Dropdown | No prompts loaded | "No prompts yet. Add one to get started." | "Create prompt" → opens editor |
| Dropdown | Filter matches none | "No prompts match \"{query}\"" | "Clear filter" |
| Queue panel | No tasks | "Queue is empty. Pick a prompt to enqueue." | "Open picker" |
| Plan-mode | No plan generated | "Plan will appear here after you run a prompt." | "Run prompt" |
| Settings → Host overrides | None configured | "No host overrides. Defaults apply everywhere." | "Add override" |
| Onboarding step 1 | First run | "Welcome — type `/` in any input to begin." | "Show tour" |

All empty states use the same `<EmptyState illustration label cta>` component to guarantee visual + a11y consistency.
