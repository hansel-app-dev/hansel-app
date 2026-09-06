/** @spec site-allocation-plan-preview REQ-006..REQ-013 @figma supplied 03.png */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { AllocationPlanViewer } from '../src/sites/AllocationPlanViewer.js';

const plan = {
  id: '00000000-0000-4000-8000-000000000006',
  filename: 'Ground Floor.png',
  mediaType: 'image/png' as const,
  byteSize: 3,
  createdAt: '2026-09-06T00:00:00.000Z',
  modifiedAt: '2026-09-06T00:00:00.000Z',
  uploadedBy: 'Nabin Singh',
};
const preview =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700"><rect width="100%" height="100%" fill="white"/><g fill="none" stroke="black"><rect x="80" y="70" width="840" height="560"/><path d="M80 250h840M300 70v560M620 70v560M300 400h320"/></g><g font-family="sans-serif" font-size="24"><text x="390" y="170">ALLOCATION PLAN</text><text x="390" y="340">GROUND FLOOR</text></g></svg>',
  );

const meta = {
  title: 'Sites/Allocation Plan Viewer',
  component: AllocationPlanViewer,
  args: {
    plan,
    loadContent: () => Promise.resolve(new Blob()),
    render: () => Promise.resolve({ src: preview, release: () => undefined }),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AllocationPlanViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ImagePlan: Story = {};
export const Loading: Story = {
  args: { loadContent: () => new Promise(() => undefined) },
};
export const Failure: Story = {
  args: { loadContent: () => Promise.reject(new Error('unavailable')) },
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
export const SpacePanArmed: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('img', { name: plan.filename });
    await userEvent.hover(
      canvas.getByRole('region', { name: `${plan.filename} preview` }),
    );
    await userEvent.keyboard('[Space>]');
  },
};
