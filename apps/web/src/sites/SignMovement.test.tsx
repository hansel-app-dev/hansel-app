import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlanSign, PlanSignPatch } from '@hansel/contracts';
import { PlanSignsSurface } from './PlanSignsSurface.js';
import { PlanSignRequestError } from './plan-signs-api.js';
const sign: PlanSign = {
  id: 'one',
  fileId: null,
  x: 0.5,
  y: 0.5,
  code: 'SG.001',
  content: '',
  mounting: 'Wall-mounted',
  function: 'Directional',
  colour: 'Red',
  orientation: 'down',
  updatedAt: '2026-09-01T00:00:00Z',
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function pointer(
  element: HTMLElement,
  type: string,
  x = 500,
  y = 400,
  extra: object = {},
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    ...extra,
  });
  fireEvent(element, event);
}
async function setup() {
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => false,
  });
  let saved = sign;
  const api = {
    load: vi.fn().mockResolvedValue({
      signs: [sign, { ...sign, id: 'two', code: 'SG.002' }],
      canManageSigns: true,
    }),
    create: vi.fn(),
    update: vi.fn((_id: string, changes: PlanSignPatch) => {
      saved = Object.assign(
        {},
        saved,
        Object.fromEntries(
          Object.entries(changes).filter(([, value]) => value !== undefined),
        ),
        { updatedAt: '2026-09-01T00:01:00Z' },
      );
      return Promise.resolve(saved);
    }),
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
  await screen.findByRole('button', { name: 'Select sign SG.001' });
  const drawing = screen.getByLabelText('Plan drawing');
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
  return { api, view, props, drawing };
}
it('moves point signs by pointer and keyboard, cancels gestures and preserves identity when retrying', async () => {
  const { api, drawing } = await setup();
  let marker = screen.getByRole('button', { name: 'Select sign SG.001' });
  Object.assign(marker, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  pointer(marker, 'pointermove');
  pointer(marker, 'pointerup');
  pointer(marker, 'pointerdown', 500, 400, { button: 2 });
  pointer(marker, 'pointerdown', 500, 400, { isPrimary: false });
  pointer(marker, 'pointerdown');
  pointer(marker, 'pointermove', 501, 401);
  pointer(marker, 'pointerup', 501, 401);
  expect(api.update).not.toHaveBeenCalled();
  pointer(marker, 'pointerdown');
  pointer(marker, 'pointermove', 600, 480);
  pointer(marker, 'pointerup', 600, 480);
  await screen.findByLabelText('Sign details');
  expect(api.update).toHaveBeenCalledWith(
    sign.id,
    expect.objectContaining({ x: 0.6, y: 0.6 }),
  );
  fireEvent.click(marker);
  pointer(marker, 'pointerdown', 600, 480);
  pointer(marker, 'pointermove', 650, 500);
  pointer(marker, 'pointercancel');
  pointer(marker, 'pointerdown', 600, 480);
  pointer(marker, 'lostpointercapture');
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    fireEvent.keyDown(marker, { key, altKey: true });
    await waitFor(() =>
      expect(screen.getByLabelText('Sign code')).toBeEnabled(),
    );
  }
  api.update.mockRejectedValueOnce(new Error('offline'));
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByLabelText('Sign code')).toBeEnabled());
  fireEvent.dragStart(marker);
  fireEvent.pointerLeave(drawing);
  fireEvent.click(drawing, { clientX: 500, clientY: 400 });
  fireEvent.click(drawing, { clientX: 500, clientY: 400 });
  expect(screen.queryByLabelText('Sign details')).toBeNull();
  marker = screen.getByRole('button', { name: 'Select sign SG.001' });
  fireEvent.keyDown(marker, { key: 'Enter' });
});
it('validates edits, guards dirty navigation, retries saves and reloads conflicts', async () => {
  const { api, drawing } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  const code = screen.getByLabelText('Sign code');
  fireEvent.change(code, { target: { value: '' } });
  fireEvent.keyDown(code, { key: 'Enter' });
  expect(api.update).not.toHaveBeenCalled();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Close sign details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.002' }));
  const link = document.createElement('a');
  link.href = '/sites';
  document.body.append(link);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  link.remove();
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  fireEvent.change(code, { target: { value: 'SG.100' } });
  api.update.mockRejectedValueOnce(new Error('offline'));
  fireEvent.blur(code);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(code).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Content'), {
    target: { value: 'Content' },
  });
  fireEvent.blur(screen.getByLabelText('Content'));
  await waitFor(() => expect(code).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Orient down' }));
  api.update.mockRejectedValueOnce(new PlanSignRequestError(409));
  fireEvent.click(screen.getByRole('button', { name: 'Orient up' }));
  await screen.findByRole('button', { name: 'Reload' });
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  await waitFor(() => {
    expect(api.load).toHaveBeenCalledTimes(2);
  });
  fireEvent.keyDown(drawing, { key: 'Escape' });
});
it('retries load failures and suppresses mutations that finish after unmount', async () => {
  const api = {
    load: vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ signs: [sign], canManageSigns: true }),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  let resolve: (value: PlanSign) => void = () => undefined;
  api.update.mockImplementation(
    () =>
      new Promise<PlanSign>((done) => {
        resolve = done;
      }),
  );
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
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Orient up' }));
  view.unmount();
  await act(() => {
    resolve(sign);
    return Promise.resolve();
  });
});

it('opens enabled media sections with scoped clients and saves resized linear geometry', async () => {
  const linear = {
    ...sign,
    id: 'linear',
    code: 'Pr.01',
    placementKind: 'linear' as const,
    endX: 0.7,
    endY: 0.5,
    mounting: 'Safety Decal' as const,
  };
  const docs = {
    list: vi.fn().mockResolvedValue({ documents: [], nextCursor: null }),
    initiate: vi.fn(),
    complete: vi.fn(),
    download: vi.fn(),
  };
  const photos = {
    ...docs,
    list: vi.fn().mockResolvedValue({ photos: [], nextCursor: null }),
    thumbnail: vi.fn(),
    remove: vi.fn(),
  };
  const comments = {
    ...docs,
    list: vi.fn().mockResolvedValue({
      comments: [],
      nextCursor: null,
      viewer: { id: 'viewer', name: 'Viewer', initials: 'V' },
    }),
    submit: vi.fn(),
    people: vi.fn(),
    react: vi.fn(),
    discard: vi.fn(),
    thumbnail: vi.fn(),
  };
  const api = {
    load: vi.fn().mockResolvedValue({
      signs: [sign, linear],
      canManageSigns: true,
      documentsEnabled: true,
      photosEnabled: true,
      commentsEnabled: true,
    }),
    create: vi.fn(),
    update: vi.fn((_id: string, patch: PlanSignPatch) =>
      Promise.resolve(
        Object.assign(
          {},
          linear,
          Object.fromEntries(
            Object.entries(patch).filter(([, value]) => value !== undefined),
          ),
        ),
      ),
    ),
    remove: vi.fn(),
    documents: docs,
    photos,
    comments,
  };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 800),
  );
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
  fireEvent.click(
    await screen.findByRole('button', { name: 'Select sign SG.001' }),
  );
  for (const name of ['Docs', 'Photos', 'Comments', 'General']) {
    fireEvent.click(screen.getByRole('tab', { name }));
    if (name === 'Docs') await screen.findByText('No documents linked yet.');
    if (name === 'Photos')
      await waitFor(() => {
        expect(photos.list).toHaveBeenCalled();
      });
    if (name === 'Comments')
      await screen.findByRole('textbox', { name: 'Write a comment' });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Close sign details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select sign Pr.01' }));
  const handle = screen.getByRole('button', {
    name: 'Resize Pr.01 end endpoint',
  });
  api.update.mockRejectedValueOnce(new Error('offline'));
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await waitFor(() => {
    expect(api.update).toHaveBeenCalledTimes(2);
  });
});

it('blocks keyboard and pointer movement while adding, viewing, panning or saving a conflicting Sign', async () => {
  const { api, view, props, drawing } = await setup();
  const marker = screen.getByRole('button', { name: 'Select sign SG.001' });
  fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  pointer(marker, 'pointerdown');
  expect(api.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Move' }));
  view.rerender(<PlanSignsSurface {...props} panning />);
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  pointer(marker, 'pointerdown');
  pointer(marker, 'pointermove');
  pointer(marker, 'pointerup');
  expect(api.update).not.toHaveBeenCalled();
  view.rerender(<PlanSignsSurface {...props} />);
  fireEvent.click(marker);
  api.update.mockRejectedValueOnce(new PlanSignRequestError(409));
  fireEvent.click(screen.getByRole('button', { name: 'Orient up' }));
  await screen.findByRole('button', { name: 'Reload' });
  fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
  pointer(marker, 'pointerdown');
  expect(api.update).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  await waitFor(() => {
    expect(api.load).toHaveBeenCalledTimes(2);
  });
  fireEvent.keyDown(drawing, { key: 'Escape' });
});

it('ignores late load, create, movement and edit failures after removal', async () => {
  for (const operation of ['load', 'create', 'move', 'update'] as const) {
    let finish: (value: unknown) => void = () => undefined,
      fail: (error: Error) => void = () => undefined;
    const pending = new Promise<never>((resolve, reject) => {
      finish = (value) => {
        resolve(value as never);
      };
      fail = reject;
    });
    const { api, view, drawing } = await setup();
    if (operation === 'load') {
      view.unmount();
      api.load.mockReturnValueOnce(pending);
      const next = render(
        <PlanSignsSurface
          api={api}
          fileId={null}
          panning={false}
          drawerHost={document.body}
        >
          <img alt="Plan" />
        </PlanSignsSurface>,
      );
      next.unmount();
      await act(() => {
        finish({ signs: [sign], canManageSigns: true });
        return Promise.resolve();
      });
      continue;
    }
    if (operation === 'create') {
      api.create.mockReturnValueOnce(pending);
      fireEvent.click(screen.getByRole('button', { name: 'Add sign' }));
      fireEvent.click(drawing, { clientX: 200, clientY: 200 });
      fireEvent.click(screen.getByRole('menuitem', { name: 'Wall-mounted' }));
    } else {
      api.update.mockReturnValueOnce(pending);
      const marker = screen.getByRole('button', { name: 'Select sign SG.001' });
      if (operation === 'move')
        fireEvent.keyDown(marker, { key: 'ArrowRight', altKey: true });
      else {
        fireEvent.click(marker);
        fireEvent.click(screen.getByRole('button', { name: 'Orient up' }));
      }
    }
    view.unmount();
    await act(() => {
      if (operation === 'update') fail(new Error('offline'));
      else finish(sign);
      return Promise.resolve();
    });
  }
});
it('fails closed for missing drawings and rejects movement with zero bounds', async () => {
  const { api, view, props, drawing } = await setup();
  const marker = screen.getByRole('button', { name: 'Select sign SG.001' });
  pointer(marker, 'pointerdown', 500, 400);
  vi.spyOn(drawing, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 1000, 0),
  );
  pointer(marker, 'pointermove', 600, 500);
  pointer(marker, 'pointerup', 600, 500);
  expect(api.update).not.toHaveBeenCalled();
  view.unmount();
  api.load.mockRejectedValueOnce(new PlanSignRequestError(404));
  render(<PlanSignsSurface {...props} />);
  await waitFor(() => {
    expect(api.load).toHaveBeenCalledTimes(2);
  });
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  fireEvent.keyDown(screen.getByLabelText('Plan drawing'), { key: 'Escape' });
});

it('does not repeat pending edits or retry a dirty field before resolving a conflict', async () => {
  const { api } = await setup();
  fireEvent.click(screen.getByRole('button', { name: 'Select sign SG.001' }));
  const content = screen.getByRole('textbox', { name: 'Content' });
  fireEvent.change(content, { target: { value: 'Changed' } });
  api.update.mockRejectedValueOnce(new PlanSignRequestError(409));
  act(() => {
    fireEvent.blur(content);
    fireEvent.blur(content);
  });
  await screen.findByRole('button', { name: 'Reload' });
  fireEvent.blur(content);
  expect(api.update).toHaveBeenCalledOnce();
});
