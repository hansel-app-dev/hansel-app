/** @spec site-activity-feed-comments REQ-011, AC-001, AC-006 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type {
  SiteActivityItem,
  SiteActivityPageResponse,
} from '@hansel/contracts';
import { userEvent, within } from 'storybook/test';
import { SiteActivityFeed } from '../src/sites/SiteActivityFeed.js';

const comment: Extract<SiteActivityItem, { kind: 'SITE_COMMENT_ADDED' }> = {
  id: '00000000-0000-4000-8000-000000000051',
  kind: 'SITE_COMMENT_ADDED',
  commentText: 'Ready for review.',
  actor: { displayName: 'Chelsea Hagon', initials: 'CH' },
  createdAt: '2026-09-06T00:00:00.000Z',
};
const items: SiteActivityItem[] = [
  comment,
  {
    id: '00000000-0000-4000-8000-000000000050',
    kind: 'SIGN_CREATED',
    subjectLabel: 'RS.101',
    actor: { displayName: 'Alex Curren', initials: 'AC' },
    createdAt: '2026-09-05T00:00:00.000Z',
  },
];

const meta = {
  title: 'Sites/Site Activity Feed',
  component: SiteActivityFeed,
  args: {
    initial: { items, nextCursor: null },
    loadOlder: (_cursor: string): Promise<SiteActivityPageResponse> =>
      Promise.resolve({ items: [], nextCursor: null }),
    submitComment: (text: string): Promise<SiteActivityItem> =>
      Promise.resolve({
        id: crypto.randomUUID(),
        kind: 'SITE_COMMENT_ADDED',
        commentText: text,
        actor: { displayName: 'Nabin Singh', initials: 'NS' },
        createdAt: new Date().toISOString(),
      }),
  },
  decorators: [
    (Story) => (
      <div className="m-8 max-w-[390px] rounded-lg border border-site-card-border bg-surface shadow-site-card">
        <h2 className="border-b border-control-border px-6 py-5 text-base font-semibold">
          Activity
        </h2>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SiteActivityFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedActivity: Story = {};

export const Empty: Story = {
  args: { initial: { items: [], nextCursor: null } },
};

export const LongEscapedValues: Story = {
  args: {
    initial: {
      items: [
        {
          ...comment,
          commentText:
            '<script>stays text</script> — This deliberately long comment demonstrates safe wrapping without widening the Activity panel.'.repeat(
              3,
            ),
        },
      ],
      nextCursor: null,
    },
  },
};

export const LoadingOlder: Story = {
  args: {
    initial: { items, nextCursor: 'older' },
    loadOlder: () => new Promise<SiteActivityPageResponse>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: 'Load older activity',
      }),
    );
  },
};

export const OlderPageFailure: Story = {
  args: {
    initial: { items, nextCursor: 'older' },
    loadOlder: (): Promise<SiteActivityPageResponse> =>
      Promise.reject(new Error('unavailable')),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', {
        name: 'Load older activity',
      }),
    );
  },
};

export const Submitting: Story = {
  args: {
    submitComment: () => new Promise<SiteActivityItem>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), 'Reviewing now');
    await userEvent.click(canvas.getByRole('button', { name: 'Comment' }));
  },
};

export const SubmissionFailure: Story = {
  args: {
    submitComment: (): Promise<SiteActivityItem> =>
      Promise.reject(new Error('unavailable')),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole('textbox'), 'Keep this draft');
    await userEvent.click(canvas.getByRole('button', { name: 'Comment' }));
  },
};

export const ViewerCommenting: Story = {
  parameters: {
    docs: { description: { story: 'The composer is available to Viewers.' } },
  },
};

export const NarrowWidth: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Zoom200: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '50%', zoom: 2 }}>
        <Story />
      </div>
    ),
  ],
};
