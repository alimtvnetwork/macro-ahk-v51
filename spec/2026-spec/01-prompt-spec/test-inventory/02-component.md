# Component Test Inventory

React Testing Library + Vitest. Files under `src/**/__tests__/*.test.tsx`.

| ID | Component | Covers |
|---|---|---|
| CT-ui-001 | `<PromptDropdown>` | Opens on `/`, closes on `Esc` |
| CT-ui-002 | `<PromptDropdown>` | Arrow keys move selection, `Enter` inserts |
| CT-ui-003 | `<PromptDropdown>` | Search filter narrows list |
| CT-ui-004 | `<PromptItem>` | Renders title, category pill, keyboard hint |
| CT-ui-005 | `<QueuePanel>` | Shows pending/running/done counts |
| CT-ui-006 | `<QueuePanel>` | Pause/Resume button toggles state |
| CT-ui-007 | `<Toast>` | Auto-dismiss after 5 s; manual close |
| CT-ui-008 | `<ErrorBanner>` | Maps E-01..E-15 to copy |
| CT-ui-009 | `<EmptyState>` | All 6 empty-state variants render |
