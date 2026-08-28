import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  PlanDisplayEntry,
  PlanSelectionPageResponse,
} from '@hansel/contracts';
import { PlanSelection } from './PlanSelection.js';
afterEach(cleanup);
const entry = (
  priceId: PlanDisplayEntry['priceId'],
  planId: PlanDisplayEntry['planId'],
  billingInterval: PlanDisplayEntry['billingInterval'],
  amount: number | null,
): PlanDisplayEntry => ({
  priceId,
  planId,
  displayName: planId.charAt(0).toUpperCase() + planId.slice(1),
  description: 'Dummy description',
  features: ['One', 'Two', 'Three'],
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
    entry('free', 'free', null, 0),
    entry('plus_monthly', 'plus', 'monthly', 5000),
    entry('plus_annual', 'plus', 'annual', 3250),
    entry('pro_monthly', 'pro', 'monthly', 15000),
    entry('pro_annual', 'pro', 'annual', 9750),
    entry('enterprise', 'enterprise', null, null),
  ],
};

describe('PlanSelection [onboarding-plan-selection REQ-001, REQ-004, REQ-005, REQ-015]', () => {
  it('loads Annual by default and switches to Monthly', async () => {
    render(
      <PlanSelection
        loadPlans={() => Promise.resolve(state)}
        selectPlan={vi.fn()}
      />,
    );
    expect(screen.getByText('Loading plans…')).toBeVisible();
    expect(
      await screen.findByRole('heading', {
        name: 'Welcome Nabin, choose your plan',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Annual' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Choose Plus' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }));
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('submits Free and reports the server-authored result', async () => {
    const onCompleted = vi.fn();
    const selectPlan = vi
      .fn()
      .mockResolvedValue({ nextStep: 'organization-profile' });
    render(
      <PlanSelection
        loadPlans={() => Promise.resolve(state)}
        selectPlan={selectPlan}
        onCompleted={onCompleted}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Or try it for free' }),
    );
    await waitFor(() => {
      expect(selectPlan).toHaveBeenCalledWith('free');
    });
    expect(onCompleted).toHaveBeenCalledWith({
      nextStep: 'organization-profile',
    });
  });
  it('shows a recoverable selection error', async () => {
    render(
      <PlanSelection
        loadPlans={() => Promise.resolve(state)}
        selectPlan={() => Promise.reject(new Error('failed'))}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Choose Plus' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your plan. Please try again.',
    );
    expect(screen.getByLabelText('Plus plan, selected')).toBeVisible();
  });
  it('shows a recoverable loading error', async () => {
    render(
      <PlanSelection
        loadPlans={() => Promise.reject(new Error('failed'))}
        selectPlan={vi.fn()}
      />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load plans. Please try again.',
    );
    expect(
      screen.getByRole('button', { name: 'Or try it for free' }),
    ).toBeDisabled();
  });
  it('supports successful selection without a completion callback', async () => {
    render(
      <PlanSelection
        loadPlans={() => Promise.resolve(state)}
        selectPlan={() => Promise.resolve({ nextStep: 'payment' })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Choose Plus' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Choose Plus' })).toBeEnabled(),
    );
  });

  it('keeps the Back href and delegates enhanced navigation [onboarding-plan-selection REQ-013]', async () => {
    const onBack = vi.fn();
    render(
      <PlanSelection
        loadPlans={() => Promise.resolve(state)}
        selectPlan={vi.fn()}
        onBack={onBack}
      />,
    );
    const back = await screen.findByRole('link', { name: 'Back' });
    expect(back).toHaveAttribute('href', '/onboarding/about-you');
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
