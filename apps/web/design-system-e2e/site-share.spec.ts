import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('site-share-hover-design: pill never covers the last profile circle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-share-controls--default&viewMode=story',
  );
  const group = page.getByRole('group', { name: /Members:/ });
  await expect(group).toBeVisible();
  const avatar = group.locator(':scope > span:first-child > span:last-child');
  const visibleEdge = () =>
    avatar.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(box.right - 3, box.top + box.height / 2),
      );
    });
  expect(await visibleEdge()).toBe(true);
  await group.hover();
  await expect(group).toHaveCSS('width', '175px');
  expect(await visibleEdge()).toBe(true);
});

test('site-share-hover-design AC-001: animates expansion and respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(
    '/iframe.html?id=sites-share-controls--default&viewMode=story',
  );
  const pill = page.getByTestId('site-access-pill');
  await expect(pill).toHaveCSS('transition-duration', '0.2s');
  await page.getByRole('group', { name: /Members:/ }).hover();
  await expect(pill).toHaveCSS('width', '115px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pill).toHaveCSS('transition-duration', '0s');
});

test('site-share-hover-design AC-001..AC-003: normal, hover and focus geometry with disabled actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-share-controls--default&viewMode=story',
  );
  const group = page.getByRole('group', { name: /Members:/ });
  const share = page.getByRole('button', { name: 'Share site' });
  await expect(group).toBeVisible();
  expect(await group.boundingBox()).toMatchObject({
    x: 1168,
    width: 88,
    height: 32,
  });
  const before = await share.boundingBox();
  expect(before?.x).toBe(1265);
  expect(Math.abs((before?.y ?? 0) - 17)).toBeLessThanOrEqual(1);
  await expect(share).toBeDisabled();
  await page.screenshot({ path: '/tmp/site-share-normal.png' });
  await group.hover();
  await expect(page.getByText('Manage access', { exact: true })).toBeVisible();
  await expect(group).toHaveCSS('width', '175px');
  expect(await group.boundingBox()).toMatchObject({
    x: 1081,
    width: 175,
    height: 32,
  });
  expect(await share.boundingBox()).toEqual(before);
  await page.screenshot({ path: '/tmp/site-share-hover.png' });
  await page.mouse.move(500, 500);
  await expect(page.getByText('Manage access', { exact: true })).toBeHidden();
  await group.focus();
  await expect(page.getByText('Manage access', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('header').analyze();
  expect(axe.violations).toEqual([]);
});

test('site-share-hover-design AC-003: narrow and 200% headers do not overflow', async ({
  page,
}) => {
  for (const width of [320, 1512]) {
    await page.setViewportSize({ width, height: 982 });
    await page.goto(
      '/iframe.html?id=sites-share-controls--default&viewMode=story',
    );
    if (width === 1512)
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
    await page.getByRole('group', { name: /Members:/ }).hover();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Share site' }),
    ).toBeInViewport();
  }
});
