import type { PlanLinearLayer } from './PlanLinearLayer.js';
import { useImperativeHandle, type ComponentProps } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import type { PlanAreas } from './PlanAreas.js';
import type { PlanComments } from './PlanComments.js';
const captured = vi.hoisted(() => ({
  linear: null as ComponentProps<typeof PlanLinearLayer> | null,
  area: null as ComponentProps<typeof PlanAreas> | null,
  comments: null as ComponentProps<typeof PlanComments> | null,
  areaHandle: {
    leave: vi.fn().mockReturnValue(true),
    clear: vi.fn(),
    keyDown: vi.fn(),
    blocked: vi.fn().mockReturnValue(false),
  },
  commentHandle: {
    place: vi.fn(),
    leave: vi.fn().mockReturnValue(true),
    clear: vi.fn(),
    keyDown: vi.fn(),
  },
}));
vi.mock('./PlanAreas.js', () => ({
  PlanAreas: (props: ComponentProps<typeof PlanAreas>) => {
    captured.area = props;
    useImperativeHandle(props.ref, () => captured.areaHandle);
    return null;
  },
}));
vi.mock('./PlanComments.js', () => ({
  PlanComments: (props: ComponentProps<typeof PlanComments>) => {
    captured.comments = props;
    useImperativeHandle(props.ref, () => captured.commentHandle);
    return null;
  },
}));
vi.mock('./PlanLinearLayer.js', () => ({
  PlanLinearLayer: (props: ComponentProps<typeof PlanLinearLayer>) => {
    captured.linear = props;
    useImperativeHandle(props.ref, () => ({
      keyDown: vi.fn(),
      cancel: vi.fn(),
    }));
    return null;
  },
}));
const id = '00000000-0000-4000-8000-000000000001',
  sign = {
    id,
    fileId: null,
    x: 0.5,
    y: 0.5,
    code: 'SG.001',
    content: '',
    orientation: 'down' as const,
    mounting: 'Wall-mounted' as const,
    function: 'Directional' as const,
    colour: 'Red' as const,
    updatedAt: '2026-09-27T00:00:00Z',
  };
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing layer');
  return value;
}
beforeEach(() => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
    },
  );
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => false,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  captured.areaHandle.leave.mockReturnValue(true);
  captured.commentHandle.leave.mockReturnValue(true);
});
it('coordinates selection guards, drawing input and exclusive tools across Signs, Areas and comments', async () => {
  const api = {
    load: vi.fn().mockResolvedValue({
      signs: [sign],
      canManageSigns: true,
      planCommentsEnabled: true,
    }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    areas: {} as never,
    planComments: {} as never,
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
  await screen.findByRole('button', { name: 'Select sign SG.001' });
  const drawing = screen.getByLabelText('Plan drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  fireEvent.pointerMove(drawing, { clientX: 250, clientY: 200 });
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
    fireEvent.keyDown(drawing, { key });
  fireEvent.pointerLeave(drawing);
  fireEvent.click(screen.getByRole('button', { name: 'Move' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(captured.commentHandle.keyDown).toHaveBeenCalled();
  fireEvent.click(drawing, { clientX: 250, clientY: 200 });
  expect(captured.commentHandle.place).toHaveBeenCalledWith(0.25, 0.25);
  act(() => {
    required(captured.comments).onActivateMove();
  });
  expect(screen.getByRole('button', { name: 'Move' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  act(() => {
    expect(required(captured.comments).beforeOpen()).toBe(true);
  });
  expect(screen.queryByLabelText('Sign details')).toBeNull();
  captured.areaHandle.leave.mockReturnValue(false);
  act(() => {
    expect(required(captured.comments).beforeOpen()).toBe(false);
  });
  captured.areaHandle.leave.mockReturnValue(true);
  captured.commentHandle.leave.mockReturnValue(false);
  act(() => {
    expect(required(captured.area).beforeSelect()).toBe(false);
  });
  captured.commentHandle.leave.mockReturnValue(true);
  act(() => {
    expect(required(captured.area).beforeSelect()).toBe(true);
  });
  act(() => {
    required(captured.area).onActivateMove();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add area' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(captured.areaHandle.keyDown).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add linear' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'Escape' });
});

it('honours comment and area vetoes for sign movement, placement and linear selection', async () => {
  const api = {
    load: vi.fn().mockResolvedValue({
      signs: [sign],
      canManageSigns: true,
      planCommentsEnabled: true,
    }),
    create: vi.fn().mockResolvedValue({ ...sign, id: 'second' }),
    update: vi.fn().mockResolvedValue(sign),
    remove: vi.fn(),
    areas: {} as never,
    planComments: {} as never,
  };
  const view = render(
    <PlanSignsSurface
      api={api}
      fileId={null}
      panning={false}
      drawerHost={document.body}
    >
      <img alt="Plan" />
    </PlanSignsSurface>,
  );
  const marker = await screen.findByRole('button', {
      name: 'Select sign SG.001',
    }),
    drawing = screen.getByLabelText('Plan drawing');
  const bounds = vi
    .spyOn(drawing, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 1000, 800));
  captured.commentHandle.leave.mockReturnValue(false);
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  fireEvent.pointerDown(marker, { button: 0, isPrimary: true, pointerId: 1 });
  expect(api.update).not.toHaveBeenCalled();
  expect(required(captured.linear).beforeCreate()).toBe(false);
  expect(required(captured.linear).onSelect(sign)).toBe(false);
  captured.commentHandle.leave.mockReturnValue(true);
  fireEvent.pointerDown(marker, { button: 0, clientX: 500, clientY: 400 });
  fireEvent.pointerCancel(marker);
  captured.areaHandle.blocked.mockReturnValue(true);
  fireEvent.pointerDown(marker, { button: 0, isPrimary: true, pointerId: 1 });
  expect(api.update).not.toHaveBeenCalled();
  captured.areaHandle.blocked.mockReturnValue(false);
  bounds.mockReturnValue(new DOMRect(0, 0, 1000, 0));
  fireEvent.pointerDown(marker, { button: 0, isPrimary: true, pointerId: 1 });
  expect(api.update).not.toHaveBeenCalled();
  bounds.mockReturnValue(new DOMRect(0, 0, 1000, 800));
  act(() => {
    required(captured.comments).onBusyChange(true);
  });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  expect(api.update).not.toHaveBeenCalled();
  act(() => {
    required(captured.comments).onBusyChange(false);
    required(captured.area).onBusyChange(true);
  });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  expect(api.update).not.toHaveBeenCalled();
  act(() => {
    required(captured.area).onBusyChange(false);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Wall-mounted' }));
  await waitFor(() => {
    expect(api.create).toHaveBeenCalled();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  fireEvent.pointerLeave(drawing);
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'])
    fireEvent.keyDown(drawing, { key });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'Escape' });
  const down = new Event('pointerdown', { bubbles: true });
  Object.assign(down, { clientX: 10, clientY: 10 });
  fireEvent(drawing, down);
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  expect(screen.queryByRole('menuitem', { name: 'Wall-mounted' })).toBeNull();
  view.unmount();
  render(
    <PlanSignsSurface
      api={{
        ...api,
        load: vi.fn().mockResolvedValue({
          signs: [sign],
          canManageSigns: false,
          planCommentsEnabled: true,
        }),
      }}
      fileId={null}
      panning={false}
      drawerHost={document.body}
    >
      <img alt="Plan" />
    </PlanSignsSurface>,
  );
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Add sign' })).toBeDisabled();
  });
  fireEvent.keyDown(screen.getByLabelText('Plan drawing'), { key: 'Escape' });
  expect(captured.commentHandle.clear).toHaveBeenCalled();
});

it('uses the viewer bounds for placement and protects asynchronous mutations during navigation', async () => {
  const api = {
    load: vi.fn().mockResolvedValue({
      signs: [sign, { ...sign, id: 'sibling', code: 'SG.002' }],
      canManageSigns: true,
      planCommentsEnabled: true,
    }),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(sign),
    remove: vi.fn(),
    areas: {} as never,
    planComments: {} as never,
  };
  const view = render(
    <div data-testid="plan-pan-viewport">
      <PlanSignsSurface
        api={api}
        fileId={null}
        panning={false}
        drawerHost={document.body}
      >
        <img alt="Plan" />
      </PlanSignsSurface>
    </div>,
  );
  await screen.findByRole('button', { name: 'Select sign SG.001' });
  const drawing = screen.getByLabelText('Plan drawing'),
    viewport = screen.getByTestId('plan-pan-viewport');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(20, 30, 1000, 800),
  );
  act(() => {
    required(captured.linear).onCreate({
      fileId: null,
      x: 0.2,
      y: 0.2,
      mounting: 'Safety Decal',
      idempotencyKey: id,
    });
  });
  expect(api.create).not.toHaveBeenCalled();
  await required(captured.linear).onTransform(sign, {
    x: 0.3,
    y: 0.3,
    endX: 0.4,
    endY: 0.4,
  });
  expect(api.update).toHaveBeenCalledOnce();
  await waitFor(() => {
    expect(screen.getByLabelText('Sign details')).toBeVisible();
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close sign details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  fireEvent.keyDown(screen.getByLabelText('Sign details'), { key: 'Escape' });
  expect(screen.queryByLabelText('Sign details')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  await required(captured.linear).onTransform(sign, {
    x: 0.3,
    y: 0.3,
    endX: 0.4,
    endY: 0.4,
  });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'Escape' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'Escape' });
  let finish: (value: typeof sign) => void = () => undefined;
  api.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Move' }));
  fireEvent.pointerDown(drawing, { clientX: 200, clientY: 200 });
  fireEvent.click(drawing, { clientX: 200, clientY: 200 });
  const marker = screen.getByRole('button', { name: 'Select sign SG.001' });
  act(() => {
    fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  });
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  view.unmount();
  await act(() => {
    finish(sign);
    return Promise.resolve();
  });
});

it('opens comments when the Area service is absent and keeps read-only selections immovable', async () => {
  const api = {
    load: vi.fn().mockResolvedValue({
      signs: [sign],
      canManageSigns: false,
      planCommentsEnabled: true,
    }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    planComments: {} as never,
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
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  act(() => {
    expect(required(captured.comments).beforeOpen()).toBe(true);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Hand' }));
  fireEvent.click(marker);
  expect(screen.queryByLabelText('Sign details')).toBeNull();
});

it('ignores a Linear transform result after its surface is removed', async () => {
  let finish: () => void = () => undefined;
  const api = {
    load: vi.fn().mockResolvedValue({ signs: [sign], canManageSigns: true }),
    create: vi.fn(),
    update: vi.fn(
      () =>
        new Promise<typeof sign>((resolve) => {
          finish = () => {
            resolve(sign);
          };
        }),
    ),
    remove: vi.fn(),
  };
  const view = render(
    <PlanSignsSurface
      api={api}
      fileId={null}
      panning={false}
      drawerHost={document.body}
    >
      <img alt="Plan" />
    </PlanSignsSurface>,
  );
  await screen.findByRole('button', { name: 'Select sign SG.001' });
  const pending = required(captured.linear).onTransform(sign, {
    x: 0.3,
    y: 0.3,
    endX: 0.4,
    endY: 0.4,
  });
  view.unmount();
  await act(() => {
    finish();
    return pending;
  });
  expect(api.update).toHaveBeenCalledOnce();
});

it('returns focus to the created Linear sign after the animation frame', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const api = {
    load: vi.fn().mockResolvedValue({ signs: [], canManageSigns: true }),
    create: vi.fn().mockResolvedValue(sign),
    update: vi.fn(),
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
  fireEvent.click(await screen.findByRole('button', { name: 'Add linear' }));
  act(() => {
    required(captured.linear).onCreate({
      fileId: null,
      x: 0.2,
      y: 0.2,
      endX: 0.4,
      endY: 0.4,
      placementKind: 'linear',
      mounting: 'Safety Decal',
      idempotencyKey: id,
    });
  });
  const marker = await screen.findByRole('button', {
    name: 'Select sign SG.001',
  });
  document.body.focus();
  act(() => {
    frames.forEach((callback) => {
      callback(0);
    });
  });
  expect(marker).toHaveFocus();
});
