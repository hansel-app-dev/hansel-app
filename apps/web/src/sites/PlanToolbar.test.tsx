import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlanSign } from '@hansel/contracts';
import { PlanSignsSurface } from './PlanSignsSurface.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function pointer(target: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
  fireEvent(target, event);
}
const sign: PlanSign = {
  id: 'one',
  fileId: null,
  x: 0.5,
  y: 0.5,
  code: 'SG.001',
  content: '',
  mounting: 'Wall-mounted',
  function: 'Wayfinder',
  colour: 'Red',
  orientation: 'down',
  updatedAt: '2026-09-19T00:00:00.000Z',
};
function setup(canManageSigns = true) {
  const api = {
    load: vi.fn().mockResolvedValue({
      canManageSigns,
      signs: [sign, { ...sign, id: 'two', code: 'SG.002' }],
    }),
    create: vi.fn().mockResolvedValue({ ...sign, id: 'three', code: 'SG.003' }),
    update: vi
      .fn()
      .mockImplementation((id: string, changes: object) =>
        Promise.resolve({ ...sign, id, ...changes }),
      ),
    remove: vi.fn(),
  };
  const props = {
    api,
    fileId: null,
    panning: false,
    drawerHost: document.body,
    children: <img alt="Plan" />,
  };
  const view = render(<PlanSignsSurface {...props} />);
  const drawing = screen.getByLabelText('Plan drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  return { api, drawing, view, props };
}

it('REQ-001..003, REQ-007: defaults to Move, renders six tools and never creates from blank selection', async () => {
  const { api, drawing } = setup();
  await screen.findByRole('button', { name: 'Select sign SG.001' });
  const toolbar = screen.getByRole('toolbar', { name: 'Plan tools' });
  pointer(toolbar, 'pointerdown', 0, 0);
  fireEvent.click(toolbar);
  expect(within(toolbar).getAllByRole('button')).toHaveLength(6);
  expect(within(toolbar).getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(
    within(toolbar)
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('disabled')),
  ).toHaveLength(3);
  fireEvent.click(drawing, { clientX: 500, clientY: 400 });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.002' }));
  expect(screen.getByLabelText('Sign code')).toHaveValue('SG.002');
  fireEvent.click(drawing, { clientX: 500, clientY: 400 });
  expect(screen.queryByLabelText('Sign details')).not.toBeInTheDocument();
});

it('REQ-004..005: Add sign enables creation but not movement; Move restores dragging and keyboard movement', async () => {
  const { api, drawing } = setup();
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  expect(marker).toHaveStyle({ cursor: 'pointer' });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.click(drawing, { clientX: 250, clientY: 200 });
  await screen.findByRole('button', { name: 'Select sign SG.003' });
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({ x: 0.25, y: 0.25 }),
  );
  expect(screen.getByRole('button', { name: 'Add sign' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Move' }));
  expect(marker).toHaveStyle({ cursor: 'move' });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledWith(
      'one',
      expect.objectContaining({ x: 0.51, y: 0.5 }),
    );
  });
});

it('REQ-003..005: drags exactly one Sign, cancels with Escape, and prevents Add-mode or pan mutations', async () => {
  const { api, drawing, view, props } = setup();
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  Object.assign(marker, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  pointer(marker, 'pointerdown', 500, 400);
  pointer(marker, 'pointermove', 600, 480);
  expect(marker).toHaveStyle({ left: '60%', top: '60%' });
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(marker).toHaveStyle({ left: '50%', top: '50%' });
  expect(api.update).not.toHaveBeenCalled();
  pointer(marker, 'pointerdown', 500, 400);
  pointer(marker, 'pointermove', 600, 480);
  pointer(marker, 'pointerup', 600, 480);
  fireEvent.click(marker);
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledExactlyOnceWith(
      'one',
      expect.objectContaining({ x: 0.6, y: 0.6 }),
    );
  });
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Add sign' })).toBeEnabled();
  });
  expect(
    screen.getByRole('button', { name: 'Select sign SG.002' }),
  ).toHaveStyle({ left: '50%', top: '50%' });
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  pointer(marker, 'pointerdown', 600, 480);
  pointer(marker, 'pointermove', 700, 560);
  pointer(marker, 'pointerup', 700, 560);
  expect(api.update).toHaveBeenCalledTimes(1);
  view.rerender(<PlanSignsSurface {...props} panning />);
  fireEvent.click(drawing, { clientX: 250, clientY: 200 });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(api.create).not.toHaveBeenCalled();
});

it('REQ-005..006: Viewers can select but neither create nor move', async () => {
  const { api, drawing } = setup(false);
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  expect(screen.getByRole('button', { name: 'Add sign' })).toBeDisabled();
  fireEvent.click(marker);
  expect(screen.getByLabelText('Sign code')).toHaveAttribute('readonly');
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  pointer(marker, 'pointerdown', 500, 400);
  pointer(marker, 'pointermove', 600, 480);
  pointer(marker, 'pointerup', 600, 480);
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(api.create).not.toHaveBeenCalled();
  expect(api.update).not.toHaveBeenCalled();
});

it('REQ-005: guards tool changes against unsaved edits and in-flight writes', async () => {
  const { api } = setup();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.change(screen.getByLabelText('Sign code'), {
    target: { value: 'Changed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  expect(confirm).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  expect(screen.queryByLabelText('Sign details')).not.toBeInTheDocument();
  api.create.mockReturnValue(new Promise(() => undefined));
  fireEvent.keyDown(screen.getByLabelText('Plan drawing'), { key: 'Enter' });
  expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add sign' })).toBeDisabled();
});

it('REQ-003, REQ-005: failed movement restores saved coordinates and offers retry', async () => {
  const { api } = setup();
  api.update.mockRejectedValueOnce(new Error('unavailable'));
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  Object.assign(marker, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  pointer(marker, 'pointerdown', 500, 400);
  pointer(marker, 'pointermove', 600, 480);
  pointer(marker, 'pointerup', 600, 480);
  await screen.findByText('We couldn’t save. Please try again.');
  await waitFor(() => {
    expect(marker).toHaveStyle({ left: '50%', top: '50%' });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => {
    expect(marker).toHaveStyle({ left: '60%', top: '60%' });
  });
  expect(api.create).not.toHaveBeenCalled();
});
