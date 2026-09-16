import type { Meta, StoryObj } from '@storybook/react-vite';
import { MicrosoftEmail } from './MicrosoftEmail.js';
const meta = {
  title: 'Onboarding/Microsoft email',
  component: MicrosoftEmail,
  args: { send: () => Promise.resolve(), verify: () => Promise.resolve() },
} satisfies Meta<typeof MicrosoftEmail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ContactEmail: Story = {
  args: {
    load: () =>
      Promise.resolve({
        email: 'person@example.com',
        sent: false,
        resendAfter: 0,
      }),
  },
};
export const MissingEmail: Story = {
  args: {
    load: () => Promise.resolve({ email: '', sent: false, resendAfter: 0 }),
  },
};
export const Verification: Story = {
  args: {
    load: () =>
      Promise.resolve({
        email: 'person@example.com',
        sent: true,
        resendAfter: 60,
      }),
  },
};
export const Expired: Story = { args: { load: () => Promise.resolve(null) } };
export const Unavailable: Story = {
  args: {
    load: () => Promise.reject(new Error('Unavailable')),
  },
};
