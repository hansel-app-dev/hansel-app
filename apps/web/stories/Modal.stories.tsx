import type { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from '../src/design-system/Modal.js';

const meta = {
  title: 'Design System/Modal',
  component: Modal,
  args: { onClose: () => undefined, title: 'Add new site' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="p-6 text-content">
        <h2 className="text-xl font-semibold">Add new site</h2>
        <p className="mt-2 text-sm text-content-muted">Dialog content</p>
      </div>
    ),
  },
};
