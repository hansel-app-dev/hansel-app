import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { seedLoginAccount } from '../apps/api/e2e-support/login.js';

test('password recovery exhausts old authority, revokes sessions, and replaces the password [password-recovery REQ-004, REQ-007, REQ-011, REQ-016, REQ-022; AC-001..AC-007]', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const account = await seedLoginAccount();
  const newPassword = 'A newly recovered Hansel password!8';
  try {
    await page.goto('/login');
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto('/forgot-password');
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel('Email').fill(account.email);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await expect(page).toHaveURL(/\/reset-password\?requested=1$/);
    await expect(page.getByRole('status')).toContainText(
      'If an eligible Hansel account exists',
    );

    await account.issuePasswordRecoveryCode('123456');
    const submitReset = async (code: string) => {
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Reset code').fill(code);
      await page.getByLabel('New password', { exact: true }).fill(newPassword);
      await page.getByLabel('Confirm new password').fill(newPassword);
      await page.getByRole('button', { name: 'Reset password' }).click();
    };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitReset('000000');
      await expect(page.getByRole('alert')).toContainText(
        "We couldn't reset your password",
      );
    }
    await submitReset('123456');
    await expect(page.getByRole('alert')).toContainText(
      "We couldn't reset your password",
    );

    await page.getByRole('link', { name: 'Request a new code' }).click();
    await page.getByLabel('Email').fill(account.email);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await account.issuePasswordRecoveryCode('654321');
    await submitReset('654321');
    await expect(page).toHaveURL(/\/login\?password_reset=success$/);
    await expect(page.getByRole('status')).toContainText(
      'Your password has been reset.',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toContainText(
      "We couldn't log you in",
    );

    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Password').fill(newPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  } finally {
    await account.disconnect();
  }
});

test('unknown recovery remains generic without JavaScript [password-recovery REQ-004, REQ-019, REQ-022; AC-001, AC-005]', async ({
  browser,
  baseURL,
}) => {
  const account = await seedLoginAccount();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL ?? 'http://127.0.0.1:5173'}/forgot-password`);
    await page.getByLabel('Email').fill(`unknown-${randomUUID()}@example.com`);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await expect(page).toHaveURL(/\/reset-password\?requested=1$/);
    await expect(page.getByRole('status')).toContainText(
      'If an eligible Hansel account exists',
    );
    await expect(page.getByLabel('Reset code')).toBeVisible();

    await page.goto(`${baseURL ?? 'http://127.0.0.1:5173'}/forgot-password`);
    await page.getByLabel('Email').fill(account.email);
    await page.getByRole('button', { name: 'Send reset code' }).click();
    await account.issuePasswordRecoveryCode('246810');
    const newPassword = 'Native recovery password!9Z';
    await page.getByLabel('Email').fill(account.email);
    await page.getByLabel('Reset code').fill('246810');
    await page.getByLabel('New password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm new password').fill(newPassword);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/login\?password_reset=success$/);
    await expect(page.getByRole('status')).toContainText(
      'Your password has been reset.',
    );
  } finally {
    await context.close();
    await account.disconnect();
  }
});
