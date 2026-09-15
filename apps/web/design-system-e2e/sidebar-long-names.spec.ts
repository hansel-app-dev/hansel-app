import { expect, test } from '@playwright/test';

test('long Site names truncate without sidebar overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-site-activity--long-names&viewMode=story',
  );
  const sidebar = page.locator('aside');
  const sites = sidebar.getByRole('list', { name: 'Sites' });
  await expect(sites).toBeVisible();
  expect(
    await sidebar.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    ),
  ).toBe(0);
  for (const link of await sites.getByRole('link').all()) {
    const bounds = await link.boundingBox();
    const container = await sidebar.boundingBox();
    expect(bounds).not.toBeNull();
    expect(container).not.toBeNull();
    if (bounds && container)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        container.x + container.width,
      );
  }
});
