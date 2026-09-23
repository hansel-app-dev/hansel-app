/** @spec allocation-plan-comments REQ-002,006,009,011 */
import { createRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
import { PlanComments, type PlanCommentsHandle } from './PlanComments.js';
import type { PlanCommentsApi } from './plan-comments-api.js';
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('REQ-002,006,011: keyboard placement submits and shows a saved thread', async () => {
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
  const viewer = {
      id: crypto.randomUUID(),
      name: 'Test Viewer',
      initials: 'TV',
    },
    id = crypto.randomUUID(),
    now = new Date().toISOString();
  const thread = {
    id,
    fileId: null,
    x: 0.5,
    y: 0.5,
    author: viewer,
    preview: 'Check here',
    resolved: false,
    resolvedAt: null,
    resolvedById: null,
    createdAt: now,
    updatedAt: now,
  };
  const comment = {
    id: crypto.randomUUID(),
    parentId: null,
    body: 'Check here',
    author: viewer,
    createdAt: now,
    mentions: [],
    attachments: [],
    reactions: [],
  };
  const api: PlanCommentsApi = {
    markers: vi
      .fn()
      .mockResolvedValue({ threads: [], nextCursor: null, viewer }),
    history: vi.fn().mockResolvedValue({
      thread,
      comments: [comment],
      nextCursor: null,
      viewer,
    }),
    submit: vi.fn().mockResolvedValue({ thread, comment }),
    state: vi.fn().mockResolvedValue({ ...thread, resolved: true }),
    people: vi.fn(),
    initiate: vi.fn(),
    complete: vi.fn(),
    discard: vi.fn(),
    thumbnail: vi.fn(),
    download: vi.fn(),
  };
  const ref = createRef<PlanCommentsHandle>(),
    move = vi.fn();
  render(
    <PlanComments
      ref={ref}
      api={api}
      fileId={null}
      tool="comment"
      panning={false}
      host={document.body}
      beforeOpen={() => true}
      onActivateMove={move}
      onBusyChange={() => undefined}
    />,
  );
  await waitFor(() => {
    expect(api.markers).toHaveBeenCalled();
  });
  act(() => {
    ref.current?.place(0.5, 0.5, true);
  });
  fireEvent.change(
    await screen.findByRole('textbox', { name: 'Write a comment' }),
    { target: { value: 'Check here' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(move).toHaveBeenCalled();
  });
  expect(api.submit).toHaveBeenCalledWith(
    null,
    expect.objectContaining({
      x: 0.5,
      y: 0.5,
      threadId: null,
      body: 'Check here',
    }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Resolve thread' }),
  );
  await waitFor(() => {
    expect(api.state).toHaveBeenCalledWith(null, id, true, now);
  });
});

it('REQ-009: failed submissions preserve draft/key, navigation and pending writes are guarded', async () => {
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
  const viewer = { id: crypto.randomUUID(), name: 'Viewer', initials: 'V' };
  const submit = vi.fn().mockRejectedValue(new Error('offline'));
  const api: PlanCommentsApi = {
    markers: vi
      .fn()
      .mockResolvedValue({ threads: [], nextCursor: null, viewer }),
    history: vi.fn(),
    submit,
    state: vi.fn(),
    people: vi.fn().mockResolvedValue({ people: [viewer], nextCursor: null }),
    initiate: vi.fn(),
    complete: vi.fn(),
    discard: vi.fn(),
    thumbnail: vi.fn(),
    download: vi.fn(),
  };
  const ref = createRef<PlanCommentsHandle>();
  const props = {
    api,
    fileId: null,
    tool: 'comment' as const,
    panning: false,
    host: document.body,
    beforeOpen: () => true,
    onActivateMove: vi.fn(),
    onBusyChange: vi.fn(),
  };
  const view = render(
    <div
      onKeyDown={(e) => ref.current?.keyDown(e)}
      tabIndex={0}
      aria-label="Drawing"
    >
      <PlanComments {...props} ref={ref} />
    </div>,
  );
  await waitFor(() => {
    expect(api.markers).toHaveBeenCalled();
  });
  fireEvent.keyDown(screen.getByLabelText('Drawing'), { key: 'ArrowLeft' });
  fireEvent.keyDown(screen.getByLabelText('Drawing'), { key: 'ArrowUp' });
  fireEvent.keyDown(screen.getByLabelText('Drawing'), { key: 'Enter' });
  let input = await screen.findByRole('textbox');
  fireEvent.change(input, { target: { value: 'Keep this draft' } });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Close comment' }));
  expect(input).toBeInTheDocument();
  expect(ref.current?.leave()).toBe(false);
  const anchor = document.createElement('a');
  anchor.href = '/different-plan';
  document.body.append(anchor);
  const navigate = new MouseEvent('click', { bubbles: true, cancelable: true });
  anchor.dispatchEvent(navigate);
  expect(navigate.defaultPrevented).toBe(true);
  anchor.remove();
  confirm.mockReturnValue(true);
  act(() => {
    ref.current?.place(0.49, 0.49);
  });
  input = await screen.findByRole('textbox');
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: 'Keep this draft' } });
  confirm.mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(submit).toHaveBeenCalledTimes(2);
  });
  expect(submit.mock.calls[0]).toEqual(submit.mock.calls[1]);
  expect(input).toHaveValue('Keep this draft');
  expect(submit).toHaveBeenCalledWith(
    null,
    expect.objectContaining({ x: 0.49, y: 0.49 }),
  );
  submit.mockReturnValue(new Promise(() => undefined));
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
  });
  expect(ref.current?.leave()).toBe(false);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Close comment' }));
  expect(input).toBeInTheDocument();
  view.unmount();
});
it('REQ-006,009,012: marker failure retries and stale unmounted reads have no effect', async () => {
  const viewer = { id: crypto.randomUUID(), name: 'Viewer', initials: 'V' };
  const markers = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ threads: [], viewer, nextCursor: null });
  const api: PlanCommentsApi = {
    markers,
    history: vi.fn(),
    submit: vi.fn(),
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
      tool="hand"
      panning
      host={document.body}
      beforeOpen={() => true}
      onActivateMove={vi.fn()}
      onBusyChange={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry comments' }),
  );
  await waitFor(() => {
    expect(markers).toHaveBeenCalledTimes(2);
  });
  act(() => {
    ref.current?.place(0.5, 0.5);
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show resolved' }));
  await waitFor(() => {
    expect(markers).toHaveBeenLastCalledWith(null, true, undefined);
  });
  view.unmount();
});
it('REQ-006,009,012: history, resolution errors, reopen, and marker pagination retain usable state', async () => {
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
  const viewer = { id: crypto.randomUUID(), name: 'Viewer', initials: 'V' },
    now = new Date().toISOString();
  let thread = {
    id: crypto.randomUUID(),
    fileId: null,
    x: 0.8,
    y: 0.8,
    author: viewer,
    preview: 'Saved comment',
    resolved: false,
    resolvedAt: null as string | null,
    resolvedById: null as string | null,
    createdAt: now,
    updatedAt: now,
  };
  const comment = {
    id: crypto.randomUUID(),
    parentId: null,
    body: 'Saved comment',
    author: viewer,
    mentions: [],
    attachments: [],
    reactions: [],
    createdAt: now,
  };
  const state = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementation(
      (_file: string | null, _id: string, resolved: boolean) => {
        thread = {
          ...thread,
          resolved,
          resolvedAt: resolved ? now : null,
          resolvedById: resolved ? viewer.id : null,
          updatedAt: new Date().toISOString(),
        };
        return Promise.resolve(thread);
      },
    );
  const markers = vi
    .fn()
    .mockResolvedValueOnce({
      threads: [thread],
      viewer,
      nextCursor: { id: thread.id, createdAt: now },
    })
    .mockImplementation(() =>
      Promise.resolve({ threads: [thread], viewer, nextCursor: null }),
    );
  const api: PlanCommentsApi = {
    markers,
    history: vi.fn().mockImplementation(() =>
      Promise.resolve({
        thread,
        comments: [comment],
        nextCursor: null,
        viewer,
      }),
    ),
    submit: vi.fn(),
    state,
    people: vi.fn(),
    initiate: vi.fn(),
    complete: vi.fn(),
    discard: vi.fn(),
    thumbnail: vi.fn(),
    download: vi.fn(),
  };
  const ref = createRef<PlanCommentsHandle>();
  render(
    <PlanComments
      ref={ref}
      api={api}
      fileId={null}
      tool="move"
      panning={false}
      host={document.body}
      beforeOpen={() => true}
      onActivateMove={vi.fn()}
      onBusyChange={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Load more comments' }),
  );
  await waitFor(() => {
    expect(markers).toHaveBeenCalledTimes(2);
  });
  fireEvent.click(
    await screen.findByRole('button', { name: /Comment by Viewer/ }),
  );
  await screen.findByText('Saved comment');
  fireEvent.click(screen.getByRole('button', { name: 'Resolve thread' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t update');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resolve thread' }));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show resolved' }));
  fireEvent.click(
    await screen.findByRole('button', { name: /Resolved comment/ }),
  );
  await screen.findByText('Saved comment');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reopen thread' }));
  await screen.findByRole('textbox');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
