/** @spec site-cover-image-add REQ-016 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteCoverImageStep } from '../src/sites/SiteCoverImageStep.js';

const meta = {
  title: 'Sites/Site Cover Image Step',
  component: SiteCoverImageStep,
  args: {
    destination: '/sites/00000000-0000-4000-8000-000000000001/activity',
    onComplete: () => undefined,
    siteId: '00000000-0000-4000-8000-000000000001',
    uploadCoverImage: () => Promise.resolve(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto mt-16 max-w-[500px] overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex h-[51px] items-center border-b px-6 text-[18px] font-semibold">
          Add a cover image
        </header>
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteCoverImageStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
