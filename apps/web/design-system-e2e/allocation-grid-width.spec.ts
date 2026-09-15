import { expect, test } from '@playwright/test';

test('site-allocation-plans-add REQ-026: cards use available width and reflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-site-allocation-plans--many-plans&viewMode=story',
  );
  const grid = page.getByRole('list', { name: 'Allocation Plans' });
  const cards = grid.getByRole('listitem');
  await expect(cards).toHaveCount(6);
  const first = await cards.nth(0).boundingBox();
  const third = await cards.nth(2).boundingBox();
  expect(third?.y).toBe(first?.y);
  expect(first?.width).toBe(276);
  await page.setViewportSize({ width: 320, height: 982 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  expect((await cards.nth(1).boundingBox())?.y).toBeGreaterThan(
    (await cards.nth(0).boundingBox())?.y ?? 0,
  );
});
