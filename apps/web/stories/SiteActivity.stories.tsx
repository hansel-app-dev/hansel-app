/** @spec site-details-activity-shell REQ-019 @figma 2030:3333 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SitesPageResponse } from '@hansel/contracts';
import { SiteActivity } from '../src/sites/SiteActivity.js';

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

const meta = {
  title: 'Sites/Site Activity',
  component: SiteActivity,
  args: {
    loadActivity: () =>
      Promise.resolve({
        site: {
          id: siteId,
          name: 'Building A – General Teaching Space',
        },
      }),
    loadDashboard: () =>
      Promise.resolve({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    loadSites: () => Promise.resolve(sitesPage),
    loadSiteActivityPage: () =>
      Promise.resolve({ items: [], nextCursor: null }),
    createSiteComment: (text) =>
      Promise.resolve({
        id: crypto.randomUUID(),
        kind: 'SITE_COMMENT_ADDED' as const,
        commentText: text,
        actor: { displayName: 'Nabin Singh', initials: 'NS' },
        createdAt: new Date().toISOString(),
      }),
    logout: () => Promise.resolve(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Figma reference: Hansel App UI frame 2030:3333. Sample Activity records and unavailable workflows are intentionally excluded by the approved specification.',
      },
    },
  },
} satisfies Meta<typeof SiteActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {};

export const ZeroMembers: Story = {
  args: {
    loadSites: () =>
      Promise.resolve({
        ...sitesPage,
        sites: [
          {
            ...selectedSite,
            memberCount: 0,
            memberPreview: [],
          },
          otherSite,
        ],
      }),
  },
};

export const MemberPreview: Story = {};

export const LongNames: Story = {
  args: {
    loadActivity: () =>
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
    loadActivity: () => new Promise(() => undefined),
    loadSites: () => new Promise(() => undefined),
  },
};

export const RetryableFailure: Story = {
  args: { loadActivity: () => Promise.reject(new Error('unavailable')) },
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
