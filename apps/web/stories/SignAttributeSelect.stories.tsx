/** @spec sign-attribute-custom-dropdowns REQ-006 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState, type ComponentProps } from 'react';
import { userEvent, within } from 'storybook/test';
import { signFunctionOptions } from '@hansel/contracts';
import { SignAttributeSelect } from '../src/sites/SignAttributeSelect.js';

function Example(args: ComponentProps<typeof SignAttributeSelect>) {
  const [value, setValue] = useState(args.value);
  return <SignAttributeSelect {...args} value={value} onChange={setValue} />;
}
const meta = {
  title: 'Sites/Sign Attribute Select',
  component: SignAttributeSelect,
  args: {
    label: 'Function',
    value: 'Directional',
    options: signFunctionOptions,
    onChange: () => undefined,
  },
  render: (args) => <Example {...args} />,
  decorators: [
    (Story) => (
      <div className="w-[302px] max-w-full p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SignAttributeSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selected: Story = {};
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox'));
  },
};
export const LongLabel: Story = { args: { value: 'Regulatory/Statutory' } };
export const Disabled: Story = { args: { disabled: true } };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole('combobox').focus();
    await userEvent.keyboard('{Enter}{End}');
  },
};
export const Colour: Story = {
  args: {
    label: 'Colour',
    value: 'Red',
    options: ['Red'],
    icon: (
      <span
        aria-hidden="true"
        className="size-5 shrink-0 rounded-full bg-[#f45b00]"
      />
    ),
  },
};
export const ColourOpen: Story = {
  ...Colour,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox'));
  },
};
