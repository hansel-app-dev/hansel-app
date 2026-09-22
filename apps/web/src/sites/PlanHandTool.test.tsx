/** @spec allocation-plan-hand-tool REQ-001..007 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AllocationPlanViewer } from './AllocationPlanViewer.js';
import type { PlanSign } from '@hansel/contracts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const sign: PlanSign = {
  id: 'sign',
  fileId: null,
  x: 0.5,
  y: 0.5,
  code: 'SG.001',
  content: '',
  mounting: 'Wall-mounted',
  function: 'Directional',
  colour: 'Red',
  orientation: 'down',
  updatedAt: '2026-09-19T00:00:00.000Z',
};
const plan = {
  id: 'plan',
  filename: 'Plan.png',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: sign.updatedAt,
  modifiedAt: sign.updatedAt,
  uploadedBy: 'Test',
};
function pointer(
  target: HTMLElement,
  type: string,
  x = 100,
  y = 100,
  extras: object = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    ...extras,
  });
  fireEvent(target, event);
}
async function setup(canManageSigns = true) {
  const api = {
    load: vi.fn().mockResolvedValue({ signs: [sign], canManageSigns }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const view = render(
    <AllocationPlanViewer
      plan={{
        ...plan,
        files: ['Plan.png', 'Second.png'].map((filename, i) => ({
          id: String(i),
          filename,
          mediaType: 'image/png',
          byteSize: 3,
        })),
      }}
      planSignsApi={api}
      loadContent={() => Promise.resolve(new Blob())}
      render={() => Promise.resolve({ src: 'preview.png', release: vi.fn() })}
    />,
  );
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  const viewport = screen.getByTestId('plan-pan-viewport');
  Object.defineProperties(viewport, {
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 1000 },
    scrollHeight: { configurable: true, value: 800 },
  });
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  Object.assign(viewport, {
    scrollLeft: 100,
    scrollTop: 100,
    setPointerCapture,
    hasPointerCapture: () => true,
    releasePointerCapture,
  });
  return {
    api,
    view,
    viewport,
    marker,
    setPointerCapture,
    releasePointerCapture,
  };
}

it('REQ-001..003: Hand pans overflow in both axes without changing Signs', async () => {
  const { api, viewport, marker } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  pointer(marker, 'pointerdown');
  pointer(viewport, 'pointermove', 50, 25);
  expect(viewport).toMatchObject({ scrollLeft: 150, scrollTop: 175 });
  expect(screen.getByRole('region')).toHaveClass('cursor-grabbing');
  pointer(viewport, 'pointerup', 50, 25);
  fireEvent.click(marker);
  expect(screen.getByRole('region')).toHaveClass('cursor-grab');
  expect(screen.queryByLabelText('Sign details')).not.toBeInTheDocument();
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
});

it('REQ-003, REQ-005: portaled toolbar and drawer controls remain interactive in Hand mode', async () => {
  const { marker, setPointerCapture } = await setup();
  fireEvent.click(marker);
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  const move = screen.getByRole('button', { name: 'Move' });
  pointer(move, 'pointerdown');
  expect(setPointerCapture).not.toHaveBeenCalled();
  pointer(move, 'pointerup');
  fireEvent.click(move);
  expect(move).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  const close = screen.getByRole('button', { name: 'Close sign details' });
  pointer(close, 'pointerdown');
  pointer(close, 'pointerup');
  fireEvent.click(close);
  expect(screen.queryByLabelText('Sign details')).not.toBeInTheDocument();
  expect(setPointerCapture).not.toHaveBeenCalled();
});

it('REQ-002, REQ-006: clamps pointer and keyboard pan, including fitted content for Viewers', async () => {
  const { viewport, api } = await setup(false);
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  pointer(viewport, 'pointerdown');
  pointer(viewport, 'pointermove', -2000, -2000);
  expect(viewport).toMatchObject({ scrollLeft: 600, scrollTop: 500 });
  pointer(viewport, 'pointermove', 2000, 2000);
  expect(viewport).toMatchObject({ scrollLeft: 0, scrollTop: 0 });
  pointer(viewport, 'pointerup');
  viewport.focus();
  expect(viewport).toHaveFocus();
  fireEvent.keyDown(viewport, { key: 'ArrowRight' });
  fireEvent.keyDown(viewport, { key: 'ArrowDown' });
  expect(viewport).toMatchObject({ scrollLeft: 40, scrollTop: 40 });
  fireEvent.keyDown(viewport, { key: 'ArrowLeft' });
  fireEvent.keyDown(viewport, { key: 'ArrowUp' });
  expect(viewport).toMatchObject({ scrollLeft: 0, scrollTop: 0 });
  Object.defineProperties(viewport, {
    scrollWidth: { value: 300 },
    scrollHeight: { value: 200 },
  });
  pointer(viewport, 'pointerdown');
  pointer(viewport, 'pointermove', -100, -100);
  expect(viewport).toMatchObject({ scrollLeft: 0, scrollTop: 0 });
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
});

it.each(['Escape', 'pointercancel', 'lostpointercapture', 'blur', 'unmount'])(
  'REQ-004: %s ends capture without a trailing Sign action',
  async (ending) => {
    const { viewport, marker, api, view, releasePointerCapture } =
      await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
    pointer(viewport, 'pointerdown');
    pointer(viewport, 'pointermove', 50, 50);
    if (ending === 'Escape') fireEvent.keyDown(window, { key: 'Escape' });
    else if (ending === 'blur') fireEvent(window, new Event('blur'));
    else if (ending === 'unmount') view.unmount();
    else pointer(viewport, ending);
    expect(releasePointerCapture).toHaveBeenCalledWith(1);
    if (ending !== 'unmount') {
      pointer(viewport, 'pointermove', 0, 0);
      expect(viewport).toMatchObject({ scrollLeft: 150, scrollTop: 150 });
      expect(screen.getByRole('region')).not.toHaveClass('cursor-grabbing');
      expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      fireEvent.click(marker);
      expect(screen.queryByLabelText('Sign details')).not.toBeInTheDocument();
    }
    expect(api.update).not.toHaveBeenCalled();
  },
);

it('REQ-004..005: ignores secondary pointers and retains Hand after Space release', async () => {
  const { viewport } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  pointer(viewport, 'pointerdown', 100, 100, { isPrimary: false });
  pointer(viewport, 'pointermove', 50, 50);
  expect(viewport.scrollLeft).toBe(100);
  pointer(viewport, 'pointerdown', 100, 100, { button: 2 });
  pointer(viewport, 'pointermove', 50, 50);
  expect(viewport.scrollLeft).toBe(100);
  pointer(viewport, 'pointerdown');
  pointer(viewport, 'pointerup', 100, 100, { pointerId: 2 });
  pointer(viewport, 'pointermove', 50, 50);
  expect(viewport.scrollLeft).toBe(150);
  pointer(viewport, 'pointerup');
  fireEvent.keyUp(window, { code: 'Space', key: ' ' });
  expect(screen.getByRole('button', { name: 'Hand' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  pointer(viewport, 'pointerdown');
  pointer(viewport, 'pointermove', 50, 50);
  expect(viewport.scrollLeft).toBe(200);
});

it('REQ-003, REQ-005: Space-pan restores Add mode without creating on the trailing click', async () => {
  const { viewport, api } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  fireEvent.pointerEnter(screen.getByRole('region'));
  fireEvent.keyDown(window, { code: 'Space', key: ' ' });
  pointer(viewport, 'pointerdown');
  pointer(viewport, 'pointermove', 50, 50);
  pointer(viewport, 'pointerup');
  fireEvent.keyUp(window, { code: 'Space', key: ' ' });
  fireEvent.click(screen.getByLabelText('Plan drawing'));
  expect(api.create).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Add sign' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

it('REQ-004..006: file changes reset Hand and capture; controls and modified keys do not pan', async () => {
  const { viewport, releasePointerCapture } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Hand' }), {
    key: 'ArrowRight',
  });
  fireEvent.keyDown(viewport, { key: 'ArrowRight', ctrlKey: true });
  fireEvent.keyDown(viewport, { key: 'ArrowRight', altKey: true });
  fireEvent.keyDown(viewport, { key: 'ArrowRight', metaKey: true });
  fireEvent.keyDown(viewport, { key: 'ArrowRight', shiftKey: true });
  expect(viewport.scrollLeft).toBe(100);
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Increase plan zoom' }),
  );
  expect(screen.getByRole('region')).not.toHaveClass('cursor-grabbing');
  pointer(viewport, 'pointerdown');
  fireEvent.click(screen.getByRole('button', { name: 'Select plan file' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Second.png' }));
  await screen.findByRole('img', { name: 'Second.png' });
  expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(releasePointerCapture).toHaveBeenCalledWith(1);
  expect(screen.getByRole('region')).not.toHaveClass('cursor-grabbing');
});
