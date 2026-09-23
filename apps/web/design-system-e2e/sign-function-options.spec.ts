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
  await expect(field).toHaveText('Directional');
  await field.click();
  await expect(page.getByRole('option')).toHaveText([
    'Identification',
    'Directional',
    'Informational',
    'Regulatory/Statutory',
  ]);
  await field.focus();
  await expect(field).toBeFocused();
  // Custom listbox navigation retains focus on its trigger.
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(field).toHaveText('Regulatory/Statutory');
  for (const value of [
    'Identification',
    'Directional',
    'Informational',
    'Regulatory/Statutory',
  ]) {
    await field.click();
    await page.getByRole('option', { name: value, exact: true }).click();
    await expect(field).toBeEnabled();
    await page.getByRole('button', { name: 'Close sign details' }).click();
    await page.getByRole('button', { name: 'Select sign SG.001' }).click();
    await expect(field).toHaveText(value);
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
  await expect(field).toHaveText('Regulatory/Statutory');
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
