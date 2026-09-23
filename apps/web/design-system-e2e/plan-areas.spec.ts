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
  const rectangle = page.getByRole('button', { name: 'Select area Ar.02' });
  const rectangleBox = await rectangle.boundingBox();
  const labelBox = await rectangle.locator('span[title]').boundingBox();
  if (!rectangleBox || !labelBox) throw new Error('Missing area label');
  expect(labelBox.x).toBeGreaterThanOrEqual(
    rectangleBox.x + rectangleBox.width - 1,
  );
  expect(Math.abs(labelBox.y - rectangleBox.y)).toBeLessThanOrEqual(1);
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
    const resizedArea = page.getByRole('button', { name: 'Select area Ar.03' });
    const initialSize = await resizedArea.boundingBox();
    const resizeHandle = page.getByRole('button', {
      name: 'Resize area bottom-right',
      exact: true,
    });
    await resizeHandle.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await resizedArea.boundingBox())?.width)
      .toBeGreaterThan(initialSize?.width ?? 0);
  });
}

/** @spec allocation-plan-area-transform REQ-001..007 */
test('saved Areas drag in Add area mode and resize with handles and keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-plan-areas--interactive&viewMode=story',
  );
  const area = page.getByRole('button', { name: 'Select area Ar.01' });
  const before = await area.boundingBox();
  if (!before) throw new Error('Missing area');
  await page.mouse.move(before.x + 50, before.y + 50);
  await page.mouse.down();
  await page.mouse.move(before.x + 70, before.y + 70, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await area.boundingBox())?.x)
    .toBeGreaterThan(before.x + 15);
  await expect(page.getByRole('button', { name: /^Resize area/ })).toHaveCount(
    8,
  );
  const handle = page.getByRole('button', {
    name: 'Resize area bottom-right',
    exact: true,
  });
  const moved = await area.boundingBox();
  if (!moved) throw new Error('Missing moved area');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(
    moved.x + moved.width + 30,
    moved.y + moved.height + 20,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await area.boundingBox())?.width)
    .toBeGreaterThan(moved.width + 20);
  const resized = await area.boundingBox();
  if (!resized) throw new Error('Missing resized area');
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  expect((await area.boundingBox())?.width).toBeCloseTo(resized.width, 0);
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect
    .poll(async () => (await area.boundingBox())?.width)
    .toBeGreaterThan(resized.width);
  await expect(handle).toBeFocused();
  const beforeLabelDrag = await area.boundingBox();
  const label = area.locator('span[title]');
  const labelBox = await label.boundingBox();
  if (!beforeLabelDrag || !labelBox) throw new Error('Missing label');
  await page.mouse.move(
    labelBox.x + labelBox.width / 2,
    labelBox.y + labelBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    labelBox.x + labelBox.width / 2 - 20,
    labelBox.y + labelBox.height / 2 + 10,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await area.boundingBox())?.x)
    .toBeLessThan(beforeLabelDrag.x - 15);
  expect((await area.boundingBox())?.width).toBeCloseTo(
    beforeLabelDrag.width,
    0,
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('[aria-label="Area drawing"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: '/tmp/hansel-area-resize.png' });
});
