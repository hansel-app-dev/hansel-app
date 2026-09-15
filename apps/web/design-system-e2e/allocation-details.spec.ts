import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('allocation-details-design AC-002, AC-004: reference geometry, selection and accessible controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--multiple-files&viewMode=story',
  );
  await expect(page.getByRole('img')).toBeVisible();
  const selector = page.getByRole('button', { name: 'Select plan file' });
  expect(await selector.boundingBox()).toMatchObject({
    x: 332,
    y: 171,
    width: 234,
    height: 38,
  });
  expect(
    await page.getByTestId('plan-pan-viewport').boundingBox(),
  ).toMatchObject({ x: 332, y: 151, width: 1148, height: 791 });
  expect(
    await page.getByLabel('Plan viewing controls').boundingBox(),
  ).toMatchObject({ x: 300, y: 942, width: 1212, height: 40 });
  expect(
    await page.getByRole('button', { name: 'Reset zoom' }).boundingBox(),
  ).toMatchObject({ x: 332, width: 30, height: 24 });
  expect(
    await page.getByRole('button', { name: 'Zoom in' }).boundingBox(),
  ).toMatchObject({ x: 373, width: 24, height: 24 });
  expect(
    await page.getByRole('button', { name: 'Zoom out' }).boundingBox(),
  ).toMatchObject({ x: 403, width: 24, height: 24 });
  expect(
    await page.getByText('SPACEBAR', { exact: true }).boundingBox(),
  ).toMatchObject({ x: 519, width: 64, height: 22 });
  await selector.click();
  await expect(page.getByRole('menuitem')).toHaveCount(3);
  expect(await page.getByRole('menu').boundingBox()).toMatchObject({
    x: 367,
    y: 209,
    width: 199,
  });
  await page.screenshot({ path: '/tmp/allocation-details-dropdown.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('img', { name: 'Second Floor.png' }),
  ).toBeVisible();
  await expect(selector).toBeFocused();
  const accessibility = await new AxeBuilder({ page })
    .include('#storybook-root')
    .disableRules(['region'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('allocation-details-design AC-002: narrow viewport has no horizontal document overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 768 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--multiple-files&viewMode=story',
  );
  await expect(page.getByRole('img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeInViewport();
});

test('allocation-details-design AC-002: 200% zoom retains reachable controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--multiple-files&viewMode=story',
  );
  await expect(page.getByRole('img')).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(
    page.getByRole('button', { name: 'Select plan file' }),
  ).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
