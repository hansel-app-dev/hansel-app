import { expect, test } from '@playwright/test';

test('allocation cards match normal, hover and focus states [allocation-card-hover REQ-001..REQ-003]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-site-allocation-plans--populated-grid&viewMode=story',
  );
  const cards = page
    .getByRole('list', { name: 'Allocation Plans' })
    .getByRole('listitem');
  const card = cards.first();
  await expect(card).toBeVisible();
  const dots = card.getByText('more_vert');
  await expect(card).toHaveCSS('box-shadow', 'none');
  await expect(dots).toHaveCSS('opacity', '0');
  const bounds = await card.boundingBox();
  expect(bounds?.width).toBe(275);
  expect(bounds?.height).toBe(73);
  await card.hover();
  await expect(card).not.toHaveCSS('box-shadow', 'none');
  await expect(dots).toHaveCSS('opacity', '1');
  expect(await card.boundingBox()).toEqual(bounds);
  await expect(cards.nth(1).getByText('more_vert')).toHaveCSS('opacity', '0');
  await page.mouse.move(0, 0);
  await expect(dots).toHaveCSS('opacity', '0');
  await card.getByRole('link').focus();
  await expect(dots).toHaveCSS('opacity', '1');
  await expect(card.getByRole('link')).toBeFocused();
  await page.setViewportSize({ width: 320, height: 982 });
  expect((await card.boundingBox())?.width).toBeLessThanOrEqual(280);
});
