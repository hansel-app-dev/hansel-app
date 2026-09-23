/** @spec allocation-plan-comments REQ-002..012 */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import type { PlanCommentThread, SignComment } from '@hansel/contracts';
import type { PlanSignsApi } from '../src/sites/plan-signs-api.js';
import { AllocationPlanViewer } from '../src/sites/AllocationPlanViewer.js';
const viewer = {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Jordan Smith',
    initials: 'JS',
  },
  now = '2026-09-23T00:00:00.000Z';
const initial: PlanCommentThread = {
  id: '00000000-0000-4000-8000-000000000004',
  fileId: null,
  x: 0.42,
  y: 0.4,
  author: viewer,
  preview: 'Please check this location.',
  resolved: false,
  resolvedAt: null,
  resolvedById: null,
  createdAt: now,
  updatedAt: now,
};
const first: SignComment = {
  id: '00000000-0000-4000-8000-000000000005',
  parentId: null,
  body: initial.preview,
  author: viewer,
  createdAt: now,
  mentions: [],
  attachments: [],
  reactions: [],
};
function fixture(mode: string): PlanSignsApi {
  let threads = [
      {
        ...initial,
        resolved: mode === 'resolved',
        resolvedAt: mode === 'resolved' ? now : null,
        resolvedById: mode === 'resolved' ? viewer.id : null,
      },
    ],
    entries = [first],
    failed = false;
  if (mode === 'attachments')
    entries = [
      {
        ...first,
        attachments: [
          {
            id: crypto.randomUUID(),
            filename: 'Reference.pdf',
            mediaType: 'application/pdf',
            byteSize: 1024,
            createdAt: now,
          },
          {
            id: crypto.randomUUID(),
            filename: 'Location.png',
            mediaType: 'image/png',
            byteSize: 1234,
            createdAt: now,
          },
        ],
      },
    ];
  const requests = new Map<
    string,
    { thread: PlanCommentThread; comment: SignComment }
  >();
  return {
    load: () =>
      Promise.resolve({
        signs: [],
        canManageSigns: mode !== 'viewer',
        planCommentsEnabled: true,
      }),
    create: () => Promise.reject(new Error('unused')),
    update: () => Promise.reject(new Error('unused')),
    remove: () => Promise.resolve(),
    planComments: {
      markers: (_file, resolved) =>
        Promise.resolve({
          threads: threads.filter((t) => (resolved ?? false) || !t.resolved),
          nextCursor: null,
          viewer,
        }),
      history: (_file, id) =>
        Promise.resolve({
          thread: threads.find((t) => t.id === id) ?? initial,
          comments: entries.filter(
            (e) =>
              e.parentId === id || (id === initial.id && e.id === first.id),
          ),
          nextCursor: null,
          viewer,
        }),
      submit: async (_file, input) => {
        if (mode === 'pending') await new Promise(() => undefined);
        if (mode === 'failure' && !failed) {
          failed = true;
          throw new Error('offline');
        }
        const replay = requests.get(input.idempotencyKey);
        if (replay) return replay;
        let thread = threads.find((t) => t.id === input.threadId);
        if (!thread) {
          thread = {
            ...initial,
            id: crypto.randomUUID(),
            x: input.x ?? 0.5,
            y: input.y ?? 0.5,
            preview: input.body,
            createdAt: new Date().toISOString(),
          };
          threads.push(thread);
        }
        const comment = {
          ...first,
          id: crypto.randomUUID(),
          parentId: thread.id,
          body: input.body,
          mentions: input.mentions,
          createdAt: new Date().toISOString(),
        };
        entries.push(comment);
        const result = { thread, comment: { ...comment, parentId: null } };
        requests.set(input.idempotencyKey, result);
        return result;
      },
      state: (_file, id, resolved) => {
        const thread = {
          ...(threads.find((t) => t.id === id) ?? initial),
          resolved,
          resolvedAt: resolved ? new Date().toISOString() : null,
          resolvedById: resolved ? viewer.id : null,
          updatedAt: new Date().toISOString(),
        };
        threads = threads.map((t) => (t.id === id ? thread : t));
        return Promise.resolve(thread);
      },
      people: () => Promise.resolve({ people: [viewer], nextCursor: null }),
      initiate: () =>
        Promise.reject(new Error('Use the local API to upload files.')),
      complete: () => Promise.reject(new Error('unused')),
      discard: () => Promise.resolve(),
      download: () => Promise.resolve(),
      thumbnail: () =>
        Promise.resolve(
          new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#dbeafe"/><text x="15" y="65">Location reference</text></svg>',
            ],
            { type: 'image/svg+xml' },
          ),
        ),
    },
  };
}
const plan = {
  id: '00000000-0000-4000-8000-000000000006',
  filename: 'First Floor.png',
  name: 'First Floor',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: now,
  modifiedAt: now,
  uploadedBy: 'Jordan Smith',
};
const preview =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="100%" height="100%" fill="white"/><g fill="none" stroke="#555"><rect x="80" y="70" width="840" height="560"/><path d="M80 250h840M300 70v560M620 70v560M300 400h320"/></g><g font-family="sans-serif" font-size="16"><text x="390" y="170">FIRST FLOOR</text><text x="390" y="340">LEARNING 01</text></g></svg>',
  );
function Example({ mode = 'normal' }: { mode?: string }) {
  const [api] = useState(() => fixture(mode));
  return (
    <div
      className={
        mode === 'narrow'
          ? 'w-[320px] px-3 pt-[119px]'
          : 'ml-[300px] px-8 pt-[119px] max-md:ml-0 max-md:px-3'
      }
    >
      <AllocationPlanViewer
        plan={plan}
        planSignsApi={api}
        loadContent={() => Promise.resolve(new Blob())}
        render={() =>
          Promise.resolve({ src: preview, release: () => undefined })
        }
      />
    </div>
  );
}
const meta = {
  title: 'Sites/Plan Comments',
  component: Example,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
const select = async (e: HTMLElement) => {
  await userEvent.click(
    await within(e).findByRole('button', { name: /Comment by Jordan/ }),
  );
};
const compose = async (e: HTMLElement) => {
  const c = within(e);
  await c.findByRole('button', { name: /Comment by Jordan/ });
  await userEvent.click(c.getByRole('button', { name: 'Add comment' }));
  c.getByLabelText('Plan drawing').focus();
  await userEvent.keyboard('{Enter}');
};
export const EmptyComposer: Story = {
  play: async ({ canvasElement }) => compose(canvasElement),
};
export const Thread: Story = {
  play: async ({ canvasElement }) => select(canvasElement),
};
export const Viewer: Story = {
  args: { mode: 'viewer' },
  play: async ({ canvasElement }) => select(canvasElement),
};
export const Attachments: Story = {
  args: { mode: 'attachments' },
  play: async ({ canvasElement }) => select(canvasElement),
};
export const Mentions: Story = {
  play: async ({ canvasElement }) => {
    await compose(canvasElement);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Mention a person' }),
    );
  },
};
export const Emoji: Story = {
  play: async ({ canvasElement }) => {
    await compose(canvasElement);
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Insert emoji' }),
    );
  },
};
export const Resolved: Story = {
  args: { mode: 'resolved' },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(
      await c.findByRole('checkbox', { name: 'Show resolved' }),
    );
    await userEvent.click(
      await c.findByRole('button', { name: /Resolved comment by/ }),
    );
  },
};
const post = async (e: HTMLElement) => {
  await compose(e);
  await userEvent.type(
    within(e).getByRole('textbox', { name: 'Write a comment' }),
    'Check this location.',
  );
  await userEvent.click(within(e).getByRole('button', { name: 'Submit' }));
};
export const Pending: Story = {
  args: { mode: 'pending' },
  play: async ({ canvasElement }) => post(canvasElement),
};
export const Failure: Story = {
  args: { mode: 'failure' },
  play: async ({ canvasElement }) => post(canvasElement),
};
export const Narrow: Story = {
  args: { mode: 'narrow' },
  play: async ({ canvasElement }) => select(canvasElement),
};

export const Zoomed: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await c.findByRole('button', { name: /Comment by Jordan/ });
    for (let i = 0; i < 4; i++)
      await userEvent.click(
        c.getByRole('button', { name: 'Increase plan zoom' }),
      );
    await select(canvasElement);
  },
};
