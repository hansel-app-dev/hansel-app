import { expect, test } from '@playwright/test';

test('proxies API requests through the web origin [AC-005, REQ-007]', async ({
  request,
}) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: 'ok' });
});

test('shows only Hansel in the middle [AC-004, REQ-006]', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hansel');
  await expect(page.getByRole('main')).toHaveText(/^Hansel$/);
  await expect(page.getByRole('main')).toHaveCSS('place-items', 'center');
});

test('preserves the centered narrow presentation [AC-004, REQ-006]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');

  await expect(page.getByRole('main')).toBeVisible();
  const heading = page.getByRole('heading', { name: 'Hansel' });
  await expect(heading).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
