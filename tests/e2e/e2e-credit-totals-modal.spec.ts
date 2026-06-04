/**
 * E2E — Credit Totals modal (Plan 20-step, Step 16 — fixtures wired in Phase B Step 52)
 *
 * Coverage (target): open modal → sort by Rem asc → drag row 3 above row 1 →
 * filter "Refill-soon" → click CSV → assert downloaded CSV contains exactly
 * the filtered + reordered rows.
 *
 * Status: the page-setup half (lovable.dev shell + chrome.* stubs +
 * `/credit-balance` network stub for Ktlo / Free / Cancelled fixtures) is
 * fully wired via `mountMacroControllerHarness` (Option A from
 * `.lovable/question-and-ambiguity/61-credit-totals-content-script-harness.md`).
 * The remaining `fixme` is the panel-mount + sort/drag/CSV flow itself, which
 * needs the harness shell DOM extended with the credit-totals trigger button
 * selectors before un-fixme-ing. See plan.md "Macro-controller content-script
 * harness (Option A)" Phase 3 for the close-out.
 *
 * Spec: spec/21-app/01-chrome-extension/credit-balance-update/18-tests-e2e.md.
 */
import { test, expect, chromium } from '@playwright/test';
import { launchExtension } from './fixtures';
import { installCreditBalanceStub } from './utils/credit-balance-stub';
import { mountMacroControllerHarness } from './utils/macro-controller-harness';
import {
    KTLO_WORKSPACE,
    FREE_WORKSPACE,
    CANCELLED_WORKSPACE,
    KTLO_CREDIT_BALANCE,
    FREE_CREDIT_BALANCE,
    CANCELLED_CREDIT_BALANCE,
} from './fixtures/credit-balance/workspaces';

test.describe('Credit Totals modal — sort → drag → filter → CSV export round-trip', () => {
    test.fixme('round-trip via macro-controller panel (flow assertions pending; harness wired)', async () => {
        const context = await launchExtension(chromium);
        try {
            // Network half — stubs /credit-balance for all three fixtures.
            await installCreditBalanceStub(context, {
                workspaces: [KTLO_WORKSPACE, FREE_WORKSPACE, CANCELLED_WORKSPACE],
                creditBalances: {
                    [KTLO_WORKSPACE.id]: KTLO_CREDIT_BALANCE,
                    [FREE_WORKSPACE.id]: FREE_CREDIT_BALANCE,
                    [CANCELLED_WORKSPACE.id]: CANCELLED_CREDIT_BALANCE,
                },
            });

            // Page half — fake lovable.dev shell + chrome.* stubs + IIFE inject.
            const { page, bundleError } = await mountMacroControllerHarness(context, {
                projectId: 'credit-totals-e2e',
            });
            expect(page.url()).toMatch(/^https:\/\/lovable\.dev\/projects\/credit-totals-e2e/);
            // Surface (not swallow) any boot-time bundle error so the next
            // harness iteration sees the real failure mode immediately.
            expect(bundleError, `macro-controller bundle threw on inject: ${bundleError?.message}`).toBeNull();

            // Pending: open Credit Totals modal, sort by Rem asc, drag row 3
            // above row 1, apply Refill-soon filter, click CSV, assert content.
            expect(true).toBe(true);
        } finally {
            await context.close();
        }
    });
});

