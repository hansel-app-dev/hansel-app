import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResetPassword } from '../src/auth/ResetPassword.js';
import { PasswordResetRejectedError } from '../src/api.js';

const meta = {
  title: 'Authentication/ResetPassword',
  component: ResetPassword,
  parameters: { layout: 'fullscreen' },
  args: {
    email: 'owner@example.com',
    requestRecovery: () => Promise.resolve({ status: 'accepted' }),
    resetPassword: () => Promise.resolve({ destination: '/login' }),
  },
} satisfies Meta<typeof ResetPassword>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { email: '' } };

export const ValidationErrors: Story = {
  args: { email: '' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset password' }),
    );
  },
};

const validInput = async (
  canvas: Parameters<NonNullable<Story['play']>>[0]['canvas'],
  userEvent: Parameters<NonNullable<Story['play']>>[0]['userEvent'],
) => {
  await userEvent.type(canvas.getByLabelText('Reset code'), '123456');
  await userEvent.type(
    canvas.getByLabelText('New password'),
    'Secure password value!7A',
  );
  await userEvent.type(
    canvas.getByLabelText('Confirm new password'),
    'Secure password value!7A',
  );
};

export const Rejected: Story = {
  args: {
    resetPassword: () => Promise.reject(new PasswordResetRejectedError()),
  },
  play: async ({ canvas, userEvent }) => {
    await validInput(canvas, userEvent);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset password' }),
    );
  },
};

export const ServiceUnavailable: Story = {
  args: { resetPassword: () => Promise.reject(new Error('unavailable')) },
  play: async ({ canvas, userEvent }) => {
    await validInput(canvas, userEvent);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset password' }),
    );
  },
};

export const Submitting: Story = {
  args: { resetPassword: () => new Promise(() => undefined) },
  play: async ({ canvas, userEvent }) => {
    await validInput(canvas, userEvent);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset password' }),
    );
  },
};

export const Success: Story = {
  play: async ({ canvas, userEvent }) => {
    await validInput(canvas, userEvent);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reset password' }),
    );
  },
};
