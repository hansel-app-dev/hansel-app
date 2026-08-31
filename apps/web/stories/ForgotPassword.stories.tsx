import type { Meta, StoryObj } from '@storybook/react-vite';
import { ForgotPassword } from '../src/auth/ForgotPassword.js';

const meta = {
  title: 'Authentication/ForgotPassword',
  component: ForgotPassword,
  parameters: { layout: 'fullscreen' },
  args: {
    requestRecovery: () => Promise.resolve({ status: 'accepted' }),
  },
} satisfies Meta<typeof ForgotPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Validation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send reset code' }),
    );
  },
};

export const ServiceUnavailable: Story = {
  args: {
    requestRecovery: () => Promise.reject(new Error('unavailable')),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'owner@example.com');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send reset code' }),
    );
  },
};

export const Submitting: Story = {
  args: {
    requestRecovery: () => new Promise(() => undefined),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'owner@example.com');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Send reset code' }),
    );
  },
};
