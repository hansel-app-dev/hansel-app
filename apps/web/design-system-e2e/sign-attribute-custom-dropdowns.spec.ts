/** @spec sign-attribute-custom-dropdowns REQ-001..REQ-006 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1512, 320]) {
  test(`Function and Colour match Type and stay accessible at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 982 });
    await page.goto(
      '/iframe.html?id=sites-allocation-plan-viewer--sign-drawer&viewMode=story',
    );
    const field = page.getByRole('combobox', { name: 'Function' });
    await expect(field).toBeVisible();
    const type = page.getByRole('combobox', { name: 'Type' });
    expect((await field.boundingBox())?.height).toBe(40);
    expect((await field.boundingBox())?.width).toBe(
      (await type.boundingBox())?.width,
    );
    await field.click();
    const list = page.getByRole('listbox', { name: 'Function' });
    await expect(list).toBeInViewport();
    await expect(
      page.getByRole('option', { name: 'Regulatory/Statutory' }),
    ).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(
      page.getByLabel('Sign details', { exact: true }),
    ).toBeVisible();
    await expect(field).toBeFocused();
    const colour = page.getByRole('combobox', { name: 'Colour' });
    await colour.click();
    await expect(
      page.getByRole('listbox', { name: 'Colour' }),
    ).toBeInViewport();
    await expect(
      page.getByRole('option', { name: 'Red' }).locator('[aria-hidden=true]'),
    ).toHaveCSS('background-color', 'rgb(244, 91, 0)');
    await page.screenshot({
      path: `/tmp/hansel-custom-colour-${String(width)}.png`,
    });
    const axe = await new AxeBuilder({ page })
      .include('[role="combobox"]')
      .include('[role="listbox"]')
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.getByRole('option', { name: 'Red' }).click();
    await expect(colour).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await field.click();
    await expect(
      page.getByRole('option', { name: 'Regulatory/Statutory' }),
    ).toBeInViewport();
  });
}
