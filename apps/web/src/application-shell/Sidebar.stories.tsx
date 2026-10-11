import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sidebar } from './Sidebar.js';

const meta = {
  title: 'Application/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

const viewer = {
  displayName: 'Nabin Singh',
  initials: 'NS',
  roleLabel: 'Owner',
  email: 'nabin@example.com',
};

export const WithSites: Story = {
  args: {
    activePage: 'Dashboard',
    siteNavigation: [
      { id: 'site-1', name: 'Westlake Campus – Building A' },
      { id: 'site-2', name: 'North Annex' },
    ],
    organizationName: 'Hansel Workspace',
    organization: { name: 'Hansel Workspace', planDisplayName: 'Pro Plan' },
    displayedViewer: viewer,
    canManageOrganization: true,
    canInviteMembers: true,
    onInviteMembers: undefined,
    onUpgrade: undefined,
    canCreateSiteFromSidebar: true,
    createSiteDisabled: false,
    loadError: false,
    settingsOpen: false,
    onOpenSettings: () => undefined,
    logout: () => Promise.resolve(),
  },
};

export const Loading: Story = {
  args: {
    activePage: 'Dashboard',
    canManageOrganization: false,
    canInviteMembers: false,
    onInviteMembers: undefined,
    onUpgrade: undefined,
    canCreateSiteFromSidebar: false,
    createSiteDisabled: false,
    loadError: false,
    settingsOpen: false,
    onOpenSettings: () => undefined,
    logout: () => Promise.resolve(),
  },
};
