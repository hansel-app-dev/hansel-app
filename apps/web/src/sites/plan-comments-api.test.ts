/** @spec allocation-plan-comments REQ-001,005..010 */
import { afterEach, expect, it, vi } from 'vitest';
import { createPlanCommentsApi } from './plan-comments-api.js';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('REQ-001,005..010: client scopes every operation to plan/file, validates results and keeps uploads private', async () => {
  const id = '00000000-0000-4000-8000-000000000001',
    now = new Date().toISOString(),
    viewer = { id, name: 'Viewer', initials: 'V' };
  const thread = {
    id,
    fileId: null,
    x: 0.5,
    y: 0.5,
    author: viewer,
    preview: 'Text',
    resolved: false,
    resolvedAt: null,
    resolvedById: null,
    createdAt: now,
    updatedAt: now,
  };
  const comment = {
    id,
    parentId: null,
    body: 'Text',
    author: viewer,
    createdAt: now,
    mentions: [],
    attachments: [],
    reactions: [],
  };
  const file = {
    id,
    filename: 'test.pdf',
    mediaType: 'application/pdf',
    byteSize: 1,
    createdAt: now,
  };
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const api = createPlanCommentsApi(id, id, 'http://localhost:3000');
  const respond = (body: unknown) =>
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 200 }),
    );
  respond({ threads: [thread], viewer, nextCursor: null });
  await api.markers(null);
  expect(fetcher).toHaveBeenLastCalledWith(
    expect.stringContaining(`/files/legacy/comments?`),
    expect.objectContaining({ credentials: 'include' }),
  );
  expect(String(fetcher.mock.calls.at(-1)?.[0])).not.toContain('resolved=');
  respond({ threads: [thread], viewer, nextCursor: null });
  await api.markers(id, { id, createdAt: now });
  // @spec allocation-plan-comments-always-visible REQ-003
  expect(String(fetcher.mock.calls.at(-1)?.[0])).not.toContain('resolved=');
  expect(String(fetcher.mock.calls.at(-1)?.[0])).toContain('cursor=');
  respond({ thread, comments: [comment], viewer, nextCursor: null });
  await api.history(id, id, { id, createdAt: now });
  respond({ thread, comments: [comment], viewer, nextCursor: null });
  await api.history(null, id);
  respond({ thread, comment });
  await api.submit(null, {
    idempotencyKey: id,
    body: 'Text',
    mentions: [],
    attachmentIds: [],
    threadId: null,
    x: 0.5,
    y: 0.5,
  });
  expect(fetcher).toHaveBeenLastCalledWith(
    expect.stringContaining('/comments'),
    expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }),
  );
  respond(thread);
  await api.state(null, id, true, now);
  // @spec allocation-plan-comment-moving REQ-005,008
  respond({ ...thread, x: 0.2, y: 0.3 });
  expect(await api.position(null, id, 0.2, 0.3, now)).toMatchObject({
    x: 0.2,
    y: 0.3,
  });
  expect(fetcher).toHaveBeenLastCalledWith(
    expect.stringContaining(`/files/legacy/comments/${id}/position`),
    expect.objectContaining({
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ x: 0.2, y: 0.3, expectedUpdatedAt: now }),
    }),
  );
  respond({});
  await expect(api.position(id, id, 0.2, 0.3, now)).rejects.toThrow();
  respond({ people: [viewer], nextCursor: null });
  await api.people(null, 'View');
  respond({ people: [viewer], nextCursor: null });
  await api.people(null, 'View', id);
  respond({ id, completed: true });
  await api.initiate(null, {
    idempotencyKey: id,
    filename: 'test.pdf',
    mediaType: 'application/pdf',
    byteSize: 1,
    checksumSha256: 'a'.repeat(43) + '=',
  });
  respond(file);
  await api.complete(null, id);
  respond({ discarded: true });
  await api.discard(null, id);
  fetcher.mockResolvedValueOnce(new Response('image'));
  expect(await api.thumbnail(null, id)).toBeInstanceOf(Blob);
  vi.useFakeTimers();
  const revoke = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL = vi.fn().mockReturnValue('blob:test');
      static override revokeObjectURL = revoke;
    },
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  fetcher.mockResolvedValueOnce(new Response('file'));
  await api.download(null, id, 'test.pdf');
  expect(click).toHaveBeenCalled();
  vi.advanceTimersByTime(60000);
  expect(revoke).toHaveBeenCalledWith('blob:test');
  for (const body of [
    JSON.stringify({ error: 'attachment_expired' }),
    'invalid',
    JSON.stringify({}),
  ]) {
    fetcher.mockResolvedValueOnce(new Response(body, { status: 422 }));
    await expect(api.markers(null)).rejects.toMatchObject({ status: 422 });
  }
});
