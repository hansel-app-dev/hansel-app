import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllocationPlanViewer, renderPlan } from './AllocationPlanViewer.js';

const pdf = vi.hoisted(() => ({
  destroy: vi.fn().mockResolvedValue(undefined),
  getPage: vi.fn(),
  render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({ getPage: pdf.getPage, destroy: pdf.destroy }),
  })),
}));
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({
  default: 'pdf.worker.mjs',
}));

afterEach(cleanup);

const plan = {
  id: '00000000-0000-4000-8000-000000000006',
  filename: 'Ground Floor.png',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: '2026-09-06T00:00:00.000Z',
  modifiedAt: '2026-09-06T00:00:00.000Z',
  uploadedBy: 'Nabin Singh',
};

describe('AllocationPlanViewer [site-allocation-plan-preview REQ-005..REQ-013]', () => {
  it('renders images directly and only page 1 of PDFs [AC-001, AC-002]', async () => {
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:preview'),
      revokeObjectURL: vi.fn(),
    });
    const image = await renderPlan(new Blob(['png'], { type: 'image/png' }));
    image.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    pdf.getPage.mockResolvedValue({
      getViewport: () => ({ width: 100, height: 80 }),
      render: pdf.render,
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toBlob: (callback: (value: Blob) => void) =>
        callback(new Blob(['page 1'])),
    };
    const createElement = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(canvas as never);
    try {
      const rendered = await renderPlan({
        type: 'application/pdf',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)),
      } as Blob);
      expect(pdf.getPage).toHaveBeenCalledWith(1);
      expect(pdf.render).toHaveBeenCalledOnce();
      expect(pdf.destroy).toHaveBeenCalledOnce();
      expect(canvas).toMatchObject({ width: 100, height: 80 });
      rendered.release();
    } finally {
      createElement.mockRestore();
    }
  });

  it('rejects unavailable PDF canvas and raster output [AC-003]', async () => {
    pdf.getPage.mockResolvedValue({
      getViewport: () => ({ width: 10, height: 10 }),
      render: pdf.render,
    });
    const input = {
      type: 'application/pdf',
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)),
    } as Blob;
    const noContext = vi.spyOn(document, 'createElement').mockReturnValueOnce({
      getContext: () => null,
    } as never);
    await expect(renderPlan(input)).rejects.toThrow(
      'allocation_plan_preview_failed',
    );
    noContext.mockRestore();
    const noRaster = vi.spyOn(document, 'createElement').mockReturnValueOnce({
      width: 0,
      height: 0,
      getContext: () => ({}),
      toBlob: (callback: (value: null) => void) => callback(null),
    } as never);
    await expect(renderPlan(input)).rejects.toThrow(
      'allocation_plan_preview_failed',
    );
    noRaster.mockRestore();
  });

  it('loads an image and provides bounded button and keyboard zoom [AC-001, AC-004]', async () => {
    const release = vi.fn();
    render(
      <AllocationPlanViewer
        loadContent={() =>
          Promise.resolve(new Blob(['png'], { type: 'image/png' }))
        }
        plan={plan}
        render={() => Promise.resolve({ src: 'preview.png', release })}
      />,
    );
    expect(screen.getByText('Loading plan…')).toBeVisible();
    expect(
      await screen.findByRole('img', { name: plan.filename }),
    ).toHaveAttribute('src', 'preview.png');
    const viewer = screen.getByRole('region', {
      name: `${plan.filename} preview`,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(
      screen.getByRole('button', { name: 'Reset zoom' }),
    ).toHaveTextContent('125%');
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(
      screen.getByRole('button', { name: 'Reset zoom' }),
    ).toHaveTextContent('100%');
    fireEvent.keyDown(viewer, { key: '0' });
    expect(
      screen.getByRole('button', { name: 'Reset zoom' }),
    ).toHaveTextContent('100%');
    for (let index = 0; index < 20; index += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    fireEvent.keyDown(viewer, { key: '=', ctrlKey: true });
    fireEvent.keyDown(viewer, { key: '=', altKey: true });
    fireEvent.keyDown(viewer, { key: '=', metaKey: true });
    fireEvent.keyDown(viewer, { key: 'ArrowRight' });
    fireEvent.keyDown(viewer, { key: '+' });
    fireEvent.keyDown(viewer, { key: '=' });
    fireEvent.keyDown(viewer, { key: '-' });
    for (let index = 0; index < 20; index += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  });

  it('shows a generic failure and releases rendered content on unmount [AC-003, AC-004]', async () => {
    const failed = render(
      <AllocationPlanViewer
        loadContent={() => Promise.reject(new Error('private'))}
        plan={plan}
      />,
    );
    expect(
      await screen.findByText(
        'We couldn’t display this plan. Please try again.',
      ),
    ).toBeVisible();
    failed.unmount();

    const release = vi.fn();
    const ready = render(
      <AllocationPlanViewer
        loadContent={() => Promise.resolve(new Blob())}
        plan={plan}
        render={() => Promise.resolve({ src: 'preview.png', release })}
      />,
    );
    await screen.findByRole('img');
    ready.unmount();
    await waitFor(() => expect(release).toHaveBeenCalledOnce());
  });

  it('releases a render that finishes after unmount [AC-004]', async () => {
    let finish: ((value: { src: string; release: () => void }) => void) | undefined;
    const release = vi.fn();
    const renderContent = vi.fn(
      () =>
        new Promise<{ src: string; release: () => void }>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(
      <AllocationPlanViewer
        loadContent={() => Promise.resolve(new Blob())}
        plan={plan}
        render={renderContent}
      />,
    );
    await waitFor(() => expect(renderContent).toHaveBeenCalledOnce());
    view.unmount();
    finish?.({ src: 'late', release });
    await waitFor(() => expect(release).toHaveBeenCalledOnce());
  });
});
