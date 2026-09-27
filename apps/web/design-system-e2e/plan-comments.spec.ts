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

/** @spec allocation-plan-comment-moving REQ-001..010 */
test('Viewer drags a saved pin with preview and preserves an unsent reply; keyboard move and cancellation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-plan-comments--viewer&viewMode=story');
  const pin = page.getByRole('button', {
    name: /Comment by Jordan.*Please check/,
  });
  const card = page.getByRole('dialog', { name: 'Comment', exact: true });
  await expect(card).toBeVisible();
  const input = page.getByRole('textbox');
  await input.fill('Keep unsent reply');
  const start = await pin.boundingBox(),
    startCard = await card.boundingBox();
  if (!start || !startCard) throw new Error('Missing pin/card');
  await page.mouse.move(start.x + 10, start.y + 10);
  await page.mouse.down();
  await page.mouse.move(start.x + 100, start.y + 60, { steps: 5 });
  const preview = await pin.boundingBox(),
    previewCard = await card.boundingBox();
  if (!preview || !previewCard) throw new Error('Missing preview');
  expect(preview.x).toBeCloseTo(start.x + 90, 0);
  expect(preview.y).toBeCloseTo(start.y + 50, 0);
  expect(previewCard.x).not.toBe(startCard.x);
  await page.mouse.up();
  await expect(input).toHaveValue('Keep unsent reply');
  await expect(
    page.getByText('Comment position saved.', { exact: true }),
  ).toBeAttached();
  await pin.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(
    page.getByText('Comment position saved.', { exact: true }),
  ).toBeAttached();
  await expect(pin).toBeFocused();
  const moved = await pin.boundingBox();
  if (!moved) throw new Error('Missing moved pin');
  expect(moved.x).toBeGreaterThan(preview.x);
  await page.mouse.move(moved.x + 10, moved.y + 10);
  await page.mouse.down();
  await page.mouse.move(moved.x + 80, moved.y + 60);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  const canceled = await pin.boundingBox();
  expect(canceled?.x).toBeCloseTo(moved.x, 0);
  await expect(input).toHaveValue('Keep unsent reply');
  await expect(page.getByRole('button', { name: 'Add sign' })).toBeDisabled();
  await page.screenshot({ path: '/tmp/hansel-comment-move-viewer.png' });
});
test('Temporary pin drag preserves text and final position on publication', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-plan-comments--empty-composer&viewMode=story',
  );
  const draft = page.getByRole('button', { name: 'New comment pin' }),
    input = page.getByRole('textbox');
  await expect(draft).toBeVisible();
  await input.fill('Moved draft');
  const box = await draft.boundingBox();
  if (!box) throw new Error('Missing draft');
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x - 55, box.y - 25, { steps: 5 });
  await page.mouse.up();
  await expect(input).toHaveValue('Moved draft');
  const moved = await draft.boundingBox();
  if (!moved) throw new Error('Missing moved draft');
  expect(moved.x).toBeCloseTo(box.x - 60, 0);
  await page.getByRole('button', { name: 'Submit' }).click();
  const saved = page.getByRole('button', {
    name: /Comment by Jordan.*Moved draft/,
  });
  await expect(saved).toBeVisible();
  const final = await saved.boundingBox();
  expect(final?.x).toBeCloseTo(moved.x, 0);
  expect(final?.y).toBeCloseTo(moved.y, 0);
  await expect(page.getByRole('button', { name: /Comment by/ })).toHaveCount(2);
});
test('Movement failure retries and conflict requires reload; resolved pin stays immovable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-plan-comments--move-failure&viewMode=story',
  );
  await page.getByRole('button', { name: 'Retry comment move' }).click();
  await expect(
    page.getByText('Comment position saved.', { exact: true }),
  ).toBeAttached();
  await page.goto(
    '/iframe.html?id=sites-plan-comments--move-conflict&viewMode=story',
  );
  await page.getByRole('button', { name: 'Reload comment' }).click();
  await expect(
    page.getByText('Comment reloaded.', { exact: true }),
  ).toBeAttached();
  await page.goto(
    '/iframe.html?id=sites-plan-comments--resolved&viewMode=story',
  );
  const pin = page.getByRole('button', { name: /Resolved comment by/ });
  await expect(pin).toBeVisible();
  const original = await pin.boundingBox();
  if (!original) throw new Error('Missing resolved pin');
  await pin.focus();
  await page.keyboard.press('Alt+ArrowRight');
  const after = await pin.boundingBox();
  expect(after?.x).toBe(original.x);
  await page.getByRole('button', { name: 'Reopen thread' }).click();
  const open = page.getByRole('button', { name: /Comment by Jordan/ });
  await open.focus();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(
    page.getByText('Comment position saved.', { exact: true }),
  ).toBeAttached();
});

test('REQ-003,006,009: zoomed scrolled coordinates and Hand/Space-pan stay independent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-plan-comments--zoomed&viewMode=story');
  const pin = page.getByRole('button', {
    name: /Comment by Jordan.*Please check/,
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close comment' }).click();
  const viewport = page.getByTestId('plan-pan-viewport');
  await viewport.evaluate((el) => {
    el.scrollLeft = 75;
    el.scrollTop = 40;
  });
  const layer = page.getByLabel('Plan comments', { exact: true });
  const bounds = await layer.boundingBox(),
    box = await pin.boundingBox();
  if (!bounds || !box) throw new Error('Missing zoomed drawing');
  const initial = await pin.evaluate((el) => ({
    x: parseFloat(el.style.left) / 100,
    y: parseFloat(el.style.top) / 100,
  }));
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 68, box.y + 38, { steps: 5 });
  await page.mouse.up();
  await expect(
    page.getByText('Comment position saved.', { exact: true }),
  ).toBeAttached();
  const moved = await pin.evaluate((el) => ({
    x: parseFloat(el.style.left) / 100,
    y: parseFloat(el.style.top) / 100,
  }));
  expect(moved.x).toBeCloseTo(initial.x + 60 / bounds.width, 3);
  expect(moved.y).toBeCloseTo(initial.y + 30 / bounds.height, 3);
  await page.getByRole('button', { name: 'Close comment' }).click();
  await page.getByRole('button', { name: 'Hand', exact: true }).click();
  await expect(pin).toBeDisabled();
  const handBox = await pin.boundingBox();
  if (!handBox) throw new Error('Missing pan target');
  await page.mouse.move(handBox.x + 8, handBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(handBox.x - 32, handBox.y - 12);
  await page.mouse.up();
  expect(await pin.evaluate((el) => parseFloat(el.style.left) / 100)).toBe(
    moved.x,
  );
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const current = await pin.boundingBox();
  if (!current) throw new Error('Missing pin');
  await page.mouse.move(current.x + 8, current.y + 8);
  await viewport.focus();
  await page.keyboard.down('Space');
  await expect(pin).toBeDisabled();
  await page.mouse.down();
  await page.mouse.move(current.x - 32, current.y - 12);
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(await pin.evaluate((el) => parseFloat(el.style.left) / 100)).toBe(
    moved.x,
  );
  await expect(page.getByRole('button', { name: /Comment by/ })).toHaveCount(1);
});
