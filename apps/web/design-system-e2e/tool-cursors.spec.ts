/** @spec allocation-plan-tool-cursors REQ-001..005 */
import { expect, test } from '@playwright/test';
test('supplied cursors follow tools, auto-Move and temporary pan without replacing resize or text cursors', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--areas-and-signs&viewMode=story',
  );
  const drawing = page.getByLabel('Plan drawing', { exact: true });
  const areaDrawing = page.getByLabel('Area drawing', { exact: true });
  await expect(drawing).toHaveCSS('cursor', /move_cursor\.png.*8 6, default/);
  for (const [name, asset] of [
    ['Hand', 'hand'],
    ['Add sign', 'add_sign'],
    ['Add area', 'add_area'],
    ['Move', 'move'],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(drawing).toHaveCSS(
      'cursor',
      new RegExp(`${asset}_cursor\\.png`),
    );
    await expect(
      page.getByRole('button', { name: 'Select sign SG.001' }),
    ).toHaveCSS('cursor', new RegExp(`${asset}_cursor\\.png`));
    await expect(
      page.getByRole('button', { name: 'Select area Ar.01' }),
    ).toHaveCSS('cursor', new RegExp(`${asset}_cursor\\.png`));
  }
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  await areaDrawing.focus();
  await page.keyboard.down('Space');
  await expect(drawing).toHaveCSS('cursor', /hand_cursor\.png/);
  const drawingBox = await drawing.boundingBox();
  if (!drawingBox) throw new Error('Missing drawing');
  await page.mouse.move(drawingBox.x + 50, drawingBox.y + 50);
  await page.mouse.down();
  await page.mouse.move(drawingBox.x + 65, drawingBox.y + 65);
  await expect(drawing).toHaveCSS('cursor', /hand_cursor\.png/);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(drawing).toHaveCSS('cursor', /add_area_cursor\.png/);
  await areaDrawing.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Floor' }).click();
  await expect(areaDrawing).toHaveCSS('cursor', /add_area_cursor\.png/);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(drawing).toHaveCSS('cursor', /move_cursor\.png/);
  await expect(
    page.getByRole('button', { name: 'Resize area bottom-right', exact: true }),
  ).toHaveCSS('cursor', 'se-resize');
  await expect(page.getByLabel('Area code')).not.toHaveCSS(
    'cursor',
    /_cursor\.png/,
  );
  await page.getByRole('button', { name: 'Close area details' }).click();
  await page.getByRole('button', { name: 'Add sign', exact: true }).click();
  await drawing.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Floor' }).click();
  await expect(drawing).toHaveCSS('cursor', /move_cursor\.png/);
  await expect(page.getByRole('button', { name: 'Add linear' })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Comment (coming soon)' }),
  ).toBeDisabled();
});
test('all six original images load in previews and remain available at 200% zoom', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-tool-cursors--supplied-artwork&viewMode=story',
  );
  const previews = page.getByRole('region');
  await expect(previews).toHaveCount(6);
  for (const preview of await previews.all()) {
    await expect(preview).toHaveCSS('cursor', /image-set.*_cursor\.png.*3dppx/);
    for (const img of await preview.getByRole('img').all()) {
      await expect
        .poll(() =>
          img.evaluate(
            (el: HTMLImageElement) =>
              el.complete && el.naturalWidth >= 70 && el.naturalWidth <= 86,
          ),
        )
        .toBe(true);
      const displayed = await img.evaluate((el: HTMLImageElement) => ({
        width: el.getBoundingClientRect().width,
        source: el.naturalWidth,
      }));
      expect(displayed.width).toBeCloseTo(displayed.source / 3, 1);
    }
  }
  await page.screenshot({
    path: '/tmp/hansel-tool-cursors.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await expect(previews.first()).toHaveCSS('cursor', /move_cursor\.png/);
});
