/**
 * Issue 129 Step 3 — Plan Task button must work after snapshot restore.
 *
 * Root cause: `_rebindDropdownListeners` did not rebuild the Plan Task
 * submenus. Snapshot restore writes `innerHTML`, which strips the per-
 * element `onclick` handlers attached by `renderPlanTaskSubmenu`, so the
 * inline Plan Task row and the in-Tasks-group copy became dead HTML.
 *
 * Source-level invariants enforced here.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'ui', 'prompt-dropdown.ts');

let source = '';
beforeAll(() => { source = readFileSync(SRC, 'utf-8'); });

describe('Plan Task — listener rebind after snapshot restore (Issue 129 Step 3)', () => {
  it('_rebindDropdownListeners calls _rebindPlanTaskSubmenus', () => {
    expect(source).toMatch(/_rebindPlanTaskSubmenus\(promptsDropdown,\s*ctx\)/);
  });

  it('_rebindPlanTaskSubmenus targets the inline row container', () => {
    expect(source).toMatch(/querySelector\('\[data-inline-plan-row\]'\)/);
  });

  it('_rebindPlanTaskSubmenus re-renders into the inline row via renderPlanTaskSubmenu', () => {
    const fnIdx = source.indexOf('function _rebindPlanTaskSubmenus');
    expect(fnIdx).toBeGreaterThan(0);
    const fnBody = source.slice(fnIdx, fnIdx + 2000);
    expect(fnBody).toMatch(/renderPlanTaskSubmenu\(inlineRow,\s*ctx\)/);
  });

  it('_rebindPlanTaskSubmenus also rebuilds the Plan Task copy inside [data-tasks-group]', () => {
    const fnIdx = source.indexOf('function _rebindPlanTaskSubmenus');
    const fnBody = source.slice(fnIdx, fnIdx + 2000);
    expect(fnBody).toContain("querySelector('[data-tasks-group]')");
    expect(fnBody).toContain("querySelectorAll('[data-plan-task-sub]')");
    expect(fnBody).toMatch(/renderPlanTaskSubmenu\(tasksGroup,\s*ctx\)/);
  });
});
