/** @spec site-cover-image-add REQ-003..REQ-007, REQ-017 */
import {
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
