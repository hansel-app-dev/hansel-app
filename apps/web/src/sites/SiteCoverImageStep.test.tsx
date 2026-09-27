/** @spec site-cover-image-add REQ-003..REQ-007, REQ-017 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteCoverImageStep } from './SiteCoverImageStep.js';

const destination = '/sites/00000000-0000-4000-8000-000000000001/activity';
const png = () =>
  new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
    'cover.png',
    { type: 'image/png' },
  );

afterEach(cleanup);

function renderStep(
  overrides: Partial<ComponentProps<typeof SiteCoverImageStep>> = {},
) {
  const onComplete = vi.fn();
  const uploadCoverImage = vi.fn(() => Promise.resolve());
  render(
    <SiteCoverImageStep
      destination={destination}
      onComplete={onComplete}
      siteId="00000000-0000-4000-8000-000000000001"
      uploadCoverImage={uploadCoverImage}
      {...overrides}
    />,
  );
  return { onComplete, uploadCoverImage };
}

describe('SiteCoverImageStep', () => {
  it('enables Add cover image after a valid selection even when upload wiring is unavailable', async () => {
    render(
      <SiteCoverImageStep
        destination={destination}
        onComplete={vi.fn()}
        siteId="00000000-0000-4000-8000-000000000001"
      />,
    );
    fireEvent.change(screen.getByLabelText('Choose cover image'), {
      target: { files: [png()] },
    });
    const add = screen.getByRole('button', { name: 'Add cover image' });
    await waitFor(() => {
      expect(add).toBeEnabled();
    });
    fireEvent.click(add);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't add the cover image",
    );
  });

  it('skips without uploading [site-cover-image-add AC-003]', () => {
    const { onComplete, uploadCoverImage } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(uploadCoverImage).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith(destination);
  });

  it('rejects unsupported and malformed content [site-cover-image-add AC-004]', async () => {
    renderStep();
    const input = screen.getByLabelText('Choose cover image');
    fireEvent.change(input, {
      target: {
        files: [new File(['text'], 'cover.txt', { type: 'text/plain' })],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a PNG or JPG file.',
    );

    fireEvent.change(input, {
      target: {
        files: [new File(['not-png'], 'cover.png', { type: 'image/png' })],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'does not contain a valid PNG or JPG image',
    );
    expect(
      screen.getByRole('button', { name: 'Add cover image' }),
    ).toBeDisabled();
  });

  it('uploads one selected PNG and completes [site-cover-image-add AC-002]', async () => {
    const { onComplete, uploadCoverImage } = renderStep();
    fireEvent.change(screen.getByLabelText('Choose cover image'), {
      target: { files: [png()] },
    });
    expect(await screen.findByText('cover.png')).toBeVisible();
    const add = screen.getByRole('button', { name: 'Add cover image' });
    expect(add).toBeEnabled();
    fireEvent.click(add);
    await waitFor(() => {
      expect(uploadCoverImage).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(destination);
    });
  });

  it('keeps the selected file and allows retry after failure', async () => {
    const uploadCoverImage = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    const onComplete = vi.fn();
    renderStep({ onComplete, uploadCoverImage });
    fireEvent.change(screen.getByLabelText('Choose cover image'), {
      target: { files: [png()] },
    });
    const add = await screen.findByRole('button', { name: 'Add cover image' });
    await waitFor(() => {
      expect(add).toBeEnabled();
    });
    fireEvent.click(add);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't add the cover image",
    );
    expect(screen.getByText('cover.png')).toBeVisible();
    fireEvent.click(add);
    await waitFor(() => {
      expect(uploadCoverImage).toHaveBeenCalledTimes(2);
      expect(onComplete).toHaveBeenCalledWith(destination);
    });
  });
});

it('validates file size, extension, JPG signatures and drop interactions', async () => {
  const { onComplete } = renderStep({
    totalSteps: 2,
    onUploadingChange: vi.fn(),
  });
  const input = screen.getByLabelText('Choose cover image');
  fireEvent.change(input, { target: { files: [] } });
  for (const [file, message] of [
    [new File([], 'empty.png', { type: 'image/png' }), 'not empty'],
    [
      new File([new Uint8Array(3_000_001)], 'large.png', { type: 'image/png' }),
      '3 MB',
    ],
    [
      new File(['png'], 'wrong.jpg', { type: 'image/png' }),
      'matching filename',
    ],
    [
      new File(['jpg'], 'wrong.png', { type: 'image/jpeg' }),
      'matching filename',
    ],
    [
      new File(['jpg'], 'wrong.jpg', { type: 'image/jpeg' }),
      'valid PNG or JPG',
    ],
  ] as const) {
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  }
  const drop = screen
    .getByText('Drag your file here')
    .closest('section')
    ?.querySelector('div');
  if (!drop) throw new Error('Missing drop target');
  fireEvent.dragEnter(drop);
  fireEvent.dragOver(drop);
  fireEvent.dragLeave(drop);
  fireEvent.click(screen.getByRole('button', { name: 'Browse files' }));
  fireEvent.drop(drop, {
    dataTransfer: {
      files: [
        new File([new Uint8Array([255, 216, 255])], 'cover.jpg', {
          type: 'image/jpeg',
        }),
      ],
    },
  });
  await screen.findByText('cover.jpg');
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Add cover image' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add cover image' }));
  });
  await waitFor(() => {
    expect(onComplete).toHaveBeenCalledWith(destination);
  });
});
it('discards obsolete selections, handles file reader failures, and blocks selection during upload', async () => {
  const readers: {
    result: ArrayBuffer | string | null;
    error: Error | null;
    listeners: Record<string, () => void>;
  }[] = [];
  class Reader {
    result: ArrayBuffer | string | null = null;
    error: Error | null = null;
    listeners: Record<string, () => void> = {};
    constructor() {
      readers.push(this);
    }
    addEventListener(name: string, fn: () => void) {
      this.listeners[name] = fn;
    }
    readAsArrayBuffer() {
      return undefined;
    }
  }
  vi.stubGlobal('FileReader', Reader);
  const invoke = (
    index: number,
    event: string,
    result: ArrayBuffer | string | null = null,
  ) => {
    const reader = readers[index];
    if (!reader) throw new Error('Missing reader');
    reader.result = result;
    const listener = reader.listeners[event];
    if (!listener) throw new Error('Missing event');
    listener();
  };
  try {
    const changed = vi.fn();
    let finish: () => void = () => undefined;
    renderStep({
      onUploadingChange: changed,
      uploadCoverImage: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const input = screen.getByLabelText('Choose cover image');
    fireEvent.change(input, { target: { files: [png()] } });
    invoke(0, 'load', 'invalid');
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't read");
    fireEvent.change(input, { target: { files: [png()] } });
    invoke(1, 'error');
    await screen.findByRole('alert');
    fireEvent.change(input, { target: { files: [png()] } });
    const reader = readers[2];
    if (!reader) throw new Error('Missing reader');
    reader.error = new Error('broken');
    invoke(2, 'error');
    await screen.findByRole('alert');
    fireEvent.change(input, { target: { files: [png()] } });
    fireEvent.change(input, { target: { files: [png()] } });
    invoke(3, 'load', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer);
    invoke(4, 'load', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer);
    await screen.findByText('cover.png');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add cover image' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add cover image' }));
    });
    const drop = screen
      .getByText('cover.png')
      .closest('section')
      ?.querySelector('div');
    if (!drop) throw new Error('Missing drop');
    fireEvent.drop(drop, { dataTransfer: { files: [png()] } });
    await waitFor(() => {
      expect(changed).toHaveBeenCalledWith(true);
    });
    finish();
    await waitFor(() => {
      expect(changed).toHaveBeenCalledWith(false);
    });
  } finally {
    vi.unstubAllGlobals();
  }
});
