import { expect, test } from '@playwright/test';

test('allocation-plan-sign-moving REQ-003: zoomed moves use drawing coordinates and retain marker size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  const sign = page.getByRole('button', { name: 'Select sign SG.001' });
  await expect(sign).toBeVisible();
  await page.getByRole('button', { name: 'Increase plan zoom' }).click();
  const before = await sign.boundingBox();
  const drawing = await page.getByLabel('Plan drawing').boundingBox();
  if (!before || !drawing) throw new Error('Missing drawing');
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 70, before.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('Saved');
  expect(
    await sign.evaluate((element) => parseFloat(element.style.left)),
  ).toBeCloseTo(45 + 6000 / drawing.width, 2);
  expect((await sign.boundingBox())?.height).toBe(before.height);
});

test('allocation-plan-sign-moving REQ-001,005: viewers cannot move; failed save restores location', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--read-only-signs&viewMode=story',
  );
  const sign = page.getByRole('button', { name: 'Select sign SG.001' });
  await expect(sign).toBeVisible();
  await expect(sign).not.toHaveCSS('cursor', 'move');
  await sign.focus();
  const original = await sign.boundingBox();
  await page.keyboard.press('Alt+ArrowRight');
  expect(await sign.boundingBox()).toEqual(original);
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--move-save-failure&viewMode=story',
  );
  await expect(sign).toBeVisible();
  const before = await sign.boundingBox();
  await sign.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.getByRole('status')).toContainText('We couldn’t save');
  expect(await sign.boundingBox()).toEqual(before);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('allocation-plan-sign-moving REQ-001..004,007: drag preserves offset, selection and keyboard movement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  const sign = page.getByRole('button', { name: 'Select sign SG.001' });
  await expect(sign).toBeVisible();
  await expect(sign).toHaveCSS('cursor', 'move');
  const before = await sign.boundingBox();
  if (!before) throw new Error('Missing Sign');
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 110, before.y + 70, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('status')).toContainText('Saved');
  const after = await sign.boundingBox();
  expect(after?.x).toBeCloseTo(before.x + 100, 0);
  expect(after?.y).toBeCloseTo(before.y + 60, 0);
  await expect(page.getByRole('button', { name: /^Select sign/ })).toHaveCount(
    1,
  );
  await sign.click();
  await expect(page.getByLabel('Sign code')).toHaveValue('SG.001');
  await sign.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.getByRole('status')).toContainText('Saved');
  expect((await sign.boundingBox())?.x).toBeGreaterThan(after?.x ?? 0);
});

test('allocation-plan-sign-moving REQ-005: Escape cancels without creating a Sign', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  const sign = page.getByRole('button', { name: 'Select sign SG.001' });
  await expect(sign).toBeVisible();
  const before = await sign.boundingBox();
  if (!before) throw new Error('Missing Sign');
  await page.mouse.move(before.x + 10, before.y + 10);
  await page.mouse.down();
  await page.mouse.move(before.x + 110, before.y + 80);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await sign.boundingBox())?.x).toBeCloseTo(before.x, 0);
  await expect(page.getByRole('button', { name: /^Select sign/ })).toHaveCount(
    1,
  );
});
