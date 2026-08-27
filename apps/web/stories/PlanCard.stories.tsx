/** @spec onboarding-plan-selection REQ-015 @figma 52:608 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PlanDisplayEntry } from '@hansel/contracts';
import { PlanCard } from '../src/design-system/index.js';
const plus: PlanDisplayEntry = {
  priceId: 'plus_annual',
  planId: 'plus',
  displayName: 'Plus',
  description: 'Dummy non-production plan description.',
  features: ['Dummy feature', 'Dummy feature two', 'Dummy feature three'],
  billingInterval: 'annual',
  currency: 'USD',
  amountMinor: 39000,
  monthlyEquivalentMinor: 3250,
  additionalSiteAmountMinor: 1500,
  paymentRequired: true,
  maximumSites: null,
  contactSales: false,
};
const meta = {
  title: 'Design System/PlanCard',
  component: PlanCard,
  args: { plan: plus, onSelect: () => undefined },
  decorators: [
    (Story) => (
      <main>
        <h1 className="sr-only">Plan card cookbook</h1>
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof PlanCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Normal: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Free: Story = {
  args: {
    plan: {
      ...plus,
      priceId: 'free',
      planId: 'free',
      displayName: 'Free',
      billingInterval: null,
      amountMinor: 0,
      monthlyEquivalentMinor: 0,
      additionalSiteAmountMinor: null,
      paymentRequired: false,
      maximumSites: 1,
    },
  },
};
export const Enterprise: Story = {
  args: {
    plan: {
      ...plus,
      priceId: 'enterprise',
      planId: 'enterprise',
      displayName: 'Enterprise',
      billingInterval: null,
      amountMinor: null,
      monthlyEquivalentMinor: null,
      additionalSiteAmountMinor: null,
      paymentRequired: false,
      contactSales: true,
    },
  },
};
