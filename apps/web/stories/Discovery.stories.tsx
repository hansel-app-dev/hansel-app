/** @spec onboarding-discovery REQ-001, REQ-015, REQ-016 @figma 37:649 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { discoveryManagementOptions } from '@hansel/contracts';
import type { DiscoveryPageResponse } from '@hansel/contracts';
import { Discovery } from '../src/onboarding/Discovery.js';

const page: DiscoveryPageResponse = {
  submissionKey: 'x'.repeat(43),
  methods: [...discoveryManagementOptions],
};
const meta = {
  title: 'Onboarding/Discovery',
  component: Discovery,
  args: {
    loadDiscovery: () => Promise.resolve(page),
    completeDiscovery: () =>
      Promise.resolve({
        nextStep: 'dashboard' as const,
        destination: '/dashboard' as const,
      }),
  },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Figma reference: 37:649' } },
  },
} satisfies Meta<typeof Discovery>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};
export const OtherSelected: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      await canvas.findByLabelText('How do you manage your signage currently?'),
      'other',
    );
    await expect(canvas.getByLabelText('Other tools')).toBeVisible();
  },
};
export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Next' }));
    await expect(canvas.getByRole('alert')).toBeVisible();
  },
};
export const Submitting: Story = {
  args: {
    completeDiscovery: () =>
      new Promise<{ nextStep: 'dashboard'; destination: '/dashboard' }>(
        () => undefined,
      ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      await canvas.findByLabelText('How do you manage your signage currently?'),
      'pdf',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled();
  },
};
export const LoadFailure: Story = {
  args: { loadDiscovery: () => Promise.reject(new Error('failed')) },
};
export const ServerFailure: Story = {
  args: { completeDiscovery: () => Promise.reject(new Error('failed')) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Skip for now' }),
    );
    await expect(await canvas.findByRole('alert')).toBeVisible();
  },
};
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
