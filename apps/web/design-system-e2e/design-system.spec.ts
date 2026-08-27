import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function analyzeAccessibility(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await new AxeBuilder({ page }).analyze();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes('Axe is already running') ||
        attempt === 4
      )
        throw error;
      await page.waitForTimeout(100);
    }
  }
  throw new Error('Accessibility analysis did not complete.');
}

const stories = [
  ['button-states', 'design-system-button--states', 'button', 'Primary action'],
  ['text-field-states', 'design-system-textfield--states', 'textbox', 'Email'],
  [
    'select-field-states',
    'design-system-selectfield--states',
    'combobox',
    'Job title',
  ],
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

    const accessibility = await analyzeAccessibility(page);
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

  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-account-creation.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('personal profile is accessible and visually stable [REQ-086]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-about-you--default&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  await expect(page.getByLabel('Job title')).toHaveValue('');
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-about-you.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

test('plan card is accessible and visually stable [onboarding-plan-selection REQ-015]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=design-system-plancard--normal&viewMode=story',
  );
  await expect(page.getByRole('button', { name: 'Choose Plus' })).toBeVisible();
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('plan-card-normal.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

for (const state of ['selected', 'disabled', 'free', 'enterprise']) {
  test(`plan card ${state} state is accessible and visually stable [onboarding-plan-selection REQ-015, REQ-017]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=design-system-plancard--${state}&viewMode=story`,
    );
    await expect(page.getByRole('article')).toBeVisible();
    const accessibility = await analyzeAccessibility(page);
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(`plan-card-${state}.png`, {
      animations: 'disabled',
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    });
  });
}

test('plan selection is accessible and visually stable [onboarding-plan-selection REQ-001, REQ-015]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-plan-selection--annual&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Welcome Nabin, choose your plan' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Annual' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-plan-selection.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page).toHaveScreenshot('onboarding-plan-selection-narrow.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});

for (const state of [
  'monthly',
  'selected',
  'free-selected',
  'enterprise-selected',
  'submitting-disabled',
  'load-failure',
]) {
  test(`plan selection ${state} state is accessible and visually stable [onboarding-plan-selection REQ-015, REQ-017]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=onboarding-plan-selection--${state}&viewMode=story`,
    );
    await expect(page.getByRole('main')).toBeVisible();
    const accessibility = await analyzeAccessibility(page);
    expect(accessibility.violations).toEqual([]);
    await expect(page).toHaveScreenshot(
      `onboarding-plan-selection-${state}.png`,
      {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixelRatio: 0.001,
      },
    );
  });
}

test('organization profile matches Figma and remains accessible [onboarding-organization-profile REQ-001, REQ-014]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-organization-profile--normal&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Now your organization' }),
  ).toBeVisible();
  expect((await analyzeAccessibility(page)).violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-organization-profile.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page).toHaveScreenshot(
    'onboarding-organization-profile-narrow.png',
    { animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001 },
  );
});

for (const state of [
  'dependent-options',
  'validation-error',
  'load-failure',
  'submitting',
]) {
  test(`organization profile ${state} is accessible and visually stable [onboarding-organization-profile REQ-014]`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=onboarding-organization-profile--${state}&viewMode=story`,
    );
    await expect(page.getByRole('main')).toBeVisible();
    expect((await analyzeAccessibility(page)).violations).toEqual([]);
    await expect(page).toHaveScreenshot(
      `onboarding-organization-profile-${state}.png`,
      { animations: 'disabled', fullPage: true, maxDiffPixelRatio: 0.001 },
    );
  });
}

test('email verification is accessible and visually stable [AC-002, REQ-006, REQ-084]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=onboarding-verify-email--waiting&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Verify your account' }),
  ).toBeVisible();
  await expect(page.getByLabel('Verification code')).toHaveAttribute(
    'autocomplete',
    'one-time-code',
  );
  const accessibility = await analyzeAccessibility(page);
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-verify-email.png', {
    animations: 'disabled',
    fullPage: true,
    maxDiffPixelRatio: 0.001,
  });
});
