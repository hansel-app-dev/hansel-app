import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
afterEach(cleanup);
import { SignDocuments } from './SignDocuments.js';
import type { SignDocumentsApi } from './sign-documents-api.js';
const document = {
  id: '33e82388-a951-4d52-b6d6-0b5cde568763',
  filename: 'spec.pdf',
  mediaType: 'application/pdf' as const,
  byteSize: 12,
  createdAt: '2026-09-15T00:00:00.000Z',
};
const download = vi.fn().mockResolvedValue(undefined);
const api: SignDocumentsApi = {
  list: vi.fn().mockResolvedValue({ documents: [document], nextCursor: null }),
  initiate: vi.fn(),
  complete: vi.fn(),
  download,
};
it('sign-documents REQ-002,003,006: renders files and downloads; deferred actions disabled', async () => {
  render(
    <SignDocuments signId="sign" api={api} canManage onBusyChange={vi.fn()} />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Download spec.pdf' }),
  );
  expect(download).toHaveBeenCalledWith('sign', document.id, 'spec.pdf');
  expect(screen.getByRole('button', { name: 'Library files' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Document options unavailable' }),
  ).toBeDisabled();
});
it('sign-documents REQ-004: rejects invalid files independently', async () => {
  render(
    <SignDocuments signId="sign" api={api} canManage onBusyChange={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText('Upload documents'), {
    target: { files: [new File([], 'empty.pdf', { type: 'application/pdf' })] },
  });
  expect(await screen.findByText(/Choose a nonempty/)).toBeInTheDocument();
});
