import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
test('sign-documents REQ-004..006: multiple browser uploads, completion retry and download', async ({
  page,
}) => {
  const documents: {
    id: string;
    filename: string;
    mediaType: string;
    byteSize: number;
    createdAt: string;
  }[] = [];
  const intents = new Map<string, (typeof documents)[number]>();
  let failCompletion = true;
  await page.route(
    /\/api\/sites\/site\/signs\/sign\/documents(?:\/.*)?$/,
    async (route) => {
      const req = route.request();
      const parts = new URL(req.url()).pathname.split('/');
      const id = parts[7];
      if (req.method() === 'GET' && parts.at(-1) === 'download')
        return route.fulfill({
          contentType: 'application/pdf',
          body: '%PDF-1.7',
        });
      if (req.method() === 'GET')
        return route.fulfill({ json: { documents, nextCursor: null } });
      if (!id) {
        const input = req.postDataJSON() as {
          filename: string;
          mediaType: string;
          byteSize: number;
        };
        const document = {
          filename: input.filename,
          mediaType: input.mediaType,
          byteSize: input.byteSize,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        };
        intents.set(document.id, document);
        return route.fulfill({
          json: {
            id: document.id,
            completed: false,
            uploadUrl: new URL(`/upload/${document.id}`, req.url()).href,
            headers: {},
          },
        });
      }
      if (failCompletion) {
        failCompletion = false;
        return route.fulfill({ status: 503, json: {} });
      }
      const document = intents.get(id);
      if (!document) throw new Error('missing intent');
      if (!documents.some((row) => row.id === id)) documents.push(document);
      return route.fulfill({ json: document });
    },
  );
  let transfers = 0;
  await page.route('**/upload/*', async (route) => {
    transfers++;
    await route.fulfill({ status: 200 });
  });
  await page.goto(
    '/iframe.html?id=sites-sign-documents--network&viewMode=story',
  );
  await page.getByLabel('Upload documents').setInputFiles([
    {
      name: 'one.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7'),
    },
    {
      name: 'two.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7'),
    },
  ]);
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Retry / })).toBeVisible();
  await page.getByRole('button', { name: /^Retry / }).click();
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(2);
  expect(transfers).toBe(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download one.pdf' }).click();
  expect((await download).suggestedFilename()).toBe('one.pdf');
  await page.reload();
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(2);
});
test('sign-documents REQ-002,003: reference drawer geometry and deferred controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.goto(
    '/iframe.html?id=sites-sign-documents--populated&viewMode=story',
  );
  const panel = page.getByRole('tabpanel');
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(3);
  expect((await panel.boundingBox())?.width).toBe(349);
  const browse = await page
    .getByRole('button', { name: 'Browse local files' })
    .boundingBox();
  expect(browse?.width).toBe(254);
  await expect(
    page.getByRole('button', { name: 'Library files' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: /Download/ })
    .first()
    .hover();
  await expect(
    page.getByRole('button', { name: 'Document options unavailable' }).first(),
  ).toHaveCSS('opacity', '1');
  expect(
    (await new AxeBuilder({ page }).include('[role="tabpanel"]').analyze())
      .violations,
  ).toEqual([]);
});
test('sign-documents REQ-003,006: list scrolls independently and viewer cannot upload', async ({
  page,
}) => {
  await page.goto(
    '/iframe.html?id=sites-sign-documents--long-list&viewMode=story',
  );
  const browse = page.getByRole('button', { name: 'Browse local files' });
  const before = await browse.boundingBox();
  await page
    .getByRole('button', { name: /Download/ })
    .last()
    .scrollIntoViewIfNeeded();
  expect(await browse.boundingBox()).toEqual(before);
  await page.goto(
    '/iframe.html?id=sites-sign-documents--read-only&viewMode=story',
  );
  await expect(browse).toBeDisabled();
  await expect(
    page.getByRole('button', { name: /Download/ }).first(),
  ).toBeEnabled();
});
