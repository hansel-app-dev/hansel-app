import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('selected files use the same rectangular layout before upload starts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-add-plans-modal--selected&viewMode=story',
  );
  const files = page.getByRole('list', { name: 'Allocation files' });
  await expect(files).toBeVisible();
  expect((await page.getByRole('dialog').boundingBox())?.height).toBe(343);
  expect((await files.getByRole('listitem').boundingBox())?.height).toBe(62);
  expect((await files.getByRole('listitem').boundingBox())?.width).toBe(452);
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/allocation-selected-rectangle.png' });
});

for (const [state, height] of [
  ['empty', 531],
  ['uploading', 343],
  ['uploaded', 343],
] as const) {
  test(`REQ-011, REQ-012: allocation ${state} matches design geometry`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1512, height: 982 });
    await page.goto(
      `/iframe.html?id=sites-add-plans-modal--${state}&viewMode=story`,
    );
    const dialog = page.getByRole('dialog', { name: 'Add new Allocation' });
    await expect(dialog).toBeVisible();
    if (state !== 'empty')
      await expect(
        page.getByRole('button', { name: 'Add Allocation', exact: true }),
      ).toBeVisible();
    if (state === 'uploaded')
      await expect(
        page.getByRole('button', { name: 'Add Allocation', exact: true }),
      ).toBeEnabled();
    const box = await dialog.boundingBox();
    expect(box?.width).toBe(500);
    expect(box?.height).toBe(height);
    expect(box?.x).toBe(506);
    expect(
      (await page.getByLabel('Allocation name').boundingBox())?.height,
    ).toBe(40);
    if (state === 'uploading')
      await expect(page.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '45',
      );
    const axe = await new AxeBuilder({ page })
      .include('[role=dialog]')
      .analyze();
    expect(
      axe.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);
    await page.screenshot({ path: `/tmp/allocation-${state}-verified.png` });
    for (const width of [756, 320]) {
      await page.setViewportSize({ width, height: 491 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole('button', {
          name: state === 'empty' ? 'Next' : 'Add Allocation',
          exact: true,
        }),
      ).toBeInViewport();
    }
  });
}
