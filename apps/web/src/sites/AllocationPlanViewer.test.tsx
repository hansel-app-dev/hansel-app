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
    const viewport = screen.getByTestId('plan-pan-viewport');
    const zoomSurface = screen.getByTestId('plan-zoom-surface');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 300 },
      scrollWidth: {
        configurable: true,
        get: () => Number.parseFloat(zoomSurface.style.width) * 10,
      },
      scrollHeight: {
        configurable: true,
        get: () => Number.parseFloat(zoomSurface.style.width) * 8,
      },
    });
    viewport.scrollLeft = 300;
    viewport.scrollTop = 250;
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomSurface).toHaveStyle({
      width: '125%',
    });
    expect(viewport).toMatchObject({ scrollLeft: 425, scrollTop: 350 });
    expect(screen.getByRole('img', { name: plan.filename })).toHaveClass(
      'w-full',
    );
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

  it('pans with Space-primary-pointer drag and exits cleanly [REQ-016, AC-005]', async () => {
    render(
      <AllocationPlanViewer
        loadContent={() => Promise.resolve(new Blob())}
        plan={plan}
        render={() =>
          Promise.resolve({ src: 'preview.png', release: vi.fn() })
        }
      />,
    );
    await screen.findByRole('img');
    const viewer = screen.getByRole('region', {
      name: `${plan.filename} preview`,
    });
    const viewport = screen.getByTestId('plan-pan-viewport');
    Object.assign(viewport, {
      scrollLeft: 180,
      scrollTop: 120,
      hasPointerCapture: vi.fn().mockReturnValue(true),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    });

    fireEvent.pointerEnter(viewer);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(viewer).toHaveClass('cursor-grab');
    const dispatchPointer = (
      type: string,
      properties: Record<string, number>,
    ) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, properties);
      fireEvent(viewport, event);
    };
    dispatchPointer('pointerdown', {
      button: 0,
      clientX: 100,
      clientY: 80,
      pointerId: 4,
    });
    expect(viewer).toHaveClass('cursor-grabbing');
    fireEvent.pointerLeave(viewer);
    expect(viewer).toHaveClass('cursor-grabbing');
    fireEvent.dragStart(screen.getByRole('img'));
    dispatchPointer('pointermove', {
      clientX: 70,
      clientY: 50,
      pointerId: 4,
    });
    expect(viewport).toMatchObject({ scrollLeft: 210, scrollTop: 150 });
    expect(viewport.setPointerCapture).toHaveBeenCalledWith(4);
    dispatchPointer('pointerup', { pointerId: 4 });
    expect(viewport.releasePointerCapture).toHaveBeenCalledWith(4);
    expect(viewer).toHaveClass('cursor-grab');
    fireEvent.keyUp(window, { key: ' ', code: 'Space' });
    expect(viewer).not.toHaveClass('cursor-grab');
    fireEvent.dragStart(screen.getByRole('img'));

    dispatchPointer('pointermove', {
      clientX: 1,
      clientY: 1,
      pointerId: 4,
    });
    dispatchPointer('pointerdown', {
      button: 0,
      clientX: 1,
      clientY: 1,
      pointerId: 5,
    });
    fireEvent.pointerLeave(viewer);
    fireEvent.keyDown(window, { key: 'x', code: 'KeyX' });
    fireEvent.keyUp(window, { key: 'x', code: 'KeyX' });
    fireEvent.keyDown(window, { key: ' ', code: 'Space', altKey: true });
    fireEvent.keyDown(window, { key: ' ', code: 'Space', ctrlKey: true });
    fireEvent.keyDown(window, { key: ' ', code: 'Space', metaKey: true });
    expect(viewer).not.toHaveClass('cursor-grab');
    fireEvent.keyUp(window, { key: ' ', code: 'Space' });

    fireEvent.pointerEnter(viewer);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    dispatchPointer('pointerdown', {
      button: 1,
      clientX: 40,
      clientY: 40,
      pointerId: 6,
    });
    expect(viewer).not.toHaveClass('cursor-grabbing');
    dispatchPointer('pointerdown', {
      button: 0,
      clientX: 40,
      clientY: 40,
      pointerId: 6,
    });
    dispatchPointer('pointermove', {
      clientX: 20,
      clientY: 20,
      pointerId: 7,
    });
    dispatchPointer('pointercancel', { pointerId: 6 });
    expect(viewer).toHaveClass('cursor-grab');

    dispatchPointer('pointerdown', {
      button: 0,
      clientX: 40,
      clientY: 40,
      pointerId: 8,
    });
    vi.mocked(viewport.hasPointerCapture).mockReturnValue(false);
    fireEvent(window, new Event('blur'));
    expect(viewer).not.toHaveClass('cursor-grab');
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
