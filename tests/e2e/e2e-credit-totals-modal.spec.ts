/**
 * E2E — Credit Totals modal (Plan 20-step, Step 16 — fixtures wired in Phase B Step 52)
 *
 * Coverage: open modal → sort by Rem asc → drag row 3 above row 1 → filter
 * "Refill-soon" → click CSV → assert downloaded CSV contains exactly the
 * filtered + reordered rows.
 *
 * Status: STILL `fixme` for the panel-render assertions because the macro
 * controller panel is content-script-injected into lovable.dev and can't be
 * reached from an extension page URL. The credit-balance network stub +
 * fixture set (Ktlo / Free / Cancelled / Inline-Pro) ARE now wired below
 * and unblock the network half of this spec.
 *
 * Spec: spec/21-app/01-chrome-extension/credit-balance-update/18-tests-e2e.md.
 */
import { test, expect, chromium } from '@playwright/test';
import { launchExtension } from './fixtures';
import { installCreditBalanceStub } from './utils/credit-balance-stub';
import {
    KTLO_WORKSPACE,
    FREE_WORKSPACE,
    CANCELLED_WORKSPACE,
    KTLO_CREDIT_BALANCE,
    FREE_CREDIT_BALANCE,
    CANCELLED_CREDIT_BALANCE,
} from './fixtures/credit-balance/workspaces';

test.describe('Credit Totals modal — sort → drag → filter → CSV export round-trip', () => {
    test.fixme('round-trip via macro-controller panel (pending content-script harness)', async () => {
        const context = await launchExtension(chromium);
        try {
            await installCreditBalanceStub(context, {
                workspaces: [KTLO_WORKSPACE, FREE_WORKSPACE, CANCELLED_WORKSPACE],
                creditBalances: {
                    [KTLO_WORKSPACE.id]: KTLO_CREDIT_BALANCE,
                    [FREE_WORKSPACE.id]: FREE_CREDIT_BALANCE,
                    [CANCELLED_WORKSPACE.id]: CANCELLED_CREDIT_BALANCE,
                },
            });
            // Pending: drive the macro-controller panel via a lovable.dev page
            // with the content script injected, then assert sort/drag/filter/CSV.
            expect(true).toBe(true);
        } finally {
            await context.close();
        }
    });
});
