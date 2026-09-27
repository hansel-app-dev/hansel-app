/** @spec library-files REQ-005,008,011,013 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SignDocuments } from './SignDocuments.js';
import { SignPhotos } from './SignPhotos.js';
afterEach(cleanup);
const file = {
  id: '00000000-0000-4000-8000-000000000001',
  filename: 'Photo.png',
  mediaType: 'image/png' as const,
  byteSize: 42,
  uploadedBy: 'Member',
  createdAt: '2026-09-27T00:00:00Z',
  sourceSite: { id: '00000000-0000-4000-8000-000000000002', name: 'Site' },
  hasThumbnail: true,
};
it.each(['documents', 'photos'] as const)(
  'library-files links selected %s independently, retries and deduplicates results',
  async (kind) => {
    const library = {
      files: {
        list: vi.fn().mockResolvedValue({ files: [file], nextCursor: null }),
        download: vi.fn(),
        thumbnail: vi.fn(),
        link: vi.fn(),
        createPlan: vi.fn(),
      },
      link: vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue({ items: [file] }),
    };
    const api = {
        library,
        list: vi.fn().mockResolvedValue({
          documents: [file],
          photos: [file],
          nextCursor: null,
        }),
        initiate: vi.fn(),
        complete: vi.fn(),
        download: vi.fn(),
        thumbnail: vi.fn().mockResolvedValue(new Blob()),
        remove: vi.fn(),
      },
      busy = vi.fn();
    const Component = kind === 'documents' ? SignDocuments : SignPhotos;
    const view = render(
      <Component api={api} signId="target" canManage onBusyChange={busy} />,
    );
    await screen.findByText(file.filename);
    fireEvent.click(screen.getByRole('button', { name: 'Library files' }));
    fireEvent.click(
      await screen.findByRole('checkbox', { name: file.filename }),
    );
    expect(library.files.list).toHaveBeenCalledWith({
      q: '',
      kind: kind === 'photos' ? 'image' : 'all',
    });
    expect(busy).toHaveBeenLastCalledWith(true);
    fireEvent.click(
      screen.getByRole('button', {
        name: kind === 'photos' ? 'Add photos' : 'Add documents',
      }),
    );
    await screen.findByRole('alert');
    fireEvent.click(
      screen.getByRole('button', {
        name: kind === 'photos' ? 'Add photos' : 'Add documents',
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getAllByText(file.filename)).toHaveLength(1);
    expect(library.link).toHaveBeenLastCalledWith(
      'target',
      expect.objectContaining({ fileIds: [file.id] }),
    );
    expect(library.link.mock.calls[0]?.[1]).toEqual(
      library.link.mock.calls[1]?.[1],
    );
    expect(api.initiate).not.toHaveBeenCalled();
    expect(busy).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: 'Library files' }));
    fireEvent.click(
      await screen.findByRole('checkbox', { name: file.filename }),
    );
    let finish: (value: { items: (typeof file)[] }) => void = () => undefined;
    const pending = new Promise<{ items: (typeof file)[] }>((resolve) => {
      finish = resolve;
    });
    library.link.mockImplementationOnce(() => pending);
    fireEvent.click(
      screen.getByRole('button', {
        name: kind === 'photos' ? 'Add photos' : 'Add documents',
      }),
    );
    view.unmount();
    await act(async () => {
      finish({ items: [file] });
      await pending;
    });
  },
);
it.each(['documents', 'photos'] as const)(
  'library-files %s picker cancels without mutation and remains disabled for Viewers',
  async (kind) => {
    const library = {
      files: {
        list: vi.fn().mockResolvedValue({ files: [file], nextCursor: null }),
        download: vi.fn(),
        thumbnail: vi.fn(),
        link: vi.fn(),
        createPlan: vi.fn(),
      },
      link: vi.fn(),
    };
    const api = {
      library,
      list: vi
        .fn()
        .mockResolvedValue({ documents: [], photos: [], nextCursor: null }),
      initiate: vi.fn(),
      complete: vi.fn(),
      download: vi.fn(),
      thumbnail: vi.fn(),
      remove: vi.fn(),
    };
    const Component = kind === 'documents' ? SignDocuments : SignPhotos;
    const view = render(
      <Component api={api} signId="target" canManage onBusyChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Library files' }));
    await screen.findByRole('checkbox', { name: file.filename });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(library.link).not.toHaveBeenCalled();
    view.rerender(
      <Component
        api={api}
        signId="target"
        canManage={false}
        onBusyChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Library files' }),
    ).toBeDisabled();
  },
);
