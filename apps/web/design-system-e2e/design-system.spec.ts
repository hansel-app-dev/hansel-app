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
      maxDiffPixelRatio: 0.001,
    });
  });
}

test('onboarding account creation is accessible and visually stable [AC-053, REQ-082, REQ-083]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-account-creation--default&viewMode=story',
  );
  const heading = page.getByRole('heading', { name: "Let's get started" });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('font-family', /Figtree/);
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'placeholder',
    'you@gmail.com',
  );
  await expect(
    page.getByRole('button', { name: 'Create with email' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toHaveCSS('column-gap', '8px');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-account-creation.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('email verification is accessible and visually stable [AC-002, REQ-006, REQ-084]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-verify-email--waiting&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Verify your email' }),
  ).toBeVisible();
  await expect(page.getByLabel('Verification code')).toHaveAttribute(
    'autocomplete',
    'one-time-code',
  );
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-verify-email.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});
