/** @spec onboarding REQ-086 @figma 52:607 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AboutYou } from '../src/onboarding/AboutYou.js';
const meta = {
  title: 'Onboarding/About You',
  component: AboutYou,
  args: { submitProfile: () => Promise.resolve() },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Figma reference: 52:607' } },
  },
} satisfies Meta<typeof AboutYou>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const OtherSelections: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByLabelText('Job title'), 'other');
    await userEvent.selectOptions(canvas.getByLabelText('Department'), 'other');
    await expect(canvas.getByLabelText('Other job title')).toBeVisible();
    await expect(canvas.getByLabelText('Other department')).toBeVisible();
  },
};
export const ValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByText('Enter your first name.')).toBeVisible();
  },
};
