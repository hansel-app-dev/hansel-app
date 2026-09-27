import { expect, test } from '@playwright/test';
test('sign-comments retries attachment verification and preserves failed submission', async ({
  page,
}) => {
  const viewer = {
    id: '779491f7-bf74-45dd-8478-a184ff96bb17',
    name: 'John Smith',
    initials: 'JS',
  };
  const file = {
    id: '779491f7-bf74-45dd-8478-a184ff96bb18',
    filename: 'Specification.pdf',
    mediaType: 'application/pdf',
    byteSize: 8,
    createdAt: new Date().toISOString(),
  };
  let verified = false,
    posted = false;
  await page.route('**/test-comment-upload', (route) =>
    route.fulfill({ status: 200 }),
  );
  await page.route('**/api/sites/site/signs/sign/comments**', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.pathname.endsWith('/attachments'))
      return route.fulfill({
        json: {
          id: file.id,
          completed: false,
          uploadUrl: `${url.origin}/test-comment-upload`,
          headers: {},
        },
      });
    if (url.pathname.endsWith(file.id)) {
      if (!verified) {
        verified = true;
        return route.fulfill({ status: 503, json: { error: 'temporary' } });
      }
      return route.fulfill({ json: file });
    }
    if (request.method() === 'POST') {
      if (!posted) {
        posted = true;
        return route.fulfill({ status: 503, json: { error: 'temporary' } });
      }
      const body = request.postDataJSON() as {
        body: string;
        parentId: string | null;
        mentions: unknown[];
        attachmentIds: string[];
      };
      expect(body.attachmentIds).toEqual([file.id]);
      return route.fulfill({
        json: {
          id: '779491f7-bf74-45dd-8478-a184ff96bb19',
          body: body.body,
          parentId: body.parentId,
          mentions: body.mentions,
          author: viewer,
          createdAt: new Date().toISOString(),
          attachments: [file],
          reactions: [],
        },
      });
    }
    return route.fulfill({ json: { comments: [], viewer, nextCursor: null } });
  });
  await page.goto(
    '/iframe.html?id=sites-sign-comments--network&viewMode=story',
  );
  await expect(page.getByText('There are no comments yet.')).toBeVisible();
  await page.getByLabel('Comment attachments').setInputFiles({
    name: file.filename,
    mimeType: file.mediaType,
    buffer: Buffer.from('%PDF-1.7'),
  });
  await page.getByRole('button', { name: 'Retry upload' }).click();
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('couldn’t submit');
  await expect(page.getByText('Ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('article')).toContainText(file.filename);
});
test('sign-comments composer matches collapsed and expanded design', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto('/iframe.html?id=sites-sign-comments--empty&viewMode=story');
  await expect(page.getByText('There are no comments yet.')).toBeVisible();
  const input = page.getByLabel('Write a comment');
  expect(await input.locator('..').boundingBox()).toMatchObject({
    x: 1226,
    y: 870,
    width: 262,
    height: 56,
  });
  await input.click();
  expect(await input.locator('..').boundingBox()).toMatchObject({
    x: 1226,
    y: 798,
    width: 262,
    height: 128,
  });
  await input.fill('Please move this sign.');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('article')).toContainText(
    'Please move this sign.',
  );
  await expect(input).toHaveValue('');
});
test('sign-comments replies, selected mentions and reactions', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-sign-comments--threaded&viewMode=story',
  );
  await expect(page.getByRole('article')).toHaveCount(2);
  await page.getByRole('button', { name: 'Reply', exact: true }).last().click();
  const input = page.getByLabel('Write a comment');
  await input.fill('@Nic');
  await page.getByRole('option', { name: 'Nicola James' }).click();
  await input.press('End');
  await input.pressSequentially('Thanks!');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByLabel('React to comment by Nicola James').click();
  await page.getByRole('button', { name: '👍', exact: true }).click();
  await expect(page.getByLabel('👍 reaction, 1')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('👍 reaction, 1').click();
  await expect(page.getByLabel('👍 reaction, 1')).toHaveCount(0);
});
