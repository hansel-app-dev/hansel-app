import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('site-invitation-design REQ-001..007: mixed invitation rows match reference', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-add-site-modal--step-one&viewMode=story',
  );
  await page.getByLabel('Name', { exact: true }).fill('Building A');
  await page.getByRole('combobox', { name: 'Who has access' }).click();
  await page.getByRole('option', { name: 'People you invite' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const [email, role] of [
    ['alex@example.com', 'EDITOR'],
    ['sarah@lumen.com', 'VIEWER'],
    ['james@lumen.com', 'EDITOR'],
  ] as const) {
    await page.getByLabel('Email or team member').fill(email);
    await page.getByLabel('Role', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(
      page.getByRole('button', { name: `Remove ${email}` }),
    ).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: '/tmp/site-invitation-design.png' });
  expect(await page.getByRole('dialog').boundingBox()).toMatchObject({
    x: 506,
    y: 212,
    width: 500,
    height: 558,
  });
  await expect(
    page.getByRole('heading', { name: 'Invite team members' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create site' }),
  ).toBeDisabled();
  await page.screenshot({ path: '/tmp/site-invitation-design.png' });
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 600 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
