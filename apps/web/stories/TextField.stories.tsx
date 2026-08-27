/**
 * @spec design-system-foundation REQ-005, REQ-007, REQ-011
 * @figma 1:3
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from '../src/design-system/index.js';

const meta = {
  title: 'Design System/TextField',
  component: TextField,
  parameters: { docs: { description: { component: 'Figma reference: 1:3' } } },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  args: { label: 'Email' },
  render: () => (
    <main className="grid gap-component-gap rounded-control bg-canvas p-workbench">
      <span className="sr-only" data-focus-start tabIndex={-1} />
      <h1 className="text-xl font-semibold text-content">Text field</h1>
      <div className="grid min-w-80 gap-component-gap rounded-control bg-surface p-workbench shadow-control">
        <TextField description="Use your work email." label="Email" />
        <TextField
          error="Enter a valid email address."
          label="Email with error"
          value="invalid"
          readOnly
        />
        <TextField disabled label="Disabled email" value="name@example.com" />
      </div>
    </main>
  ),
};
