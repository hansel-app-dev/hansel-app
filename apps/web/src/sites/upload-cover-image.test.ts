import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { uploadSiteCoverImage } from './upload-cover-image.js';

afterEach(() => vi.unstubAllGlobals());
const siteId = 'a8245345-f2f1-459b-a15d-04ddbdcb7230';
const uploadId = 'ead4e617-cdfe-4d8b-bb93-e54fb5e6f680';
function image() {
  vi.stubGlobal('crypto', webcrypto);
  const file = new File(['png'], 'cover.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new TextEncoder().encode('png').buffer),
  });
  return file;
}
it('starts an authenticated upload and sends the selected bytes before completing', async () => {
  const file = image();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ uploadId }, { status: 201 }))
    .mockResolvedValueOnce(
      Response.json({ destination: `/sites/${siteId}/activity` }),
    );
  await uploadSiteCoverImage(siteId, file, '', fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
    credentials: 'include',
    method: 'POST',
  });
  expect(fetcher.mock.calls[1]).toEqual([
    `/api/sites/${siteId}/cover-image-uploads/${uploadId}/finalize`,
    expect.objectContaining({
      body: file,
      headers: { 'Content-Type': 'image/png' },
      credentials: 'include',
    }),
  ]);
});
it('keeps the idempotency key when retrying a failed finalization', async () => {
  const file = image();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ uploadId }))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ uploadId }))
    .mockResolvedValueOnce(
      Response.json({ destination: `/sites/${siteId}/activity` }),
    );
  await expect(
    uploadSiteCoverImage(siteId, file, '', fetcher),
  ).rejects.toThrow();
  await uploadSiteCoverImage(siteId, file, '', fetcher);
  expect(fetcher.mock.calls[0]?.[1]?.body).toEqual(
    fetcher.mock.calls[2]?.[1]?.body,
  );
});
it('does not upload bytes when authorization fails', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({}, { status: 401 }));
  await expect(
    uploadSiteCoverImage(siteId, image(), '', fetcher),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
});
