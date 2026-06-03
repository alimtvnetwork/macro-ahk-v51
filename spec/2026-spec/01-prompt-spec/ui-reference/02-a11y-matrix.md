# Accessibility Matrix

| UI element | Role | Label source | Keyboardable | Notes |
|---|---|---|---|---|
| Dropdown root | `listbox` | `aria-label="Prompt picker"` | ✅ | `aria-activedescendant` reflects selection |
| Dropdown item | `option` | Prompt title | via listbox | `aria-selected` true on highlight |
| Search input | `combobox` | "Search prompts" | ✅ | `aria-expanded` mirrors open state |
| Queue panel | `region` | "Prompt queue" | ✅ | `aria-live="polite"` for status updates |
| Toast | `status` | toast text | n/a | `aria-live="polite"`, 5 s dismiss |
| Error banner | `alert` | error message | ✅ | `aria-live="assertive"` |
| Cancel button | `button` | "Cancel current task" | ✅ | Disabled when no running task |

Color contrast: text ≥ 4.5:1, large text ≥ 3:1. Focus ring: 2 px solid `hsl(var(--ring))`.
