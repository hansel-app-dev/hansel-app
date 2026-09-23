/** @spec allocation-plan-add-area REQ-003..012 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('rectangle menu, drawing, edit, move, deletion and keyboard creation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-plan-areas--interactive&viewMode=story',
  );
  const canvas = page.getByLabel('Area drawing', { exact: true });
  await expect(canvas).toBeFocused();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing drawing');
  await canvas.click({
    position: { x: box.width * 0.65, y: box.height * 0.2 },
  });
  await expect(page.getByRole('menu', { name: 'Add area type' })).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveText(['Floor', '+New type']);
  await page.getByRole('menuitem', { name: 'Floor' }).click();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, {
    steps: 5,
  });
  await expect(page.getByLabel('Area preview')).toBeVisible();
  await page.mouse.up();
  await expect(page.getByLabel('Area details', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Area code')).toHaveValue('Ar.02');
  await expect(page.getByRole('combobox', { name: 'Function' })).toHaveText(
    'Environmental',
  );
  await expect(page.getByRole('combobox', { name: 'Colour' })).toHaveText(
    'Blue',
  );
  await page.getByLabel('Area code').fill('Zone A');
  await page.getByLabel('Area code').press('Tab');
  await expect(
    page.getByRole('button', { name: 'Select area Zone A' }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .include('[aria-label="Area details"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: '/tmp/hansel-area-applied.png' });
  await page.getByRole('button', { name: 'Close area details' }).click();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const area = page.getByRole('button', { name: 'Select area Zone A' });
  const before = await area.boundingBox();
  await area.focus();
  await page.keyboard.press('Alt+ArrowLeft');
  await expect
    .poll(async () => (await area.boundingBox())?.x)
    .toBeLessThan(before?.x ?? 0);
  page.once('dialog', (dialog) => {
    void dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete area', exact: true }).click();
  await expect(area).toHaveCount(0);
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  await canvas.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Floor' }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Area details', { exact: true })).toBeVisible();
});
test('Areas and Signs select independently in the real viewer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--areas-and-signs&viewMode=story',
  );
  await page.getByRole('button', { name: 'Select area Ar.01' }).click();
  await expect(page.getByLabel('Area details', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select sign SG.001' }).click();
  await expect(page.getByLabel('Sign details', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Area details', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  await page.getByLabel('Area drawing', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Floor' }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Area code')).toHaveValue('Ar.02');
  await expect(
    page.getByRole('button', { name: 'Add area', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

for (const width of [320, 1512]) {
  test(`Area drawer and keyboard creation remain accessible at ${String(width)}px and zoom`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 982 });
    await page.goto(
      '/iframe.html?id=sites-allocation-plan-viewer--areas-and-signs&viewMode=story',
    );
    await page.getByRole('button', { name: 'Add area', exact: true }).click();
    const drawing = page.getByLabel('Area drawing', { exact: true });
    await drawing.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'Floor' }).click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const drawer = page.getByLabel('Area details', { exact: true });
    await expect(drawer).toBeVisible();
    await expect(page.getByLabel('Area code')).toBeInViewport();
    await page.getByRole('combobox', { name: 'Function' }).click();
    await expect(
      page.getByRole('option', { name: 'Environmental' }),
    ).toBeInViewport();
    await page.keyboard.press('Escape');
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Area details"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .getByRole('button', { name: 'Delete area', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByRole('button', { name: 'Delete area', exact: true }),
    ).toBeInViewport();
    await page.getByRole('button', { name: 'Close area details' }).click();
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await drawing.focus();
    await page.keyboard.press('Enter');
    const floor = page.getByRole('menuitem', { name: 'Floor' });
    await expect(floor).toBeInViewport();
    await floor.click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(drawer).toBeVisible();
  });
}
