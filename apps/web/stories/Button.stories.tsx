/**
 * @spec design-system-foundation REQ-004, REQ-007, REQ-011
 * @figma 1:3
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../src/design-system/index.js';

const meta = {
  title: 'Design System/Button',
  component: Button,
  parameters: { docs: { description: { component: 'Figma reference: 1:3' } } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <main className="grid gap-component-gap rounded-control bg-canvas p-workbench">
      <span className="sr-only" data-focus-start tabIndex={-1} />
      <h1 className="text-xl font-semibold text-content">Button</h1>
      <div className="grid min-w-64 gap-component-gap rounded-control bg-surface p-workbench shadow-control">
        <Button>Primary action</Button>
        <Button variant="secondary">Secondary action</Button>
        <Button disabled>Disabled action</Button>
      </div>
    </main>
  ),
};
