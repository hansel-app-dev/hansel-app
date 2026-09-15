import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('plan-sign-delete-dialog REQ-006: pending cannot dismiss and failure retains the Sign', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--delete-pending&viewMode=story',
  );
  await page.getByRole('button', { name: 'Select sign SG.001' }).click();
  await page.getByRole('button', { name: 'Delete sign', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--delete-failure&viewMode=story',
  );
  await page.getByRole('button', { name: 'Select sign SG.001' }).click();
  await page.getByRole('button', { name: 'Delete sign', exact: true }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('We couldn’t delete');
  await expect(
    page.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(
    page.getByRole('button', { name: 'Select sign SG.001' }),
  ).toBeVisible();
});

test('plan-sign-delete-dialog REQ-002,005: narrow long-code layout and accessible dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(
    '/iframe.html?id=sites-sign-delete-dialog--long-code&viewMode=story',
  );
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(16);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(359);
  expect(
    (await new AxeBuilder({ page }).include('dialog').analyze()).violations,
  ).toEqual([]);
});

test('plan-sign-delete-dialog REQ-001..005: reference geometry and safe cancellation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Select sign SG.001' }).click();
  await page.getByRole('button', { name: 'Delete sign', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete sign SG.001' });
  await expect(dialog).toBeVisible();
  expect(await dialog.boundingBox()).toMatchObject({ width: 350, height: 212 });
  expect(
    await page.getByTestId('sign-delete-backdrop').boundingBox(),
  ).toMatchObject({ x: 300, y: 119, width: 862, height: 823 });
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Close delete confirmation' }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Delete sign', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Select sign SG.001' }),
  ).toBeVisible();
});
