import { expect, test } from '@playwright/test';

test('shows the API is healthy [AC-002, REQ-003]', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Build with a trail you can trust.' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API healthy');
});

test('preserves narrow, semantic, reduced-motion presentation [AC-003, REQ-004]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/health', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.fulfill({ json: { status: 'ok' } });
  });

  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API checking');
  await expect(page.getByRole('status').locator('span')).toHaveCSS(
    'animation-name',
    'none',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});
