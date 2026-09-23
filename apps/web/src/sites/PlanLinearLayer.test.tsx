/** @spec allocation-plan-add-linear REQ-003,008,011 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  PlanSign,
  PlanSignCreate,
  PlanSignPatch,
} from '@hansel/contracts';
import { PlanSignsSurface } from './PlanSignsSurface.js';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const sign: PlanSign = {
  id: crypto.randomUUID(),
  fileId: null,
  placementKind: 'linear',
  x: 0.3,
  y: 0.3,
  endX: 0.6,
  endY: 0.3,
  code: 'Pr.01',
  mounting: 'Safety Decal',
  function: 'Regulatory/Statutory',
  colour: 'Orange',
  orientation: 'down',
  content: '',
  updatedAt: new Date().toISOString(),
};
it('REQ-003,008,011 creates by keyboard and opens shared drawer with fixed choices and editable Function', async () => {
  const api = {
    load: vi.fn().mockResolvedValue({ canManageSigns: true, signs: [] }),
    create: vi.fn((input: PlanSignCreate) =>
      Promise.resolve({ ...sign, ...input, mounting: sign.mounting }),
    ),
    update: vi.fn((_id: string, changes: PlanSignPatch) =>
      Promise.resolve({ ...sign, function: changes.function ?? sign.function }),
    ),
    remove: vi.fn(),
  };
  render(
    <PlanSignsSurface
      api={api}
      fileId={null}
      panning={false}
      drawerHost={document.body}
    >
      <img alt="Plan" />
    </PlanSignsSurface>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Add linear' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add linear' }));
  const drawing = screen.getByLabelText('Linear drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(
    within(screen.getByRole('menu', { name: 'Add linear type' })).getAllByRole(
      'menuitem',
    ),
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole('menuitem', { name: 'Safety Decal' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.keyDown(drawing, { key: 'ArrowRight' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  await screen.findByLabelText('Sign details');
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({
      placementKind: 'linear',
      mounting: 'Safety Decal',
      x: 0.5,
      y: 0.5,
      endX: 0.51,
      endY: 0.5,
    }),
  );
  expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.click(screen.getByRole('option', { name: 'Safety Decal' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Colour' }));
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.click(screen.getByRole('option', { name: 'Orange' }));
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('combobox', { name: 'Function' }));
  fireEvent.click(screen.getByRole('option', { name: 'Informational' }));
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledWith(
      sign.id,
      expect.objectContaining({ function: 'Informational' }),
    );
  });
});

import { PlanLinearLayer } from './PlanLinearLayer.js';
function pointer(target: Element, type: string, x: number, y: number) {
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
function layer(
  overrides: Partial<React.ComponentProps<typeof PlanLinearLayer>> = {},
) {
  const props = {
    signs: [sign],
    selectedId: sign.id,
    tool: 'move' as const,
    panning: false,
    canManage: true,
    blocked: false,
    fileId: null,
    host: document.body,
    beforeCreate: vi.fn(() => true),
    onSelect: vi.fn(() => true),
    onCreate: vi.fn(),
    onTransform: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const view = render(<PlanLinearLayer {...props} />);
  const canvas = screen.getByLabelText('Linear drawing');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  for (const element of [canvas, ...screen.queryAllByRole('button')])
    Object.assign(element, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
    });
  return { props, view, canvas };
}
it('REQ-010 moves the whole segment and edits endpoints, cancels without writes', async () => {
  const { props } = layer();
  const badge = screen.getByRole('button', { name: 'Select sign Pr.01' });
  pointer(badge, 'pointerdown', 300, 240);
  pointer(badge, 'pointermove', 400, 320);
  pointer(badge, 'pointerup', 400, 320);
  expect(props.onTransform).toHaveBeenLastCalledWith(sign, {
    x: 0.4,
    y: 0.4,
    endX: 0.7,
    endY: 0.4,
  });
  fireEvent.click(badge);
  expect(props.onSelect).toHaveBeenCalledTimes(1);
  const end = screen.getByRole('button', { name: 'Resize Pr.01 end endpoint' });
  pointer(end, 'pointerdown', 600, 240);
  pointer(end, 'pointermove', 900, 700);
  pointer(end, 'pointerup', 900, 700);
  expect(props.onTransform).toHaveBeenLastCalledWith(sign, {
    x: 0.3,
    y: 0.3,
    endX: 0.9,
    endY: 0.875,
  });
  const start = screen.getByRole('button', {
    name: 'Resize Pr.01 start endpoint',
  });
  pointer(start, 'pointerdown', 300, 240);
  pointer(start, 'pointermove', 200, 80);
  pointer(start, 'pointerup', 200, 80);
  expect(props.onTransform).toHaveBeenLastCalledWith(sign, {
    x: 0.2,
    y: 0.1,
    endX: 0.6,
    endY: 0.3,
  });
  pointer(badge, 'pointerdown', 300, 240);
  pointer(badge, 'pointermove', 400, 400);
  fireEvent.keyDown(window, { key: 'Escape' });
  pointer(badge, 'pointerup', 400, 400);
  expect(props.onTransform).toHaveBeenCalledTimes(3);
  fireEvent.keyDown(badge, { key: 'ArrowLeft', altKey: true });
  expect(props.onTransform).toHaveBeenLastCalledWith(sign, {
    x: 0.29,
    y: 0.3,
    endX: 0.59,
    endY: 0.3,
  });
  fireEvent.keyDown(end, { key: 'Enter' });
  fireEvent.keyDown(end, { key: 'ArrowDown' });
  fireEvent.keyDown(end, { key: 'Enter' });
  await waitFor(() => {
    expect(props.onTransform).toHaveBeenLastCalledWith(sign, {
      x: 0.3,
      y: 0.3,
      endX: 0.6,
      endY: 0.31,
    });
  });
  fireEvent.keyDown(start, { key: ' ' });
  fireEvent.keyDown(start, { key: 'ArrowUp' });
  fireEvent.blur(start);
  expect(props.onTransform).toHaveBeenCalledTimes(5);
});
it('REQ-003..005 tiny, canceled and valid reverse pointer drawing; no accidental duplicate', () => {
  const { props, canvas } = layer({ tool: 'line' });
  fireEvent.click(canvas, { clientX: 500, clientY: 400 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Safety Decal' }));
  pointer(canvas, 'pointerdown', 500, 400);
  pointer(canvas, 'pointerup', 501, 401);
  fireEvent.click(canvas);
  expect(props.onCreate).not.toHaveBeenCalled();
  pointer(canvas, 'pointerdown', 500, 400);
  pointer(canvas, 'pointermove', 300, 200);
  pointer(canvas, 'pointerup', 300, 200);
  fireEvent.click(canvas);
  expect(props.onCreate).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      x: 0.5,
      y: 0.5,
      endX: 0.3,
      endY: 0.25,
      placementKind: 'linear',
    }),
  );
  fireEvent.click(canvas, { clientX: 500, clientY: 400 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Safety Decal' }));
  pointer(canvas, 'pointerdown', 500, 400);
  pointer(canvas, 'pointermove', 600, 500);
  fireEvent.blur(window);
  pointer(canvas, 'pointerup', 600, 500);
  expect(props.onCreate).toHaveBeenCalledTimes(1);
});
it('REQ-001,005 honors blocked, Viewer, pan and selection guards', () => {
  const { props, view, canvas } = layer({ blocked: true });
  const badge = screen.getByRole('button', { name: 'Select sign Pr.01' });
  pointer(badge, 'pointerdown', 300, 240);
  pointer(badge, 'pointermove', 400, 400);
  pointer(badge, 'pointerup', 400, 400);
  fireEvent.keyDown(badge, { key: 'ArrowRight', altKey: true });
  expect(props.onTransform).not.toHaveBeenCalled();
  view.rerender(
    <PlanLinearLayer {...props} blocked={false} canManage={false} />,
  );
  fireEvent.click(badge);
  expect(props.onSelect).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('button', { name: 'Resize Pr.01 end endpoint' }),
  ).not.toBeInTheDocument();
  view.rerender(
    <PlanLinearLayer {...props} tool="line" blocked={false} panning />,
  );
  fireEvent.click(canvas);
  fireEvent.keyDown(canvas, { key: 'Enter' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  view.rerender(
    <PlanLinearLayer
      {...props}
      blocked={false}
      beforeCreate={() => false}
      tool="line"
    />,
  );
  fireEvent.click(canvas);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  view.rerender(
    <PlanLinearLayer {...props} blocked={false} onSelect={() => false} />,
  );
  pointer(badge, 'pointerdown', 300, 240);
  pointer(badge, 'pointerup', 400, 400);
  expect(props.onTransform).not.toHaveBeenCalled();
});
it('REQ-005,011 cancels capture, scroll and endpoint drafts, selects SVG strokes with keyboard', () => {
  const { props, view, canvas } = layer();
  const stroke = screen.getByRole('button', { name: 'Move sign Pr.01' });
  fireEvent.click(stroke);
  fireEvent.keyDown(stroke, { key: 'Enter' });
  fireEvent.keyDown(stroke, { key: ' ' });
  fireEvent.keyDown(stroke, { key: 'x' });
  pointer(stroke, 'pointerdown', 300, 240);
  pointer(stroke, 'pointermove', 350, 250);
  fireEvent(stroke, new Event('lostpointercapture', { bubbles: true }));
  fireEvent(stroke, new Event('lostpointercapture', { bubbles: true }));
  pointer(stroke, 'pointerup', 350, 250);
  expect(props.onTransform).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Linear signs'));
  const endpoint = screen.getByRole('button', {
    name: 'Resize Pr.01 end endpoint',
  });
  fireEvent.click(endpoint);
  fireEvent.keyDown(endpoint, { key: 'ArrowUp' });
  fireEvent.keyDown(endpoint, { key: 'Enter' });
  fireEvent.keyDown(endpoint, { key: 'ArrowLeft' });
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(props.onTransform).not.toHaveBeenCalled();
  fireEvent.keyDown(endpoint, { key: 'Enter' });
  fireEvent.keyDown(endpoint, { key: 'Enter' });
  expect(props.onTransform).not.toHaveBeenCalled();
  view.rerender(<PlanLinearLayer {...props} tool="hand" />);
  fireEvent.click(stroke);
  fireEvent.keyDown(stroke, { key: 'Enter' });
  pointer(stroke, 'pointerdown', 300, 240);
  view.rerender(<PlanLinearLayer {...props} tool="line" />);
  pointer(canvas, 'pointerdown', 300, 200);
  fireEvent.click(canvas, { clientX: 300, clientY: 200 });
  fireEvent.scroll(screen.getByRole('menu'));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.scroll(document);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.click(canvas, { clientX: 300, clientY: 200 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Safety Decal' }));
  fireEvent.click(canvas);
  expect(props.onCreate).not.toHaveBeenCalled();
  pointer(canvas, 'pointerdown', 300, 200);
  fireEvent.pointerCancel(canvas);
  pointer(canvas, 'pointerup', 500, 400);
  expect(props.onCreate).not.toHaveBeenCalled();
});
it('REQ-004,005 handles zero-sized drawings, secondary pointers, clamping, dirty guards and keyboard focus', () => {
  const { props, view, canvas } = layer({ tool: 'line' });
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 0, 0),
  );
  fireEvent.keyDown(canvas, { key: 'Enter' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  const wrapper = document.createElement('div');
  wrapper.dataset.testid = 'plan-pan-viewport';
  canvas.parentElement?.append(wrapper);
  wrapper.append(canvas);
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(20, 30, 1000, 800),
  );
  fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
  fireEvent.keyDown(canvas, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Safety Decal' }));
  const right = new Event('pointerdown', { bubbles: true });
  Object.assign(right, {
    button: 2,
    isPrimary: true,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  fireEvent(canvas, right);
  expect(props.onCreate).not.toHaveBeenCalled();
  // Restore React's original DOM hierarchy before updates/unmount.
  wrapper.parentElement?.append(canvas);
  wrapper.remove();
  view.rerender(<PlanLinearLayer {...props} tool="move" />);
  const badge = screen.getByRole('button', { name: 'Select sign Pr.01' });
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 0, 0),
  );
  pointer(badge, 'pointerdown', 300, 240);
  expect(props.onTransform).not.toHaveBeenCalled();
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  pointer(badge, 'pointerdown', 300, 240);
  pointer(badge, 'pointermove', 301, 241);
  pointer(badge, 'pointerup', 301, 241);
  expect(props.onTransform).not.toHaveBeenCalled();
  pointer(badge, 'pointerdown', 300, 240);
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 0, 0),
  );
  pointer(badge, 'pointermove', 400, 300);
  pointer(badge, 'pointerup', 400, 300);
  view.rerender(
    <PlanLinearLayer
      {...props}
      tool="move"
      signs={[{ ...sign, x: 1, y: 1, endX: 0.9, endY: 0.9 }]}
    />,
  );
  expect(screen.getByRole('button', { name: 'Select sign Pr.01' })).toHaveStyle(
    { transform: 'translate(-100%,calc(-100% - 5px))' },
  );
});
it('REQ-005,011 preserves keyboard focus after a save and does not focus detached controls', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return 1;
  });
  const { props, view } = layer();
  const end = screen.getByRole('button', { name: 'Resize Pr.01 end endpoint' });
  end.focus();
  fireEvent.keyDown(end, { key: 'Enter' });
  fireEvent.keyDown(end, { key: 'ArrowDown' });
  fireEvent.keyDown(end, { key: 'Enter' });
  end.blur();
  await waitFor(() => {
    expect(frames).toHaveLength(1);
  });
  frames.shift()?.(0);
  expect(end).toHaveFocus();
  fireEvent.keyDown(end, { key: 'Enter' });
  fireEvent.keyDown(end, { key: 'ArrowUp' });
  fireEvent.keyDown(end, { key: 'Enter' });
  await waitFor(() => {
    expect(frames).toHaveLength(1);
  });
  view.unmount();
  frames.shift()?.(0);
  expect(props.onTransform).toHaveBeenCalledTimes(2);
});
it('REQ-001,005 prevents armed-mode transforms and rejected selection; tolerates legacy endpoint absence', () => {
  const { props, view } = layer({ tool: 'line' });
  const badge = screen.getByRole('button', { name: 'Select sign Pr.01' });
  pointer(badge, 'pointerdown', 300, 240);
  pointer(badge, 'pointermove', 400, 400);
  pointer(badge, 'pointerup', 400, 400);
  expect(props.onTransform).not.toHaveBeenCalled();
  view.rerender(
    <PlanLinearLayer {...props} tool="move" onSelect={() => false} />,
  );
  fireEvent.keyDown(badge, { key: 'ArrowDown', altKey: true });
  expect(props.onTransform).not.toHaveBeenCalled();
  view.rerender(<PlanLinearLayer {...props} tool="move" blocked />);
  fireEvent.keyDown(
    screen.getByRole('button', { name: 'Resize Pr.01 end endpoint' }),
    { key: 'Enter' },
  );
  expect(props.onTransform).not.toHaveBeenCalled();
  view.rerender(
    <PlanLinearLayer
      {...props}
      tool="move"
      signs={[{ ...sign, endX: null, endY: null }]}
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Move sign Pr.01' }),
  ).toHaveAttribute('x2', '0.3');
});
