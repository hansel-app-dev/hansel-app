/** @spec allocation-plan-comment-moving REQ-001..007,009 */
import { createRef } from 'react';
import type { PlanCommentThread } from '@hansel/contracts';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlanComments, type PlanCommentsHandle } from './PlanComments.js';
import { CommentRequestError } from './sign-comments-api.js';
import type { PlanCommentsApi } from './plan-comments-api.js';
const viewer = { id: crypto.randomUUID(), name: 'Viewer', initials: 'V' };
const thread = {
  id: crypto.randomUUID(),
  fileId: null,
  x: 0.2,
  y: 0.3,
  author: viewer,
  preview: 'Check',
  resolved: false,
  resolvedAt: null,
  resolvedById: null,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
};
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      pointerId = 1;
      isPrimary = true;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 50,
    width: 1000,
    height: 500,
    right: 1100,
    bottom: 550,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  });
  HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(true);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup(saved = true, threads: PlanCommentThread[] = [thread]) {
  const api: PlanCommentsApi = {
    markers: vi.fn().mockResolvedValue({
      threads: saved ? threads : [],
      viewer,
      nextCursor: null,
    }),
    history: vi
      .fn()
      .mockResolvedValue({ thread, comments: [], viewer, nextCursor: null }),
    submit: vi.fn().mockRejectedValue(new Error('offline')),
    position: vi.fn().mockImplementation((_file, _id, x, y) =>
      Promise.resolve({
        ...thread,
        x,
        y,
        updatedAt: '2026-09-27T00:00:01.000Z',
      }),
    ),
    state: vi.fn(),
    people: vi.fn(),
    initiate: vi.fn(),
    complete: vi.fn(),
    discard: vi.fn(),
    thumbnail: vi.fn(),
    download: vi.fn(),
  };
  const ref = createRef<PlanCommentsHandle>();
  const props = {
    ref,
    api,
    fileId: null,
    tool: saved ? ('move' as const) : ('comment' as const),
    panning: false,
    host: document.body,
    beforeOpen: () => true,
    onActivateMove: () => undefined,
    onBusyChange: () => undefined,
  };
  const view = render(<PlanComments {...props} />);
  return { api, ref, view, props };
}
it('REQ-001,003,004: saves one normalized offset-preserving drag and suppresses placement', async () => {
  const { api } = setup();
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerMove(pin, { clientX: 510, clientY: 310 });
  expect(pin.style.left).toBe('40%');
  expect(pin.style.top).toBe('50%');
  fireEvent.pointerUp(pin, { clientX: 510, clientY: 310 });
  await waitFor(() => {
    expect(api.position).toHaveBeenCalledWith(
      null,
      thread.id,
      0.4,
      0.5,
      thread.updatedAt,
    );
  });
  expect(api.position).toHaveBeenCalledTimes(1);
  expect(api.submit).not.toHaveBeenCalled();
});
it('REQ-002,007: draft keyboard movement preserves text and failed root submission locks coordinates', async () => {
  const { api, ref } = setup(false);
  await waitFor(() => {
    expect(api.markers).toHaveBeenCalled();
  });
  act(() => ref.current?.place(0.2, 0.3));
  const input = await screen.findByRole('textbox', { name: 'Write a comment' });
  fireEvent.change(input, { target: { value: 'Keep this draft' } });
  const card = screen.getByRole('dialog', { name: 'New plan comment' });
  expect(
    screen.queryAllByRole('button', {
      name: /Move comment (left|right|up|down)/,
    }),
  ).toHaveLength(0);
  expect(
    screen.queryByText('Drag pin to move, or use these controls.'),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(card, { key: 'ArrowRight', altKey: true });
  expect(input).toHaveValue('Keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ x: 0.21, y: 0.3, body: 'Keep this draft' }),
    );
  });
  expect(api.position).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'New comment pin' }),
    ).toBeDisabled(),
  );
});
it('REQ-004,006,009: keyboard save restores canonical position on failure and retries exact intent', async () => {
  const { api } = setup();
  vi.mocked(api.position).mockRejectedValueOnce(new Error('offline'));
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
  await screen.findByRole('button', { name: 'Retry comment move' });
  expect(pin.style.left).toBe('20%');
  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Retry comment move' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry comment move' }));
  });
  await waitFor(() => {
    expect(api.position).toHaveBeenCalledTimes(2);
  });
  expect(vi.mocked(api.position).mock.calls[0]).toEqual(
    vi.mocked(api.position).mock.calls[1],
  );
});
it('REQ-005: cancellation and clicks do not write', async () => {
  const { api } = setup();
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerMove(pin, { clientX: 510, clientY: 310 });
  fireEvent.keyDown(pin, { key: 'Escape' });
  expect(pin.style.left).toBe('20%');
  fireEvent.pointerUp(pin, { clientX: 510, clientY: 310 });
  expect(api.position).not.toHaveBeenCalled();
});

it('REQ-002,003,006: threshold, edge clamping, no-op, pointer cancellation and lost capture', async () => {
  const { api } = setup();
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerMove(pin, { clientX: 312, clientY: 210 });
  fireEvent.pointerUp(pin, { clientX: 312, clientY: 210 });
  expect(api.position).not.toHaveBeenCalled();
  for (const event of ['pointerCancel', 'lostPointerCapture'] as const) {
    fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
    fireEvent.pointerMove(pin, { clientX: 510, clientY: 310 });
    fireEvent[event](pin);
    expect(pin.style.left).toBe('20%');
  }
  fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerMove(pin, { clientX: 510, clientY: 310 });
  fireEvent.pointerUp(pin, { clientX: 310, clientY: 210 });
  expect(api.position).not.toHaveBeenCalled();
  fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerUp(pin, { clientX: 5000, clientY: -1000 });
  await waitFor(() => {
    expect(api.position).toHaveBeenCalledWith(
      null,
      thread.id,
      1,
      0,
      thread.updatedAt,
    );
  });
});
it('REQ-006,007: conflicts block another move until reload', async () => {
  const { api } = setup();
  vi.mocked(api.position).mockRejectedValueOnce(
    new CommentRequestError(409, 'comment_request_failed'),
  );
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.keyDown(pin, { altKey: true, key: 'ArrowRight' });
  const reload = await screen.findByRole('button', { name: 'Reload comment' });
  fireEvent.keyDown(pin, { altKey: true, key: 'ArrowRight' });
  expect(api.position).toHaveBeenCalledTimes(1);
  fireEvent.click(reload);
  await waitFor(() => {
    expect(reload).not.toBeInTheDocument();
  });
  fireEvent.keyDown(pin, { altKey: true, key: 'ArrowRight' });
  await waitFor(() => {
    expect(api.position).toHaveBeenCalledTimes(2);
  });
});
it('REQ-006,007: pending saves guard navigation and obsolete responses cannot reach a new file', async () => {
  const { api, ref, view } = setup();
  let complete!: (value: typeof thread) => void;
  vi.mocked(api.position).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.keyDown(pin, { altKey: true, key: 'ArrowRight' });
  expect(ref.current?.leave()).toBe(false);
  const other = {
    ...thread,
    id: crypto.randomUUID(),
    fileId: crypto.randomUUID(),
    preview: 'Another file',
  };
  vi.mocked(api.markers).mockResolvedValue({
    threads: [other],
    viewer,
    nextCursor: null,
  });
  view.rerender(
    <PlanComments
      ref={ref}
      api={api}
      fileId={other.fileId}
      tool="move"
      panning={false}
      host={document.body}
      beforeOpen={() => true}
      onActivateMove={() => undefined}
      onBusyChange={() => undefined}
    />,
  );
  await screen.findByRole('button', {
    name: 'Comment by Viewer: Another file',
  });
  await act(async () => {
    complete({ ...thread, x: 0.21 });
    await Promise.resolve();
  });
  expect(
    screen.queryByRole('button', { name: 'Comment by Viewer: Check' }),
  ).not.toBeInTheDocument();
  expect(ref.current?.leave()).toBe(true);
});

it('REQ-006: another pin prompts once per pointer click and honors decline/accept', async () => {
  const other = {
    ...thread,
    id: crypto.randomUUID(),
    preview: 'Other comment',
  };
  setup(true, [thread, other]);
  const first = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.click(first);
  const input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: 'Unsent reply' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const second = screen.getByRole('button', {
    name: 'Comment by Viewer: Other comment',
  });
  fireEvent.pointerDown(second, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerUp(second, { clientX: 310, clientY: 210 });
  fireEvent.click(second, { detail: 1 });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(input).toHaveValue('Unsent reply');
  confirm.mockReturnValue(true);
  fireEvent.pointerDown(second, { clientX: 310, clientY: 210, button: 0 });
  fireEvent.pointerUp(second, { clientX: 310, clientY: 210 });
  fireEvent.click(second, { detail: 1 });
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(await screen.findByRole('textbox')).toHaveValue('');
});

/** @spec allocation-plan-comments-always-visible REQ-001,002,004 */
it('REQ-001,002,004: resolved-only drawings load and reopen history without a visibility control, including remount', async () => {
  const resolved = {
    ...thread,
    resolved: true,
    resolvedAt: thread.updatedAt,
    resolvedById: viewer.id,
  };
  const { api, view } = setup(true, [resolved]);
  const pin = await screen.findByRole('button', {
    name: 'Resolved comment by Viewer: Check',
  });
  expect(
    screen.queryByRole('checkbox', { name: 'Show resolved' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('No comments')).not.toBeInTheDocument();
  vi.mocked(api.history).mockResolvedValue({
    thread: resolved,
    comments: [],
    viewer,
    nextCursor: null,
  });
  fireEvent.click(pin);
  await screen.findByRole('button', { name: 'Reopen thread' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.keyDown(pin, { altKey: true, key: 'ArrowRight' });
  expect(api.position).not.toHaveBeenCalled();
  view.unmount();
  setup(true, [resolved]);
  await screen.findByRole('button', {
    name: 'Resolved comment by Viewer: Check',
  });
  expect(screen.queryByText('No comments')).not.toBeInTheDocument();
});

it('moves a new comment pin by dragging, guards navigation and closes with Escape', async () => {
  const { api, ref } = setup(false);
  await waitFor(() => {
    expect(api.markers).toHaveBeenCalled();
  });
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
    act(() =>
      ref.current?.keyDown({
        key,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as never),
    );
  act(() => ref.current?.place(0.2, 0.3));
  const pin = screen.getByRole('button', { name: 'New comment pin' });
  fireEvent.pointerDown(pin, { clientX: 300, clientY: 200, button: 0 });
  fireEvent.pointerMove(pin, { clientX: 400, clientY: 250 });
  fireEvent.pointerUp(pin, { clientX: 400, clientY: 250 });
  expect(api.position).not.toHaveBeenCalled();
  fireEvent.click(pin);
  fireEvent.keyDown(pin, { key: 'ArrowUp', altKey: true });
  const input = await screen.findByRole('textbox', { name: 'Write a comment' });
  fireEvent.change(input, { target: { value: 'Draft' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const link = document.createElement('a');
  link.href = '/sites';
  document.body.append(link);
  const navigation = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
  });
  link.dispatchEvent(navigation);
  expect(navigation.defaultPrevented).toBe(true);
  link.remove();
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  fireEvent.pointerDown(screen.getByRole('dialog'));
  fireEvent.click(screen.getByRole('dialog'));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeVisible();
  confirm.mockReturnValue(true);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  act(() =>
    ref.current?.keyDown({
      key: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never),
  );
});
it('reports reload failures after a move conflict and suppresses resolution work after unmount', async () => {
  const { api, view } = setup();
  vi.mocked(api.position).mockRejectedValueOnce(
    new CommentRequestError(409, 'conflict'),
  );
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
  vi.mocked(api.history).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Reload comment' }),
  );
  await screen.findByText('Couldn’t reload comment.');
  vi.mocked(api.history).mockResolvedValue({
    thread,
    comments: [],
    viewer,
    nextCursor: null,
  });
  fireEvent.click(pin);
  await screen.findByRole('button', { name: 'Resolve thread' });
  let settle: (value: PlanCommentThread) => void = () => undefined;
  vi.mocked(api.state).mockImplementation(
    () =>
      new Promise((resolve) => {
        settle = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Resolve thread' }));
  view.unmount();
  await act(() => {
    settle(thread);
    return Promise.resolve();
  });
});

it('restores pin focus after keyboard movement and guards unload during a pointer gesture', async () => {
  const { api } = setup();
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  pin.focus();
  let finish: (value: PlanCommentThread) => void = () => undefined;
  vi.mocked(api.position).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
  const feedback = screen.getByText('Saving position…');
  fireEvent.pointerDown(feedback);
  fireEvent.click(feedback);
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) focused.blur();
  await act(() => {
    finish({ ...thread, x: 0.21 });
    return Promise.resolve();
  });
  await waitFor(() => expect(pin).toHaveFocus());
  fireEvent.pointerDown(pin, { clientX: 310, clientY: 210, button: 0 });
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  fireEvent.pointerCancel(pin);
});

it('reports resolution conflicts and guards unload while resolution is pending', async () => {
  const { api } = setup();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Comment by Viewer: Check' }),
  );
  await screen.findByRole('button', { name: 'Resolve thread' });
  let reject: (error: Error) => void = () => undefined;
  vi.mocked(api.state).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Resolve thread' }));
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(true);
  await act(() => {
    reject(new CommentRequestError(409, 'conflict'));
    return Promise.resolve();
  });
  await screen.findByText(
    'This thread changed. Close and reopen it to reload.',
  );
});

it('ignores obsolete marker, movement and reload responses after a file switch', async () => {
  for (const operation of ['markers', 'position', 'history'] as const) {
    const { api, props, view } = setup();
    const pin = await screen.findByRole('button', {
      name: 'Comment by Viewer: Check',
    });
    let resolve: (value: unknown) => void = () => undefined,
      reject: (error: Error) => void = () => undefined;
    const pending = new Promise<never>((done, fail) => {
      resolve = (value) => {
        done(value as never);
      };
      reject = fail;
    });
    vi.mocked(api[operation]).mockReturnValueOnce(pending);
    if (operation === 'markers') {
      view.rerender(<PlanComments {...props} fileId="second" />);
    } else if (operation === 'position')
      fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
    else {
      vi.mocked(api.position).mockRejectedValueOnce(
        new CommentRequestError(409, 'conflict'),
      );
      fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
      fireEvent.click(
        await screen.findByRole('button', { name: 'Reload comment' }),
      );
    }
    view.rerender(<PlanComments {...props} fileId="third" />);
    await waitFor(() => {
      expect(api.markers).toHaveBeenCalledWith('third', undefined);
    });
    await act(() => {
      if (operation === 'position') reject(new Error('offline'));
      else
        resolve(
          operation === 'markers'
            ? { threads: [thread], viewer, nextCursor: null }
            : { thread, comments: [], viewer, nextCursor: null },
        );
      return Promise.resolve();
    });
    expect(screen.queryByText('Couldn’t reload comment.')).toBeNull();
    view.unmount();
  }
});
it('rejects secondary pointers, stale pointer ids and zero-height drag bounds, and clamps keyboard movement', async () => {
  const { api } = setup();
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.pointerDown(pin, { button: 2 });
  fireEvent.pointerMove(pin, { pointerId: 2 });
  expect(api.position).not.toHaveBeenCalled();
  const layer = screen.getByLabelText('Plan comments');
  const bounds = vi
    .spyOn(layer, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 1000, 0));
  fireEvent.pointerDown(pin, { button: 0, clientX: 200, clientY: 200 });
  expect(api.position).not.toHaveBeenCalled();
  bounds.mockReturnValue(new DOMRect(0, 0, 1000, 500));
  fireEvent.pointerDown(pin, { button: 0, clientX: 200, clientY: 200 });
  const wrong = new Event('pointermove', { bubbles: true });
  Object.assign(wrong, { pointerId: 2 });
  fireEvent(pin, wrong);
  bounds.mockReturnValue(new DOMRect(0, 0, 1000, 0));
  fireEvent.pointerMove(pin, { clientX: 300, clientY: 300 });
  fireEvent.pointerCancel(pin);
  expect(api.position).not.toHaveBeenCalled();
});

it('does not reopen a cleared selection when movement or conflict reload completes', async () => {
  for (const operation of ['position', 'history'] as const) {
    const { api, ref } = setup();
    const pin = await screen.findByRole('button', {
      name: 'Comment by Viewer: Check',
    });
    let finish: () => void = () => undefined;
    if (operation === 'position')
      vi.mocked(api.position).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => {
              resolve(thread);
            };
          }),
      );
    else {
      vi.mocked(api.position).mockRejectedValueOnce(
        new CommentRequestError(409, 'conflict'),
      );
      vi.mocked(api.history).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () => {
              resolve({ thread, comments: [], viewer, nextCursor: null });
            };
          }),
      );
    }
    fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
    if (operation === 'history')
      fireEvent.click(
        await screen.findByRole('button', { name: 'Reload comment' }),
      );
    act(() => {
      ref.current?.clear();
    });
    await act(() => {
      finish();
      return Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
  }
});
it('does not save a keyboard move beyond the drawing boundary', async () => {
  const { api } = setup(true, [{ ...thread, x: 0, y: 0 }]);
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Check',
  });
  fireEvent.keyDown(pin, { key: 'ArrowLeft', altKey: true });
  expect(api.position).not.toHaveBeenCalled();
});

it('does not recreate a cleared draft from a queued keyboard event', async () => {
  const { api, ref } = setup(false);
  await waitFor(() => {
    expect(api.markers).toHaveBeenCalled();
  });
  act(() => {
    ref.current?.place(0.5, 0.5);
  });
  const pin = screen.getByRole('button', { name: 'New comment pin' });
  act(() => {
    ref.current?.clear();
    fireEvent.keyDown(pin, { key: 'ArrowRight', altKey: true });
  });
  expect(screen.queryByRole('button', { name: 'New comment pin' })).toBeNull();
});
