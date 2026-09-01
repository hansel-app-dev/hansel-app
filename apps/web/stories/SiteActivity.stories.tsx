/** @spec sites-add-new REQ-019 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteActivity } from '../src/sites/SiteActivity.js';

const meta = {
  title: 'Sites/Site Activity',
  component: SiteActivity,
  args: {
    loadActivity: () =>
      Promise.resolve({
        site: {
          id: 'ad96f8c1-e7f8-4fbb-a057-1c98ee4539a9',
          name: 'Sydney Central',
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
    logout: () => Promise.resolve(),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {};

export const Failure: Story = {
  args: { loadActivity: () => Promise.reject(new Error('unavailable')) },
};
