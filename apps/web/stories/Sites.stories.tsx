/** @spec sites-empty-state REQ-001, REQ-004..REQ-012 @figma 2024:9828 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Sites } from '../src/sites/Sites.js';

const figmaViewer = {
  viewer: {
    displayName: 'John Smith',
    initials: 'JS',
    roleLabel: 'Admin',
  },
};

const meta = {
  title: 'Sites/Empty State',
  component: Sites,
  args: {
    loadDashboard: () => Promise.resolve(figmaViewer),
    logout: () => Promise.resolve(),
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
    await expect(canvas.getByRole('button', { name: 'Retry' })).toHaveFocus();
  },
};

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
