/** @spec allocation-plan-toolbar-icons REQ-001..REQ-004 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [width, zoom] of [
  [1024, 1],
  [320, 1],
  [640, 2],
] as const) {
  test(`supplied toolbar artwork at ${String(width)}px and ${String(zoom * 100)}%`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto(
      '/iframe.html?id=sites-plan-toolbar--interactive&viewMode=story',
    );
    const toolbar = page.getByRole('toolbar', { name: 'Plan tools' });
    await expect(toolbar).toBeVisible();
    await page.evaluate((scale) => {
      document.documentElement.style.zoom = String(scale);
    }, zoom);
    const images = toolbar.locator('img');
    await expect(images).toHaveCount(6);
    for (const img of await images.all()) {
      await expect
        .poll(() =>
          img.evaluate(
            (el: HTMLImageElement) =>
              el.complete &&
              el.naturalWidth === 102 &&
              el.naturalHeight === 102,
          ),
        )
        .toBe(true);
      await expect(img).toHaveCSS('width', '34px');
      await expect(img).toHaveCSS('height', '34px');
      await expect(img).toBeInViewport();
    }
    for (const name of ['Hand', 'Add sign', 'Move']) {
      const button = toolbar.getByRole('button', { name, exact: true });
      await button.locator('img').click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button.locator('img')).toHaveCSS(
        'filter',
        'brightness(0) invert(1)',
      );
      await expect(button).toHaveCSS('background-color', 'rgb(64, 150, 255)');
    }
    await page.keyboard.press('Tab');
    await expect(toolbar.getByRole('button', { name: 'Hand' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(toolbar.getByRole('button', { name: 'Hand' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      (await new AxeBuilder({ page }).include('[role=toolbar]').analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1024)
      await page.screenshot({ path: '/tmp/hansel-toolbar-icons.png' });
  });
}

test('Viewer and saving stories retain disabled controls with supplied images', async ({
  page,
}) => {
  for (const [story, disabled] of [
    ['viewer', 4],
    ['saving', 6],
  ] as const) {
    await page.goto(
      `/iframe.html?id=sites-plan-toolbar--${story}&viewMode=story`,
    );
    const toolbar = page.getByRole('toolbar');
    await expect(toolbar.locator('button:disabled')).toHaveCount(disabled);
    await expect(toolbar.locator('img')).toHaveCount(6);
  }
});
