import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const stories = [
  ['button-states', 'design-system-button--states', 'button', 'Primary action'],
  ['text-field-states', 'design-system-textfield--states', 'textbox', 'Email'],
] as const;

for (const [snapshotName, storyId, focusRole, focusName] of stories) {
  test(`${snapshotName} is accessible and visually stable [AC-005, REQ-008, REQ-009]`, async ({
    page,
  }) => {
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await expect(page.locator('#storybook-root')).toBeVisible();
    await page.locator('[data-focus-start]').focus();
    await page.keyboard.press('Tab');
    const focusedControl = page.getByRole(focusRole, {
      name: focusName,
      exact: true,
    });
    await expect(focusedControl).toBeFocused();
    await expect(focusedControl).toHaveCSS('outline-style', 'solid');

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
}
