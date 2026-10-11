/** @spec library-files REQ-004,005,011,013 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LibraryFilePicker } from './LibraryFiles.js';
afterEach(cleanup);
it('library-files picker preserves selection after failure and cancels without linking', async () => {
  const file = {
    id: '00000000-0000-4000-8000-000000000001',
    filename: 'Floor.pdf',
    mediaType: 'application/pdf' as const,
    byteSize: 42,
    uploadedBy: 'Member',
    createdAt: '2026-09-27T00:00:00Z',
    sourceSite: { id: '00000000-0000-4000-8000-000000000002', name: 'Site A' },
    hasThumbnail: false,
  };
  const api = {
    list: vi.fn().mockResolvedValue({ files: [file], nextCursor: null }),
    download: vi.fn(),
    thumbnail: vi.fn(),
    link: vi.fn(),
    createPlan: vi.fn(),
  };
  const confirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined),
    close = vi.fn();
  render(
    <LibraryFilePicker
      api={api}
      kind="all"
      multiple={false}
      onSelect={confirm}
      onClose={close}
    />,
  );
  fireEvent.click(await screen.findByRole('radio', { name: /Floor.pdf/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Use selected files' }));
  await screen.findByRole('alert');
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Use selected files' }));
  await screen.findByRole('radio', { name: /Floor.pdf/ });
  expect(confirm).toHaveBeenCalledTimes(2);
});

import { act, waitFor } from '@testing-library/react';
import { LibraryFileList, LibraryFilesPage } from './LibraryFiles.js';
import type { LibraryFile } from '@hansel/contracts';
const file: LibraryFile = {
  id: '00000000-0000-4000-8000-000000000001',
  filename: 'Floor.pdf',
  mediaType: 'application/pdf',
  byteSize: 42,
  uploadedBy: 'Member',
  createdAt: '2026-09-27T00:00:00Z',
  sourceSite: { id: '00000000-0000-4000-8000-000000000002', name: 'Site A' },
  hasThumbnail: false,
};
function library() {
  return {
    list: vi.fn().mockResolvedValue({ files: [file], nextCursor: null }),
    download: vi.fn().mockResolvedValue(undefined),
    thumbnail: vi.fn(),
    link: vi.fn(),
    createPlan: vi.fn(),
  };
}
it('library-files lists metadata, searches, filters, pages without duplicates and retries download errors [REQ-004]', async () => {
  const api = library();
  api.list
    .mockResolvedValueOnce({ files: [file], nextCursor: file.id })
    .mockResolvedValueOnce({
      files: [
        file,
        { ...file, id: 'other', filename: 'Photo.png', mediaType: 'image/png' },
        {
          ...file,
          id: 'third',
          filename: 'Photo.jpg',
          mediaType: 'image/jpeg',
        },
      ],
      nextCursor: null,
    });
  render(<LibraryFileList api={api} />);
  await screen.findByText('Floor.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Photo.jpg');
  expect(screen.getAllByText('Floor.pdf')).toHaveLength(1);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search files' }), {
    target: { value: 'Floor' },
  });
  await waitFor(() => {
    expect(api.list).toHaveBeenCalledWith({ q: 'Floor', kind: 'all' });
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'File type' }), {
    target: { value: 'pdf' },
  });
  await waitFor(() => {
    expect(api.list).toHaveBeenCalledWith({ q: 'Floor', kind: 'pdf' });
  });
  await screen.findByText('Floor.pdf');
  api.download.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => {
    expect(screen.queryByRole('alert')).toBeNull();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  expect(api.download).toHaveBeenLastCalledWith(file.id, file.filename);
});
it('library-files retries initial and pagination failures and displays an empty result [REQ-004,011]', async () => {
  const api = library();
  api.list
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ files: [file], nextCursor: file.id })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ files: [], nextCursor: null });
  render(<LibraryFileList api={api} />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Floor.pdf');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No files found.');
});
it('library-files supports multiple selection, preserves the retry key and blocks dismissal while pending [REQ-008,011,013]', async () => {
  const api = library();
  api.list.mockResolvedValue({
    files: [
      file,
      { ...file, id: 'other', filename: 'Photo.png', mediaType: 'image/png' },
    ],
    nextCursor: null,
  });
  let complete: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const confirm = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(() => pending),
    close = vi.fn();
  render(
    <LibraryFilePicker
      api={api}
      kind="image"
      multiple
      onSelect={confirm}
      onClose={close}
    />,
  );
  const input = await screen.findByRole('checkbox', { name: file.filename });
  fireEvent.click(input);
  fireEvent.click(input);
  expect(
    screen.getByRole('button', { name: 'Use selected files' }),
  ).toBeDisabled();
  fireEvent.click(input);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Photo.png' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use selected files' }));
  await screen.findByRole('alert');
  fireEvent.click(input);
  fireEvent.click(input);
  fireEvent.click(screen.getByRole('button', { name: 'Use selected files' }));
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(confirm.mock.calls[1]).toEqual(confirm.mock.calls[0]);
  await act(async () => {
    complete();
    await pending;
  });
  expect(close).toHaveBeenCalledOnce();
});
it('library-files cancellation has no link and restores focus [REQ-011,013]', async () => {
  const api = library(),
    close = vi.fn(),
    confirm = vi.fn();
  const invoker = document.createElement('button');
  document.body.append(invoker);
  invoker.focus();
  const view = render(
    <LibraryFilePicker
      api={api}
      kind="all"
      multiple={false}
      onSelect={confirm}
      onClose={close}
    />,
  );
  fireEvent.click(await screen.findByRole('radio', { name: file.filename }));
  fireEvent.click(screen.getByRole('radio', { name: file.filename }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(3);
  expect(confirm).not.toHaveBeenCalled();
  view.unmount();
  expect(invoker).toHaveFocus();
  invoker.remove();
});
it('library-files ignores obsolete initial reads, paging, downloads and confirmation after removal [REQ-011]', async () => {
  for (const reject of [false, true]) {
    let finish: (value: never) => void = () => undefined;
    const pending = new Promise<never>((resolve, rejection) => {
      finish = reject ? rejection : resolve;
    });
    const api = library();
    api.list.mockImplementationOnce(() => pending);
    const view = render(<LibraryFileList api={api} />);
    view.unmount();
    await act(async () => {
      finish(
        reject
          ? (new Error('offline') as never)
          : ({ files: [file], nextCursor: null } as never),
      );
      await pending.catch(() => undefined);
    });
  }
  for (const reject of [false, true]) {
    let finish: (value: never) => void = () => undefined;
    const pending = new Promise<never>((resolve, rejection) => {
      finish = reject ? rejection : resolve;
    });
    const api = library();
    api.list
      .mockResolvedValueOnce({ files: [file], nextCursor: file.id })
      .mockImplementationOnce(() => pending);
    const view = render(<LibraryFileList api={api} />);
    await screen.findByText('Floor.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    view.unmount();
    await act(async () => {
      finish(
        reject
          ? (new Error('offline') as never)
          : ({ files: [file], nextCursor: null } as never),
      );
      await pending.catch(() => undefined);
    });
  }
  const api = library();
  let fail: (error: Error) => void = () => undefined;
  api.download.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const view = render(<LibraryFileList api={api} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
  view.unmount();
  await act(() => {
    fail(new Error('offline'));
    return Promise.resolve();
  });
  for (const reject of [false, true]) {
    let finish: (value: never) => void = () => undefined;
    const pending = new Promise<never>((resolve, rejection) => {
      finish = reject ? rejection : resolve;
    });
    const close = vi.fn(),
      view = render(
        <LibraryFilePicker
          api={library()}
          kind="all"
          multiple
          onSelect={() => pending}
          onClose={close}
        />,
      );
    fireEvent.click(
      await screen.findByRole('checkbox', { name: file.filename }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use selected files' }));
    view.unmount();
    await act(async () => {
      finish(reject ? (new Error('offline') as never) : (undefined as never));
      await pending.catch(() => undefined);
    });
    expect(close).not.toHaveBeenCalled();
  }
});
it('library-files page uses the authenticated shell and current Files navigation [REQ-004]', async () => {
  const navigate = vi.fn();
  render(
    <LibraryFilesPage
      api={library()}
      loadDashboard={() =>
        Promise.resolve({
          viewer: { displayName: 'Member', initials: 'M', roleLabel: 'Owner' },
        })
      }
      logout={() => Promise.resolve()}
      navigate={navigate}
    />,
  );
  await screen.findByText('Floor.pdf');
  const link = screen.getByRole('link', { name: 'Library' });
  expect(link).toHaveAttribute('aria-current', 'page');
  fireEvent.click(link);
  expect(navigate).toHaveBeenCalledWith('/library/files');
});
it('supports a standalone selection list without a controlled selection and ignores duplicate confirmations [REQ-008,011]', async () => {
  const toggle = vi.fn(),
    view = render(<LibraryFileList api={library()} onToggle={toggle} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: file.filename }));
  expect(toggle).toHaveBeenCalledWith(file);
  view.unmount();
  let finish: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const confirm = vi.fn(() => pending);
  render(
    <LibraryFilePicker
      api={library()}
      kind="all"
      multiple
      onSelect={confirm}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole('checkbox', { name: file.filename }));
  const button = screen.getByRole('button', { name: 'Use selected files' });
  act(() => {
    fireEvent.click(button);
    fireEvent.click(button);
  });
  expect(confirm).toHaveBeenCalledOnce();
  await act(async () => {
    finish();
    await pending;
  });
});
