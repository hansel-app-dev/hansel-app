import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import type { SignMounting } from '@hansel/contracts';
import { SignMountingSelect } from '../src/sites/SignMountingSelect.js';
function Preview({
  value = 'Wall-mounted',
  disabled = false,
}: {
  value?: SignMounting;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <div className="w-[min(350px,100vw)] bg-white p-6">
      <SignMountingSelect
        value={selected}
        disabled={disabled}
        onChange={setSelected}
      />
    </div>
  );
}
const meta = {
  title: 'Sites/Sign Mounting Select',
  component: Preview,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WallMounted: Story = {};
export const Freestanding: Story = { args: { value: 'Freestanding' } };
export const Overhead: Story = { args: { value: 'Overhead' } };
export const Cantilevered: Story = { args: { value: 'Cantilevered' } };
export const Floor: Story = { args: { value: 'Floor' } };
export const Disabled: Story = { args: { disabled: true } };
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox'));
  },
};
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}');
  },
};

/** @spec sign-additional-type-options REQ-002,006 */
export const SafetyDecal: Story = { args: { value: 'Safety Decal' } };
export const PrivacyDecal: Story = { args: { value: 'Privacy Decal' } };
export const Environmental: Story = { args: { value: 'Environmental' } };
export const DisabledEnvironmental: Story = {
  args: { value: 'Environmental', disabled: true },
};
export const Constrained: Story = {
  ...Open,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
