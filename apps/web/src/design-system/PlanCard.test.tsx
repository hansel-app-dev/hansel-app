import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanDisplayEntry } from '@hansel/contracts';
import { PlanCard } from './PlanCard.js';
afterEach(cleanup);
const plus: PlanDisplayEntry = {
  priceId: 'plus_annual',
  planId: 'plus',
  displayName: 'Plus',
  description: 'Dummy description',
  features: ['One', 'Two', 'Three'],
  billingInterval: 'annual',
  currency: 'USD',
  amountMinor: 39000,
  monthlyEquivalentMinor: 3250,
  additionalSiteAmountMinor: 1500,
  paymentRequired: true,
  maximumSites: null,
  contactSales: false,
};
describe('PlanCard [onboarding-plan-selection REQ-015]', () => {
  it('renders pricing and selects its stable identifier', () => {
    const onSelect = vi.fn();
    render(<PlanCard plan={plus} selected onSelect={onSelect} />);
    expect(screen.getByLabelText('Plus plan, selected')).toBeVisible();
    expect(screen.getByText('$32.50/mo')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Choose Plus' }));
    expect(onSelect).toHaveBeenCalledWith('plus_annual');
  });
  it('renders disabled Enterprise contact behavior', () => {
    render(
      <PlanCard
        plan={{
          ...plus,
          priceId: 'enterprise',
          planId: 'enterprise',
          displayName: 'Enterprise',
          contactSales: true,
          billingInterval: null,
          amountMinor: null,
          monthlyEquivalentMinor: null,
          additionalSiteAmountMinor: null,
          paymentRequired: false,
        }}
        disabled
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Custom')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Schedule a call' }),
    ).toBeDisabled();
  });
  it('renders whole-dollar monthly pricing and one included site', () => {
    render(
      <PlanCard
        plan={{
          ...plus,
          priceId: 'plus_monthly',
          billingInterval: 'monthly',
          monthlyEquivalentMinor: 5000,
          additionalSiteAmountMinor: null,
        }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('$50/mo')).toBeVisible();
    expect(screen.getByText('One site included')).toBeVisible();
  });
});
