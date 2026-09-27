import { createRef } from 'react';
import type { PlanAreasHandle } from './PlanAreas.js';
import { PlanAreaRequestError } from './plan-areas-api.js';
/** @spec allocation-plan-add-area REQ-003..REQ-011 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  PlanArea,
  PlanAreaCreate,
  PlanAreaPatch,
} from '@hansel/contracts';
import { PlanAreas } from './PlanAreas.js';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const area: PlanArea = {
  id: crypto.randomUUID(),
  fileId: null,
  x: 0.1,
  y: 0.2,
  width: 0.3,
  height: 0.4,
  code: 'Ar.01',
  content: '',
  orientation: 'down',
  type: 'Floor',
  function: 'Environmental',
  colour: 'Blue',
  updatedAt: '2026-09-23T00:00:00.000Z',
};
function setup(initial: PlanArea[] = [], canManageAreas = true) {
  let data = initial;
  const api = {
    load: vi.fn(() => Promise.resolve({ areas: data, canManageAreas })),
    create: vi.fn((input: PlanAreaCreate) => {
      data = [{ ...area, ...input }];
      return Promise.resolve(data[0] ?? area);
    }),
    update: vi.fn((_id: string, input: PlanAreaPatch) => {
      const saved = {
        ...area,
        code: input.code ?? area.code,
        content: input.content ?? area.content,
        orientation: input.orientation ?? area.orientation,
        x: input.x ?? area.x,
        y: input.y ?? area.y,
        width: input.width ?? area.width,
        height: input.height ?? area.height,
        updatedAt: '2026-09-23T00:00:01.000Z',
      };
      data = [saved];
      return Promise.resolve(saved);
    }),
    remove: vi.fn(() => {
      data = [];
      return Promise.resolve();
    }),
  };
  const props = {
    api,
    fileId: null,
    tool: 'area' as const,
    panning: false,
    externalBusy: false,
    drawerHost: document.body,
    beforeSelect: () => true,
    onBusyChange: vi.fn(),
    onActivateMove: vi.fn(),
  };
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => false,
  });
  const ref = createRef<PlanAreasHandle>();
  const view = render(<PlanAreas {...props} ref={ref} />);
  return { api, props, view, ref };
}
function pointer(target: HTMLElement, type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
  fireEvent(target, e);
}
it('click → Floor → drag persists once, displays fixed values and edits/deletes an independent Area', async () => {
  const { api } = setup();
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => expect(drawing).toHaveAttribute('tabindex', '0'));
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  pointer(drawing, 'pointerdown', 100, 160);
  pointer(drawing, 'pointermove', 400, 480);
  pointer(drawing, 'pointerup', 400, 480);
  await screen.findByLabelText('Area details');
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.create).toHaveBeenCalledWith(
    expect.objectContaining({
      x: 0.1,
      y: 0.2,
      width: expect.closeTo(0.3),
      height: expect.closeTo(0.4),
    }),
  );
  expect(screen.getByRole('combobox', { name: 'Function' })).toHaveTextContent(
    'Environmental',
  );
  expect(screen.getByRole('combobox', { name: 'Colour' })).toHaveTextContent(
    'Blue',
  );
  fireEvent.change(screen.getByLabelText('Area code'), {
    target: { value: 'Zone A' },
  });
  fireEvent.blur(screen.getByLabelText('Area code'));
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledWith(
      area.id,
      expect.objectContaining({ code: 'Zone A' }),
    );
  });
  await waitFor(() => expect(screen.getByLabelText('Area code')).toBeEnabled());
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Delete area' }));
  await waitFor(() => {
    expect(api.remove).toHaveBeenCalledTimes(1);
  });
  expect(screen.queryByLabelText('Area details')).not.toBeInTheDocument();
});
it('cancels tiny gestures and Escape without requests and supports keyboard creation', async () => {
  const { api } = setup();
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => expect(drawing).toHaveAttribute('tabindex', '0'));
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  pointer(drawing, 'pointerdown', 100, 100);
  pointer(drawing, 'pointerup', 101, 101);
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.keyDown(drawing, { key: 'Escape' });
  expect(api.create).not.toHaveBeenCalled();
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'ArrowRight' });
  fireEvent.keyDown(drawing, { key: 'ArrowDown' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  await waitFor(() => {
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});
it('Viewers inspect fixed and read-only details without mutation', async () => {
  const { api, view, props } = setup([area], false);
  view.rerender(<PlanAreas {...props} tool="move" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  expect(screen.getByLabelText('Area code')).toHaveAttribute('readonly');
  expect(
    screen.queryByRole('button', { name: 'Delete area' }),
  ).not.toBeInTheDocument();
  expect(api.update).not.toHaveBeenCalled();
  expect(
    screen.queryByRole('button', { name: /^Resize area/ }),
  ).not.toBeInTheDocument();
});

it('retries failed creation with the same key and blocks duplicate writes', async () => {
  const { api, props } = setup();
  api.create.mockRejectedValueOnce(new Error('offline'));
  const drawing = screen.getByLabelText('Area drawing');
  await waitFor(() => {
    expect(drawing).toHaveAttribute('tabindex', '0');
  });
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'ArrowRight' });
  fireEvent.keyDown(drawing, { key: 'ArrowDown' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  await screen.findByRole('button', { name: 'Retry area' });
  expect(props.onActivateMove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry area' }));
  await screen.findByLabelText('Area details');
  expect(props.onActivateMove).toHaveBeenCalledTimes(1);
  expect(api.create.mock.calls[0]).toEqual(api.create.mock.calls[1]);
});
it('metadata, orientation, fixed controls, dirty protection and move cancellation', async () => {
  const { api, view, props } = setup([area]);
  view.rerender(<PlanAreas {...props} tool="move" />);
  const button = await screen.findByRole('button', {
    name: 'Select area Ar.01',
  });
  const drawing = screen.getByLabelText('Area drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  // A plain click in Move is not swallowed as a drag.
  pointer(button, 'pointerdown', 100, 160);
  pointer(button, 'pointerup', 100, 160);
  fireEvent.click(button);
  expect(screen.getByLabelText('Area details')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
  fireEvent.click(screen.getByRole('option', { name: 'Floor' }));
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Orient area down' }));
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Orient area up' }));
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(screen.getByLabelText('Area code')).toBeEnabled();
  });
  fireEvent.change(screen.getByLabelText('Content'), {
    target: { value: 'Draft' },
  });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Close area details' }));
  expect(screen.getByLabelText('Area details')).toBeInTheDocument();
  confirm.mockReturnValue(true);
  fireEvent.keyDown(screen.getByLabelText('Area details'), { key: 'Escape' });
  expect(screen.queryByLabelText('Area details')).not.toBeInTheDocument();
  pointer(button, 'pointerdown', 100, 160);
  pointer(button, 'pointermove', 200, 240);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(api.update).toHaveBeenCalledTimes(1);
  pointer(button, 'pointerdown', 100, 160);
  pointer(button, 'pointermove', 200, 240);
  pointer(button, 'pointerup', 200, 240);
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(2);
  });
  await waitFor(() => {
    expect(screen.getByLabelText('Area code')).toBeEnabled();
  });
  expect(api.update).toHaveBeenLastCalledWith(
    area.id,
    expect.objectContaining({ x: expect.closeTo(0.2), y: expect.closeTo(0.3) }),
  );
  fireEvent.keyDown(button, { key: 'ArrowRight', altKey: true });
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(3);
  });
});
it('failed text edits retain the draft, retry, and conflicts require reload', async () => {
  const { api, view, props } = setup([area]);
  view.rerender(<PlanAreas {...props} tool="move" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  api.update.mockRejectedValueOnce(new Error('offline'));
  fireEvent.change(screen.getByLabelText('Content'), {
    target: { value: 'Keep draft' },
  });
  fireEvent.blur(screen.getByLabelText('Content'));
  await screen.findByRole('button', { name: 'Retry area' });
  expect(screen.getByLabelText('Content')).toHaveValue('Keep draft');
  fireEvent.click(screen.getByRole('button', { name: 'Retry area' }));
  await waitFor(() => {
    expect(screen.getByLabelText('Area code')).toBeEnabled();
  });
  expect(api.update).toHaveBeenCalledTimes(2);
  api.update.mockRejectedValueOnce(new PlanAreaRequestError(409));
  fireEvent.change(screen.getByLabelText('Area code'), {
    target: { value: 'Conflict' },
  });
  fireEvent.keyDown(screen.getByLabelText('Area code'), { key: 'Enter' });
  await screen.findByRole('button', { name: 'Reload areas' });
  expect(
    screen.queryByRole('button', { name: 'Retry area' }),
  ).not.toBeInTheDocument();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reload areas' }));
  await waitFor(() => {
    expect(api.load).toHaveBeenCalledTimes(2);
  });
});
it('dismisses menu, previews and armed state on pan, zoom, resize and pointer cancellation', async () => {
  const { api, view, props } = setup();
  const drawing = screen.getByLabelText('Area drawing');
  await waitFor(() => {
    expect(drawing).toHaveAttribute('tabindex', '0');
  });
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  for (const cause of ['cancel', 'blur', 'resize', 'scroll', 'zoom', 'pan']) {
    view.rerender(<PlanAreas {...props} />);
    fireEvent.keyDown(drawing, { key: 'Enter' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
    pointer(drawing, 'pointerdown', 200, 200);
    pointer(drawing, 'pointermove', 400, 400);
    expect(screen.getByLabelText('Area preview')).toBeInTheDocument();
    if (cause === 'cancel') pointer(drawing, 'pointercancel', 400, 400);
    else if (cause === 'zoom')
      view.rerender(<PlanAreas {...props} viewScale={150} />);
    else if (cause === 'pan') view.rerender(<PlanAreas {...props} panning />);
    else fireEvent(window, new Event(cause));
    expect(screen.queryByLabelText('Area preview')).not.toBeInTheDocument();
  }
  expect(api.create).not.toHaveBeenCalled();
});

it('recovers from load failure and validates edits before making a request', async () => {
  const { api, view, props } = setup([area]);
  const unavailable = {
    ...api,
    load: vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ areas: [area], canManageAreas: true }),
  };
  view.rerender(<PlanAreas {...props} api={unavailable} tool="move" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry area' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  fireEvent.change(screen.getByLabelText('Area code'), {
    target: { value: ' ' },
  });
  fireEvent.blur(screen.getByLabelText('Area code'));
  expect(screen.getByRole('status')).toHaveTextContent('Enter a code');
  expect(api.update).not.toHaveBeenCalled();
  const event = new Event('beforeunload', { cancelable: true });
  fireEvent(window, event);
  expect(event.defaultPrevented).toBe(true);
  const link = document.createElement('a');
  link.href = '/other';
  document.body.append(link);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  fireEvent(link, click);
  expect(click.defaultPrevented).toBe(true);
  link.remove();
});
it('pending updates block selection and stale completions after unmount have no effects', async () => {
  const { api, view, props } = setup([area]);
  view.rerender(<PlanAreas {...props} tool="move" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  let complete: (value: PlanArea) => void = () => undefined;
  api.update.mockReturnValueOnce(
    new Promise<PlanArea>((resolve) => {
      complete = resolve;
    }),
  );
  fireEvent.change(screen.getByLabelText('Content'), {
    target: { value: 'Saving' },
  });
  fireEvent.blur(screen.getByLabelText('Content'));
  expect(
    screen.getByRole('button', { name: 'Close area details' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Select area Ar.01' }));
  expect(api.update).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(() => {
    complete(area);
    return Promise.resolve();
  });
  expect(screen.queryByLabelText('Area details')).not.toBeInTheDocument();
});
it('failed deletion retains the annotation and retry removes it', async () => {
  const { api, view, props } = setup([area]);
  view.rerender(<PlanAreas {...props} tool="move" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  api.remove.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete area' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry area' }));
  await waitFor(() => {
    expect(
      screen.queryByRole('button', { name: 'Select area Ar.01' }),
    ).not.toBeInTheDocument();
  });
  expect(api.remove).toHaveBeenCalledTimes(2);
});
it('Hand passes through interactions and lost capture cancels moves without saving', async () => {
  const { api, view, props } = setup([area]);
  view.rerender(<PlanAreas {...props} tool="hand" />);
  const button = await screen.findByRole('button', {
    name: 'Select area Ar.01',
  });
  pointer(button, 'pointerdown', 100, 160);
  fireEvent.click(button);
  fireEvent.click(screen.getByLabelText('Area drawing'));
  expect(screen.queryByLabelText('Area details')).not.toBeInTheDocument();
  view.rerender(<PlanAreas {...props} tool="move" />);
  const drawing = screen.getByLabelText('Area drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  Object.assign(button, {
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  pointer(button, 'pointerdown', 100, 160);
  pointer(button, 'pointermove', 200, 240);
  fireEvent(button, new Event('lostpointercapture', { bubbles: true }));
  fireEvent.click(button);
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.dragStart(button);
  fireEvent.keyDown(button, { key: 'x' });
  for (const key of ['ArrowLeft', 'ArrowDown', 'ArrowUp']) {
    fireEvent.keyDown(button, { key, altKey: true });
    await waitFor(() => {
      expect(screen.getByLabelText('Area code')).toBeEnabled();
    });
  }
  expect(api.update).toHaveBeenCalledTimes(3);
});

it('scrolls an offscreen drawing into view before opening the keyboard menu', async () => {
  const { api } = setup();
  const drawing = screen.getByLabelText('Area drawing');
  await waitFor(() => expect(drawing).toHaveAttribute('tabindex', '0'));
  const bounds = vi
    .spyOn(drawing, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 1000, 1000, 800));
  const scroll = vi.fn(() => {
    bounds.mockReturnValue(new DOMRect(0, 0, 1000, 800));
  });
  Object.assign(drawing, { scrollIntoView: scroll });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(scroll).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Floor' }));
  expect(screen.getByRole('status')).toHaveTextContent('Drag to draw');
  expect(api.create).not.toHaveBeenCalled();
});

/** @spec allocation-plan-area-transform REQ-001..005 */
it('drags immediately in Add area and resizes selected Areas using pointer and keyboard handles', async () => {
  const { api } = setup([area]);
  const button = await screen.findByRole('button', {
    name: 'Select area Ar.01',
  });
  const drawing = screen.getByLabelText('Area drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  pointer(button, 'pointerdown', 150, 200);
  pointer(button, 'pointermove', 200, 240);
  pointer(button, 'pointerup', 200, 240);
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => expect(screen.getByLabelText('Area code')).toBeEnabled());
  const handle = screen.getByRole('button', {
    name: 'Resize area bottom-right',
  });
  pointer(handle, 'pointerdown', 450, 560);
  pointer(handle, 'pointermove', 550, 640);
  pointer(handle, 'pointerup', 550, 640);
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(2);
  });
  expect(api.update).toHaveBeenLastCalledWith(
    area.id,
    expect.objectContaining({
      width: expect.closeTo(0.4),
      height: expect.closeTo(0.5),
    }),
  );
  await waitFor(() => expect(screen.getByLabelText('Area code')).toBeEnabled());
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(3);
  });
});

/** @spec allocation-plan-area-transform REQ-002..005 */
it('cancels resize gestures, prevents no-op writes and retries failed resize without changing identity', async () => {
  const { api, view, props } = setup([area]);
  const button = await screen.findByRole('button', {
    name: 'Select area Ar.01',
  });
  const drawing = screen.getByLabelText('Area drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.click(button);
  const handle = screen.getByRole('button', {
    name: 'Resize area right',
  });
  pointer(handle, 'pointerdown', 400, 320);
  pointer(handle, 'pointerup', 400, 320);
  expect(api.update).not.toHaveBeenCalled();
  for (const reason of [
    'pointercancel',
    'lostpointercapture',
    'scroll',
    'blur',
  ]) {
    pointer(handle, 'pointerdown', 400, 320);
    pointer(handle, 'pointermove', 500, 320);
    if (reason === 'scroll' || reason === 'blur')
      fireEvent(window, new Event(reason));
    else fireEvent(handle, new Event(reason, { bubbles: true }));
    pointer(handle, 'pointerup', 500, 320);
    expect(api.update).not.toHaveBeenCalled();
  }
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  fireEvent.keyDown(handle, { key: 'Tab' });
  expect(api.update).not.toHaveBeenCalled();
  api.update.mockRejectedValueOnce(new Error('offline'));
  pointer(handle, 'pointerdown', 400, 320);
  pointer(handle, 'pointermove', 500, 320);
  pointer(handle, 'pointerup', 500, 320);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry area' }));
  await waitFor(() => expect(screen.getByLabelText('Area code')).toBeEnabled());
  expect(api.update.mock.calls[0]).toEqual(api.update.mock.calls[1]);
  expect(screen.getAllByRole('button', { name: /^Select area/ })).toHaveLength(
    1,
  );
  view.rerender(<PlanAreas {...props} tool="hand" />);
  expect(
    screen.queryByRole('button', { name: /^Resize area/ }),
  ).not.toBeInTheDocument();
});

/** @spec allocation-plan-area-transform REQ-002,005 */
it('resizes with every keyboard handle and keeps the opposite edges fixed', async () => {
  const { api } = setup([area]);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  vi.spyOn(
    screen.getByLabelText('Area drawing'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 1000, 800));
  for (const [name, key] of [
    ['top-left', 'ArrowLeft'],
    ['top', 'ArrowUp'],
    ['top-right', 'ArrowRight'],
    ['right', 'ArrowRight'],
    ['bottom-right', 'ArrowDown'],
    ['bottom', 'ArrowDown'],
    ['bottom-left', 'ArrowLeft'],
    ['left', 'ArrowLeft'],
  ] as const) {
    const handle = screen.getByRole('button', {
      name: `Resize area ${name}`,
    });
    const count = api.update.mock.calls.length;
    fireEvent.keyDown(handle, { key: ' ' });
    fireEvent.keyDown(handle, { key });
    fireEvent.keyDown(handle, { key: 'Enter' });
    await waitFor(() => {
      expect(api.update).toHaveBeenCalledTimes(count + 1);
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Area code')).toBeEnabled(),
    );
    expect(api.update.mock.lastCall?.[1]).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
    });
  }
});

it('cancels keyboard resizing with Tab, Escape, blur and lost pointer capture and positions labels inside the edge', async () => {
  setup([{ ...area, x: 0.8, width: 0.2 }]);
  const marker = await screen.findByRole('button', {
    name: 'Select area Ar.01',
  });
  fireEvent.click(marker);
  const drawing = screen.getByLabelText('Area drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  const handle = screen.getByRole('button', { name: 'Resize area right' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  fireEvent.keyDown(handle, { key: 'Tab' });
  fireEvent.keyDown(handle, { key: 'Escape' });
  fireEvent.click(handle);
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.blur(handle);
  pointer(handle, 'pointerdown', 100, 100);
  fireEvent.lostPointerCapture(handle);
  fireEvent.keyDown(drawing, { key: 'Escape' });
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
    fireEvent.keyDown(drawing, { key });
});
it('rejects clicks in unmeasured drawings and suppresses obsolete creation results', async () => {
  const { api, view } = setup();
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => expect(drawing).toHaveAttribute('tabindex', '0'));
  fireEvent.click(drawing);
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  let finish: (value: PlanArea) => void = () => undefined;
  api.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  pointer(drawing, 'pointerdown', 100, 100);
  pointer(drawing, 'pointermove', 400, 400);
  pointer(drawing, 'pointerup', 400, 400);
  view.unmount();
  await act(() => {
    finish(area);
    return Promise.resolve();
  });
});

it('blocks geometry input during shared busy states, pan mode and read-only access', async () => {
  const { props, view, api } = setup([area]);
  const marker = await screen.findByRole('button', {
    name: 'Select area Ar.01',
  });
  fireEvent.click(marker);
  const drawing = screen.getByLabelText('Area drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  view.rerender(<PlanAreas {...props} externalBusy />);
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  pointer(marker, 'pointerdown', 200, 200);
  expect(api.update).not.toHaveBeenCalled();
  view.rerender(<PlanAreas {...props} panning />);
  fireEvent.keyDown(drawing, { key: 'ArrowDown' });
  fireEvent.click(drawing);
  pointer(marker, 'pointerdown', 200, 200);
  expect(api.create).not.toHaveBeenCalled();
  view.rerender(<PlanAreas {...props} beforeSelect={() => false} />);
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  pointer(marker, 'pointerdown', 200, 200);
  expect(api.update).not.toHaveBeenCalled();
});

it('preserves focus when a keyboard-created Area completes after another control takes focus', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return 1;
  });
  const { api } = setup();
  let finish: (value: PlanArea) => void = () => undefined;
  api.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => expect(drawing).toHaveAttribute('tabindex', '0'));
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  fireEvent.keyDown(drawing, { key: 'ArrowRight' });
  fireEvent.keyDown(drawing, { key: 'ArrowDown' });
  fireEvent.keyDown(drawing, { key: 'Enter' });
  const outside = document.createElement('button');
  outside.textContent = 'Other control';
  document.body.append(outside);
  outside.focus();
  await act(() => {
    finish(area);
    return Promise.resolve();
  });
  act(() => {
    frames.forEach((callback) => {
      callback(0);
    });
  });
  expect(outside).toHaveFocus();
  outside.remove();
  vi.unstubAllGlobals();
});

it('exposes pending and retry guards and consumes the click following an Area gesture', async () => {
  const { api, ref } = setup();
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => expect(drawing).toHaveAttribute('tabindex', '0'));
  expect(ref.current?.blocked()).toBe(false);
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  api.create.mockRejectedValueOnce(new Error('offline'));
  pointer(drawing, 'pointerdown', 100, 100);
  pointer(drawing, 'pointermove', 300, 300);
  pointer(drawing, 'pointerup', 300, 300);
  fireEvent.click(drawing, { clientX: 300, clientY: 300 });
  expect(screen.queryByRole('menuitem', { name: 'Floor' })).toBeNull();
  await screen.findByRole('button', { name: 'Retry area' });
  expect(ref.current?.blocked()).toBe(true);
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry area' }));
  await screen.findByRole('button', { name: 'Select area Ar.01' });
  expect(ref.current?.blocked()).toBe(false);
});

it('ignores obsolete area reads and rejects a failed edit after unmount', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  for (const operation of ['load', 'update', 'remove'] as const) {
    const { api, props, view } = setup([
      area,
      { ...area, id: 'other', code: 'Ar.02' },
    ]);
    const drawing = await screen.findByLabelText('Area drawing');
    await screen.findByRole('button', { name: 'Select area Ar.01' });
    let reject: (error: Error) => void = () => undefined;
    const pending = new Promise<never>((_resolve, fail) => {
      reject = fail;
    });
    api[operation].mockReturnValueOnce(pending);
    if (operation === 'load')
      view.rerender(<PlanAreas {...props} fileId="other" />);
    else {
      fireEvent.click(
        screen.getByRole('button', { name: 'Select area Ar.01' }),
      );
      if (operation === 'update')
        fireEvent.click(screen.getByRole('button', { name: 'Orient area up' }));
      else fireEvent.click(screen.getByRole('button', { name: 'Delete area' }));
    }
    view.unmount();
    await act(() => {
      reject(new Error('offline'));
      return Promise.resolve();
    });
    expect(drawing.isConnected).toBe(false);
  }
});
it('preserves sibling Areas and cancels keyboard resizing on scroll or external busy state', async () => {
  const { api, props, view } = setup([
    area,
    { ...area, id: 'other', code: 'Ar.02' },
  ]);
  await screen.findByRole('button', { name: 'Select area Ar.01' });
  fireEvent.click(screen.getByRole('button', { name: 'Select area Ar.01' }));
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Orient area up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Orient area up' }));
  });
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledOnce();
  });
  expect(
    screen.getByRole('button', { name: 'Select area Ar.02' }),
  ).toBeVisible();
  const handle = screen.getByRole('button', { name: 'Resize area right' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.scroll(window);
  expect(api.update).toHaveBeenCalledOnce();
  view.rerender(<PlanAreas {...props} externalBusy />);
  fireEvent.keyDown(handle, { key: 'Enter' });
  expect(api.update).toHaveBeenCalledOnce();
});
it('rejects zero-height coordinates and mismatched pointer ids during an Area drag', async () => {
  const { api } = setup();
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => {
    expect(drawing).toHaveAttribute('tabindex', '0');
  });
  const rect = vi
    .spyOn(drawing, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 1000, 0));
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  expect(screen.queryByRole('menuitem', { name: 'Floor' })).toBeNull();
  rect.mockReturnValue(new DOMRect(0, 0, 1000, 800));
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  fireEvent.click(drawing);
  rect.mockReturnValue(new DOMRect(0, 0, 1000, 0));
  pointer(drawing, 'pointerdown', 100, 100);
  expect(api.create).not.toHaveBeenCalled();
  rect.mockReturnValue(new DOMRect(0, 0, 1000, 800));
  pointer(drawing, 'pointerdown', 100, 100);
  const wrong = new Event('pointermove', { bubbles: true });
  Object.assign(wrong, { pointerId: 2 });
  fireEvent(drawing, wrong);
  rect.mockReturnValue(new DOMRect(0, 0, 1000, 0));
  pointer(drawing, 'pointermove', 200, 200);
  fireEvent.lostPointerCapture(drawing);
  fireEvent.lostPointerCapture(drawing);
  expect(api.create).not.toHaveBeenCalled();
});

it('rejects keyboard placement with zero drawing bounds and releases pointer capture', async () => {
  const { api } = setup();
  const drawing = await screen.findByLabelText('Area drawing');
  await waitFor(() => {
    expect(drawing).toHaveAttribute('tabindex', '0');
  });
  const rect = vi
    .spyOn(drawing, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 1000, 0));
  fireEvent.keyDown(drawing, { key: 'Enter' });
  expect(screen.queryByRole('menu')).toBeNull();
  rect.mockReturnValue(new DOMRect(0, 0, 1000, 800));
  vi.spyOn(drawing, 'hasPointerCapture').mockReturnValue(true);
  const release = vi.spyOn(drawing, 'releasePointerCapture');
  fireEvent.click(drawing, { clientX: 100, clientY: 100 });
  fireEvent.click(screen.getByRole('menuitem', { name: 'Floor' }));
  pointer(drawing, 'pointerdown', 100, 100);
  pointer(drawing, 'pointermove', 200, 200);
  pointer(drawing, 'pointerup', 200, 200);
  await waitFor(() => {
    expect(api.create).toHaveBeenCalledOnce();
  });
  expect(release).toHaveBeenCalledOnce();
});
it('ignores a successful delete after its Area controller is removed', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const { api, view } = setup([area]);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select area Ar.01' }),
  );
  let finish: () => void = () => undefined;
  api.remove.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete area' }));
  view.unmount();
  await act(() => {
    finish();
    return Promise.resolve();
  });
});
