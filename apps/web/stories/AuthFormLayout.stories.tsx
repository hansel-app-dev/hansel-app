/** @spec design-system-foundation REQ-007, REQ-013, REQ-014 @figma 1:3, 38:528 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AuthFormLayout,
  Button,
  ProviderAction,
  TextField,
} from '../src/design-system/index.js';

const meta = {
  title: 'Design system/AuthFormLayout',
  component: AuthFormLayout,
  parameters: { layout: 'fullscreen' },
  args: {
    children: (
      <form>
        <span className="sr-only" data-focus-start tabIndex={-1} />
        <TextField label="Email" placeholder="your@email.com" />
        <TextField label="Password" type="password" />
        <Button type="submit">Continue</Button>
      </form>
    ),
    footer: <p className="text-sm text-content-muted">Supporting copy</p>,
    heading: 'Authentication form',
    providerActions: (
      <>
        <ProviderAction provider="google" />
        <ProviderAction provider="microsoft" />
        <ProviderAction provider="apple" />
      </>
    ),
    providerLabel: 'or continue with',
  },
} satisfies Meta<typeof AuthFormLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
