import { expect, test } from '@playwright/test';

test('dashboard-home REQ-001: sidebar and utility header stay fixed during content scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=application-shell--tall-dashboard&viewMode=story',
  );
  const content = page.getByText('Scrollable dashboard content');
  await expect(content).toBeVisible();
  const sidebar = page.locator('aside');
  const header = page.locator('main > section > header');
  const sidebarBefore = await sidebar.boundingBox();
  const headerBefore = await header.boundingBox();
  await page.mouse.move(1000, 500);
  await page.mouse.wheel(0, 600);
  await expect
    .poll(async () => (await content.boundingBox())?.y ?? 0)
    .toBeLessThan(0);
  expect(await sidebar.boundingBox()).toEqual(sidebarBefore);
  expect(await header.boundingBox()).toEqual(headerBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
