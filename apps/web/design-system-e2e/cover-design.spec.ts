import { expect, test } from '@playwright/test';

test('site-cover-image-add: cover reference geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-add-site-modal--step-three&viewMode=story',
  );
  await expect(
    page.getByRole('heading', { name: 'Add a cover image' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.getByRole('dialog').boundingBox()).toMatchObject({
    x: 506,
    y: 259,
    width: 500,
    height: 464,
  });
  expect(
    await page.getByRole('button', { name: 'Browse files' }).boundingBox(),
  ).toMatchObject({ x: 702, y: 524, width: 108, height: 32 });
  await page.screenshot({ path: '/tmp/cover-design.png' });
});
