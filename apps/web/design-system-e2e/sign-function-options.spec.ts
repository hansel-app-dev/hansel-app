/** @spec sign-function-options REQ-001, REQ-002, REQ-005 */
import { expect, test } from '@playwright/test';

test('Function choices support keyboard editing and preserve the selection when reopening', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--populated-signs&viewMode=story',
  );
  await page.getByRole('button', { name: 'Select sign SG.001' }).click();
  const field = page.getByRole('combobox', { name: 'Function' });
  await expect(field).toHaveValue('Directional');
  await expect(field.locator('option')).toHaveText([
    'Identification',
    'Directional',
    'Informational',
    'Regulatory/Statutory',
  ]);
  await field.focus();
  await expect(field).toBeFocused();
  // Native select type-ahead is keyboard-driven on macOS Chromium, including headless.
  await page.keyboard.press('r');
  await page.keyboard.press('Enter');
  await expect(field).toHaveValue('Regulatory/Statutory');
  for (const value of [
    'Identification',
    'Directional',
    'Informational',
    'Regulatory/Statutory',
  ]) {
    await field.selectOption(value);
    await expect(field).toBeEnabled();
    await page.getByRole('button', { name: 'Close sign details' }).click();
    await page.getByRole('button', { name: 'Select sign SG.001' }).click();
    await expect(field).toHaveValue(value);
  }
});

test('Viewer Function is disabled and Regulatory/Statutory fits the drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(
    '/iframe.html?id=sites-allocation-plan-viewer--function-read-only&viewMode=story',
  );
  const field = page.getByRole('combobox', { name: 'Function' });
  await expect(field).toBeDisabled();
  await expect(field).toHaveValue('Regulatory/Statutory');
  const width = await field.evaluate((element) => {
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.font = `${style.fontSize} ${style.fontFamily}`;
    return {
      text: context.measureText('Regulatory/Statutory').width,
      available:
        element.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) -
        24,
    };
  });
  expect(width.text).toBeLessThan(width.available);
});
