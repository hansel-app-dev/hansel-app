import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { AddPlansModal } from './AddPlansModal.js';
import { AllocationDraftFilesRejectedError } from './allocation-draft-errors.js';
afterEach(cleanup);
function file(name = 'plan.pdf') {
  const value = new File(['%PDF-'], name, { type: 'application/pdf' });
  Object.defineProperty(value, 'arrayBuffer', {
    value: () => Promise.resolve(new TextEncoder().encode(name).buffer),
    configurable: true,
  });
  return value;
}
function setup(overrides: Partial<ComponentProps<typeof AddPlansModal>> = {}) {
  const props = {
    createBatch: vi.fn<ComponentProps<typeof AddPlansModal>['createBatch']>(
      (input) =>
        Promise.resolve({
          uploads: input.files.map((_, i) => ({
            uploadId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
            uploadUrl: 'https://example.test/upload',
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
            headers: {
              'content-type': 'application/pdf',
              'x-amz-checksum-sha256': 'A'.repeat(43) + '=',
            },
          })),
        }),
    ),
    upload: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onComplete: vi.fn(),
  };
  render(<AddPlansModal {...props} {...overrides} />);
  return props;
}
function select(files: File[]) {
  fireEvent.change(screen.getByLabelText('Allocation name'), {
    target: { value: 'Ground floor' },
  });
  fireEvent.change(screen.getByLabelText('Choose allocation files'), {
    target: { files },
  });
}
describe('allocation-plan-multiple-files REQ-002..REQ-007, REQ-011..REQ-012', () => {
  it('shows the name and initial selection state with disabled Next', () => {
    setup();
    expect(
      screen.getByRole('heading', { name: 'Add new Allocation' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Allocation name')).toHaveValue('');
    expect(screen.getByLabelText('Allocation name')).toHaveAttribute(
      'placeholder',
      'New allocation plan',
    );
    expect(screen.getByLabelText('Allocation name')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Choose allocation files'), {
      target: { files: [file()] },
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove plan.pdf' }));
    select([file()]);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Allocation name'), {
      target: { value: ' ' },
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
  it('uses the uploading rectangle layout immediately after selection without starting uploads', () => {
    const props = setup();
    select([file()]);
    expect(
      screen.queryByText('Drag your file here to get started'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Allocation file')).toBeVisible();
    expect(
      screen.getByRole('list', { name: 'Allocation files' }),
    ).toBeVisible();
    expect(screen.getByRole('listitem')).toHaveClass(
      'min-h-[62px]',
      'rounded-[6px]',
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(props.createBatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove plan.pdf' }));
    expect(
      screen.getByText('Drag your file here to get started'),
    ).toBeVisible();
  });
  it('allocation-plan-single-file REQ-002: rejects multiple files without losing the selected file', async () => {
    const props = setup();
    select([file('one.pdf')]);
    select([file('two.pdf'), file('three.pdf')]);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose exactly one file per allocation.',
    );
    expect(screen.getByText('one.pdf')).toBeVisible();
    expect(screen.queryByText('two.pdf')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalledOnce();
    });
    expect(props.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ground floor',
        uploadIds: ['00000000-0000-4000-8000-000000000001'],
      }),
    );
  });
  it('removes an active file and ignores its late completion', async () => {
    let finish: (() => void) | undefined;
    const props = setup({
      upload: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('plan.pdf • Uploading…');
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel upload plan.pdf' }),
    );
    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(props.finalize).not.toHaveBeenCalled();
  });
  it('retries failed rows while retaining successful files', async () => {
    const props = setup({
      upload: vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(undefined),
    });
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry plan.pdf' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled(),
    );
    expect(props.createBatch).toHaveBeenCalledOnce();
  });
  it('confirms abandonment without creating an allocation', async () => {
    const props = setup();
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard allocation' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.commit).not.toHaveBeenCalled();
  });
  it('retains the commit key after an ambiguous creation failure', async () => {
    const commit = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined);
    const props = setup({ commit });
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalledOnce();
    });
    expect(commit.mock.calls[0]).toEqual(commit.mock.calls[1]);
  });
  it('allocation-plan-single-file REQ-002: rejects unsupported and duplicate selections', () => {
    setup();
    select([new File(['x'], 'file.txt', { type: 'text/plain' })]);
    expect(screen.getByRole('alert')).toHaveTextContent('PNG');
    select([file(), file()]);
    expect(screen.getByRole('alert')).toHaveTextContent('exactly one');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    select([file()]);
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });
  it('can retry batch creation after a network failure', async () => {
    const createBatch = vi.fn().mockRejectedValue(new Error('offline'));
    setup({ createBatch });
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(createBatch).toHaveBeenCalledTimes(2);
    });
    expect(createBatch.mock.calls[0]).toEqual(createBatch.mock.calls[1]);
  });
  it('lets expired uploads start again after a definitive rejection', async () => {
    setup({
      commit: vi
        .fn()
        .mockRejectedValue(new AllocationDraftFilesRejectedError()),
    });
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByLabelText('Allocation name')).toBeEnabled();
  });
});

it('traps keyboard focus, dismisses the selection view and selects a dropped image', () => {
  const props = setup();
  const dialog = screen.getByRole('dialog');
  const close = screen.getByRole('button', { name: 'Close Add Allocation' });
  dialog.focus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(close).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(close).not.toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(close).toHaveFocus();
  dialog.focus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  const drop = screen
    .getByText('Drag your file here to get started')
    .closest('div');
  if (!drop) throw new Error('Missing drop target');
  fireEvent.dragOver(drop);
  fireEvent.drop(drop, {
    dataTransfer: {
      files: [new File(['png'], 'plan.png', { type: 'image/png' })],
    },
  });
  expect(screen.getByText('plan.png')).toBeVisible();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(props.onClose).toHaveBeenCalledOnce();
});
it('reports empty/oversized files, malformed manifests and expired intents', async () => {
  const props = setup({
    createBatch: vi.fn().mockResolvedValue({ uploads: [] }),
  });
  select([new File([], 'empty.pdf', { type: 'application/pdf' })]);
  expect(screen.getByRole('alert')).toHaveTextContent('between');
  select([
    new File([new Uint8Array(5_242_881)], 'large.pdf', {
      type: 'application/pdf',
    }),
  ]);
  expect(screen.getByRole('alert')).toHaveTextContent('between');
  select([file()]);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('We couldn’t start the upload. Please try again.');
  expect(props.upload).not.toHaveBeenCalled();
});
it('shows bounded upload progress and ignores callbacks after abandoning the modal', async () => {
  let progress: (n: number) => void = () => undefined,
    finish: () => void = () => undefined;
  const props = setup({
    upload: (_url, _file, _headers, options) => {
      progress = (value) => options?.onProgress(value);
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  select([file()]);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('progressbar');
  act(() => {
    progress(110);
  });
  expect(screen.getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  act(() => {
    progress(-1);
  });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard allocation' }));
  expect(props.onClose).toHaveBeenCalled();
  act(() => {
    progress(50);
    finish();
  });
});

it('opens the picker and prevents Tab from leaving while a commit disables every control', async () => {
  let settle: () => void = () => undefined;
  const props = setup({
    commit: () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Browse files' }));
  select([file()]);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
  const tab = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(props.onClose).not.toHaveBeenCalled();
  await act(() => {
    settle();
    return Promise.resolve();
  });
});

it('shows verification in progress and ignores preparation results after abandonment', async () => {
  let verify: () => void = () => undefined;
  const first = setup({
    finalize: () =>
      new Promise((resolve) => {
        verify = resolve;
      }),
  });
  select([file()]);
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  });
  await screen.findByText('plan.pdf • Verifying…');
  expect(screen.getByRole('button', { name: 'Add Allocation' })).toBeDisabled();
  await act(() => {
    verify();
    return Promise.resolve();
  });
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
  });
  cleanup();
  for (const phase of ['digest', 'batch'] as const) {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const selected = file();
    if (phase === 'digest')
      Object.defineProperty(selected, 'arrayBuffer', {
        configurable: true,
        value: () => pending.then(() => new ArrayBuffer(1)),
      });
    const batch = vi.fn<ComponentProps<typeof AddPlansModal>['createBatch']>(
      () => pending.then(() => ({ uploads: [] })),
    );
    const props = setup({ createBatch: batch });
    select([selected]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    if (phase === 'batch')
      await waitFor(() => {
        expect(batch).toHaveBeenCalled();
      });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard allocation' }));
    await act(() => {
      finish();
      return Promise.resolve();
    });
    expect(props.upload).not.toHaveBeenCalled();
    cleanup();
  }
  expect(first.onClose).not.toHaveBeenCalled();
});
it('permits a rejected manifest to be resubmitted with a fresh idempotency key', async () => {
  const createBatch = vi
    .fn<ComponentProps<typeof AddPlansModal>['createBatch']>()
    .mockRejectedValue(new AllocationDraftFilesRejectedError());
  setup({ createBatch });
  select([file()]);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('We couldn’t start the upload. Please try again.');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => {
    expect(createBatch).toHaveBeenCalledTimes(2);
  });
  expect(createBatch.mock.calls[0]?.[0].idempotencyKey).not.toBe(
    createBatch.mock.calls[1]?.[0].idempotencyKey,
  );
});

it('handles empty native file selections and pointer clicks inside the backdrop', () => {
  setup();
  fireEvent.change(screen.getByLabelText('Choose allocation files'), {
    target: { files: null },
  });
  fireEvent.click(screen.getByLabelText('Allocation name'));
  expect(
    screen.getByRole('heading', { name: 'Add new Allocation' }),
  ).toBeVisible();
});

it('rejects expired and sparse upload manifests and accepts dismissal through the backdrop', async () => {
  for (const uploads of [
    [
      {
        uploadId: 'intent',
        uploadUrl: 'https://upload.example/',
        expiresAt: '2000-01-01T00:00:00Z',
        headers: {
          'content-type': 'application/pdf' as const,
          'x-amz-checksum-sha256': 'a'.repeat(43) + '=',
        },
      },
    ],
    new Array<
      Awaited<
        ReturnType<ComponentProps<typeof AddPlansModal>['createBatch']>
      >['uploads'][number]
    >(1),
  ]) {
    setup({ createBatch: () => Promise.resolve({ uploads }) });
    select([file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Preparing…' })).toBeNull();
    });
    if (uploads[0])
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeDisabled();
    else
      expect(
        screen.queryByRole('button', { name: 'Add Allocation' }),
      ).toBeNull();
    cleanup();
  }
  const props = setup();
  const backdrop = screen.getByRole('dialog').parentElement;
  if (!backdrop) throw new Error('Missing backdrop');
  fireEvent.click(backdrop);
  expect(props.onClose).toHaveBeenCalledOnce();
});

it('ignores new file input during preparation and duplicate commit or remove dispatches', async () => {
  let finish: () => void = () => undefined;
  const props = setup({
    commit: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  select([file()]);
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Choose allocation files'), {
      target: { files: [file('second.pdf')] },
    });
  });
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Add Allocation' }),
    ).toBeEnabled();
  });
  expect(screen.queryByText('second.pdf')).toBeNull();
  const add = screen.getByRole('button', { name: 'Add Allocation' }),
    remove = screen.getByRole('button', { name: 'Remove plan.pdf' });
  act(() => {
    fireEvent.click(add);
    fireEvent.click(add);
    fireEvent.click(remove);
  });
  expect(screen.getByText('plan.pdf')).toBeVisible();
  await act(() => {
    finish();
    return Promise.resolve();
  });
  expect(props.onComplete).toHaveBeenCalledOnce();
});

it('ignores a queued retry after its failed file was removed', async () => {
  const props = setup({ upload: () => Promise.reject(new Error('offline')) });
  select([file()]);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  const retry = await screen.findByRole('button', { name: 'Retry plan.pdf' }),
    remove = screen.getByRole('button', { name: 'Remove plan.pdf' });
  act(() => {
    fireEvent.click(remove);
    fireEvent.click(retry);
  });
  expect(props.finalize).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});
