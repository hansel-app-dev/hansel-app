/** @spec library-files REQ-004..008,011,013 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('library-files lists real metadata, searches and filters privately', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=libraries-files--page&viewMode=story');
  await expect(page.getByRole('link', { name: 'Files' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('Ground floor.pdf')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search files' }).fill('Entrance');
  await expect(page.getByText('Ground floor.pdf')).toHaveCount(0);
  await expect(page.getByText('Entrance.png')).toBeVisible();
  await page.getByRole('combobox', { name: 'File type' }).selectOption('pdf');
  await expect(page.getByText('No files found.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search files' }).fill('');
  await expect(page.getByText('Ground floor.pdf')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('#storybook-root').analyze())
      .violations,
  ).toEqual([]);
});

for (const width of [320, 1024])
  test(`library-files picker works with keyboard at ${String(width)}px and 200% zoom`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto(
      '/iframe.html?id=libraries-files--single-picker&viewMode=story',
    );
    await expect(
      page.getByRole('radio', { name: 'Ground floor.pdf' }),
    ).toBeVisible();
    if (width === 1024)
      await page.evaluate(() => {
        document.body.style.zoom = '2';
      });
    await page.getByRole('radio', { name: 'Ground floor.pdf' }).focus();
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('button', { name: 'Use selected files' }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#storybook-root')
          .disableRules(['region'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `/tmp/hansel-library-picker-${String(width)}.png`,
      fullPage: true,
    });
  });

test('library-files picker retains selection on failure', async ({ page }) => {
  await page.goto(
    '/iframe.html?id=libraries-files--picker-failure&viewMode=story',
  );
  await page.getByRole('checkbox', { name: 'Ground floor.pdf' }).check();
  await page.getByRole('button', { name: 'Use selected files' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Ground floor.pdf' }),
  ).toBeChecked();
  await expect(
    page.getByRole('button', { name: 'Use selected files' }),
  ).toBeEnabled();
});

test('library-files chooses a plan without uploading and restores the parent dialog focus', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-add-plans-modal--library&viewMode=story',
  );
  const open = page.getByRole('button', { name: 'Library files' });
  await open.click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('radio', { name: 'Ground floor.pdf' }).check();
  await page.getByRole('button', { name: 'Select plan file' }).click();
  await expect(page.getByLabel('Allocation name')).toHaveValue('Ground floor');
  await expect(page.getByLabel('Choose allocation files')).toBeDisabled();
  await expect(open).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Add Allocation', exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: '/tmp/hansel-library-plan-selected.png',
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .include('#storybook-root')
        .disableRules(['region'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

for (const kind of ['documents', 'photos'])
  test(`library-files attaches compatible ${kind} through the Sign drawer`, async ({
    page,
  }) => {
    await page.goto(
      `/iframe.html?id=sites-sign-${kind}--library&viewMode=story`,
    );
    await page.getByRole('button', { name: 'Library files' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Entrance.png' }),
    ).toBeVisible();
    if (kind === 'photos')
      await expect(
        page.getByRole('checkbox', { name: 'Ground floor.pdf' }),
      ).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Entrance.png' }).check();
    await page
      .getByRole('button', {
        name: kind === 'photos' ? 'Add photos' : 'Add documents',
      })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
