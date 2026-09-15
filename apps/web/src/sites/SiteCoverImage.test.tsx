/** @spec site-cover-image-display REQ-001, REQ-002, REQ-006, REQ-007 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SiteCoverImage } from './SiteCoverImage.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function urls() {
  const createObjectURL = vi.fn(() => 'blob:cover');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
}
it('shows the cover and releases its URL on unmount', async () => {
  const { revokeObjectURL } = urls();
  const load = vi.fn(() =>
    Promise.resolve(new Blob(['image'], { type: 'image/png' })),
  );
  const view = render(
    <SiteCoverImage siteId="one" hasCoverImage loadCoverImage={load} />,
  );
  await waitFor(() =>
    expect(view.container.querySelector('img')).toHaveAttribute(
      'src',
      'blob:cover',
    ),
  );
  expect(view.container.querySelector('img')).toHaveAttribute('alt', '');
  view.unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:cover');
});
it('does not fetch missing covers and falls back for request and decode failure', async () => {
  urls();
  const load = vi.fn().mockRejectedValue(new Error('unavailable'));
  const view = render(
    <SiteCoverImage siteId="one" hasCoverImage={false} loadCoverImage={load} />,
  );
  expect(load).not.toHaveBeenCalled();
  view.rerender(
    <SiteCoverImage siteId="one" hasCoverImage loadCoverImage={load} />,
  );
  await waitFor(() => {
    expect(load).toHaveBeenCalledOnce();
  });
  expect(view.container.querySelector('img')).toBeNull();
  const success = () => Promise.resolve(new Blob(['image']));
  view.rerender(
    <SiteCoverImage siteId="two" hasCoverImage loadCoverImage={success} />,
  );
  await waitFor(() => {
    expect(view.container.querySelector('img')).not.toBeNull();
  });
  const image = view.container.querySelector('img');
  if (!image) throw new Error('Expected loaded cover');
  fireEvent.error(image);
  expect(view.container.querySelector('img')).toBeNull();
});
it('aborts obsolete requests and never shows their result', async () => {
  const { createObjectURL } = urls();
  let resolve: (blob: Blob) => void = () => {
    throw new Error('Request not started');
  };
  const load = vi.fn(
    (_id: string, _signal: AbortSignal) =>
      new Promise<Blob>((done) => {
        resolve = done;
      }),
  );
  const view = render(
    <SiteCoverImage siteId="one" hasCoverImage loadCoverImage={load} />,
  );
  view.rerender(
    <SiteCoverImage siteId="two" hasCoverImage={false} loadCoverImage={load} />,
  );
  expect(load.mock.calls[0]?.[1].aborted).toBe(true);
  resolve(new Blob(['old']));
  await Promise.resolve();
  expect(createObjectURL).not.toHaveBeenCalled();
});
