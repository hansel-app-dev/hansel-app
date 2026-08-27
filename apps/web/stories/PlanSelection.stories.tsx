/** @spec onboarding-plan-selection REQ-001, REQ-015 @figma 52:608 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type {
  PlanDisplayEntry,
  PlanSelectionPageResponse,
} from '@hansel/contracts';
import { expect, userEvent, within } from 'storybook/test';
import { PlanSelection } from '../src/onboarding/PlanSelection.js';
const plan = (
  priceId: PlanDisplayEntry['priceId'],
  planId: PlanDisplayEntry['planId'],
  billingInterval: PlanDisplayEntry['billingInterval'],
  amount: number | null,
): PlanDisplayEntry => ({
  priceId,
  planId,
  displayName: planId.charAt(0).toUpperCase() + planId.slice(1),
  description: 'Dummy non-production plan description.',
  features: ['Dummy feature', 'Dummy feature two', 'Dummy feature three'],
  billingInterval,
  currency: 'USD',
  amountMinor: amount,
  monthlyEquivalentMinor: amount,
  additionalSiteAmountMinor:
    planId === 'plus' || planId === 'pro' ? 1500 : null,
  paymentRequired: planId === 'plus' || planId === 'pro',
  maximumSites: planId === 'free' ? 1 : null,
  contactSales: planId === 'enterprise',
});
const state: PlanSelectionPageResponse = {
  firstName: 'Nabin',
  selectedInterval: 'annual',
  selectedPriceId: null,
  plans: [
    plan('free', 'free', null, 0),
    plan('plus_monthly', 'plus', 'monthly', 5000),
    plan('plus_annual', 'plus', 'annual', 3250),
    plan('pro_monthly', 'pro', 'monthly', 15000),
    plan('pro_annual', 'pro', 'annual', 9750),
    plan('enterprise', 'enterprise', null, null),
  ],
};
const meta = {
  title: 'Onboarding/Plan Selection',
  component: PlanSelection,
  args: {
    loadPlans: () => Promise.resolve(state),
    selectPlan: () => Promise.resolve({ nextStep: 'payment' }),
  },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Figma reference: 52:608' } },
  },
} satisfies Meta<typeof PlanSelection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Annual: Story = {};
export const Monthly: Story = {
  args: {
    loadPlans: () => Promise.resolve({ ...state, selectedInterval: 'monthly' }),
  },
};
export const Selected: Story = {
  args: {
    loadPlans: () =>
      Promise.resolve({ ...state, selectedPriceId: 'plus_annual' }),
  },
};
export const FreeSelected: Story = {
  args: {
    loadPlans: () => Promise.resolve({ ...state, selectedPriceId: 'free' }),
  },
};
export const EnterpriseSelected: Story = {
  args: {
    loadPlans: () =>
      Promise.resolve({ ...state, selectedPriceId: 'enterprise' }),
  },
};
export const SubmittingDisabled: Story = {
  args: {
    selectPlan: () => new Promise<{ nextStep: 'payment' }>(() => undefined),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Choose Plus' }));
    await expect(
      canvas.getByRole('button', { name: 'Choose Pro' }),
    ).toBeDisabled();
  },
};
export const LoadFailure: Story = {
  args: { loadPlans: () => Promise.reject(new Error('failed')) },
};
