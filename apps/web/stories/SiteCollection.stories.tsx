/** @spec sites-populated-state REQ-009..REQ-015, REQ-020..REQ-025 @figma 2025:11221, 2043:3580 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { SiteSummary } from '@hansel/contracts';
import { SiteCollection } from '../src/sites/SiteCollection.js';

const now = new Date('2026-09-05T12:00:00.000Z');
const buildingSite: SiteSummary = {
  id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
  name: 'Building A – General Teaching Space',
  createdAt: '2026-06-05T12:00:00.000Z',
  updatedAt: '2026-09-04T12:00:00.000Z',
  memberCount: 3,
  memberPreview: [
    { displayName: 'John Doe', initials: 'JD' },
    { displayName: 'Alex Smith', initials: 'AS' },
    { displayName: 'Mary King', initials: 'MK' },
  ],
};
const aviationSite: SiteSummary = {
  id: 'c1745b68-2885-45dd-9f05-7a35f9466c1c',
  name: 'Aviation Academy – Hangar 51',
  createdAt: '2026-06-05T12:00:00.000Z',
  updatedAt: '2026-08-05T12:00:00.000Z',
  memberCount: 3,
  memberPreview: [
    { displayName: 'John Doe', initials: 'JD' },
    { displayName: 'Alex Smith', initials: 'AS' },
    { displayName: 'Mary King', initials: 'MK' },
  ],
};
const hospitalSite: SiteSummary = {
  id: '5d6dcff1-035c-4615-b8b3-4c27db312f3f',
  name: "Mother's & Children's Hospital",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  memberCount: 0,
  memberPreview: [],
};
const figmaSites = [buildingSite, aviationSite, hospitalSite];

const meta = {
  title: 'Sites/Site Collection',
  component: SiteCollection,
  args: { now, sites: figmaSites },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Figma references: Hansel App UI frames 2025:11221 and 2043:3580.',
      },
    },
  },
} satisfies Meta<typeof SiteCollection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grid: Story = {};

export const List: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'List view' }).click();
    await expect(
      canvas.getByRole('table', { name: 'Sites list' }),
    ).toBeVisible();
  },
};

export const OneSite: Story = { args: { sites: [buildingSite] } };

export const LongName: Story = {
  args: {
    sites: [
      {
        ...buildingSite,
        name: 'Building A – General Teaching Space with a deliberately very long descriptive name',
      },
    ],
  },
};

export const NoMembers: Story = {
  args: { sites: [{ ...hospitalSite, memberCount: 0, memberPreview: [] }] },
};

export const MoreThanThreeMembers: Story = {
  args: { sites: [{ ...buildingSite, memberCount: 8 }] },
};

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
