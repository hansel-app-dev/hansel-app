import type { ComponentProps } from 'react';
import { createRef } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlanComments, type PlanCommentsHandle } from './PlanComments.js';
import type { SignComments } from './SignComments.js';
const captured = vi.hoisted(() => ({
  composer: null as ComponentProps<typeof SignComments> | null,
}));
vi.mock('./SignComments.js', () => ({
  SignComments: (props: ComponentProps<typeof SignComments>) => {
    captured.composer = props;
    return <p>Discussion transport</p>;
  },
}));
const id = '00000000-0000-4000-8000-000000000001',
  viewer = { id, name: 'Viewer', initials: 'V' },
  date = '2026-09-27T00:00:00Z';
const thread = {
  id,
  fileId: null,
  x: 0.2,
  y: 0.3,
  author: viewer,
  preview: 'Comment',
  resolved: false,
  resolvedAt: null,
  resolvedById: null,
  createdAt: date,
  updatedAt: date,
};
const comment = {
  id,
  parentId: null,
  body: 'Comment',
  mentions: [],
  attachments: [],
  reactions: [],
  author: viewer,
  createdAt: date,
};
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing discussion');
  return value;
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  captured.composer = null;
});
it('scopes every shared composer operation to the selected plan file, supports drafts and rejects reactions', async () => {
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
  const api = {
    markers: vi
      .fn()
      .mockResolvedValue({ threads: [thread], viewer, nextCursor: null }),
    history: vi.fn().mockResolvedValue({
      thread,
      comments: [comment],
      viewer,
      nextCursor: null,
    }),
    submit: vi.fn().mockResolvedValue({ thread, comment }),
    position: vi.fn(),
    state: vi.fn(),
    people: vi.fn().mockResolvedValue({ people: [], nextCursor: null }),
    initiate: vi.fn().mockResolvedValue({ id, completed: true }),
    complete: vi.fn().mockResolvedValue({ id }),
    discard: vi.fn().mockResolvedValue(undefined),
    thumbnail: vi.fn().mockResolvedValue(new Blob()),
    download: vi.fn().mockResolvedValue(undefined),
  };
  const ref = createRef<PlanCommentsHandle>();
  render(
    <PlanComments
      ref={ref}
      api={api}
      fileId={id}
      tool="comment"
      panning={false}
      host={document.body}
      beforeOpen={() => true}
      onActivateMove={vi.fn()}
      onBusyChange={vi.fn()}
    />,
  );
  await screen.findByRole('button', { name: 'Comment by Viewer: Comment' });
  act(() => ref.current?.place(0.4, 0.5));
  const draft = required(captured.composer).api;
  await expect(draft.list('ignored', null)).resolves.toEqual({
    comments: [],
    nextCursor: null,
    viewer,
  });
  await draft.people('ignored', 'Viewer');
  await draft.initiate('ignored', {
    idempotencyKey: id,
    filename: 'file.pdf',
    mediaType: 'application/pdf',
    byteSize: 1,
    checksumSha256: 'a'.repeat(43) + '=',
  });
  await draft.complete('ignored', id);
  await draft.discard('ignored', id);
  await draft.thumbnail('ignored', id);
  await draft.download('ignored', id, 'file.pdf');
  await expect(draft.react('ignored', id, '👍', true)).rejects.toThrow(
    'do not have reactions',
  );
  expect(api.people).toHaveBeenCalledWith(id, 'Viewer', undefined);
  expect(api.complete).toHaveBeenCalledWith(id, id);
  expect(api.download).toHaveBeenCalledWith(id, id, 'file.pdf');
  await act(() =>
    draft.submit('ignored', {
      idempotencyKey: id,
      parentId: null,
      body: 'Comment',
      mentions: [],
      attachmentIds: [],
    }),
  );
  expect(api.submit).toHaveBeenCalledWith(
    id,
    expect.objectContaining({ threadId: null, x: 0.4, y: 0.5 }),
  );
  required(required(captured.composer).compact).onSubmitted();
  const saved = required(captured.composer).api;
  await act(() => saved.list('ignored', null));
  expect(api.history).toHaveBeenCalledWith(id, thread.id, undefined);
  await saved.submit('ignored', {
    idempotencyKey: id,
    parentId: null,
    body: 'Reply',
    mentions: [],
    attachmentIds: [],
  });
  expect(api.submit).toHaveBeenLastCalledWith(
    id,
    expect.objectContaining({ threadId: thread.id, x: null, y: null }),
  );
  act(() => {
    required(captured.composer).onStateChange({ busy: true, dirty: false });
  });
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  expect(ref.current?.leave()).toBe(false);
  act(() => {
    required(captured.composer).onStateChange({ busy: false, dirty: false });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close comment' }));
});

it('guards keyboard draft placement before marker discovery, guards dirty resolution and preserves newer markers', async () => {
  const observers: (() => void)[] = [],
    frames: (() => void)[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(() => {
      callback(0);
    });
    return 1;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(update: () => void) {
        observers.push(update);
      }
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
  let discover: (value: {
    threads: (typeof thread)[];
    viewer: typeof viewer;
    nextCursor: null;
  }) => void = () => undefined;
  const api = {
    markers: vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          discover = resolve;
        }),
    ),
    history: vi
      .fn()
      .mockResolvedValue({ thread, comments: [], viewer, nextCursor: null }),
    submit: vi.fn().mockResolvedValue({ thread, comment }),
    position: vi.fn().mockResolvedValue(thread),
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
    fileId: id,
    tool: 'comment' as const,
    panning: false,
    host: null,
    beforeOpen: () => true,
    onActivateMove: vi.fn(),
    onBusyChange: vi.fn(),
  };
  const view = render(<PlanComments {...props} />);
  act(() => {
    ref.current?.keyDown({
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never);
  });
  expect(captured.composer).toBeNull();
  await act(() => {
    discover({
      threads: [{ ...thread, preview: '', updatedAt: '2026-09-28T00:00:00Z' }],
      viewer,
      nextCursor: null,
    });
    return Promise.resolve();
  });
  act(() => {
    ref.current?.place(0.4, 0.5);
  });
  expect(screen.getByRole('button', { name: 'New comment pin' })).toBeVisible();
  view.rerender(<PlanComments {...props} host={document.body} />);
  const pin = await screen.findByRole('button', {
    name: 'Comment by Viewer: Attachment',
  });
  fireEvent.click(pin);
  await act(() => required(captured.composer).api.list('thread', null));
  expect(pin).toHaveAttribute('aria-label', 'Comment by Viewer: Attachment');
  act(() => {
    required(captured.composer).onStateChange({ busy: false, dirty: true });
  });
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Resolve thread' }));
  expect(api.state).not.toHaveBeenCalled();
  act(() => {
    required(captured.composer).onStateChange({ busy: false, dirty: false });
  });
  view.rerender(<PlanComments {...props} host={document.body} tool="move" />);
  act(() => {
    ref.current?.keyDown({
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never);
  });
  view.rerender(<PlanComments {...props} host={document.body} panning />);
  expect(pin).toBeDisabled();
  view.rerender(<PlanComments {...props} host={document.body} />);
  act(() => {
    ref.current?.clear();
  });
  act(() => {
    ref.current?.keyDown({
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never);
  });
  const draftPin = screen.getByRole('button', { name: 'New comment pin' });
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'])
    fireEvent.keyDown(draftPin, { key, altKey: true });
  expect(api.position).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close comment' }));
  act(() => {
    frames.splice(0).forEach((frame) => {
      frame();
    });
  });
  act(() => {
    ref.current?.keyDown({
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as never);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close comment' }));
  view.unmount();
  frames.forEach((frame) => {
    frame();
  });
  observers.forEach((update) => {
    update();
  });
});
