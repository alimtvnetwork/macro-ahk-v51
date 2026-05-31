import { test, expect, chromium, type Page } from '@playwright/test';
import { launchExtension, getExtensionId, openOptions } from './fixtures';

/**
 * E2E-23 — Multi-Tab State Synchronization
 *
 * Verifies that the Prompt Manager and Step Group Library synchronize state
 * across multiple Options tabs in real-time.
 */
test.describe('E2E-23 — Multi-Tab State Synchronization', () => {
  test('prompts and step groups sync across tabs', async () => {
    // 1. Setup Extension Context
    const context = await launchExtension(chromium);
    const extensionId = await getExtensionId(context);

    // 2. Open two Options tabs
    const tab1 = await openOptions(context, extensionId);
    const tab2 = await openOptions(context, extensionId);

    // --- Verify Prompt Synchronization ---
    
    // 3. Navigate both tabs to Prompts
    console.log('Navigating to Prompts...');
    await navigateToSection(tab1, 'Prompts');
    await navigateToSection(tab2, 'Prompts');

    const testPromptName = `Sync Test Prompt ${Date.now()}`;
    const testPromptText = 'Test prompt text for sync verification.';

    // 4. Add prompt in Tab 1
    console.log('Adding prompt in Tab 1...');
    // Click the "Add" (plus) button in the header
    await tab1.getByRole('button', { name: /plus|add/i }).last().click();
    await tab1.getByPlaceholder(/prompt name/i).fill(testPromptName);
    
    // Interact with Monaco editor (fallback to filling the hidden textarea)
    const textarea = tab1.locator('.monaco-editor textarea');
    await textarea.focus();
    await textarea.fill(testPromptText);
    
    // Click the "Add" button in the form
    await tab1.getByRole('button', { name: /^Add$/ }).click();

    // 5. Verify it appeared in Tab 2
    console.log('Verifying prompt appearance in Tab 2...');
    await expect(tab2.getByText(testPromptName)).toBeVisible({ timeout: 20000 });
    await expect(tab2.getByText(testPromptText)).toBeVisible();

    // --- Verify Step Group Synchronization ---

    // 6. Navigate both tabs to Step Groups
    console.log('Navigating to Step Groups...');
    await navigateToSection(tab1, 'Step Groups');
    await navigateToSection(tab2, 'Step Groups');

    const testGroupName = `Sync Test Group ${Date.now()}`;

    // 7. Add step group in Tab 1
    console.log('Adding step group in Tab 1...');
    const firstGroupBtn = tab1.getByRole('button', { name: /create your first group/i });
    if (await firstGroupBtn.isVisible()) {
      await firstGroupBtn.click();
    } else {
      await tab1.getByRole('button', { name: /new group|plus/i }).first().click();
    }
    
    await tab1.locator('input[placeholder="Group name..."]').fill(testGroupName);
    await tab1.getByRole('button', { name: /create/i }).click();

    // 8. Verify it appeared in Tab 2
    console.log('Verifying step group appearance in Tab 2...');
    await expect(tab2.getByText(testGroupName)).toBeVisible({ timeout: 20000 });

    await context.close();
  });
});

async function navigateToSection(page: Page, sectionName: string) {
  // Try finding by button name, then fallback to finding by data-testid or custom logic if needed
  const navButton = page.getByRole('button', { name: sectionName, exact: true });
  await expect(navButton).toBeVisible();
  await navButton.click();
}
