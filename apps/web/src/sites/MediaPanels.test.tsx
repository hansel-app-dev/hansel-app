import type * as documentApi from './sign-documents-api.js';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { SignDocuments } from './SignDocuments.js';
import { SignPhotos } from './SignPhotos.js';
import {
  transferDocument,
  SignDocumentRequestError,
} from './sign-documents-api.js';
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
const id = '00000000-0000-4000-8000-000000000001',
  other = '00000000-0000-4000-8000-000000000002';
const media = {
  id,
  filename: 'file.png',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: '2026-09-01T00:00:00Z',
};
function setup() {
  vi.stubGlobal('crypto', webcrypto);
  Object.assign(URL, {
    createObjectURL: vi.fn().mockReturnValue('blob:photo'),
    revokeObjectURL: vi.fn(),
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  return {
    list: vi.fn(),
    initiate: vi.fn().mockResolvedValue({
      id,
      completed: false,
      uploadUrl: 'https://upload.example/',
      headers: {},
    }),
    complete: vi.fn().mockResolvedValue(media),
    download: vi.fn().mockResolvedValue(undefined),
    thumbnail: vi.fn().mockResolvedValue(new Blob()),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}
function file(name = 'file.png') {
  const value = new File(['png'], name, { type: 'image/png' });
  Object.assign(value, {
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode('png').buffer),
  });
  return value;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(transferDocument).mockReset();
  vi.mocked(transferDocument).mockImplementation(
    (_url, _headers, _file, progress) => {
      progress(50);
      return Promise.resolve();
    },
  );
});
it('sign-documents REQ-004..008: retries reads, merges pages, uploads files and retries failures using the existing intent', async () => {
  const api = setup();
  api.list
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ documents: [media], nextCursor: id })
    .mockResolvedValue({ documents: [media], nextCursor: null });
  render(
    <SignDocuments api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });
  expect(screen.getAllByText('file.png')).toHaveLength(1);
  api.download.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Download file.png' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Download failed');
  const input = screen.getByLabelText('Upload documents');
  fireEvent.click(screen.getByRole('button', { name: 'Browse local files' }));
  api.complete.mockRejectedValueOnce(new Error('offline'));
  const f = file();
  fireEvent.change(input, { target: { files: [f, f] } });
  await screen.findByRole('button', { name: 'Retry file.png' });
  expect(api.initiate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Retry file.png' }));
  await waitFor(() => {
    expect(api.complete).toHaveBeenCalledTimes(2);
  });
  expect(api.initiate).toHaveBeenCalledOnce();
  api.complete.mockRejectedValueOnce(new SignDocumentRequestError(422));
  fireEvent.change(input, { target: { files: [file('expired.png')] } });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry expired.png' }),
  );
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalledTimes(3);
  });
  api.initiate.mockResolvedValueOnce({ id, completed: false });
  fireEvent.change(input, { target: { files: [file('malformed.png')] } });
  await screen.findByRole('button', { name: 'Retry malformed.png' });
  const drop = screen.getByText(
    'Drag your file(s) here to get started',
  ).parentElement;
  if (!drop) throw new Error('Missing drop target');
  fireEvent.dragOver(drop);
  fireEvent.dragLeave(drop);
  api.initiate.mockResolvedValueOnce({ id, completed: true });
  fireEvent.drop(drop, { dataTransfer: { files: [file('replayed.png')] } });
  await waitFor(() => {
    expect(api.complete).toHaveBeenCalledTimes(5);
  });
});
it('sign-documents REQ-004,005: bounds upload concurrency and suppresses stale asynchronous completions', async () => {
  const api = setup();
  api.list.mockResolvedValue({ documents: [], nextCursor: null });
  let settle: () => void = () => undefined;
  vi.mocked(transferDocument).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  const view = render(
    <SignDocuments api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await screen.findByText('No documents linked yet.');
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: { files: [file()] },
  });
  await waitFor(() => {
    expect(transferDocument).toHaveBeenCalled();
  });
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  view.unmount();
  await act(() => {
    settle();
    return Promise.resolve();
  });
  const readonly = render(
    <SignDocuments
      api={api}
      signId={id}
      canManage={false}
      onBusyChange={vi.fn()}
    />,
  );
  const drop = screen.getByText(
    'Drag your file(s) here to get started',
  ).parentElement;
  if (!drop) throw new Error('Missing drop target');
  fireEvent.drop(drop, { dataTransfer: { files: [file()] } });
  readonly.unmount();
});
it('sign-photos REQ-004..010: retries paginated reads and thumbnails, uploads images, downloads and confirms deletion', async () => {
  const api = setup();
  api.list
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ photos: [media], nextCursor: id })
    .mockResolvedValue({
      photos: [media, { ...media, id: other, filename: 'other.png' }],
      nextCursor: null,
    });
  api.thumbnail.mockRejectedValueOnce(new Error('offline'));
  const view = render(
    <SignPhotos api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry image' }));
  await screen.findByRole('img', { name: 'file.png' });
  fireEvent.error(screen.getByRole('img', { name: 'file.png' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry image' }));
  await screen.findByRole('img', { name: 'file.png' });
  fireEvent.click(screen.getByRole('button', { name: 'Grid view' }));
  fireEvent.click(screen.getByRole('button', { name: 'List view' }));
  api.download.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Download file.png' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Download failed');
  fireEvent.click(screen.getByRole('button', { name: 'Delete file.png' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete file.png' }));
  api.remove.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await screen.findByText('We couldn’t delete this photo. Please retry.');
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(screen.queryByText('file.png')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Browse local files' }));
  fireEvent.change(screen.getByLabelText('Upload photos'), {
    target: { files: [file()] },
  });
  await screen.findByText('file.png');
  view.unmount();
});

it('photos display upload progress, retry failed uploads, and support file drops', async () => {
  const api = setup();
  api.list.mockResolvedValue({ photos: [], nextCursor: null });
  let finish: () => void = () => undefined;
  vi.mocked(transferDocument).mockImplementationOnce(
    (_url, _headers, _file, progress) => {
      progress(25);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  );
  const view = render(
    <SignPhotos api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await waitFor(() => {
    expect(api.list).toHaveBeenCalled();
  });
  fireEvent.change(screen.getByLabelText('Upload photos'), {
    target: { files: [file()] },
  });
  await screen.findByRole('progressbar');
  await screen.findByText('Uploading… 25%');
  await act(() => {
    finish();
    return Promise.resolve();
  });
  await screen.findByText('file.png');
  api.complete.mockRejectedValueOnce(new Error('offline'));
  fireEvent.change(screen.getByLabelText('Upload photos'), {
    target: { files: [file('retry.png')] },
  });
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry retry.png' }),
  );
  await waitFor(() => {
    expect(api.complete).toHaveBeenCalledTimes(3);
  });
  const drop = screen.getByText(
    'Drag your file(s) here to get started',
  ).parentElement;
  if (!drop) throw new Error('Missing drop');
  fireEvent.dragOver(drop);
  fireEvent.dragLeave(drop);
  fireEvent.drop(drop, { dataTransfer: { files: [file('dropped.png')] } });
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalledTimes(3);
  });
  view.unmount();
  const readonly = render(
    <SignPhotos
      api={api}
      signId={id}
      canManage={false}
      onBusyChange={vi.fn()}
    />,
  );
  const readonlyDrop = screen.getByText(
    'Drag your file(s) here to get started',
  ).parentElement;
  if (!readonlyDrop) throw new Error('Missing drop');
  fireEvent.dragOver(readonlyDrop);
  fireEvent.drop(readonlyDrop, { dataTransfer: { files: [file()] } });
  readonly.unmount();
});

it('documents queue beyond three transfers and suppress verification after removal', async () => {
  const api = setup();
  api.list.mockResolvedValue({ documents: [], nextCursor: null });
  const finishers: (() => void)[] = [];
  vi.mocked(transferDocument).mockImplementation(
    () => new Promise((resolve) => finishers.push(resolve)),
  );
  const view = render(
    <SignDocuments api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await screen.findByText('No documents linked yet.');
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: { files: null },
  });
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: {
      files: [
        file('one.png'),
        file('two.png'),
        file('three.png'),
        file('four.png'),
      ],
    },
  });
  await screen.findByText('Queued');
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalledTimes(3);
  });
  view.unmount();
  await act(() => {
    finishers.forEach((resolve) => {
      resolve();
    });
    return Promise.resolve();
  });
  expect(api.complete).not.toHaveBeenCalled();
});

it('photos queue beyond three transfers and ignore their completion after unmount', async () => {
  const api = setup();
  api.list.mockResolvedValue({ photos: [], nextCursor: null });
  const finishers: (() => void)[] = [];
  vi.mocked(transferDocument).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishers.push(resolve);
      }),
  );
  const view = render(
    <SignPhotos api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await waitFor(() => {
    expect(api.list).toHaveBeenCalled();
  });
  fireEvent.change(screen.getByLabelText('Upload photos'), {
    target: { files: null },
  });
  fireEvent.change(screen.getByLabelText('Upload photos'), {
    target: {
      files: [
        file('one.png'),
        file('two.png'),
        file('three.png'),
        file('four.png'),
      ],
    },
  });
  await screen.findByText('Queued');
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalledTimes(3);
  });
  view.unmount();
  await act(() => {
    finishers.forEach((resolve) => {
      resolve();
    });
    return Promise.resolve();
  });
  expect(api.complete).not.toHaveBeenCalled();
});

it('documents suppress hashing after removal and refuse a completed intent without an identity', async () => {
  const api = setup();
  api.list.mockResolvedValue({ documents: [], nextCursor: null });
  let finish: (value: ArrayBuffer) => void = () => undefined;
  const selected = new File(['png'], 'file.png', { type: 'image/png' });
  Object.assign(selected, {
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((resolve) => {
        finish = resolve;
      }),
  });
  const view = render(
    <SignDocuments api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await screen.findByText('No documents linked yet.');
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: { files: [selected] },
  });
  view.unmount();
  await act(() => {
    finish(new ArrayBuffer(1));
    return Promise.resolve();
  });
  expect(api.initiate).not.toHaveBeenCalled();
  api.initiate.mockResolvedValue({ completed: true });
  const second = render(
    <SignDocuments api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await screen.findByText('No documents linked yet.');
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: { files: [file()] },
  });
  await waitFor(() => {
    expect(api.initiate).toHaveBeenCalled();
  });
  await act(() => Promise.resolve());
  expect(api.complete).not.toHaveBeenCalled();
  second.unmount();
});
it('photos coalesce duplicate delete dispatches and discard a successful response after unmount', async () => {
  const api = setup();
  api.list.mockResolvedValue({ photos: [media], nextCursor: null });
  let finish: () => void = () => undefined;
  api.remove.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <SignPhotos api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Delete file.png' }),
  );
  const confirm = screen.getByRole('button', { name: 'Delete' });
  act(() => {
    fireEvent.click(confirm);
    fireEvent.click(confirm);
  });
  expect(api.remove).toHaveBeenCalledOnce();
  view.unmount();
  await act(() => {
    finish();
    return Promise.resolve();
  });
});

it('documents suppress verification results after removal', async () => {
  const api = setup();
  api.list.mockResolvedValue({ documents: [], nextCursor: null });
  let finish: (value: typeof media) => void = () => undefined;
  api.complete.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <SignDocuments api={api} signId={id} canManage onBusyChange={vi.fn()} />,
  );
  await screen.findByText('No documents linked yet.');
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: { files: [file()] },
  });
  await waitFor(() => {
    expect(api.complete).toHaveBeenCalledOnce();
  });
  view.unmount();
  await act(() => {
    finish(media);
    return Promise.resolve();
  });
});
