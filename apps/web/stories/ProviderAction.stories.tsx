/** @spec design-system-foundation REQ-007, REQ-013, REQ-014 @figma 1:3, 38:528 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProviderAction } from '../src/design-system/index.js';

const meta = {
  title: 'Design system/ProviderAction',
  component: ProviderAction,
  args: { provider: 'google' },
} satisfies Meta<typeof ProviderAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Providers: Story = {
  render: () => (
    <main className="grid w-[350px] gap-[14px]">
      <span className="sr-only" data-focus-start tabIndex={-1} />
      <h1 className="text-xl font-semibold">Provider actions</h1>
      <ProviderAction provider="google" />
      <ProviderAction provider="microsoft" />
      <ProviderAction provider="apple" />
    </main>
  ),
};

export const Disabled: Story = { args: { disabled: true } };

export const Link: Story = {
  args: { href: '/auth/start/google?intent=login' },
};
