/** @spec sites-empty-state REQ-001, REQ-004..REQ-012 @figma 2024:9828 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Sites } from '../src/sites/Sites.js';
import type { SitesPageResponse } from '@hansel/contracts';

const figmaViewer = {
  viewer: {
    displayName: 'John Smith',
    initials: 'JS',
    roleLabel: 'Admin',
  },
};

const emptySitesPage: SitesPageResponse = {
  organizationName: 'Hansel',
  canCreateSite: true,
  canInviteMembers: true,
  creator: {
    email: 'owner@example.com',
    displayName: 'Owner',
    initials: 'O',
  },
  siteLimitReached: false,
  maximumSites: null,
  members: [],
  sites: [],
};

const meta = {
  title: 'Sites/Empty State',
  component: Sites,
  args: {
    createSite: () =>
      Promise.resolve({
        siteId: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
        destination: '/sites/ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9/activity',
      }),
    loadDashboard: () => Promise.resolve(figmaViewer),
    loadSites: () => Promise.resolve(emptySitesPage),
    logout: () => Promise.resolve(),
    now: new Date('2026-09-05T12:00:00.000Z'),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Figma reference: Hansel App UI frame 2024:9828',
      },
    },
  },
} satisfies Meta<typeof Sites>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FigmaEmpty: Story = {};

export const AuthenticatedOwner: Story = {
  args: {
    loadDashboard: () =>
      Promise.resolve({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
  },
};

export const LongIdentity: Story = {
  args: {
    loadDashboard: () =>
      Promise.resolve({
        viewer: {
          displayName: 'Alexandria Montgomery-Worthington',
          initials: 'AM',
          roleLabel: 'Organization Operations Administrator',
        },
      }),
  },
};

export const Loading: Story = {
  args: { loadDashboard: () => new Promise(() => undefined) },
};

export const RetryableFailure: Story = {
  args: { loadDashboard: () => Promise.reject(new Error('unavailable')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('alert')).toBeVisible();
    await userEvent.tab();
    await expect(canvas.getByRole('link', { name: 'Dashboard' })).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('link', { name: 'Sites' })).toHaveFocus();
    await userEvent.tab();
    await expect(
      canvas.getAllByRole('button', { name: 'New site' })[0],
    ).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Retry' })).toHaveFocus();
  },
};

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const Populated: Story = {
  args: {
    loadSites: () =>
      Promise.resolve({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: true,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: null,
        members: [],
        sites: [
          {
            id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
            name: 'Sydney Central',
            createdAt: '2026-06-05T12:00:00.000Z',
            updatedAt: '2026-09-04T12:00:00.000Z',
            memberCount: 1,
            memberPreview: [{ displayName: 'Owner', initials: 'O' }],
          },
        ],
      }),
  },
};
