import { expect, test } from '@playwright/test';
test('site-signage-schedule REQ-007: reference columns and stepped total', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-signage-schedule--reference-grid&viewMode=story',
  );
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  expect(await table.boundingBox()).toMatchObject({
    x: 332,
    y: 263,
    width: 1148,
  });
  expect(
    (await page.getByRole('columnheader', { name: 'Quantity' }).boundingBox())
      ?.x,
  ).toBe(522);
  await expect(table.locator('tfoot td').nth(2)).toHaveCSS(
    'border-left-width',
    '1px',
  );
  await page.screenshot({ path: '/tmp/signage-grid.png' });
});
