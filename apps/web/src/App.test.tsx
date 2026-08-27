import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import {
  countryOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '@hansel/contracts';

const planFixture = (
  priceId:
    | 'free'
    | 'plus_monthly'
    | 'plus_annual'
    | 'pro_monthly'
    | 'pro_annual'
    | 'enterprise',
) => {
  const planId =
    priceId === 'free'
      ? 'free'
      : priceId.startsWith('plus')
        ? 'plus'
        : priceId.startsWith('pro')
          ? 'pro'
          : 'enterprise';
  return {
    priceId,
    planId,
    displayName: planId.charAt(0).toUpperCase() + planId.slice(1),
    description: 'Plan',
    features: ['Feature one', 'Feature two', 'Feature three'],
    billingInterval: priceId.endsWith('monthly')
      ? 'monthly'
      : priceId.endsWith('annual')
        ? 'annual'
        : null,
    currency: 'USD',
    amountMinor: priceId === 'enterprise' ? null : 0,
    monthlyEquivalentMinor: priceId === 'enterprise' ? null : 0,
    additionalSiteAmountMinor: null,
    paymentRequired: planId === 'plus' || planId === 'pro',
    maximumSites: planId === 'free' ? 1 : null,
    contactSales: planId === 'enterprise',
  };
};
const planFixtures = (
  [
    'free',
    'plus_monthly',
    'plus_annual',
    'pro_monthly',
    'pro_annual',
    'enterprise',
  ] as const
).map(planFixture);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('App [REQ-002]', () => {
  it('routes organization profile completion to discovery [onboarding-organization-profile REQ-001, REQ-011]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'x'.repeat(43),
              countries: countryOptions,
              industries: [...industryOptions],
              placesByIndustry: Object.fromEntries(
                Object.entries(placeServiceOptions).map(([key, values]) => [
                  key,
                  [...values],
                ]),
              ),
              sizes: [...organizationSizeOptions],
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'discovery' }), {
            status: 200,
          }),
        ),
    );
    render(<App path="/onboarding/organization-profile" />);
    await screen.findByLabelText('Organization');
    fireEvent.change(screen.getByLabelText('Organization'), {
      target: { value: 'Hansel' },
    });
    fireEvent.change(screen.getByLabelText('Country'), {
      target: { value: 'AU' },
    });
    fireEvent.change(screen.getByLabelText('Industry or sector'), {
      target: { value: 'healthcare' },
    });
    fireEvent.change(screen.getByLabelText('Type of place or service'), {
      target: { value: 'clinics' },
    });
    fireEvent.change(screen.getByLabelText('Size'), {
      target: { value: 'employees_11_50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding/discovery');
    });
  });
  it('shows only Hansel in the middle of the landing page [REQ-006]', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('place-items-center');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Hansel',
    );
    expect(main).toHaveTextContent(/^Hansel$/);
  });

  it('routes the approved onboarding entry to the account form', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App path="/onboarding" />);
    expect(
      screen.getByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes the verification step', () => {
    render(<App path="/onboarding/verify-email" />);
    expect(
      screen.getByRole('heading', { name: 'Verify your account' }),
    ).toBeInTheDocument();
  });

  it('routes the personal profile step', () => {
    render(<App path="/onboarding/about-you" />);
    expect(
      screen.getByRole('heading', { name: 'Tell us about you' }),
    ).toBeInTheDocument();
  });

  it('connects verification and resend actions to the configured API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'personal-profile' }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
        ),
    );
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    expect(
      await screen.findByRole('heading', { name: 'Tell us about you' }),
    ).toBeInTheDocument();
    cleanup();
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request new code' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('submits personal details and advances to plan selection', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nextStep: 'plan-selection' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<App apiUrl="https://api.example" />);
    for (const [label, value] of [
      ['First name', 'Nabin'],
      ['Last name', 'Singh'],
      ['Job title', 'manager'],
      ['Department', 'marketing_communications'],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding/plan-selection');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      expect.objectContaining({ credentials: 'include' }),
    );
    window.history.replaceState({}, '', '/');
  });

  it.each([
    ['plus_annual', 'payment', '/onboarding/payment'],
    ['free', 'organization-profile', '/onboarding/organization-profile'],
  ] as const)(
    'routes a selected %s plan to %s [onboarding-plan-selection REQ-006, REQ-007]',
    async (priceId, nextStep, destination) => {
      window.history.replaceState({}, '', '/onboarding/plan-selection');
      document.cookie = 'hansel_onboarding_csrf=csrf-proof';
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              firstName: 'Nabin',
              selectedInterval: 'annual',
              selectedPriceId: null,
              plans: planFixtures,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep }), { status: 200 }),
        );
      vi.stubGlobal('fetch', fetchMock);
      render(<App />);
      fireEvent.click(
        await screen.findByRole('button', {
          name: priceId === 'free' ? 'Or try it for free' : 'Choose Plus',
        }),
      );
      await waitFor(() => {
        expect(window.location.pathname).toBe(destination);
      });
      window.history.replaceState({}, '', '/');
    },
  );

  it('opens the configured Enterprise sales destination [onboarding-plan-selection REQ-008]', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const openExternal = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              firstName: 'Nabin',
              selectedInterval: 'annual',
              selectedPriceId: null,
              plans: planFixtures,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              nextStep: 'contact-sales',
              destination: 'https://sales.example.com/hansel',
            }),
            { status: 200 },
          ),
        ),
    );
    render(
      <App path="/onboarding/plan-selection" openExternal={openExternal} />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Schedule a call' }),
    );
    await waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith(
        'https://sales.example.com/hansel',
      );
    });
  });

  it('submits onboarding through the configured API URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nextStep: 'verify-email' }), {
          status: 202,
        }),
      ),
    );
    render(<App apiUrl="https://api.example" path="/onboarding" />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/accounts',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('carries the submitted destination into the verification step', async () => {
    window.history.replaceState({}, '', '/onboarding');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nextStep: 'verify-email' }), {
          status: 202,
        }),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));
    expect(
      await screen.findByRole('heading', { name: 'Verify your account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Request new code in 60s')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('hansel.verificationEmail')).toBe(
      'owner@example.com',
    );
    window.history.replaceState({}, '', '/');
  });

  it('resends to the stored destination after a same-tab reload [REQ-084]', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'owner@example.com',
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    for (let second = 0; second < 60; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Request new code' }));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example/api/onboarding/email-verification/resend',
        expect.objectContaining({
          body: JSON.stringify({ email: 'owner@example.com' }),
        }),
      );
    });
  });
});
