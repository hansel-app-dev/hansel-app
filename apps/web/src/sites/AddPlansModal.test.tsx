import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddPlansModal } from './AddPlansModal.js';

afterEach(cleanup);

describe('AddPlansModal [site-allocation-plans-add REQ-002..REQ-005, REQ-019..REQ-021]', () => {
  it('shows the Figma copy and keeps Upload unavailable without files [AC-006]', () => {
    render(
      <AddPlansModal
        createBatch={vi.fn()}
        finalize={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        upload={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Add plans' })).toBeVisible();
    expect(
      screen.getByText('Drag your file(s) here to get started'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Browse files' }));
  });

  it('rejects an unsupported file and removes a valid selection [AC-002, AC-006]', () => {
    render(
      <AddPlansModal
        createBatch={vi.fn()}
        finalize={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        upload={vi.fn()}
      />,
    );
    const picker = document.querySelector('input[type="file"]');
    if (!picker) throw new Error('Expected file picker');
    fireEvent.change(picker, {
      target: { files: [new File(['x'], 'plan.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a PNG, JPG or PDF file.',
    );
    fireEvent.change(picker, {
      target: {
        files: [new File(['%PDF-'], 'plan.pdf', { type: 'application/pdf' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove plan.pdf' }));
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    fireEvent.change(picker, { target: { files: null } });
    fireEvent.change(picker, {
      target: {
        files: [new File([], 'empty.pdf', { type: 'application/pdf' })],
      },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Each file must be between 1 byte and 5 MB.',
    );
  });

  it('uploads and finalizes a valid file [AC-001]', async () => {
    const createBatch = vi.fn().mockResolvedValue({
      uploads: [
        {
          uploadId: '00000000-0000-4000-8000-000000000001',
          uploadUrl: 'https://uploads.example/plan',
          expiresAt: '2026-09-06T00:15:00.000Z',
          headers: {
            'content-type': 'application/pdf',
            'x-amz-checksum-sha256':
              'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
          },
        },
      ],
    });
    const upload = vi.fn().mockResolvedValue(undefined);
    const finalize = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(
      <AddPlansModal
        createBatch={createBatch}
        finalize={finalize}
        onClose={vi.fn()}
        onComplete={onComplete}
        upload={upload}
      />,
    );
    const file = new File(['%PDF-'], 'plan.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode('%PDF-').buffer),
    });
    const picker = document.querySelector('input[type="file"]');
    if (!picker) throw new Error('Expected file picker');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledWith(
      'https://uploads.example/plan',
      file,
      expect.any(Object),
      expect.objectContaining({
        onProgress: expect.any(Function),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(finalize).toHaveBeenCalledOnce();
  });

  it('shows the Figma uploading progress and completed Done state [REQ-019]', async () => {
    let finishUpload: (() => void) | undefined;
    const upload = vi.fn<
      (
        url: string,
        file: File,
        headers: Record<string, string>,
        options?: {
          onProgress: (percentage: number) => void;
          signal: AbortSignal;
        },
      ) => Promise<void>
    >(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const onComplete = vi.fn();
    render(
      <AddPlansModal
        createBatch={() =>
          Promise.resolve({
            uploads: [
              {
                uploadId: '00000000-0000-4000-8000-000000000001',
                uploadUrl: 'https://uploads.example/plan',
                expiresAt: '2026-09-06T00:15:00.000Z',
                headers: {
                  'content-type': 'application/pdf',
                  'x-amz-checksum-sha256':
                    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                },
              },
            ],
          })
        }
        finalize={() => Promise.resolve()}
        onClose={vi.fn()}
        onComplete={onComplete}
        upload={upload}
      />,
    );
    const picker = document.querySelector('input[type="file"]');
    if (!picker) throw new Error('Expected file picker');
    const file = new File(['%PDF-'], 'HANSEL_L1_6054.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode('%PDF-').buffer),
    });
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => {
      expect(upload).toHaveBeenCalledOnce();
    });
    const options = upload.mock.calls[0]?.[3];
    options?.onProgress(45);
    expect(
      await screen.findByText(/HANSEL_L1_6054\.pdf • Uploading…/),
    ).toBeVisible();
    expect((await screen.findAllByText('45%'))[0]).toBeVisible();
    expect(screen.getByText('(0 of 1 uploaded)')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Cancel upload HANSEL_L1_6054.pdf',
      }),
    );
    expect(options?.signal.aborted).toBe(true);
    finishUpload?.();
    expect(await screen.findByRole('button', { name: 'Done' })).toBeVisible();
    expect(screen.getByText('(1 of 1 uploaded)')).toBeVisible();
    expect(onComplete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('supports Escape, drop, and recoverable upload failure [AC-002, AC-006]', async () => {
    const onClose = vi.fn();
    render(
      <AddPlansModal
        createBatch={() => Promise.reject(new Error('offline'))}
        finalize={vi.fn()}
        onClose={onClose}
        onComplete={vi.fn()}
        upload={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    const dropZone = screen.getByText('Drag your file(s) here to get started')
      .parentElement?.parentElement;
    expect(dropZone).toBeTruthy();
    fireEvent.dragOver(dropZone as Element);
    const file = new File(['%PDF-'], 'dropped.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode('%PDF-').buffer),
    });
    fireEvent.drop(dropZone as Element, { dataTransfer: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t upload every plan',
    );
  });

  it('reports a mismatched upload manifest', async () => {
    render(
      <AddPlansModal
        createBatch={() =>
          Promise.resolve({
            uploads: [
              {
                uploadId: '00000000-0000-4000-8000-000000000001',
                uploadUrl: 'https://uploads.example/one',
                expiresAt: '2026-09-06T00:15:00.000Z',
                headers: {
                  'content-type': 'application/pdf',
                  'x-amz-checksum-sha256':
                    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                },
              },
              {
                uploadId: '00000000-0000-4000-8000-000000000002',
                uploadUrl: 'https://uploads.example/two',
                expiresAt: '2026-09-06T00:15:00.000Z',
                headers: {
                  'content-type': 'application/pdf',
                  'x-amz-checksum-sha256':
                    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
                },
              },
            ],
          })
        }
        finalize={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        upload={vi.fn()}
      />,
    );
    const picker = document.querySelector('input[type="file"]');
    if (!picker) throw new Error('Expected file picker');
    const file = new File(['%PDF-'], 'plan.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode('%PDF-').buffer),
    });
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We couldn’t upload every plan',
    );
  });
});
