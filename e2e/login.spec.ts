import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedLoginAccount } from '../apps/api/e2e-support/login.js';

test('password login reaches the dashboard and an existing session bypasses login [user-login AC-001, AC-006]', async ({
  page,
}) => {
  const account = await seedLoginAccount();
  try {
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Nabin Singh')).toBeVisible();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await account.disconnect();
  }
});

test('invalid and locked password attempts remain generic [user-login AC-002]', async ({
  page,
}) => {
  const account = await seedLoginAccount();
  try {
    await page.goto('/login');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password').fill('wrong-password');
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page.getByRole('alert')).toHaveText(
        "We couldn't log you in. Check your details and try again.",
      );
    }
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      "We couldn't log you in. Check your details and try again.",
    );
  } finally {
    await account.disconnect();
  }
});

test('password login resumes incomplete onboarding and verification [user-login AC-003]', async ({
  browser,
}) => {
  for (const state of ['incomplete', 'unverified'] as const) {
    const account = await seedLoginAccount(state);
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:5173',
    });
    try {
      const page = await context.newPage();
      await page.goto('/login');
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password').fill(account.password);
      await page.getByRole('button', { name: 'Log in' }).click();
      if (state === 'incomplete') {
        await expect(page).toHaveURL(/\/onboarding\/about-you$/);
        await expect(
          page.getByRole('heading', { name: 'Tell us about you' }),
        ).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/onboarding\/verify-email$/);
        await expect(
          page.getByRole('heading', { name: 'Verify your account' }),
        ).toBeVisible();
        await expect(account.readVerificationChallengeCount()).resolves.toBe(1);
      }
    } finally {
      await context.close();
      await account.disconnect();
    }
  }
});

test('login remains accessible, responsive, and provider actions are operable [user-login AC-004, AC-005]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: 'Log in to your account' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  for (const provider of ['google', 'microsoft', 'apple'])
    await expect(
      page.getByRole('link', {
        name: `Continue with ${provider.charAt(0).toUpperCase()}${provider.slice(1)}`,
      }),
    ).toHaveAttribute('href', `/auth/start/${provider}?intent=login`);
  await page.getByLabel('Email').focus();
  await expect(page.getByLabel('Email')).toBeFocused();
});

test('native login works with JavaScript disabled [user-login REQ-016]', async ({
  browser,
}) => {
  const account = await seedLoginAccount();
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await context.close();
    await account.disconnect();
  }
});
