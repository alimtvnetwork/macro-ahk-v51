/**
 * E2E harness — Credit Totals modal full user journey.
 *
 * Drives the real `showCreditTotalsModal()` against a seeded
 * `loopCreditState.perWorkspace` snapshot and walks through every
 * user-visible interaction:
 *   1. Open the modal     → dialog mounts with all rows.
 *   2. Toggle filters     → row count adjusts (Low + Free).
 *   3. Sort by "Used"     → numeric desc/asc cycle.
 *   4. Drag-drop reorder  → only when no sort active.
 *   5. CSV export         → Blob URL flow fires.
 *   6. ESC close          → dialog removed from DOM.
 *
 * No Chrome / Puppeteer required — uses JSDOM (root vitest.config.ts).
 * Anonymized workspace IDs (`ws-00N`) per Group D convention.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  showCreditTotalsModal,
  removeCreditTotalsModal,
} from '../../../src/ui/credit-totals-modal';
import { loopCreditState } from '../../../src/shared-state';
import type { WorkspaceCredit } from '../../../src/types';

function ws(p: Partial<WorkspaceCredit>): WorkspaceCredit {
  return {
    id: 'w', name: 'w', fullName: 'w',
    dailyFree: 0, dailyUsed: 0, dailyLimit: 5,
    rolloverUsed: 0, rolloverLimit: 0,
    freeGranted: 0, freeRemaining: 0,
    used: 0, limit: 0, topupLimit: 0,
    totalCredits: 0, available: 0, rollover: 0, billingAvailable: 0,
    hasFree: false, totalCreditsUsed: 0,
    subscriptionStatus: 'active', subscriptionStatusChangedAt: '',
    plan: 'pro_3', role: 'owner', tier: 'PRO',
    raw: {}, rawApi: {},
    numProjects: 0, gitSyncEnabled: false,
    nextRefillAt: '', billingPeriodEndAt: '', createdAt: '',
    membershipRole: 'owner', planType: 'monthly',
    ...p,
  };
}

const SNAPSHOT: ReadonlyArray<WorkspaceCredit> = [
  ws({ id: 'ws-001', fullName: 'ws-001 Acme',     plan: 'pro_3', totalCreditsUsed: 200, available: 800, totalCredits: 1000, numProjects: 4 }),
  ws({ id: 'ws-002', fullName: 'ws-002 Beta',     plan: 'pro_0', totalCreditsUsed: 40,  available: 60,  totalCredits: 100,  numProjects: 2, hasFree: true }),
  ws({ id: 'ws-003', fullName: 'ws-003 Gamma',    plan: 'pro_3', totalCreditsUsed: 495, available: 5,   totalCredits: 500,  numProjects: 9 }),
  ws({ id: 'ws-004', fullName: 'ws-004 Delta',    plan: 'pro_0', totalCreditsUsed: 100, available: 0,   totalCredits: 100,  numProjects: 0 }),
  ws({ id: 'ws-005', fullName: 'ws-005 Epsilon',  plan: 'pro_3', totalCreditsUsed: 720, available: 280, totalCredits: 1000, numProjects: 6 }),
];

function dialog(): HTMLElement | null {
  return document.getElementById('marco-credit-totals-modal');
}
function visibleRowCount(): number {
  return dialog()?.querySelectorAll('[data-credit-totals-row]').length || 0;
}
function rowNames(): string[] {
  const rows = dialog()?.querySelectorAll<HTMLElement>('[data-credit-totals-row]') || [];
  return Array.from(rows).map((r) => (r.querySelector<HTMLElement>('[data-cell="name"]')?.textContent || '').trim());
}

beforeAll(() => {
  loopCreditState.perWorkspace = SNAPSHOT.slice();
  loopCreditState.lastCheckedAt = Date.parse('2026-05-25T00:00:00Z');
  // jsdom lacks URL.createObjectURL — stub at module level once.
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:e2e') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
});

afterAll(() => {
  removeCreditTotalsModal();
});

describe('Credit Totals E2E — full user journey', () => {
  it('Step 1 — opening the modal mounts dialog with all 5 workspaces', () => {
    showCreditTotalsModal();
    expect(dialog()).not.toBeNull();
    expect(dialog()!.getAttribute('aria-label')).toBe('Credit Totals');
    expect(visibleRowCount()).toBe(5);
  });

  it('Step 2 — toggling Low + Free filters narrows visible rows', () => {
    const d = dialog()!;
    d.querySelector<HTMLElement>('[data-chip="low"]')!.click();
    // Low (0<rem<100): ws-002(60), ws-003(5)
    expect(rowNames().sort()).toEqual(['ws-002 Beta', 'ws-003 Gamma']);

    d.querySelector<HTMLElement>('[data-chip="free"]')!.click();
    // Low OR Free: ws-002 (both), ws-003 (low)
    expect(rowNames().sort()).toEqual(['ws-002 Beta', 'ws-003 Gamma']);

    // Clear chips → back to 5
    d.querySelector<HTMLElement>('[data-chip="low"]')!.click();
    d.querySelector<HTMLElement>('[data-chip="free"]')!.click();
    expect(visibleRowCount()).toBe(5);
  });

  it('Step 3 — sorting Used cycles desc → asc → none', () => {
    const usedHeader = dialog()!.querySelector<HTMLElement>('[data-sort-key="used"]')!;
    usedHeader.click(); // desc: 720, 495, 200, 100, 40
    expect(rowNames()).toEqual([
      'ws-005 Epsilon', 'ws-003 Gamma', 'ws-001 Acme', 'ws-004 Delta', 'ws-002 Beta',
    ]);
    usedHeader.click(); // asc
    expect(rowNames()).toEqual([
      'ws-002 Beta', 'ws-004 Delta', 'ws-001 Acme', 'ws-003 Gamma', 'ws-005 Epsilon',
    ]);
    usedHeader.click(); // none → manual order
    expect(rowNames()).toEqual([
      'ws-001 Acme', 'ws-002 Beta', 'ws-003 Gamma', 'ws-004 Delta', 'ws-005 Epsilon',
    ]);
  });

  it('Step 4 — drag-drop reorders rows in manual mode', () => {
    const rows = dialog()!.querySelectorAll<HTMLElement>('[data-credit-totals-row]');
    const from = rows[0]; // ws-001
    const to = rows[3];   // ws-004
    const dt = {
      effectAllowed: '', dropEffect: '', _data: '',
      setData(_t: string, v: string) { this._data = v; },
      getData(_t: string) { return this._data; },
    };
    from.dispatchEvent(Object.assign(new Event('dragstart', { bubbles: true }), { dataTransfer: dt }));
    to.dispatchEvent(Object.assign(new Event('drop', { bubbles: true }), { dataTransfer: dt, preventDefault: () => {} }));
    expect(rowNames()).toEqual([
      'ws-002 Beta', 'ws-003 Gamma', 'ws-004 Delta', 'ws-001 Acme', 'ws-005 Epsilon',
    ]);
  });

  it('Step 5 — CSV export fires the Blob download path', () => {
    const createMock = URL.createObjectURL as unknown as ReturnType<typeof vi.fn>;
    const before = createMock.mock.calls.length;
    dialog()!.querySelector<HTMLElement>('[data-credit-totals-csv]')!.click();
    expect(createMock.mock.calls.length).toBe(before + 1);
  });

  it('Step 6 — ESC removes the dialog cleanly', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog()).toBeNull();
  });
});
