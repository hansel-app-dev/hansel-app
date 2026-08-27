import { expect, test } from '@playwright/test';

test('shows the API is healthy [AC-002, REQ-003]', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Build with a trail you can trust.' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('API healthy');
});
