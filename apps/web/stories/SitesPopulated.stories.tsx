/** @spec sites-populated-state REQ-001, REQ-004..REQ-025 @spec sites-latest-first REQ-003, REQ-007 @figma 2025:11221, 2043:3580 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { SitesPageResponse } from '@hansel/contracts';
import { Sites } from '../src/sites/Sites.js';

const now = new Date('2026-09-05T12:00:00.000Z');
const populatedPage: SitesPageResponse = {
  organizationName: 'Workspace Name',
  canCreateSite: true,
  canInviteMembers: true,
  creator: {
    email: 'john@example.com',
    displayName: 'John Smith',
    initials: 'JS',
  },
  siteLimitReached: false,
  maximumSites: null,
  members: [],
  sites: [
    {
      id: '5d6dcff1-035c-4615-b8b3-4c27db312f3f',
      name: "Mother's & Children's Hospital",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      memberCount: 0,
      memberPreview: [],
    },
    {
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
    },
    {
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
    },
  ],
};

const meta = {
  title: 'Sites/Populated Page',
  component: Sites,
  args: {
    createSite: () =>
      Promise.resolve({
        siteId: populatedPage.sites[0]?.id ?? '',
        destination: `/sites/${populatedPage.sites[0]?.id ?? ''}/activity`,
      }),
    loadDashboard: () =>
      Promise.resolve({
        viewer: {
          displayName: 'John Smith',
          initials: 'JS',
          roleLabel: 'Owner',
        },
      }),
    loadSites: () => Promise.resolve(populatedPage),
    logout: () => Promise.resolve(),
    now,
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Figma references: Hansel App UI frames 2025:11221 (grid) and 2043:3580 (list).',
      },
    },
  },
} satisfies Meta<typeof Sites>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FigmaGrid: Story = {};

export const FigmaList: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'List view' }).click();
    await expect(
      canvas.getByRole('table', { name: 'Sites list' }),
    ).toBeVisible();
  },
};

export const CollapsedSidebar: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Collapse sites' }),
    );
    await expect(
      canvas.getByRole('button', { name: 'Expand sites' }),
    ).toBeVisible();
  },
};

export const PlanLimit: Story = {
  args: {
    loadSites: () =>
      Promise.resolve({
        ...populatedPage,
        maximumSites: 3,
        siteLimitReached: true,
      }),
  },
};

export const Loading: Story = {
  args: { loadSites: () => new Promise(() => undefined) },
};

export const RetryableFailure: Story = {
  args: { loadSites: () => Promise.reject(new Error('unavailable')) },
};

export const Narrow: Story = {
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
