/** @spec site-activity-feed-comments REQ-011, REQ-018, REQ-019 */
import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('Activity panel matches reference dimensions and remains usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-site-activity-feed--mixed-activity&viewMode=story',
  );
  const field = page.getByRole('textbox');
  await expect(field).toBeVisible();
  const card = page.locator('[data-activity-comment-card]');
  expect((await card.boundingBox())?.width).toBe(300);
  expect((await card.boundingBox())?.height).toBe(84);
  const composer = field.locator('..');
  expect((await composer.boundingBox())?.width).toBe(303);
  expect((await composer.boundingBox())?.height).toBe(94);
  await expect(page.getByRole('heading', { name: 'Activity' })).toHaveCSS(
    'font-size',
    '12px',
  );
  const results = await new AxeBuilder({ page })
    .include('#storybook-root')
    .analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    ),
  ).toEqual([]);
  await field.fill('A working comment');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(
    page.getByText('A working comment', { exact: true }),
  ).toBeVisible();
  await expect(field).toHaveValue('');
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.evaluate(() => {
    document.body.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
