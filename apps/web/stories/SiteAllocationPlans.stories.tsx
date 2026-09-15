/** @spec site-allocation-plans-empty-state REQ-020 @spec site-allocation-plans-add REQ-021, REQ-025, REQ-026 @figma 2037:1019, 2053:2594, 2056:3131 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type {
  AllocationPlansResponse,
  SitesPageResponse,
} from '@hansel/contracts';
import { expect, userEvent, within } from 'storybook/test';
import { SiteAllocationPlans } from '../src/sites/SiteActivity.js';

const siteId = 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9';
const selectedSite: SitesPageResponse['sites'][number] = {
  id: siteId,
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
const otherSite: SitesPageResponse['sites'][number] = {
  id: 'c1745b68-2885-45dd-9f05-7a35f9466c1c',
  name: 'Aviation Academy – Hangar 51',
  createdAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
  memberCount: 0,
  memberPreview: [],
};
const sitesPage: SitesPageResponse = {
  organizationName: 'Hansel',
  canCreateSite: true,
  canInviteMembers: true,
  creator: {
    email: 'owner@example.com',
    displayName: 'Nabin Singh',
    initials: 'NS',
  },
  siteLimitReached: false,
  maximumSites: null,
  members: [],
  sites: [selectedSite, otherSite],
};
const populatedPlans: AllocationPlansResponse = {
  canAddPlans: true,
  plans: [
    {
      id: '00000000-0000-4000-8000-000000000006',
      filename: 'Ground Floor.pdf',
      mediaType: 'application/pdf',
      byteSize: 1_048_576,
      createdAt: '2026-06-06T00:00:00.000Z',
      modifiedAt: '2026-09-05T00:00:00.000Z',
      uploadedBy: 'Nabin Singh',
    },
    {
      id: '00000000-0000-4000-8000-000000000007',
      filename: 'First Floor.png',
      mediaType: 'image/png',
      byteSize: 512,
      createdAt: '2026-06-06T00:00:00.000Z',
      modifiedAt: '2026-09-04T00:00:00.000Z',
      uploadedBy: 'Nabin Singh',
    },
  ],
};

const meta = {
  title: 'Sites/Site Allocation Plans',
  component: SiteAllocationPlans,
  args: {
    loadDashboard: () =>
      Promise.resolve({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    loadSite: () =>
      Promise.resolve({
        site: { id: siteId, name: selectedSite.name },
      }),
    loadSites: () => Promise.resolve(sitesPage),
    logout: () => Promise.resolve(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Figma reference: Hansel App UI frame 2037:1019. Add plan and Google Maps remain truthfully unavailable until their workflows have approved specifications.',
      },
    },
  },
} satisfies Meta<typeof SiteAllocationPlans>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoPlans: Story = {};

export const ManyPlans: Story = {
  args: {
    loadAllocationPlans: () =>
      Promise.resolve({
        ...populatedPlans,
        plans: Array.from({ length: 3 }, (_, group) =>
          populatedPlans.plans.map((plan, index) => ({
            ...plan,
            id: `00000000-0000-4000-8000-${String(group * 2 + index + 1).padStart(12, '0')}`,
            filename: `Building ${String(group + 1)} ${plan.filename ?? 'Plan'}`,
          })),
        ).flat(),
      }),
  },
};

const populatedArgs = {
  loadAllocationPlans: () => Promise.resolve(populatedPlans),
};

export const PopulatedGrid: Story = { args: populatedArgs };

export const PopulatedList: Story = {
  args: populatedArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'List view' }),
    );
    await expect(
      canvas.getByRole('table', { name: 'Allocation Plans' }),
    ).toBeVisible();
  },
};

export const NoSearchMatches: Story = {
  args: populatedArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByRole('searchbox', { name: 'Search plans' }),
      'roof',
    );
    await expect(canvas.getByText('No plans match your search.')).toBeVisible();
  },
};

export const PopulatedNarrow: Story = {
  args: populatedArgs,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const PopulatedZoom200: Story = {
  args: populatedArgs,
  decorators: [
    (Story) => (
      <div style={{ width: '50%', zoom: 2 }}>
        <Story />
      </div>
    ),
  ],
};

export const ZeroMembers: Story = {
  args: {
    loadSites: () =>
      Promise.resolve({
        ...sitesPage,
        sites: [
          { ...selectedSite, memberCount: 0, memberPreview: [] },
          otherSite,
        ],
      }),
  },
};

export const MemberPreview: Story = {};

export const LongNames: Story = {
  args: {
    loadSite: () =>
      Promise.resolve({
        site: {
          id: siteId,
          name: 'Building A – General Teaching Space with an exceptionally long descriptive name',
        },
      }),
    loadSites: () =>
      Promise.resolve({
        ...sitesPage,
        organizationName:
          'Hansel International Learning and Community Services Organization',
        sites: [
          {
            ...selectedSite,
            name: 'Building A – General Teaching Space with an exceptionally long descriptive name',
          },
          otherSite,
        ],
      }),
  },
};

export const Loading: Story = {
  args: {
    loadDashboard: () => new Promise(() => undefined),
    loadSite: () => new Promise(() => undefined),
    loadSites: () => new Promise(() => undefined),
  },
};

export const RetryableFailure: Story = {
  args: { loadSite: () => Promise.reject(new Error('unavailable')) },
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
