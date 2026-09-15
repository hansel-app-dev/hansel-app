import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('sign-photos REQ-004..006: multiple browser uploads, completion retry and download', async ({
  page,
}) => {
  const photos: {
    id: string;
    filename: string;
    mediaType: string;
    byteSize: number;
    createdAt: string;
  }[] = [];
  const intents = new Map<string, (typeof photos)[number]>();
  let failCompletion = true;
  let failDelete = true;
  await page.route(
    /\/api\/sites\/site\/signs\/sign\/photos(?:\/.*)?$/,
    async (route) => {
      const req = route.request();
      const parts = new URL(req.url()).pathname.split('/');
      const id = parts[7];
      if (req.method() === 'DELETE') {
        if (failDelete) {
          failDelete = false;
          return route.fulfill({ status: 503, json: {} });
        }
        const index = photos.findIndex((row) => row.id === id);
        if (index >= 0) photos.splice(index, 1);
        return route.fulfill({ json: { deleted: true } });
      }
      if (req.method() === 'GET' && parts.at(-1) === 'thumbnail')
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>',
        });
      if (req.method() === 'GET' && parts.at(-1) === 'download')
        return route.fulfill({
          contentType: 'image/png',
          body: 'image',
        });
      if (req.method() === 'GET')
        return route.fulfill({ json: { photos, nextCursor: null } });
      if (!id) {
        const input = req.postDataJSON() as {
          filename: string;
          mediaType: string;
          byteSize: number;
        };
        const photo = {
          filename: input.filename,
          mediaType: input.mediaType,
          byteSize: input.byteSize,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
        };
        intents.set(photo.id, photo);
        return route.fulfill({
          json: {
            id: photo.id,
            completed: false,
            uploadUrl: new URL(`/upload/${photo.id}`, req.url()).href,
            headers: {},
          },
        });
      }
      if (failCompletion) {
        failCompletion = false;
        return route.fulfill({ status: 503, json: {} });
      }
      const photo = intents.get(id);
      if (!photo) throw new Error('missing intent');
      if (!photos.some((row) => row.id === id)) photos.push(photo);
      return route.fulfill({ json: photo });
    },
  );
  let transfers = 0;
  await page.route('**/upload/*', async (route) => {
    transfers++;
    await route.fulfill({ status: 200 });
  });
  await page.goto('/iframe.html?id=sites-sign-photos--network&viewMode=story');
  await page.getByLabel('Upload photos').setInputFiles([
    {
      name: 'one.png',
      mimeType: 'image/png',
      buffer: Buffer.from('image'),
    },
    {
      name: 'two.png',
      mimeType: 'image/png',
      buffer: Buffer.from('image'),
    },
  ]);
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Retry / })).toBeVisible();
  await page.getByRole('button', { name: /^Retry / }).click();
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(2);
  expect(transfers).toBe(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download one.png' }).click();
  expect((await download).suggestedFilename()).toBe('one.png');
  await page.getByRole('button', { name: 'Delete one.png' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('couldn’t delete');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('button', { name: /Download/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete two.png' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Add sign’s photos')).toBeVisible();
});
