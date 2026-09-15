/** @spec site-cover-image-display REQ-001, REQ-002, REQ-007 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SiteCoverImage } from '../src/sites/SiteCoverImage.js';

const sample =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#dbeafe"/><path d="M0 280L180 120L300 240L420 160L640 310V360H0Z" fill="#64748b"/><circle cx="510" cy="65" r="30" fill="#fbbf24"/></svg>';
const meta = {
  title: 'Sites/Site Cover Image',
  component: SiteCoverImage,
  args: {
    siteId: 'story-site',
    hasCoverImage: true,
    loadCoverImage: () =>
      Promise.resolve(new Blob([sample], { type: 'image/svg+xml' })),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 'min(360px, 100%)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SiteCoverImage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Saved: Story = {};
export const Absent: Story = { args: { hasCoverImage: false } };
export const Loading: Story = {
  args: {
    loadCoverImage: () =>
      new Promise<Blob>(() => {
        /* Intentionally pending story. */
      }),
  },
};
export const Failed: Story = {
  args: { loadCoverImage: () => Promise.reject(new Error('unavailable')) },
};
