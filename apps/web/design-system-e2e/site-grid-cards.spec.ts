import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sites-populated-state REQ-009..014: grid card normal and hover reference geometry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-populated-page--figma-grid&viewMode=story',
  );
  const grid = page.getByRole('list', { name: 'Sites grid' });
  const card = grid.getByRole('link').nth(1);
  await expect(card).toBeVisible();
  const normal = await card.boundingBox();
  expect(normal).toMatchObject({ x: 623, y: 136, width: 275, height: 274 });
  expect(
    await card.locator(':scope > span:first-child').boundingBox(),
  ).toMatchObject({ height: 174 });
  await expect(card).toHaveCSS('box-shadow', 'none');
  const overflow = card.locator('..').locator('[data-site-overflow-reserve]');
  await expect(overflow).toHaveCSS('opacity', '0');
  await card.hover();
  await expect(overflow).toHaveCSS('opacity', '1');
  await expect(card).not.toHaveCSS('box-shadow', 'none');
  expect(await card.boundingBox()).toEqual(normal);
  await page.screenshot({ path: '/tmp/site-grid-cards.png' });
  await page.mouse.move(1200, 600);
  await card.focus();
  await expect(overflow).toHaveCSS('opacity', '1');
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Sites grid"]')
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('sites-populated-state REQ-021: narrow cards fit without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-populated-page--figma-grid&viewMode=story',
  );
  await expect(page.getByRole('list', { name: 'Sites grid' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
