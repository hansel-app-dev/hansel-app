import { afterEach, expect, it, vi } from 'vitest';
import {
  createSignCommentsApi,
  CommentRequestError,
} from './sign-comments-api.js';
import {
  createSignDocumentsApi,
  transferDocument,
} from './sign-documents-api.js';
import { createSignPhotosApi } from './sign-photos-api.js';
import { createPlanSignsApi } from './plan-signs-api.js';
const id = '00000000-0000-4000-8000-000000000001';
const date = '2026-09-01T00:00:00Z';
const media = {
  id,
  filename: 'image.png',
  mediaType: 'image/png' as const,
  byteSize: 8,
  createdAt: date,
};
const upload = {
  idempotencyKey: id,
  filename: media.filename,
  mediaType: media.mediaType,
  byteSize: 8,
  checksumSha256: 'a'.repeat(43) + '=',
};
const comment = {
  id,
  parentId: null,
  body: 'Hello',
  author: { id, name: 'Ava', initials: 'A' },
  createdAt: date,
  mentions: [],
  attachments: [],
  reactions: [],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('sign-documents/sign-photos/sign-comments REQ-004..012: serializes credentialed requests and validates paginated responses', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const respond = (body: unknown) =>
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body)));
  const docs = createSignDocumentsApi(id, ''),
    photos = createSignPhotosApi(id, ''),
    comments = createSignCommentsApi(id, '');
  for (const [api, page] of [
    [docs, { documents: [media], nextCursor: null }],
    [photos, { photos: [media], nextCursor: null }],
  ] as const) {
    respond(page);
    await expect(api.list(id)).resolves.toEqual(page);
    respond(page);
    await api.list(id, id);
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining('?cursor=' + id),
      expect.objectContaining({ credentials: 'include' }),
    );
    respond({ id, completed: false });
    await api.initiate(id, upload);
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', body: JSON.stringify(upload) }),
    );
    respond(media);
    await expect(api.complete(id, id)).resolves.toEqual(media);
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(api.list(id)).rejects.toMatchObject({ status: 403 });
  }
  respond({ comments: [comment], nextCursor: null, viewer: comment.author });
  await comments.list(id);
  respond({ comments: [], nextCursor: null, viewer: comment.author });
  await comments.list(id, id, { id, createdAt: date });
  respond(comment);
  await comments.submit(id, {
    idempotencyKey: id,
    parentId: null,
    body: 'Hello',
    mentions: [],
    attachmentIds: [],
  });
  respond({ people: [], nextCursor: null });
  await comments.people(id, 'A');
  respond({ people: [], nextCursor: null });
  await comments.people(id, 'A', id);
  respond(comment);
  await comments.react(id, id, '👍', true);
  respond({ id, completed: true });
  await comments.initiate(id, upload);
  respond(media);
  await comments.complete(id, id);
  respond({});
  await comments.discard(id, id);
  fetcher.mockResolvedValueOnce(new Response('png'));
  expect(await comments.thumbnail(id, id)).toBeInstanceOf(Blob);
  fetcher.mockResolvedValueOnce(new Response('png'));
  await photos.thumbnail(id, id);
  respond({});
  await photos.remove(id, id);
  for (const body of [
    'not json',
    JSON.stringify({}),
    JSON.stringify({ error: 'not_allowed' }),
  ]) {
    fetcher.mockResolvedValueOnce(new Response(body, { status: 422 }));
    await expect(comments.list(id)).rejects.toEqual(
      new CommentRequestError(
        422,
        body.includes('not_allowed') ? 'not_allowed' : 'comment_request_failed',
      ),
    );
  }
});
it('sign-documents/sign-photos/sign-comments REQ-006: downloads files and releases temporary URLs', async () => {
  vi.useFakeTimers();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  const create = vi.fn().mockReturnValue('blob:download'),
    revoke = vi.fn();
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(new Response('file'))),
  );
  for (const api of [
    createSignDocumentsApi(id, ''),
    createSignPhotosApi(id, ''),
    createSignCommentsApi(id, ''),
  ])
    await api.download(id, id, 'download.png');
  expect(click).toHaveBeenCalledTimes(3);
  expect(revoke).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  expect(revoke).toHaveBeenCalledTimes(3);
});
it('allocation-plan-signs REQ-001,007,012: loads files and persists create, patch and delete bodies', async () => {
  const sign = {
    id,
    fileId: null,
    x: 0.2,
    y: 0.2,
    code: 'SG.001',
    content: '',
    mounting: 'Wall-mounted',
    function: 'Directional',
    colour: 'Red',
    orientation: 'left',
    updatedAt: date,
  };
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const api = createPlanSignsApi(id, id, '');
  const respond = (value: unknown) =>
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(value)));
  respond({ canManageSigns: true, signs: [sign] });
  await api.load(null);
  respond({ canManageSigns: true, signs: [sign] });
  await api.load(id);
  respond(sign);
  await api.create({ fileId: null, x: 0.2, y: 0.2, idempotencyKey: id });
  respond(sign);
  await api.update(id, { code: 'New', expectedUpdatedAt: date });
  respond({});
  await api.remove(id, date);
  expect(fetcher).toHaveBeenLastCalledWith(
    expect.stringContaining('/' + id),
    expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt: date }),
    }),
  );
  fetcher.mockResolvedValueOnce(new Response(null, { status: 409 }));
  await expect(api.load(null)).rejects.toMatchObject({ status: 409 });
});
it('sign-documents REQ-005: uploads with progress and terminates on HTTP, network, timeout or abort errors', async () => {
  class Xhr {
    static last: Xhr;
    status = 200;
    upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    constructor() {
      Xhr.last = this;
    }
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    abort = vi.fn(() => this.onabort?.());
    timeout = 0;
  }
  vi.stubGlobal('XMLHttpRequest', Xhr);
  const file = new File(['png'], 'file.png');
  const progress = vi.fn();
  const controller = new AbortController(),
    pending = transferDocument(
      'https://upload.example/',
      { 'content-type': 'image/png' },
      file,
      progress,
      controller.signal,
    );
  Xhr.last.upload.onprogress?.({
    lengthComputable: false,
    loaded: 1,
    total: 2,
  } as ProgressEvent);
  Xhr.last.upload.onprogress?.({
    lengthComputable: true,
    loaded: 1,
    total: 2,
  } as ProgressEvent);
  expect(progress).toHaveBeenCalledWith(50);
  Xhr.last.onload?.();
  await pending;
  for (const mode of [
    'http',
    'network',
    'timeout',
    'abort',
    'pre-aborted',
  ] as const) {
    const c = new AbortController();
    if (mode === 'pre-aborted') c.abort();
    const request = transferDocument(
      'https://upload.example/',
      {},
      file,
      progress,
      c.signal,
    );
    const assertion = expect(request).rejects.toThrow();
    if (mode === 'http') {
      Xhr.last.status = 400;
      Xhr.last.onload?.();
    } else if (mode === 'network') Xhr.last.onerror?.();
    else if (mode === 'timeout') Xhr.last.ontimeout?.();
    else if (mode === 'abort') c.abort();
    await assertion;
  }
});
