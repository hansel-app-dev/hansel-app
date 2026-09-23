/** @spec sign-additional-type-options REQ-001,002,003,006 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const zoom of [1, 2]) {
  test(`Type options remain reachable at 320px and ${String(zoom * 100)}% zoom`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(
      '/iframe.html?id=sites-sign-mounting-select--wall-mounted&viewMode=story',
    );
    const trigger = page.getByRole('combobox', { name: 'Type' });
    await expect(trigger).toBeVisible();
    await page.evaluate((scale) => {
      document.documentElement.style.zoom = String(scale);
    }, zoom);
    await trigger.click();
    await expect(page.getByRole('option')).toHaveText([
      'Freestanding',
      'Wall-mounted',
      'Overhead',
      'Cantilevered',
      'Floor',
      'Safety Decal',
      'Privacy Decal',
      'Environmental',
    ]);
    await page.keyboard.press('End');
    await expect(
      page.getByRole('option', { name: 'Environmental' }),
    ).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveText('Environmental');
    for (const [label, asset] of [
      ['Safety Decal', 'safety-decal'],
      ['Privacy Decal', 'privacy-decal'],
      ['Environmental', 'environmental'],
    ] as const) {
      await trigger.click();
      const option = page.getByRole('option', { name: label, exact: true });
      await option.click();
      await expect(trigger).toHaveText(label);
      await expect(trigger.locator('img')).toHaveAttribute(
        'src',
        `/assets/sign-${asset}.png`,
      );
      expect(
        await trigger
          .locator('img')
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth === 24,
          ),
      ).toBe(true);
    }
    await trigger.click();
    const axe = await new AxeBuilder({ page })
      .include('[role="combobox"]')
      .include('[role="listbox"]')
      .analyze();
    expect(axe.violations).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });
}

test('Add sign reaches Environmental inside a short drawing and creates with it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--add-sign-menu-edge&viewMode=story',
  );
  const menu = page.getByRole('menu', { name: 'Add sign type' });
  await expect(menu).toBeVisible();
  await page.keyboard.press('End');
  const environmental = page.getByRole('menuitem', { name: 'Environmental' });
  await expect(environmental).toBeFocused();
  await expect(environmental).toBeInViewport();
  await expect(page.getByRole('menuitem', { name: 'New type' })).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(
    'Environmental',
  );
  await expect(
    page.getByRole('button', { name: 'Move', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
