import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('site-signage-schedule REQ-007: reference columns and stepped total', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-signage-schedule--reference-grid&viewMode=story',
  );
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  // signage-schedule-remove-status REQ-001,002,005
  await expect(page.getByRole('columnheader', { name: 'Status' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('columnheader')).toHaveText([
    '',
    'Sign code',
    'Quantity',
    'Location',
    'Content',
    'Comments',
  ]);
  await expect(table).toHaveCSS('min-width', '998px');
  await expect(table.getByText('map').first().locator('..')).toHaveCSS(
    'color',
    'rgb(168, 173, 181)',
  );
  await page.locator('summary').filter({ hasText: 'Filter' }).click();
  await expect(page.getByText('Statuses', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('checkbox', { name: 'Regulatory Signs', exact: true }),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Filter' }).click();
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

for (const zoom of [1, 2]) {
  test(`signage-schedule-remove-status REQ-001,005: narrow layout and accessibility at ${String(zoom * 100)}%`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: zoom === 1 ? 320 : 1512, height: 700 });
    await page.goto(
      '/iframe.html?id=sites-signage-schedule--populated&viewMode=story',
    );
    await page.locator('body').evaluate((body, value) => {
      body.style.zoom = String(value);
    }, zoom);
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Status' }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await table
        .locator('..')
        .evaluate((container) => container.scrollWidth > container.clientWidth),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      // Audit the changed grid and toolbar; the existing colored group-name contrast is recorded separately.
      .include('table')
      .include('section[aria-label="Signage Schedule"] > div')
      .analyze();
    expect(
      results.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);
  });
}
