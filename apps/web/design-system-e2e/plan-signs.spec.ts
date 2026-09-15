import { expect, test } from '@playwright/test';

test('allocation-plan-signs REQ-002,005..009: creates, edits, selects and deletes through the drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  await expect(
    page.getByRole('button', { name: 'Select sign SG.001' }),
  ).toBeVisible();
  await page.getByLabel('Plan drawing').click({ position: { x: 120, y: 120 } });
  await expect(page.getByLabel('Sign code')).toHaveValue('SG.002');
  await expect(
    page.getByRole('complementary', { name: 'Sign details' }),
  ).toHaveCSS('width', '350px');
  await page.getByLabel('Sign code').fill('EXIT.01');
  await page.getByLabel('Sign code').press('Enter');
  await expect(
    page.getByRole('button', { name: 'Select sign EXIT.01' }),
  ).toBeVisible();
  await page.getByLabel('Orient left', { exact: true }).click();
  await expect(page.getByLabel('Orient left', { exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Photos' })).toBeDisabled();
  await page.getByRole('button', { name: 'Delete sign' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Select sign EXIT.01' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Select sign SG.001' }),
  ).toBeVisible();
});

test('allocation-plan-signs REQ-002,013: panning does not create and keyboard placement does', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  await expect(
    page.getByRole('button', { name: 'Select sign SG.001' }),
  ).toBeVisible();
  const drawing = page.getByLabel('Plan drawing');
  await drawing.hover();
  await page.keyboard.down('Space');
  await drawing.click({ position: { x: 100, y: 100 } });
  await page.keyboard.up('Space');
  await expect(
    page.getByRole('complementary', { name: 'Sign details' }),
  ).toHaveCount(0);
  await drawing.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Sign code')).toHaveValue('SG.002');
});
