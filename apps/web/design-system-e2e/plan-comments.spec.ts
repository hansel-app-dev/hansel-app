/** @spec allocation-plan-comments REQ-002..012 */
import { test, expect } from '@playwright/test';
test('Viewer creates, replies, resolves, views and reopens a plan thread', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-plan-comments--viewer&viewMode=story');
  await expect(
    page.getByRole('dialog', { name: 'Comment', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close comment' }).click();
  await expect(page.getByRole('button', { name: 'Add sign' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add comment' }).click();
  await page.getByLabel('Plan drawing', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Write a comment' });
  await expect(page.getByRole('button', { name: 'Submit' })).toBeDisabled();
  await input.fill('Check this location.');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(
    page.getByRole('button', { name: 'Move', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByText('Check this location.', { exact: true }),
  ).toBeVisible();
  await input.fill('Confirmed.');
  await input.press('Control+Enter');
  await expect(page.getByText('Confirmed.', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/hansel-plan-comments-desktop.png' });
  await page.getByRole('button', { name: 'Resolve thread' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Show resolved' }).check();
  await page
    .getByRole('button', { name: /Resolved comment by Jordan.*Check this/ })
    .click();
  await expect(input).toHaveCount(0);
  await page.getByRole('button', { name: 'Reopen thread' }).click();
  await expect(input).toBeVisible();
});
test('Draft guards, mention and emoji insertions, narrow and zoomed layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(
    '/iframe.html?id=sites-plan-comments--empty-composer&viewMode=story',
  );
  const card = page.getByRole('dialog');
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  if (!box) throw new Error('Missing comment card');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Mention a person' }).click();
  await page.getByRole('option', { name: /Jordan Smith/ }).click();
  await page.getByRole('button', { name: 'Insert emoji' }).click();
  await page.getByRole('button', { name: '👍', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue('@Jordan Smith 👍');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Close comment' }).click();
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('@Jordan Smith', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close comment' }).click();
  await page.getByRole('button', { name: 'Increase plan zoom' }).click();
  await page
    .getByRole('button', { name: /Comment by Jordan.*Please check/ })
    .click();
  await expect(card).toBeVisible();
  await page.screenshot({ path: '/tmp/hansel-plan-comments-narrow.png' });
});
