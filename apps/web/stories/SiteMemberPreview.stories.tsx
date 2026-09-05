/** @spec site-details-activity-shell REQ-008, REQ-019 @figma 2030:3333 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SiteSummary } from '@hansel/contracts';
import { SiteMemberPreview } from '../src/sites/SiteCollection.js';

const site: SiteSummary = {
  id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
  name: 'Building A – General Teaching Space',
  createdAt: '2026-09-05T10:00:00.000Z',
  updatedAt: '2026-09-05T10:00:00.000Z',
  memberCount: 5,
  memberPreview: [
    { displayName: 'John Doe', initials: 'JD' },
    { displayName: 'Alex Smith', initials: 'AS' },
    { displayName: 'Mary King', initials: 'MK' },
  ],
};

const meta = {
  title: 'Sites/Site Member Preview',
  component: SiteMemberPreview,
  args: { site },
  decorators: [
    (Story) => (
      <div className="w-fit bg-surface p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SiteMemberPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithRemainder: Story = {};

export const ExactPreview: Story = {
  args: { site: { ...site, memberCount: 3 } },
};

export const NoMembers: Story = {
  args: { site: { ...site, memberCount: 0, memberPreview: [] } },
};

export const LongNames: Story = {
  args: {
    site: {
      ...site,
      memberPreview: site.memberPreview.map((member) => ({
        ...member,
        displayName: `${member.displayName} with an unusually long display name`,
      })),
    },
  },
};
