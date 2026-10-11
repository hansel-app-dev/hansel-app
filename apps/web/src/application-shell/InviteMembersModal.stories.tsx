import type { Meta, StoryObj } from '@storybook/react-vite';
import { InviteMembersModal } from './InviteMembersModal.js';

const meta = {
  title: 'Application/InviteMembersModal',
  component: InviteMembersModal,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof InviteMembersModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { onClose: () => undefined },
};

export const Populated: Story = {
  args: {
    initialInvites: [{ email: 'person@example.com', role: 'Editor' }],
    onClose: () => undefined,
    onSubmit: () => undefined,
  },
};
