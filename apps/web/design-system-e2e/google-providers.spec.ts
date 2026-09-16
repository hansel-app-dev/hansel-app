import { expect, test } from '@playwright/test';

test('Google provider controls preserve login and consent form semantics [google-local-auth REQ-001, REQ-003]', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=authentication-external-providers--google-login&viewMode=story',
  );
  await expect(
    page.getByRole('link', { name: 'Continue with Google' }),
  ).toHaveAttribute('href', '/auth/start/google?intent=login');
  await expect(
    page.getByRole('button', { name: 'Continue with Microsoft' }),
  ).toBeDisabled();
  await page.getByRole('link', { name: 'Continue with Google' }).focus();
  await expect(
    page.getByRole('link', { name: 'Continue with Google' }),
  ).toBeFocused();
  await page.goto(
    '/iframe.html?id=authentication-external-providers--google-onboarding&viewMode=story',
  );
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeEnabled();
  await expect(page.locator('form')).toHaveAttribute('method', 'post');
  await expect(page.locator('input[name="acceptsTerms"]')).toHaveValue('true');
  await page.goto(
    '/iframe.html?id=authentication-external-providers--unavailable&viewMode=story',
  );
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeDisabled();
});
