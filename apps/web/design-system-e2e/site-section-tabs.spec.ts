import { expect, test } from '@playwright/test';

// site-section-tabs-consistency REQ-001, REQ-003
for (const width of [1512, 600]) {
  test(`Site section tabs share geometry at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 982 });
    let reference: Awaited<
      ReturnType<ReturnType<typeof page.locator>['boundingBox']>
    >;
    for (const story of [
      'sites-site-activity--loaded',
      'sites-site-allocation-plans--populated-grid',
    ]) {
      await page.goto(`/iframe.html?id=${story}&viewMode=story`);
      const navigation = page.getByRole('navigation', {
        name: 'Site sections',
      });
      await expect(navigation).toBeVisible();
      await expect(navigation).toHaveCSS('border-radius', '0px');
      await expect(navigation).toHaveCSS('box-shadow', 'none');
      await expect(navigation).toHaveCSS('overflow-x', 'auto');
      const bounds = await navigation.boundingBox();
      expect(bounds?.height).toBe(54);
      expect(bounds?.width).toBe(width === 1512 ? 1212 : width);
      if (reference) expect(bounds).toEqual(reference);
      reference = bounds;
      for (const name of ['Activity', 'Allocations', 'Signage Schedule']) {
        const link = navigation.getByRole('link', { name });
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toBeInViewport();
      }
    }
  });
}
