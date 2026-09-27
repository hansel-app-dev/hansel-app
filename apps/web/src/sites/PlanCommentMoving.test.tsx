/** @spec allocation-plan-comment-moving REQ-001..007,009 */
import { createRef } from 'react';
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
function setup(saved = true, threads = [thread]) {
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
  const view = render(
    <PlanComments
      ref={ref}
      api={api}
      fileId={null}
      tool={saved ? 'move' : 'comment'}
      panning={false}
      host={document.body}
      beforeOpen={() => true}
      onActivateMove={() => undefined}
      onBusyChange={() => undefined}
    />,
  );
  return { api, ref, view };
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
  fireEvent.click(screen.getByRole('button', { name: 'Move comment right' }));
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
      screen.getByRole('button', { name: 'Move comment right' }),
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
  fireEvent.click(screen.getByRole('button', { name: 'Retry comment move' }));
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
