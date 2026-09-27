import type * as documentApi from './sign-documents-api.js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { useCommentAttachments } from './use-comment-attachments.js';
import { usePhotoUploads } from './use-photo-uploads.js';
import { transferDocument } from './sign-documents-api.js';
import { CommentRequestError } from './sign-comments-api.js';
import { SignPhotoRequestError } from './sign-photos-api.js';
vi.mock('./sign-documents-api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof documentApi>()),
  transferDocument: vi
    .fn()
    .mockImplementation(
      (_url, _headers, _file, progress: (n: number) => void) => {
        progress(50);
        return Promise.resolve();
      },
    ),
}));
const id = '00000000-0000-4000-8000-000000000001';
const media = {
  id,
  filename: 'file.png',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: '2026-09-01T00:00:00Z',
};
const file = (name = 'file.png', type = 'image/png', body = 'png') => {
  const f = new File([body], name, { type });
  Object.assign(f, {
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
  });
  return f;
};
function setup() {
  vi.stubGlobal('crypto', webcrypto);
  return {
    initiate: vi.fn().mockResolvedValue({
      id,
      completed: false,
      uploadUrl: 'https://uploads.example/file',
      headers: {},
    }),
    complete: vi.fn().mockResolvedValue(media),
    discard: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(),
    submit: vi.fn(),
    people: vi.fn(),
    react: vi.fn(),
    thumbnail: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(transferDocument).mockClear();
});
it('sign-comments REQ-007,011: caps attachments, validates files, completes uploads and discards removed drafts', async () => {
  const api = setup(),
    view = renderHook(() => useCommentAttachments(api, id));
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(view.result.current.items[0]?.state).toBe('complete');
  });
  expect(api.complete).toHaveBeenCalledWith(id, id);
  expect(view.result.current.items[0]?.progress).toBe(50);
  act(() => {
    view.result.current.remove('unknown');
  });
  act(() => {
    view.result.current.remove(required(view.result.current.items[0]).key);
  });
  expect(api.discard).toHaveBeenCalledWith(id, id);
  act(() => {
    view.result.current.add(
      Array.from({ length: 6 }, () => file('bad.txt', 'text/plain')),
    );
  });
  expect(view.result.current.error).toContain('five');
  expect(view.result.current.items).toHaveLength(5);
  act(() => {
    view.result.current.retry('unknown');
  });
  act(() => {
    view.result.current.retry(required(view.result.current.items[0]).key);
  });
  expect(api.initiate).toHaveBeenCalledTimes(1);
  act(() => {
    view.result.current.committed();
  });
  expect(view.result.current.items).toHaveLength(0);
  api.initiate.mockResolvedValueOnce({ id, completed: true });
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(view.result.current.busy).toBe(false);
  });
  view.unmount();
  expect(api.discard).toHaveBeenCalledTimes(2);
});
it('sign-comments REQ-007,011: retries transfers with the same intent and regenerates rejected intents', async () => {
  const api = setup(),
    view = renderHook(() => useCommentAttachments(api, id));
  api.complete.mockRejectedValueOnce(new Error('offline'));
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(view.result.current.items[0]?.state).toBe('error');
  });
  const key = required(view.result.current.items[0]).key;
  act(() => {
    view.result.current.retry(key);
  });
  await waitFor(() => {
    expect(view.result.current.items[0]?.state).toBe('complete');
  });
  expect(api.initiate).toHaveBeenCalledOnce();
  act(() => {
    view.result.current.committed();
  });
  api.complete.mockRejectedValueOnce(
    new CommentRequestError(422, 'invalid_attachment'),
  );
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(view.result.current.items[0]?.state).toBe('error');
  });
  expect(view.result.current.items[0]?.error).toContain('Invalid');
  act(() => {
    view.result.current.retry(required(view.result.current.items[0]).key);
  });
  await waitFor(() => {
    expect(view.result.current.items[0]?.state).toBe('complete');
  });
  act(() => {
    view.result.current.committed();
  });
  api.initiate.mockResolvedValueOnce({ id, completed: false });
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(view.result.current.items[0]?.state).toBe('error');
  });
  expect(view.result.current.items[0]?.error).toContain('failed');
});
it('sign-comments REQ-007: ignores removal during intent/completion and uses expiry if draft discard fails', async () => {
  const api = setup();
  api.discard.mockRejectedValue(new Error('offline'));
  let resolveIntent: (value: { id: string; completed: boolean }) => void = () =>
    undefined;
  api.initiate.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveIntent = resolve;
    }),
  );
  const view = renderHook(() => useCommentAttachments(api, id));
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalledOnce();
  });
  act(() => {
    view.result.current.remove(required(view.result.current.items[0]).key);
  });
  await act(() => {
    resolveIntent({ id, completed: true });
    return Promise.resolve();
  });
  expect(api.discard).toHaveBeenCalled();
  expect(api.complete).not.toHaveBeenCalled();
  let complete: (value: typeof media) => void = () => undefined;
  api.complete.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  act(() => {
    view.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(api.complete).toHaveBeenCalledOnce();
  });
  act(() => {
    view.result.current.remove(required(view.result.current.items[0]).key);
  });
  await act(() => {
    complete(media);
    return Promise.resolve();
  });
  expect(view.result.current.items).toHaveLength(0);
  let resolveBytes: (value: ArrayBuffer) => void = () => undefined;
  const pending = file();
  Object.assign(pending, {
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((resolve) => {
        resolveBytes = resolve;
      }),
  });
  act(() => {
    view.result.current.add([pending]);
  });
  view.unmount();
  await act(() => {
    resolveBytes(new ArrayBuffer(3));
    return Promise.resolve();
  });
});
it('sign-photos REQ-007: deduplicates queued files, guards unload and retries transient or expired uploads', async () => {
  const api = setup(),
    complete = vi.fn(),
    view = renderHook(() => usePhotoUploads(api, id, complete));
  const f = file();
  api.complete.mockRejectedValueOnce(new Error('offline'));
  act(() => {
    view.result.current.add([f, f, file('bad', 'text/plain')]);
  });
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await waitFor(() => {
    expect(view.result.current.busy).toBe(false);
  });
  expect(api.initiate).toHaveBeenCalledOnce();
  act(() => {
    view.result.current.retry('unknown');
  });
  act(() => {
    view.result.current.retry(required(view.result.current.uploads[0]).key);
  });
  await waitFor(() => {
    expect(complete).toHaveBeenCalledOnce();
  });
  expect(api.initiate).toHaveBeenCalledOnce();
  const idle = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(idle);
  expect(idle.defaultPrevented).toBe(false);
  api.complete.mockRejectedValueOnce(new SignPhotoRequestError(422));
  act(() => {
    view.result.current.add([file('other.png')]);
  });
  await waitFor(() => {
    expect(
      view.result.current.uploads.some((row) => row.error?.includes('expired')),
    ).toBe(true);
  });
  const expired = required(
    view.result.current.uploads.find((row) => row.file.name === 'other.png'),
  );
  act(() => {
    view.result.current.retry(expired.key);
  });
  await waitFor(() => {
    expect(complete).toHaveBeenCalledTimes(2);
  });
  api.initiate.mockResolvedValueOnce({ id, completed: true });
  act(() => {
    view.result.current.add([file('replay.png')]);
  });
  await waitFor(() => {
    expect(complete).toHaveBeenCalledTimes(3);
  });
  api.initiate.mockResolvedValueOnce({ id, completed: false });
  act(() => {
    view.result.current.add([file('malformed.png')]);
  });
  await waitFor(() => {
    expect(view.result.current.busy).toBe(false);
  });
});
it('sign-photos REQ-007: suppresses obsolete results at each asynchronous boundary', async () => {
  for (const stage of ['checksum', 'complete'] as const) {
    const api = setup(),
      callback = vi.fn();
    let settle: () => void = () => undefined;
    const f = file();
    if (stage === 'checksum')
      Object.assign(f, {
        arrayBuffer: () =>
          new Promise<ArrayBuffer>((resolve) => {
            settle = () => {
              resolve(new ArrayBuffer(3));
            };
          }),
      });
    else
      api.complete.mockReturnValueOnce(
        new Promise((resolve) => {
          settle = () => {
            resolve(media);
          };
        }),
      );
    const view = renderHook(() => usePhotoUploads(api, id, callback));
    act(() => {
      view.result.current.add([f]);
    });
    if (stage === 'complete')
      await waitFor(() => {
        expect(api.complete).toHaveBeenCalled();
      });
    view.unmount();
    await act(() => {
      settle();
      return Promise.resolve();
    });
    expect(callback).not.toHaveBeenCalled();
  }
});

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected fixture value');
  return value;
}

it('does not finalize an upload replay lacking its attachment identity', async () => {
  const api = setup();
  api.initiate.mockResolvedValue({ completed: true });
  const attachments = renderHook(() => useCommentAttachments(api, id));
  act(() => {
    attachments.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalled();
  });
  await act(() => Promise.resolve());
  expect(api.complete).not.toHaveBeenCalled();
  attachments.unmount();
  api.initiate.mockClear();
  const photos = renderHook(() => usePhotoUploads(api, id, vi.fn()));
  act(() => {
    photos.result.current.add([file()]);
  });
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalled();
  });
  await act(() => Promise.resolve());
  expect(api.complete).not.toHaveBeenCalled();
});
