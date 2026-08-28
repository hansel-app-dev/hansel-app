import type { Meta, StoryObj } from '@storybook/react-vite';
import { VerifyEmail } from '../src/onboarding/VerifyEmail.js';

const meta = {
  title: 'Onboarding/Verify email',
  component: VerifyEmail,
  args: {
    email: 'owner@example.com',
    verify: () => Promise.resolve({ nextStep: 'personal-profile' }),
    resend: () => Promise.resolve(),
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof VerifyEmail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Waiting: Story = {};
export const ResendAvailable: Story = { args: { resendAvailableInSeconds: 0 } };
