import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { VerificationCodeField } from '../src/design-system/index.js';

const meta = {
  title: 'Design System/VerificationCodeField',
  component: VerificationCodeField,
  decorators: [
    (Story) => (
      <div className="w-[350px] p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VerificationCodeField>;

export default meta;
type Story = StoryObj<typeof meta>;
const ignoreChange = (_value: string) => undefined;

export const Interactive: Story = {
  args: { label: 'Verification code', onChange: ignoreChange, value: '' },
  render: (args) => {
    const [value, setValue] = useState('');
    return (
      <VerificationCodeField {...args} value={value} onChange={setValue} />
    );
  },
};

export const Filled: Story = {
  args: { label: 'Verification code', onChange: ignoreChange, value: '123456' },
};

export const Error: Story = {
  args: {
    error: 'Enter all six digits',
    label: 'Verification code',
    onChange: ignoreChange,
    value: '123',
  },
};
