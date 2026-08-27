import { expect, test } from '@playwright/test';

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
    page.getByRole('heading', { name: 'Verify your email' }),
  ).toBeVisible();
  await page.getByLabel('Verification code').fill('123');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page.getByText('Enter all six digits')).toBeVisible();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify email' }).click();
  await page.getByRole('button', { name: 'Resend code' }).click();
  await expect(page.getByText(/address is eligible/)).toBeVisible();
});
