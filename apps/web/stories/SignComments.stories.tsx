import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import type { SignComment } from '@hansel/contracts';
import { SignComments } from '../src/sites/SignComments.js';
import {
  createSignCommentsApi,
  type SignCommentsApi,
} from '../src/sites/sign-comments-api.js';
const viewer = {
  id: '779491f7-bf74-45dd-8478-a184ff96bb17',
  name: 'John Smith',
  initials: 'JS',
};
const person = {
  id: '779491f7-bf74-45dd-8478-a184ff96bb18',
  name: 'Nicola James',
  initials: 'NJ',
};
function Preview({
  empty = false,
  failure = false,
  loading = false,
  network = false,
}) {
  const api = useMemo<SignCommentsApi>(() => {
    let rows: SignComment[] = empty
      ? []
      : [
          {
            id: '779491f7-bf74-45dd-8478-a184ff96bb19',
            parentId: null,
            body: 'This sign should be on the other side of the corridor.',
            author: person,
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            mentions: [],
            attachments: [],
            reactions: [],
          },
          {
            id: '779491f7-bf74-45dd-8478-a184ff96bb20',
            parentId: '779491f7-bf74-45dd-8478-a184ff96bb19',
            body: 'Got it!',
            author: viewer,
            createdAt: new Date().toISOString(),
            mentions: [],
            attachments: [],
            reactions: [],
          },
        ];
    return {
      list: (_id, parentId) =>
        loading
          ? new Promise(() => {
              /* Loading visual state. */
            })
          : failure
            ? Promise.reject(new Error('offline'))
            : Promise.resolve({
                comments: rows.filter((row) => row.parentId === parentId),
                viewer,
                nextCursor: null,
              }),
      submit: (_id, input) => {
        if (failure) return Promise.reject(new Error('offline'));
        const row: SignComment = {
          id: crypto.randomUUID(),
          parentId: input.parentId,
          body: input.body,
          author: viewer,
          createdAt: new Date().toISOString(),
          mentions: input.mentions,
          attachments: [],
          reactions: [],
        };
        rows.push(row);
        return Promise.resolve(row);
      },
      people: () =>
        Promise.resolve({ people: [person, viewer], nextCursor: null }),
      react: (_sign, id, emoji, selected) => {
        const row = rows.find((item) => item.id === id);
        if (!row) return Promise.reject(new Error('missing'));
        const updated = {
          ...row,
          reactions: selected ? [{ emoji, count: 1, selected }] : [],
        };
        rows = rows.map((item) => (item.id === id ? updated : item));
        return Promise.resolve(updated);
      },
      initiate: () =>
        Promise.reject(new Error('Upload unavailable in preview')),
      complete: () =>
        Promise.reject(new Error('Upload unavailable in preview')),
      discard: () => Promise.resolve(),
      download: () => Promise.resolve(),
      thumbnail: () => Promise.reject(new Error('No image')),
    };
  }, [empty, failure, loading]);
  return (
    <aside
      aria-label="Sign details"
      className="absolute right-0 top-[119px] bottom-10 flex w-[350px] flex-col border-l border-[#e2e2e7] bg-white text-[#27272a]"
    >
      <div className="shrink-0 px-6 pt-6">
        <div className="mb-4 h-5 text-2xl leading-5 text-[#72727e]">×</div>
        <div className="h-10 rounded border border-[#e2e2e7] px-2 py-1 text-xl">
          Rg.01
        </div>
      </div>
      <div className="mt-3 flex h-[38px] shrink-0 gap-4 border-b border-[#e2e2e7] px-6 text-sm">
        {['General', 'Docs', 'Photos', 'Comments'].map((tab) => (
          <span
            key={tab}
            className={`py-2 ${tab === 'Comments' ? 'border-b-[3px] border-[#27272a]' : ''}`}
          >
            {tab}
          </span>
        ))}
      </div>
      <SignComments
        api={network ? createSignCommentsApi('site', '') : api}
        signId="sign"
        onStateChange={() => {
          /* Isolated drawer. */
        }}
      />
    </aside>
  );
}
const meta = {
  title: 'Sites/Sign Comments',
  component: Preview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Threaded: Story = {};
export const Empty: Story = { args: { empty: true } };
export const Loading: Story = { args: { loading: true } };
export const Failure: Story = { args: { failure: true } };
export const Network: Story = { args: { network: true } };
export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByLabelText('Write a comment'),
    );
  },
};
export const Mentions: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.type(
      within(canvasElement).getByLabelText('Write a comment'),
      '@',
    );
  },
};
export const Reply: Story = {
  play: async ({ canvasElement }) => {
    const button = (
      await within(canvasElement).findAllByRole('button', { name: 'Reply' })
    )[0];
    if (button) await userEvent.click(button);
  },
};
export const Reactions: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByLabelText(
        'React to comment by Nicola James',
      ),
    );
  },
};
