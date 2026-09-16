import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExternalProviderActions } from '../src/auth/ExternalProviderActions.js';

const meta = {
  title: 'Authentication/External providers',
  component: ExternalProviderActions,
  args: { intent: 'login', availableProviders: ['google'] },
  decorators: [
    (Story) => (
      <div className="grid max-w-sm gap-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExternalProviderActions>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GoogleLogin: Story = {};
export const GoogleOnboarding: Story = { args: { intent: 'onboarding' } };
export const Unavailable: Story = { args: { availableProviders: [] } };
