import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('add-site-design-refresh REQ-001..008: reference layout and cover progression', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-add-site-modal--step-one&viewMode=story',
  );
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await modal.boundingBox()).toMatchObject({
    x: 506,
    y: 263,
    width: 500,
    height: 456,
  });
  expect(
    await page.getByLabel('Name', { exact: true }).boundingBox(),
  ).toMatchObject({ x: 578, y: 339, width: 404, height: 40 });
  expect(await page.getByRole('combobox').boundingBox()).toMatchObject({
    x: 530,
    y: 431,
    width: 452,
    height: 40,
  });
  await page.screenshot({ path: '/tmp/add-site-design.png' });
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await expect(page.getByPlaceholder('New site')).toHaveValue('');
  await page.getByPlaceholder('New site').fill('Building A');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Step 2 of 2')).toBeVisible();
});

test('add-site-design-refresh REQ-008: narrow and zoomed layout', async ({
  page,
}) => {
  for (const width of [320, 756]) {
    await page.setViewportSize({ width, height: 491 });
    await page.goto(
      '/iframe.html?id=sites-add-site-modal--step-one&viewMode=story',
    );
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
});
