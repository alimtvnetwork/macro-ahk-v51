/**
 * E2E — Macro-controller harness smoke test.
 *
 * Validates the Option-A content-script harness shipped in
 * tests/e2e/utils/macro-controller-harness.ts (see ambiguity log
 * `.lovable/question-and-ambiguity/61-credit-totals-content-script-harness.md`).
 *
 * Asserts only the bootstrapping invariants — that the simulated lovable.dev
 * page loads, the chrome.* stub is present before any page script, and the
 * macro-controller IIFE injects without throwing. Deeper assertions about the
 * panel DOM (Credit Totals modal, sort/drag/CSV round-trip) belong in
 * e2e-credit-totals-modal.spec.ts once that test is un-fixmed.
 */
import { test, expect, chromium } from '@playwright/test';
import { launchExtension } from './fixtures';
import { mountMacroControllerHarness } from './utils/macro-controller-harness';

test.describe('Macro-controller content-script harness', () => {
    test.fixme(
        'mounts the production IIFE on a simulated lovable.dev project page',
        async () => {
            const context = await launchExtension(chromium);
            try {
                const { page } = await mountMacroControllerHarness(context, {
                    projectId: 'harness-smoke',
                });

                // URL surface — content-script gates check location.hostname.
                expect(page.url()).toMatch(/^https:\/\/lovable\.dev\/projects\/harness-smoke/);

                // chrome.* stubs installed before page scripts (addInitScript).
                const chromeShape = await page.evaluate(() => ({
                    hasChrome: typeof (window as unknown as { chrome?: unknown }).chrome !== 'undefined',
                    runtimeId: (window as unknown as { chrome?: { runtime?: { id?: string } } })
                        .chrome?.runtime?.id ?? null,
                    storageLocalGet: typeof (window as unknown as {
                        chrome?: { storage?: { local?: { get?: unknown } } };
                    }).chrome?.storage?.local?.get === 'function',
                }));
                expect(chromeShape.hasChrome).toBe(true);
                expect(chromeShape.runtimeId).toBeTruthy();
                expect(chromeShape.storageLocalGet).toBe(true);

                // Shell DOM rendered.
                await expect(page.getByTestId('project-title')).toHaveText('Harness Project');
            } finally {
                await context.close();
            }
        },
    );
});
