/** @spec dashboard-home REQ-001, REQ-015..REQ-017; dashboard-logout REQ-011 @figma 40:502 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Dashboard } from '../src/dashboard/Dashboard.js';

const owner = {
  viewer: {
    displayName: 'John Smith',
    initials: 'JS',
    roleLabel: 'Admin',
  },
};

const meta = {
  title: 'Dashboard/Home',
  component: Dashboard,
  args: {
    loadDashboard: () => Promise.resolve(owner),
    logout: () => Promise.resolve(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Figma reference: Dashboard 40:502 / 0.0 Dashboard',
      },
    },
  },
} satisfies Meta<typeof Dashboard>;
export default meta;
type Story = StoryObj<typeof meta>;

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

export const FigmaSample: Story = {};

export const AccountMenuOpen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'John Smith, Admin' }),
    );
    await expect(
      canvas.getByRole('menuitem', { name: 'Log out' }),
    ).toHaveFocus();
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
    await expect(canvas.getByRole('button', { name: 'Retry' })).toHaveFocus();
  },
};

export const Narrow: Story = {
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
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
