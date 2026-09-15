import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sign-photos pending deletion cannot dismiss or submit twice', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-sign-photos--delete-pending&viewMode=story',
  );
  await page
    .getByRole('button', { name: /Delete sign-photo/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Deleting…', exact: true }),
  ).toBeDisabled();
});

test('sign-photos reference geometry, hover controls, grid and confirmation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-sign-photos--populated&viewMode=story',
  );
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(3);
  const box = await cards.first().boundingBox();
  expect(box).toMatchObject({ x: 1186, y: 380, width: 302, height: 252 });
  await cards.first().hover();
  await expect(
    cards.first().getByRole('button', { name: /Download/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Grid view' }).click();
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  expect(a?.y).toBe(b?.y);
  expect(a?.width).toBe(145);
  await cards
    .first()
    .getByRole('button', { name: /Delete/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await cards
    .first()
    .getByRole('button', { name: /Delete/ })
    .click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(cards).toHaveCount(2);
  expect(
    (await new AxeBuilder({ page }).include('[role="tabpanel"]').analyze())
      .violations,
  ).toEqual([]);
});

test('sign-photos empty upload layout and read-only restrictions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-sign-photos--empty&viewMode=story');
  await expect(page.getByText('Loading photos…')).toHaveCount(0);
  const browse = page.getByRole('button', { name: 'Browse local files' });
  const drop = await browse.locator('..').boundingBox();
  expect(drop).toMatchObject({ x: 1186, y: 365, width: 302, height: 232 });
  await expect(
    page.getByRole('button', { name: 'Library files' }),
  ).toBeDisabled();
  await page.getByLabel('Upload photos').setInputFiles({
    name: 'bad.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('PDF'),
  });
  await expect(page.getByRole('alert')).toContainText('PNG or JPG');
  await page.goto(
    '/iframe.html?id=sites-sign-photos--read-only&viewMode=story',
  );
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(browse).toBeDisabled();
  await expect(page.getByRole('button', { name: /Delete/ })).toHaveCount(0);
});
