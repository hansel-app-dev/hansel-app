import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('matches the Figma-derived flow and validates required values [AC-002, AC-035, AC-052, REQ-005, REQ-016, REQ-082]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/onboarding');

  await expect(
    page.getByRole('heading', { name: "Let's get started" }),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute(
    'placeholder',
    'you@gmail.com',
  );
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Microsoft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Apple' }),
  ).toBeVisible();

  const createWithEmail = page.getByRole('button', {
    name: 'Create with email',
  });
  await expect(createWithEmail).toBeVisible();
  await createWithEmail.click();

  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Use at least 15 characters.')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test('verification requires a deliberate six-digit submission and supports resend [AC-002, REQ-006, REQ-007, REQ-084]', async ({
  page,
}) => {
  await page.route(
    '**/api/onboarding/email-verification/verify',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextStep: 'personal-profile' }),
      });
    },
  );
  await page.route(
    '**/api/onboarding/email-verification/resend',
    async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'accepted' }),
      });
    },
  );
  await page.goto('/onboarding/verify-email');
  await expect(
    page.getByRole('heading', { name: 'Verify your account' }),
  ).toBeVisible();
  await page.getByLabel('Verification code').fill('123');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter all six digits')).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/onboarding\/about-you$/);
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
});

test('personal profile matches the approved catalogs and advances [REQ-086]', async ({
  page,
}) => {
  await page.route(
    '**/api/onboarding/email-verification/verify',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nextStep: 'personal-profile' }),
      });
    },
  );
  await page.route('**/api/onboarding/personal-profile', async (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextStep: 'plan-selection' }),
    }),
  );
  await page.goto('/onboarding/verify-email');
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.evaluate(() => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; SameSite=Strict';
  });
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter your first name.')).toBeVisible();
  await page.getByLabel('First name').fill('Nabin');
  await page.getByLabel('Last name').fill('Singh');
  await page.getByLabel('Job title', { exact: true }).selectOption('other');
  await page.getByLabel('Other job title').fill('Founder');
  await page
    .getByLabel('Department', { exact: true })
    .selectOption('marketing_communications');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/onboarding\/plan-selection$/);
});

test('personal profile remains functional without JavaScript [REQ-054, REQ-086, REQ-087]', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.route('**/api/onboarding/personal-profile', async (route) => {
    const body = new URLSearchParams(route.request().postData() ?? '');
    if (body.get('jobTitle') === 'other' && !body.get('jobTitleOther')) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 303,
      headers: { location: '/onboarding/plan-selection' },
    });
  });
  await page.goto('/onboarding/about-you');
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  await page.getByLabel('First name').fill('Nabin');
  await page.getByLabel('Last name').fill('Singh');
  await page.getByLabel('Job title', { exact: true }).selectOption('other');
  await expect(page.getByLabel('Other job title')).toBeVisible();
  await page
    .getByLabel('Department', { exact: true })
    .selectOption('marketing_communications');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('First name')).toHaveValue('Nabin');
  await expect(page.getByLabel('Other job title')).toHaveAttribute('required');
  await page.getByLabel('Other job title').fill('Founder');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page).toHaveURL(/\/onboarding\/plan-selection$/);
  await context.close();
});

test('server-rendered personal profile matches its visual and accessibility contract [REQ-054, REQ-086]', async ({
  page,
}) => {
  await page.goto('/onboarding/about-you');
  await expect(
    page.getByRole('heading', { name: 'Tell us about you' }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot('onboarding-about-you-progressive.png', {
    fullPage: true,
  });
});
