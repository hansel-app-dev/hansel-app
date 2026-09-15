import { test, expect } from '@playwright/test';
test('sign-mounting-options REQ-001,002,005 illustrated selection and keyboard', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-sign-mounting-select--wall-mounted&viewMode=story',
  );
  const trigger = page.getByRole('combobox', { name: 'Type' });
  await expect(trigger).toBeVisible();
  expect(await trigger.boundingBox()).toMatchObject({ width: 302, height: 40 });
  for (const name of [
    'Freestanding',
    'Wall-mounted',
    'Overhead',
    'Cantilevered',
  ]) {
    await trigger.click();
    const option = page.getByRole('option', { name, exact: true });
    await expect(option.locator('img')).toHaveAttribute('data-mounting', name);
    await option.click();
    await expect(trigger).toContainText(name);
    await expect(trigger.locator('img[data-mounting]')).toHaveAttribute(
      'data-mounting',
      name,
    );
  }
  await trigger.press('ArrowDown');
  await trigger.press('Home');
  await trigger.press('Enter');
  await expect(trigger).toContainText('Freestanding');
  await trigger.press('ArrowDown');
  await trigger.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
