/**
 * @spec onboarding REQ-016, REQ-082, REQ-083
 * @figma 1:3
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnboardingStart } from '../src/onboarding/OnboardingStart.js';

const meta = {
  title: 'Onboarding/Account creation',
  component: OnboardingStart,
  parameters: {
    docs: {
      description: {
        component: 'New user / new organization, Step 1. Figma reference: 1:3',
      },
    },
    layout: 'fullscreen',
  },
  args: {
    createAccount: async () => Promise.resolve({ nextStep: 'verify-email' }),
  },
} satisfies Meta<typeof OnboardingStart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
