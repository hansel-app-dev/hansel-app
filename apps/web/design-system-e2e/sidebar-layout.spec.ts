/** @spec sites-populated-state REQ-005..REQ-007, REQ-020, REQ-021 */
import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('Site sidebar matches reference row geometry and retains disclosure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-site-activity--loaded&viewMode=story');
  const sidebar = page.locator('aside');
  const dashboard = sidebar.getByRole('link', {
    name: 'Dashboard',
    exact: true,
  });
  await expect(dashboard).toBeVisible();
  expect((await sidebar.boundingBox())?.width).toBe(300);
  expect((await dashboard.boundingBox())?.y).toBe(92);
  expect((await dashboard.boundingBox())?.height).toBe(40);
  const sites = sidebar.getByRole('link', { name: 'Sites', exact: true });
  expect((await sites.boundingBox())?.y).toBe(150);
  await expect(sites).toHaveCSS('font-size', '14px');
  const nested = sidebar.getByRole('list', { name: 'Sites' });
  await expect(nested.getByRole('link').first()).toHaveCSS('font-size', '12px');
  expect((await nested.getByRole('link').first().boundingBox())?.height).toBe(
    40,
  );
  await sidebar.getByRole('button', { name: 'Collapse sites' }).click();
  await expect(nested).toHaveCount(0);
  await sidebar.getByRole('button', { name: 'Expand sites' }).click();
  await expect(nested).toBeVisible();
  const results = await new AxeBuilder({ page }).include('aside').analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    ),
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
