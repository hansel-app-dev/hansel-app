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
  };
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => false,
  });
  const view = render(<PlanAreas {...props} />);
  return { api, props, view };
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
});

it('retries failed creation with the same key and blocks duplicate writes', async () => {
  const { api } = setup();
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
  fireEvent.click(await screen.findByRole('button', { name: 'Retry area' }));
  await screen.findByLabelText('Area details');
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
