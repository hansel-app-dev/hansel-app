/**
 * @spec design-system-foundation REQ-004, REQ-007, REQ-011, REQ-013
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
        <Button className="gap-2" variant="secondary">
          <svg aria-hidden="true" className="size-4" viewBox="0 0 18 18">
            <path
              d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.876 2.684-6.613Z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.468-.806 5.956-2.182l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 0 0 9 18Z"
              fill="#34A853"
            />
            <path
              d="M3.963 10.705A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.167.282-1.705V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.333Z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.333C4.672 5.166 6.656 3.58 9 3.58Z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
        <Button disabled>Disabled action</Button>
      </div>
    </main>
  ),
};
