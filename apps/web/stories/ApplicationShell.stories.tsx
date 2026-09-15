/** @spec sites-empty-state REQ-003, REQ-004, REQ-011 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ApplicationShell,
  NotificationSymbol,
} from '../src/application-shell/ApplicationShell.js';
import { Button } from '../src/design-system/index.js';
import { userEvent, within } from 'storybook/test';

const meta = {
  title: 'Application/Shell',
  component: ApplicationShell,
  args: {
    activePage: 'Sites',
    loadDashboard: () =>
      Promise.resolve({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
    loadErrorMessage: "We couldn't load your account. Please try again.",
    logout: () => Promise.resolve(),
    headerActions: <NotificationSymbol />,
    children: (
      <div className="m-10 rounded-lg border border-[#dddddd] p-8">
        Page content boundary
      </div>
    ),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ApplicationShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SitesCurrent: Story = {};

export const DashboardCurrent: Story = {
  args: { activePage: 'Dashboard' },
};

export const TallDashboard: Story = {
  args: {
    activePage: 'Dashboard',
    children: (
      <div className="h-[2400px] p-8">Scrollable dashboard content</div>
    ),
  },
};

export const LongBoundaryContent: Story = {
  args: {
    children: (
      <div className="m-10 max-w-5xl rounded-lg border border-[#dddddd] p-8">
        This boundary intentionally contains a long line of application content
        so shell navigation, identity truncation, and the available content area
        can be checked without coupling the shell story to a feature page.
      </div>
    ),
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

export const UnavailableViewer: Story = {
  args: { loadDashboard: () => new Promise(() => undefined) },
};

export const UnavailableAction: Story = {
  args: {
    headerActions: (
      <Button disabled aria-disabled="true" className="disabled:opacity-100">
        Unavailable action
      </Button>
    ),
  },
};

const organizationDashboard = {
  viewer: {
    displayName: 'John Smith',
    initials: 'JS',
    roleLabel: 'Owner',
    email: 'john.s@example.com',
  },
  organization: { name: 'Workspace Name', planDisplayName: 'Pro Plan' },
} as const;

export const OrganizationTrayOpen: Story = {
  args: { loadDashboard: () => Promise.resolve(organizationDashboard) },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', {
        name: 'Open Organization menu',
      }),
    );
  },
};

export const AccountSettingsOpen: Story = {
  args: { loadDashboard: () => Promise.resolve(organizationDashboard) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Open Organization menu' }),
    );
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Settings' }));
  },
};

export const ViewerOrganizationTray: Story = {
  args: {
    loadDashboard: () =>
      Promise.resolve({
        ...organizationDashboard,
        viewer: { ...organizationDashboard.viewer, roleLabel: 'Viewer' },
      }),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', {
        name: 'Open Organization menu',
      }),
    );
  },
};
