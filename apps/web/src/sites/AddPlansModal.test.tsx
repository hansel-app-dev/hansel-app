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
      screen.queryByText('Drag your file(s) here to get started'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Add plans here')).toBeVisible();
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
      screen.getByText('Drag your file(s) here to get started'),
    ).toBeVisible();
  });
  it('verifies multiple files without committing, then creates one named allocation', async () => {
    const props = setup();
    select([file('one.pdf'), file('two.pdf')]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Add Allocation' }),
      ).toBeEnabled(),
    );
    expect(props.finalize).toHaveBeenCalledTimes(2);
    expect(props.commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add Allocation' }));
    await waitFor(() => {
      expect(props.onComplete).toHaveBeenCalledOnce();
    });
    expect(props.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ground floor',
        uploadIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
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
  it('rejects unsupported and duplicate selections', async () => {
    setup();
    select([new File(['x'], 'file.txt', { type: 'text/plain' })]);
    expect(screen.getByRole('alert')).toHaveTextContent('PNG');
    select([file(), file()]);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('duplicate'),
    );
    const remove = screen.getAllByRole('button', {
      name: 'Remove plan.pdf',
    })[0];
    if (!remove) throw new Error('Expected remove action');
    fireEvent.click(remove);
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
