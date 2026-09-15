/** @spec site-cover-image-display REQ-004..REQ-006 */
import { expect, it, vi } from 'vitest';
import {
  loadSiteCoverImage,
  DashboardAuthenticationRequiredError,
} from '../api.js';
it('uses configured API origin, credentials, cancellation, and no-store', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response('png', { headers: { 'Content-Type': 'image/png' } }),
    );
  const result = await loadSiteCoverImage(
    'site',
    '/base',
    new AbortController().signal,
    fetcher,
  );
  expect(result.type).toBe('image/png');
  expect(fetcher).toHaveBeenCalledWith(
    '/base/api/sites/site/cover-image',
    expect.objectContaining({
      credentials: 'include',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }),
  );
});
it('rejects expired sessions, missing covers, and unexpected content', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response('html'));
  const load = () =>
    loadSiteCoverImage('site', '', new AbortController().signal, fetcher);
  await expect(load()).rejects.toBeInstanceOf(
    DashboardAuthenticationRequiredError,
  );
  await expect(load()).rejects.toThrow('cover_image_load_failed');
  await expect(load()).rejects.toThrow('invalid_cover_image');
});
