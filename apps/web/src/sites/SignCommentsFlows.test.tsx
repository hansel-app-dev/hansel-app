import type * as documentApi from './sign-documents-api.js';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import type { SignComment } from '@hansel/contracts';
import { SignComments } from './SignComments.js';
import { CommentRequestError } from './sign-comments-api.js';
vi.mock('./sign-documents-api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof documentApi>()),
  transferDocument: vi
    .fn()
    .mockImplementation(
      (_url, _headers, _file, progress: (n: number) => void) => {
        progress(25);
        return Promise.resolve();
      },
    ),
}));
const id = '00000000-0000-4000-8000-000000000001',
  other = '00000000-0000-4000-8000-000000000002';
const person = { id, name: 'Ava Chen', initials: 'AC' },
  date = '2026-09-27T00:00:00Z';
const root: SignComment = {
  id,
  parentId: null,
  author: person,
  createdAt: date,
  body: 'Hello @Ava Chen',
  mentions: [{ membershipId: id, name: person.name, start: 6, end: 15 }],
  attachments: [
    {
      id,
      filename: 'document.pdf',
      mediaType: 'application/pdf',
      byteSize: 8,
      createdAt: date,
    },
    {
      id: other,
      filename: 'image.png',
      mediaType: 'image/png',
      byteSize: 8,
      createdAt: date,
    },
  ],
  reactions: [
    { emoji: '👍', count: 1, selected: true },
    { emoji: '👀', count: 1, selected: false },
  ],
};
const reply = {
  ...root,
  id: other,
  parentId: id,
  body: 'Reply body',
  mentions: [],
  attachments: [],
  reactions: [],
};
function setup(rows: SignComment[] = [root]) {
  vi.stubGlobal('crypto', webcrypto);
  Object.assign(URL, {
    createObjectURL: vi.fn().mockReturnValue('blob:thumbnail'),
    revokeObjectURL: vi.fn(),
  });
  return {
    list: vi.fn().mockImplementation((_sign: string, parent: string | null) =>
      Promise.resolve({
        comments: parent ? [reply] : rows,
        nextCursor: null,
        viewer: person,
      }),
    ),
    submit: vi.fn().mockResolvedValue({ ...reply, parentId: null }),
    people: vi.fn().mockResolvedValue({
      people: [person, { id: other, name: 'Ben', initials: 'B' }],
      nextCursor: null,
    }),
    react: vi.fn().mockResolvedValue({ ...root, reactions: [] }),
    initiate: vi.fn().mockResolvedValue({
      id,
      completed: false,
      uploadUrl: 'https://upload.example/file',
      headers: {},
    }),
    complete: vi.fn().mockResolvedValue(root.attachments[1]),
    thumbnail: vi.fn().mockResolvedValue(new Blob()),
    download: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
  };
}
const textarea = () => screen.getByRole('textbox', { name: 'Write a comment' });
const text = (value: string) =>
  fireEvent.change(textarea(), {
    target: { value, selectionStart: value.length },
  });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('sign-comments REQ-001,005,009,012: renders root/reply attachments and toggles existing or new reactions', async () => {
  const api = setup();
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  expect(await screen.findByText('Reply body')).toBeVisible();
  expect(await screen.findByRole('img', { name: 'image.png' })).toHaveAttribute(
    'src',
    'blob:thumbnail',
  );
  const article = required(document.getElementById('comment-' + id));
  fireEvent.click(
    within(article).getByRole('button', { name: '👍 reaction, 1' }),
  );
  await waitFor(() => {
    expect(api.react).toHaveBeenCalledWith(id, id, '👍', false);
  });
  fireEvent.click(
    within(article).getByRole('button', {
      name: 'React to comment by Ava Chen',
    }),
  );
  fireEvent.keyDown(screen.getByRole('group', { name: 'Choose emoji' }), {
    key: 'Escape',
  });
  fireEvent.click(
    within(article).getByRole('button', {
      name: 'React to comment by Ava Chen',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '🎉' }));
  await waitFor(() => {
    expect(api.react).toHaveBeenCalledWith(id, id, '🎉', true);
  });
  api.react.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(
    within(article).getByRole('button', {
      name: 'React to comment by Ava Chen',
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '👀' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'update this reaction',
  );
  api.download.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'document.pdf' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Download failed');
  api.download.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Download image.png' }));
  await waitFor(() => {
    expect(api.download).toHaveBeenCalledTimes(2);
  });
  fireEvent.error(screen.getByRole('img', { name: 'image.png' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry image' }));
  expect(await screen.findByRole('img', { name: 'image.png' })).toBeVisible();
  fireEvent.click(
    required(screen.getAllByRole('button', { name: 'Reply' })[1]),
  );
  expect(screen.getByText('Replying to Ava Chen')).toBeVisible();
  text('Reply text');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ parentId: id, body: 'Reply text' }),
    );
  });
  fireEvent.click(
    required(screen.getAllByRole('button', { name: 'Reply' })[0]),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reply' }));
  expect(screen.queryByText('Replying to Ava Chen')).toBeNull();
});
it('sign-comments REQ-005,009: retries root/reply reads and paginates deduplicated entries', async () => {
  const api = setup();
  api.list.mockRejectedValueOnce(new Error('offline'));
  const view = render(
    <SignComments api={api} signId={id} onStateChange={vi.fn()} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  await screen.findByText('Reply body');
  view.unmount();
  const cursor = { id, createdAt: date };
  api.list.mockImplementation((_sign: string, parent: string | null, next) => {
    if (!next)
      return Promise.resolve({
        comments: parent ? [reply] : [root],
        viewer: person,
        nextCursor: cursor,
      });
    return Promise.resolve({
      comments: parent ? [reply] : [root],
      viewer: person,
      nextCursor: null,
    });
  });
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Load more comments' }),
  );
  fireEvent.click(await screen.findByRole('button', { name: 'More replies' }));
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'More replies' })).toBeNull();
  });
});
it('sign-comments REQ-009: selects exact mention ranges by mouse/keyboard and edits tokens without keeping stale ranges', async () => {
  const api = setup([]);
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  fireEvent.focus(textarea());
  fireEvent.click(screen.getByRole('button', { name: 'Mention a person' }));
  fireEvent.keyDown(textarea(), { key: 'Enter' });
  const option = await screen.findByRole('option', { name: person.name });
  fireEvent.mouseDown(option);
  fireEvent.click(option);
  expect(textarea()).toHaveValue('@Ava Chen ');
  text('Prefix @Ava Chen ');
  text('Prefix @Ava Chen suffix');
  text('Prefix @Ava Chen suffix @B');
  await screen.findByRole('option', { name: 'Ben' });
  fireEvent.keyDown(textarea(), { key: 'ArrowDown' });
  fireEvent.keyDown(textarea(), { key: 'ArrowUp' });
  fireEvent.keyDown(textarea(), { key: 'ArrowDown' });
  fireEvent.keyDown(textarea(), { key: 'Enter' });
  expect(textarea()).toHaveValue('Prefix @Ava Chen suffix @Ben ');
  text('Prefix @Ava Chen suffix @Ben !');
  fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalled();
  });
  expect(api.submit.mock.calls[0]?.[1]).toMatchObject({
    mentions: [
      { membershipId: id, name: person.name, start: 7, end: 16 },
      { membershipId: other, name: 'Ben', start: 24, end: 28 },
    ],
  });
});
it('sign-comments REQ-009,010: handles people lookup failure/pagination and composer emoji dismissal', async () => {
  const api = setup([]);
  api.people.mockRejectedValueOnce(new Error('offline'));
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  fireEvent.focus(textarea());
  text('@A');
  expect(
    await screen.findByText('Couldn’t load people. Try typing again.'),
  ).toBeVisible();
  fireEvent.keyDown(textarea(), { key: 'Escape' });
  api.people.mockResolvedValueOnce({ people: [person], nextCursor: id });
  text('@Av');
  fireEvent.click(await screen.findByRole('button', { name: 'More people' }));
  await screen.findByRole('option', { name: 'Ben' });
  fireEvent.keyDown(textarea(), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }));
  fireEvent.click(screen.getByRole('button', { name: '😄' }));
  expect(textarea()).toHaveValue('@Av😄');
  fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }));
  fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }));
  expect(screen.queryByRole('group', { name: 'Choose emoji' })).toBeNull();
  text('x'.repeat(5001));
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  fireEvent.keyDown(textarea(), { key: 'Enter', metaKey: true });
  expect(api.submit).not.toHaveBeenCalled();
});
it('sign-comments REQ-006..011: uploads and removes draft attachments and retains categorical submission failures', async () => {
  const api = setup([]);
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  fireEvent.focus(textarea());
  fireEvent.click(screen.getByRole('button', { name: 'Attach files' }));
  const file = new File(['png'], 'file.png', { type: 'image/png' });
  Object.assign(file, {
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode('png').buffer),
  });
  fireEvent.change(screen.getByLabelText('Comment attachments'), {
    target: { files: [file] },
  });
  expect(await screen.findByText('Ready')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ attachmentIds: [other] }),
    );
  });
  for (const [category, status, copy] of [
    ['mention_unavailable', 422, 'mentioned person'],
    ['changed', 409, 'discussion changed'],
    ['comment_capacity_reached', 422, 'thread limit'],
    ['attachment_unavailable', 422, 'attachment has expired'],
  ] as const) {
    api.submit.mockRejectedValueOnce(new CommentRequestError(status, category));
    text('Draft');
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy);
  }
  fireEvent.change(screen.getByLabelText('Comment attachments'), {
    target: { files: [file] },
  });
  await screen.findByText('Ready');
  fireEvent.click(screen.getByRole('button', { name: 'Remove file.png' }));
  expect(screen.queryByText('Ready')).toBeNull();
  fireEvent.change(screen.getByLabelText('Comment attachments'), {
    target: {
      files: Array.from(
        { length: 6 },
        () => new File(['bad'], 'bad.txt', { type: 'text/plain' }),
      ),
    },
  });
  expect(
    await screen.findByText('A comment can have up to five attachments.'),
  ).toBeVisible();
});
it('allocation-plan-comments REQ-006: compact draft handles Escape inside mention/emoji menus and read-only history has no composer', async () => {
  const api = setup([]),
    compact = { draft: true, readOnly: false, onSubmitted: vi.fn() };
  const view = render(
    <SignComments
      api={api}
      signId={id}
      compact={compact}
      onStateChange={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled(),
  );
  text('@');
  fireEvent.keyDown(textarea(), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }));
  fireEvent.keyDown(screen.getByRole('group', { name: 'Choose emoji' }), {
    key: 'Escape',
  });
  text('Draft');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(compact.onSubmitted).toHaveBeenCalledOnce();
  });
  view.unmount();
  const readonly = setup([root]);
  render(
    <SignComments
      api={readonly}
      signId={id}
      compact={{ ...compact, draft: false, readOnly: true }}
      onStateChange={vi.fn()}
    />,
  );
  await screen.findByText('document.pdf');
  expect(screen.queryByRole('textbox')).toBeNull();
});
it('sign-comments REQ-005: ignores asynchronous read/submit results after unmount', async () => {
  const api = setup([]);
  let finish: (value: SignComment) => void = () => undefined;
  api.submit.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(
    <SignComments api={api} signId={id} onStateChange={vi.fn()} />,
  );
  await screen.findByText('There are no comments yet.');
  text('Draft');
  fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
  fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
  expect(api.submit).toHaveBeenCalledOnce();
  view.unmount();
  await act(() => {
    finish(root);
    return Promise.resolve();
  });
});

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected fixture value');
  return value;
}

it('retries reply reads and thumbnail failures, and leaves an untouched composer on blur', async () => {
  const api = setup();
  api.list.mockImplementation((_sign: string, parent: string | null) =>
    parent
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ comments: [root], nextCursor: null, viewer: person }),
  );
  api.thumbnail.mockRejectedValueOnce(new Error('offline'));
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry replies' }));
  expect(api.list).toHaveBeenCalledTimes(3);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry image' }));
  const input = screen.getByRole('textbox', { name: 'Write a comment' });
  fireEvent.focus(input);
  fireEvent.blur(input, { relatedTarget: document.body });
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(false);
  fireEvent.change(input, { target: { value: 'Draft' } });
  const dirtyLeave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirtyLeave);
  expect(dirtyLeave.defaultPrevented).toBe(true);
});
it('suppresses reply reads, thumbnail requests and reactions that settle after unmount', async () => {
  for (const outcome of ['resolve', 'reject'] as const) {
    let finish: (value: unknown) => void = () => undefined,
      fail: (error: Error) => void = () => undefined;
    const pending = new Promise<unknown>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    const api = setup();
    api.list.mockImplementation((_sign: string, parent: string | null) =>
      parent
        ? pending
        : Promise.resolve({
            comments: [root],
            nextCursor: null,
            viewer: person,
          }),
    );
    api.thumbnail.mockImplementation(() => pending);
    api.react.mockImplementation(() => pending);
    const view = render(
      <SignComments api={api} signId={id} onStateChange={vi.fn()} />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: '👍 reaction, 1' }),
    );
    view.unmount();
    await act(() => {
      if (outcome === 'resolve') finish({ comments: [], nextCursor: null });
      else fail(new Error('offline'));
      return Promise.resolve();
    });
  }
});

it('shows singular day and hour timestamps and retries an attachment verification failure', async () => {
  for (const hours of [1, 2, 25, 49]) {
    const row = {
      ...root,
      createdAt: new Date(Date.now() - hours * 3600000).toISOString(),
      attachments: [],
      mentions: [],
    };
    const api = setup([row]);
    api.list.mockImplementation((_sign: string, parent: string | null) =>
      Promise.resolve({
        comments: parent ? [] : [row],
        viewer: person,
        nextCursor: null,
      }),
    );
    const view = render(
      <SignComments api={api} signId={id} onStateChange={vi.fn()} />,
    );
    await screen.findByText(
      hours < 24
        ? `${String(hours)} ${hours === 1 ? 'hour' : 'hours'} ago`
        : `${String(Math.floor(hours / 24))} ${hours < 48 ? 'day' : 'days'} ago`,
    );
    view.unmount();
  }
  const api = setup([]);
  api.complete.mockRejectedValueOnce(new Error('offline'));
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  const f = new File(['png'], 'file.png', { type: 'image/png' });
  Object.assign(f, {
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode('png').buffer),
  });
  fireEvent.change(screen.getByLabelText('Comment attachments'), {
    target: { files: [f] },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Retry upload' }));
  await screen.findByText('Ready');
});

it('reports failed people pagination and dismisses compact composer menus from toolbar keys', async () => {
  const api = setup([]);
  api.people.mockResolvedValue({ people: [], nextCursor: id });
  render(
    <SignComments
      api={api}
      signId={id}
      compact={{ draft: true, readOnly: false, onSubmitted: vi.fn() }}
      onStateChange={vi.fn()}
    />,
  );
  text('@');
  await screen.findByRole('button', { name: 'More people' });
  api.people.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'More people' }));
  await screen.findByText('Couldn’t load more people.');
  fireEvent.keyDown(screen.getByRole('button', { name: 'Mention a person' }), {
    key: 'Escape',
  });
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Insert emoji' }));
  fireEvent.keyDown(textarea(), { key: 'Escape' });
  expect(screen.queryByRole('group', { name: 'Choose emoji' })).toBeNull();
});

it('keeps ordered mention ranges when inserting a token before an existing mention', async () => {
  const api = setup([]);
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  text('@A');
  fireEvent.click(await screen.findByRole('option', { name: person.name }));
  text('X @Ava Chen ');
  fireEvent.change(textarea(), {
    target: { value: '@B @Ava Chen ', selectionStart: 2 },
  });
  fireEvent.click(await screen.findByRole('option', { name: 'Ben' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalled();
  });
  expect(api.submit.mock.calls[0]?.[1]).toMatchObject({
    body: '@Ben  @Ava Chen ',
    mentions: [
      { name: 'Ben', start: 0, end: 4 },
      { name: 'Ava Chen', start: 6, end: 15 },
    ],
  });
});

it('threads replies to the root and prevents duplicate reactions within one dispatch batch', async () => {
  const api = setup();
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('Reply body');
  const row = required(document.getElementById('comment-' + other));
  fireEvent.click(within(row).getByRole('button', { name: 'Reply' }));
  text('Reply to reply');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ parentId: id }),
    );
  });
  let finish: (value: SignComment) => void = () => undefined;
  api.react.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const reaction = screen.getByRole('button', { name: '👍 reaction, 1' });
  act(() => {
    fireEvent.click(reaction);
    fireEvent.click(reaction);
  });
  expect(api.react).toHaveBeenCalledOnce();
  await act(() => {
    finish({ ...root, reactions: [] });
    return Promise.resolve();
  });
  fireEvent.change(screen.getByLabelText('Comment attachments'), {
    target: { files: null },
  });
  expect(api.initiate).not.toHaveBeenCalled();
});

it('drops a mention whose token was edited while keeping surrounding text', async () => {
  const api = setup([]);
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  text('@A');
  fireEvent.click(await screen.findByRole('option', { name: person.name }));
  text('@Ava Chan ');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ body: '@Ava Chan ', mentions: [] }),
    );
  });
});

it('submits a direct reply using the selected root identity', async () => {
  const api = setup();
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('Reply body');
  const row = required(document.getElementById('comment-' + id));
  fireEvent.click(within(row).getByRole('button', { name: 'Reply' }));
  text('Root reply');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({ parentId: id, body: 'Root reply' }),
    );
  });
});

it('preserves exact mention ranges across consecutive text changes', async () => {
  const api = setup([]);
  render(<SignComments api={api} signId={id} onStateChange={vi.fn()} />);
  await screen.findByText('There are no comments yet.');
  text('@A');
  fireEvent.click(await screen.findByRole('option', { name: person.name }));
  act(() => {
    text('X @Ava Chen ');
    text('XY @Ava Chen ');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  await waitFor(() => {
    expect(api.submit).toHaveBeenCalledWith(
      id,
      expect.objectContaining({
        body: 'XY @Ava Chen ',
        mentions: [
          { membershipId: person.id, name: person.name, start: 3, end: 12 },
        ],
      }),
    );
  });
});
