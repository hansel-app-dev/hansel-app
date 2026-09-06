/** @spec site-allocation-plans-add REQ-002, REQ-020, REQ-021 @figma 2057:3458 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddPlansModal } from '../src/sites/AddPlansModal.js';

const meta = {
  title: 'Sites/Add Plans Modal',
  component: AddPlansModal,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Figma reference: Hansel App UI frame 2057:3458.',
      },
    },
  },
  args: {
    createBatch: () => Promise.resolve({ uploads: [] }),
    upload: () => Promise.resolve(),
    finalize: () => Promise.resolve(),
    onClose: () => undefined,
    onComplete: () => undefined,
  },
} satisfies Meta<typeof AddPlansModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Narrow: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
