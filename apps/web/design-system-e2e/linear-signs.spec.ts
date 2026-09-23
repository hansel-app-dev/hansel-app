/** @spec allocation-plan-add-linear REQ-001..012 */
import { expect, test } from '@playwright/test';
test('draw, drag, edit endpoints and shared drawer then delete', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-linear-signs--interactive&viewMode=story',
  );
  const tool = page.getByRole('button', { name: 'Add linear', exact: true });
  await tool.click();
  const drawing = page.getByLabel('Linear drawing', { exact: true });
  await expect(drawing).toHaveCSS('cursor', /add_linear_cursor.png/);
  const box = await drawing.boundingBox();
  if (!box) throw Error('No drawing');
  await drawing.click({
    position: { x: box.width * 0.6, y: box.height * 0.15 },
  });
  await expect(page.getByRole('menuitem')).toHaveText([
    'Safety Decal',
    '+New type',
  ]);
  await page.getByRole('menuitem', { name: 'Safety Decal' }).click();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.getByLabel('Sign code')).toHaveValue('Pr.02');
  await expect(
    page.getByRole('button', { name: 'Move', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(
    'Safety Decal',
  );
  await expect(page.getByRole('combobox', { name: 'Colour' })).toHaveText(
    'Orange',
  );
  await page.getByRole('combobox', { name: 'Function' }).click();
  await page.getByRole('option', { name: 'Informational' }).click();
  await expect(page.getByRole('combobox', { name: 'Function' })).toHaveText(
    'Informational',
  );
  const badge = page.getByRole('button', { name: 'Select sign Pr.02' });
  const before = await badge.boundingBox();
  if (!before) throw Error('No badge');
  await badge.hover();
  await page.mouse.down();
  await page.mouse.move(before.x - 60, before.y - 40, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await badge.boundingBox())?.x ?? 0)
    .toBeLessThan(before.x - 20);
  const handle = page.getByRole('button', {
    name: 'Resize Pr.02 end endpoint',
  });
  const hb = await handle.boundingBox();
  if (!hb) throw Error('No handle');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(hb.x - 35, hb.y + 45, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await handle.boundingBox())?.y ?? 0)
    .toBeGreaterThan(hb.y + 20);
  await handle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(handle).toBeFocused();
  await page.screenshot({ path: '/tmp/hansel-linear-applied.png' });
  await page.getByRole('button', { name: 'Delete sign', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(badge).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Select sign Pr.01' }),
  ).toBeVisible();
});
test('keyboard creation, cancellation, retry and Viewer access', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=sites-linear-signs--failure&viewMode=story');
  await expect(
    page.getByText('We couldn’t save. Please try again.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Sign code')).toHaveValue('Pr.02');
  await page.getByRole('button', { name: 'Add linear', exact: true }).click();
  const d = page.getByLabel('Linear drawing', { exact: true });
  await d.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Safety Decal' }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Select sign Pr.03' }),
  ).toHaveCount(0);
  await page.goto('/iframe.html?id=sites-linear-signs--viewer&viewMode=story');
  await expect(page.getByLabel('Sign code')).toHaveAttribute('readonly', '');
  await expect(
    page.getByRole('button', { name: 'Add linear', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('button', { name: /Resize Pr.01/ })).toHaveCount(
    0,
  );
});
test('narrow and zoomed drawers, independent Area selection and pan cancellation', async ({
  page,
}) => {
  for (const width of [320, 1512]) {
    await page.setViewportSize({ width, height: 982 });
    await page.goto(
      '/iframe.html?id=sites-linear-signs--selected&viewMode=story',
    );
    if (width === 1512)
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
    const drawer = page.getByLabel('Sign details', { exact: true });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('combobox', { name: 'Colour' }).click();
    await expect(page.getByRole('option', { name: 'Orange' })).toBeVisible();
    await page.keyboard.press('Escape');
    await drawer
      .getByRole('button', { name: 'Delete sign', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      drawer.getByRole('button', { name: 'Delete sign', exact: true }),
    ).toBeInViewport();
  }
  await page.goto(
    '/iframe.html?id=sites-linear-signs--selected&viewMode=story',
  );
  await page.getByRole('button', { name: 'Close sign details' }).click();
  await page.getByRole('button', { name: 'Select area Ar.01' }).click();
  await expect(page.getByLabel('Area details', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select sign Pr.01' }).click();
  await expect(page.getByLabel('Area details', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Sign details', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add linear', exact: true }).click();
  const d = page.getByLabel('Linear drawing', { exact: true });
  await d.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Safety Decal' }).click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(
    page.getByRole('button', { name: 'Select sign Pr.02' }),
  ).toHaveCount(0);
});
