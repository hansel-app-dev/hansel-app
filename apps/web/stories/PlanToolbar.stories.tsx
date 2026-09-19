/** @spec allocation-plan-toolbar REQ-001..007 */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanToolbar, type PlanTool } from '../src/sites/PlanToolbar.js';

const meta = {
  title: 'Sites/Plan Toolbar',
  component: PlanToolbar,
  args: { tool: 'move', canAdd: true, onChange: () => undefined },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PlanToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Move: Story = {};
export const AddSign: Story = { args: { tool: 'add' } };
export const Viewer: Story = { args: { canAdd: false } };
export const Saving: Story = { args: { disabled: true } };
export const Interactive: Story = {
  render: function InteractiveToolbar(args) {
    const [tool, setTool] = useState<PlanTool>('move');
    return <PlanToolbar {...args} tool={tool} onChange={setTool} />;
  },
};
