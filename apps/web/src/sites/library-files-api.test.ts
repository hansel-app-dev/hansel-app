/** @spec library-files REQ-003..008 */
import { afterEach, expect, it, vi } from 'vitest';
import { createLibraryFilesApi } from './library-files-api.js';
import { createSignDocumentsApi } from './sign-documents-api.js';
import { createSignPhotosApi } from './sign-photos-api.js';
import { DashboardAuthenticationRequiredError } from '../api.js';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const id = '00000000-0000-4000-8000-000000000001',
  file = {
    id,
    filename: 'file.pdf',
    mediaType: 'application/pdf',
    byteSize: 42,
    createdAt: '2026-09-27T00:00:00Z',
  };
it('library-files clients validate lists and link/plan responses, download and revoke blobs', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL = vi.fn().mockReturnValue('blob:file');
      static override revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    () => undefined,
  );
  const api = createLibraryFilesApi('https://hansel.test');
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ files: [], nextCursor: null })),
  );
  await api.list({ q: 'Floor', kind: 'all' });
  fetch.mockResolvedValueOnce(
    new Response(JSON.stringify({ files: [], nextCursor: null })),
  );
  await api.list({ q: '', kind: 'image', cursor: id });
  expect(fetch.mock.calls[1]?.[0]).toContain(`cursor=${id}`);
  fetch.mockResolvedValueOnce(new Response('file'));
  await api.download(id, file.filename);
  vi.runAllTimers();
  expect(vi.mocked(URL).revokeObjectURL).toHaveBeenCalledWith('blob:file');
  fetch.mockResolvedValueOnce(new Response('image'));
  expect(await api.thumbnail(id)).toBeInstanceOf(Blob);
  for (const kind of ['documents', 'photos'] as const) {
    fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              ...file,
              ...(kind === 'photos' ? { mediaType: 'image/png' } : {}),
            },
          ],
        }),
      ),
    );
    const result = await api.link(id, id, kind, {
      fileIds: [id],
      idempotencyKey: id,
    });
    expect(result.items).toHaveLength(1);
  }
  fetch.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        plan: {
          id,
          name: 'Plan',
          files: [
            {
              id: file.id,
              filename: file.filename,
              mediaType: file.mediaType,
              byteSize: file.byteSize,
            },
          ],
          createdAt: file.createdAt,
          modifiedAt: file.createdAt,
          uploadedBy: 'Member',
        },
      }),
    ),
  );
  await api.createPlan(id, { fileId: id, idempotencyKey: id, name: 'Plan' });
  for (const factory of [createSignDocumentsApi, createSignPhotosApi]) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));
    await factory(id, 'https://hansel.test').library.link(id, {
      fileIds: [id],
      idempotencyKey: id,
    });
  }
  fetch.mockResolvedValueOnce(new Response('{}', { status: 503 }));
  await expect(api.list({ q: '', kind: 'all' })).rejects.toThrow('unavailable');
  const expired = vi.fn();
  fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));
  await expect(
    createLibraryFilesApi('', expired).list({ q: '', kind: 'all' }),
  ).rejects.toBeInstanceOf(DashboardAuthenticationRequiredError);
  expect(expired).toHaveBeenCalledOnce();
  fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));
  await expect(api.list({ q: '', kind: 'all' })).rejects.toBeInstanceOf(
    DashboardAuthenticationRequiredError,
  );
});
