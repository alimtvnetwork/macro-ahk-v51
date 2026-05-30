# Issue 129 — Prompts cache UX, Plan Task button, GitSync detection, Remix navigation

**Status:** Planning (no implementation yet)
**Reported:** 2026-05-30
**Severity:** P1 — direct user-visible UX defects on hot paths.

## Symptoms

### S-1. Plan/Next buttons missing after prompt click (no cache hit)
When the user clicks a prompt in the prompts dropdown, the action row
containing **Plan Task** and **Task Next** does not render instantly. The
user briefly sees no buttons (or a flicker / spinner). Expectation: the
buttons are part of the cached prompt detail and MUST appear synchronously
from the in-memory snapshot — zero loading state, zero round-trip.

### S-2. Plan Task button is a no-op
Clicking **Plan Task** does nothing. **Task Next** is wired correctly.
Likely cause candidates (to verify, not assume):
- Handler bound to wrong element / wrong `data-action` key.
- Composer text not staged because Plan handler skips the
  "wrap with `Plan it:` prefix" path used by Task Next.
- Async path swallows the error silently (audit will tell us which).

### S-3. GitSync connection detection is missing / unreliable
Right-click → "Open GitHub Repo" only knows about connections that
`/projects` returned. There is no first-class probe of the GitSync
job-progress endpoint. We must:
- Detect "is this project already connected to a GitHub repo?" via the
  GitSync **progress** endpoint, NOT by re-POSTing `/sync` (which would
  create a repo when none exists).
- Only POST `/sync` when the project is confirmed NOT connected.

### S-4. Remix flow does not navigate to the new project
`POST /remix` (or equivalent) successfully creates the new project, but
the active tab is not redirected to the new project URL. The user is left
on the old project. Macro-controller is therefore not re-injected on the
new project either.

---

## API contracts (from the user's curl capture)

### Create / trigger sync
```
POST https://api.lovable.dev/workspaces/{wsId}/connections/gitsync/{connId}/projects/{projectId}/sync
→ { "job_id": "gitsync-sync-project-{projectId}" }
```
- **Creates the GitHub repo only if the project is not already connected.**
- Idempotent on the project side: a re-POST when already connected will
  still return a `job_id` whose progress immediately resolves with the
  existing `result.repo_url`. We must NEVER rely on this — always probe
  progress FIRST.

### Read progress
```
GET https://api.lovable.dev/workspaces/{wsId}/connections/gitsync/projects/{projectId}/jobs/{jobId}/progress
```
Two response shapes:
```jsonc
// In flight
{ "type":"sync", "status":"running", "step":"pushing_code",
  "title":"Syncing '<name>' with GitHub", "description":"Pushing code to GitHub..." }
// Completed
{ "type":"sync", "status":"completed",
  "title":"'<name>' synced",
  "description":"https://github.com/<owner>/<repo>",
  "result": { "repo_url":"https://github.com/<owner>/<repo>",
              "repo_name":"<repo>", "owner":"<owner>" } }
```

### Connection-detection rule (canonical)
```
isConnected(project) :=
  exists a completed progress response with result.repo_url set
  for some prior job_id of this project.
```
Implementation: probe `progress` for the well-known job id
`gitsync-sync-project-{projectId}`. If `status===completed && result?.repo_url` → connected.
If 404 / no such job / running → poll up to N seconds (sequential, single
deadline — honors `mem://constraints/no-retry-policy`). If still no
`repo_url` after the deadline → treat as not connected.

---

## Ten-step fix plan

> Each `next` command executes ONE step. Sequential, fail-fast, no retries.

### Step 1 — Spec authoring & plan.md sync (this file)
Land this spec + a mirror entry in `.lovable/plan.md`. No code yet.

### Step 2 — Prompts cache snapshot guarantees Plan/Task-Next buttons
- Audit `panel-controls.ts` → `renderPromptsDropdown` and the prompt-click
  handler. Verify the HtmlCopy snapshot already includes the action row.
- If snapshot is missing the row, extend the cache shape so the row is
  baked in at save-time, not appended on click.
- Render path must be 100% synchronous from `IndexedDB.HtmlCopy` — no
  `await`, no network, no `requestAnimationFrame` gate before the buttons
  appear. Loading state is permitted ONLY on cold-cache first-ever load.
- Unit test: prompt click renders the action row in the same tick.

### Step 3 — Diagnose & fix Plan Task button
- Add temporary diagnostic logging in the dropdown click delegator to
  capture: matched `data-action`, target element, handler resolution.
- Compare Plan-handler vs Task-Next-handler code paths line by line.
- Fix the divergence (likely the composer-fill path or the missing
  `data-action="plan"` attr in the cached HTML).
- Unit test: `plan` action stages the composer with the documented
  prefix; `task-next` continues to work unchanged.

### Step 4 — GitSync progress-probe module
- New module `standalone-scripts/macro-controller/src/gitsync/progress-probe.ts`.
- Exports:
  - `probeProgress(wsId, projectId, jobId, deadlineMs)` → resolved
    progress JSON or `null`.
  - `resolveConnection(wsId, connId, projectId)` →
    `{ connected: true, repoUrl, repoName, owner } | { connected: false }`.
- Uses single `getBearerToken()` call. Sequential polling within a single
  deadline; no exponential backoff; cancels on first terminal state.
- Negative results cached (per `mem://features/workspace-github-repo-open`).

### Step 5 — Hook progress-probe into the right-click "Open GitHub Repo" path
- Replace any direct `/projects` lookup with `resolveConnection()`.
- Menu item label states:
  - "Open GitHub Repo" when connected (opens `repoUrl`).
  - "Connect to GitHub" when not connected (triggers Step 6 flow).
  - "Syncing…" while a probe is running (disabled).

### Step 6 — Connect flow: POST /sync only when not connected
- New helper `ensureGithubRepo(wsId, connId, projectId)`:
  1. `resolveConnection()` — if connected, return repoUrl.
  2. Else `POST .../sync` → get `job_id`.
  3. Poll `progress` until `status==='completed'` or deadline.
  4. Return `result.repo_url`, persist to SQLite cache.
- No silent retry on failure — surface error via `Logger.error()` per
  Code-Red Logging core rule (exact path, missing item, reason).

### Step 7 — Remix flow: capture new project URL
- Locate the remix trigger in macro-controller (likely `ws-context-menu.ts`
  or a panel button). Audit the network call to confirm response shape
  (`{ project_id, project_url, … }` — to be captured in the spec when
  observed).
- After successful remix, persist the new project_id to the per-tab
  workspace-mapping cache so the auto-injector picks it up.

### Step 8 — Remix flow: navigate active tab to the new project
- `window.location.assign(newProjectUrl)` in the MAIN-world responder, OR
  `chrome.tabs.update(tabId, { url: newProjectUrl })` from background —
  whichever the platform-adapter pattern requires.
- New-tab guard (`isNewTabOrBlankUrl()`) must not be bypassed: the
  destination URL is always a real lovable project URL.

### Step 9 — Remix flow: auto-reinject macro-controller on the new project
- After navigation, the existing auto-injector + project-matcher should
  fire on the new URL. Verify the per-tab cache invalidation triggers
  re-injection (don't rely on stale "already-injected" sentinel for the
  old project_id).
- If a gap exists, emit `RECHECK_INJECTION` on `webNavigation.onCommitted`
  when the URL transitions between two lovable project IDs in the same tab.

### Step 10 — Version bump + changelog + readme + tests green
- MINOR bump per `mem://prompts/08-bump-version` (all unified-version sites).
- Changelog grouped (Added / Changed / Fixed / Removed).
- `bunx vitest run` green for the new tests in steps 2/3/4/6/9.
- `bunx tsc --noEmit` green.
- `node scripts/check-version-sync.mjs` exits 0.

---

## Out of scope
- Changing the wording on Plan Task / Task Next buttons.
- Changing remix server behavior (we only fix the client navigation).
- New retry/backoff loops (banned).

## Memory ties
- `mem://constraints/no-retry-policy` — sequential fail-fast.
- `mem://features/workspace-github-repo-open` — negative result caching.
- `mem://features/macro-controller/open-tabs-workspace-mapping` — per-tab
  workspace cache that Step 7/9 piggyback on.
- `mem://features/prompt-management` — dual-cache (JsonCopy/HtmlCopy)
  that Step 2 makes synchronous.
- Core rule "New-tab guard" — Step 8 must not regress it.
