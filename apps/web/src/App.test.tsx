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
  discoveryManagementOptions,
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
  document.cookie = 'hansel_onboarding_csrf=; Max-Age=0; path=/';
  window.history.replaceState({}, '', '/');
});

describe('App [REQ-002]', () => {
  it('routes only /dashboard to the authenticated dashboard module [dashboard-home REQ-006]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<App path="/dashboard" />);

    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(
      screen.getAllByRole('heading', { name: 'Widget title' }),
    ).toHaveLength(4);
    expect(fetch).toHaveBeenCalledWith('/api/dashboard', {
      credentials: 'include',
    });
  });

  it('returns an unauthenticated dashboard to login [user-login REQ-012]', async () => {
    window.history.replaceState({}, '', '/dashboard');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/login');
  });

  it('logs out from the dashboard and replaces navigation with login [user-login REQ-012]', async () => {
    window.history.replaceState({}, '', '/dashboard');
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'stale@example.com',
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    render(<App />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nabin Singh, Owner' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/dashboard/logout', {
      method: 'POST',
      credentials: 'include',
    });
    expect(window.location.pathname).toBe('/login');
    expect(
      window.sessionStorage.getItem('hansel.verificationEmail'),
    ).toBeNull();
  });

  it('routes a successful login to the server-owned destination [user-login REQ-009, REQ-012]', async () => {
    window.history.replaceState({}, '', '/login');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ destination: '/dashboard' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetcher);

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: ' Nabin@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct-password-1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(window.location.pathname).toBe('/dashboard');
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/login', {
      body: expect.any(String),
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const submittedBody = fetcher.mock.calls[1]?.[1]?.body;
    if (typeof submittedBody !== 'string')
      throw new Error('Expected a serialized login request');
    const submittedLogin: unknown = JSON.parse(submittedBody);
    expect(submittedLogin).toEqual({
      email: 'nabin@example.com',
      password: 'Correct-password-1!',
    });
  });

  it('stores the normalized email when login resumes verification [user-login REQ-009]', async () => {
    window.history.replaceState({}, '', '/login');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ destination: '/onboarding/verify-email' }),
            { status: 200 },
          ),
        ),
    );
    render(<App />);
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: ' Owner@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct-password-1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByRole('heading', { name: 'Verify your account' }),
    ).toBeVisible();
    expect(window.sessionStorage.getItem('hansel.verificationEmail')).toBe(
      'owner@example.com',
    );
  });

  it('replaces login with dashboard for an existing valid session [user-login REQ-012]', async () => {
    window.history.replaceState({}, '', '/login');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              viewer: {
                displayName: 'Nabin Singh',
                initials: 'NS',
                roleLabel: 'Owner',
              },
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<App />);

    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('ignores a completed login preflight after the page unmounts', () => {
    window.history.replaceState({}, '', '/login');
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const view = render(<App />);
    view.unmount();
    act(() => {
      resolveFetch?.(
        new Response(
          JSON.stringify({
            viewer: { displayName: 'Ava', initials: 'A', roleLabel: 'Owner' },
          }),
          { status: 200 },
        ),
      );
    });
    expect(window.location.pathname).toBe('/login');
  });

  it('renders discovery and follows only the server-owned dashboard destination [onboarding-discovery REQ-001, REQ-010]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof; path=/';
    const openExternal = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'x'.repeat(43),
              methods: discoveryManagementOptions,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              nextStep: 'dashboard',
              destination: '/dashboard',
            }),
            { status: 200 },
          ),
        ),
    );
    render(<App path="/onboarding/discovery" openExternal={openExternal} />);
    fireEvent.change(
      await screen.findByLabelText('How do you manage your signage currently?'),
      { target: { value: 'pdf' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(openExternal).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('returns from discovery to the saved organization profile [onboarding-discovery REQ-012]', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'x'.repeat(43),
              methods: discoveryManagementOptions,
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              submissionKey: 'o'.repeat(43),
              countries: countryOptions,
              industries: industryOptions,
              placesByIndustry: placeServiceOptions,
              sizes: organizationSizeOptions,
            }),
            { status: 200 },
          ),
        ),
    );
    window.history.replaceState({}, '', '/onboarding/discovery');
    render(<App />);
    await screen.findByLabelText('How do you manage your signage currently?');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.location.pathname).toBe('/onboarding/organization-profile');
  });

  it('returns an expired discovery session to onboarding [onboarding-discovery REQ-013]', async () => {
    window.history.replaceState({}, '', '/onboarding/discovery');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'onboarding_session_expired' }), {
          status: 401,
        }),
      ),
    );
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: "Let's get started" }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/onboarding');
    window.history.replaceState({}, '', '/');
  });
  it('routes organization profile completion to discovery [onboarding-organization-profile REQ-001, REQ-011]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof; path=/';
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

  it.each([
    ['onboarding', '/onboarding', "Let's get started"],
    ['verification', '/onboarding/verify-email', 'Verify your account'],
  ])(
    'keeps an unavailable hinted session at the %s entry [REQ-089]',
    async (_entry, path, heading) => {
      document.cookie = 'hansel_onboarding_csrf=proof; path=/';
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'onboarding_session_expired' }), {
          status: 401,
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      render(<App path={path} />);

      expect(
        screen.getByRole('heading', { name: heading }),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledOnce();
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/onboarding/personal-profile',
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    },
  );

  it.each([
    ['onboarding', '/onboarding'],
    ['verification', '/onboarding/verify-email'],
  ])(
    'resumes an active session at About You from %s [REQ-089]',
    async (_entry, path) => {
      document.cookie = 'hansel_onboarding_csrf=proof; path=/';
      window.sessionStorage.setItem(
        'hansel.verificationEmail',
        'owner@example.com',
      );
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve(
              new Response(JSON.stringify({ profile: null }), { status: 200 }),
            ),
          ),
      );

      render(<App apiUrl="https://api.example" path={path} />);

      expect(
        await screen.findByRole('heading', { name: 'Tell us about you' }),
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe('/onboarding/about-you');
      expect(
        window.sessionStorage.getItem('hansel.verificationEmail'),
      ).toBeNull();
      window.history.replaceState({}, '', '/');
    },
  );

  it('does not resume after the session-aware page is closed [REQ-089]', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof; path=/';
    window.history.replaceState({}, '', '/onboarding');
    let resolveProbe: (response: Response) => void = () => undefined;
    const pendingProbe = new Promise<Response>((resolve) => {
      resolveProbe = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingProbe));

    const view = render(<App path="/onboarding" />);
    view.unmount();
    await act(async () => {
      resolveProbe(
        new Response(JSON.stringify({ profile: null }), { status: 200 }),
      );
      await pendingProbe;
    });

    expect(window.location.pathname).toBe('/onboarding');
    window.history.replaceState({}, '', '/');
  });

  it('routes the personal profile step', () => {
    render(<App path="/onboarding/about-you" />);
    expect(
      screen.getByRole('heading', { name: 'Tell us about you' }),
    ).toBeInTheDocument();
  });

  it('restores the accepted personal profile when returning to the step [REQ-011, REQ-014]', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          profile: {
            firstName: 'Nabin',
            lastName: 'Singh',
            jobTitle: 'manager',
            department: 'marketing_communications',
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<App apiUrl="https://api.example" path="/onboarding/about-you" />);

    await waitFor(() => {
      expect(screen.getByLabelText('First name')).toHaveValue('Nabin');
    });
    expect(screen.getByLabelText('Last name')).toHaveValue('Singh');
    expect(screen.getByLabelText('Job title')).toHaveValue('manager');
    expect(screen.getByLabelText('Department')).toHaveValue(
      'marketing_communications',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('logs out an expired personal-profile session and returns to onboarding [REQ-014, REQ-086]', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'onboarding_session_expired' }), {
          status: 401,
        }),
      ),
    );

    render(<App apiUrl="https://api.example" />);

    expect(
      await screen.findByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');
    expect(
      screen.queryByText('Your onboarding session is unavailable.'),
    ).not.toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });

  it('returns to onboarding when the personal-profile session expires before submission [REQ-086]', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ profile: null }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ error: 'onboarding_session_expired' }),
            { status: 401 },
          ),
        ),
    );

    render(<App apiUrl="https://api.example" />);
    for (const [label, value] of [
      ['First name', 'Nabin'],
      ['Last name', 'Singh'],
      ['Job title', 'manager'],
      ['Department', 'marketing_communications'],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      await screen.findByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');
    window.history.replaceState({}, '', '/');
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
          new Response(JSON.stringify({ profile: null }), { status: 200 }),
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
      expect(fetch).toHaveBeenCalledTimes(2);
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
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  it('submits personal details and advances to plan selection', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: null }), { status: 200 }),
      )
      .mockResolvedValueOnce(
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
      document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
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

  it('returns from plan selection and restores the accepted profile [REQ-011, REQ-014]', async () => {
    window.history.replaceState({}, '', '/onboarding/plan-selection');
    const profile = {
      firstName: 'Nabin',
      lastName: 'Singh',
      jobTitle: 'manager',
      department: 'marketing_communications',
    };
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
        new Response(JSON.stringify({ profile }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<App apiUrl="https://api.example" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Back' }));

    expect(
      await screen.findByRole('heading', { name: 'Tell us about you' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getByLabelText('First name')).toHaveValue('Nabin');
    });
    expect(window.location.pathname).toBe('/onboarding/about-you');
    window.history.replaceState({}, '', '/');
  });

  it('opens the configured Enterprise sales destination [onboarding-plan-selection REQ-008]', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof; path=/';
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

  it('routes an existing account to login without retaining a verification destination [REQ-088]', async () => {
    window.history.replaceState({}, '', '/onboarding');
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'stale@example.com',
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'login' }), { status: 202 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 401 })),
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
      await screen.findByRole('heading', { name: 'Log in to your account' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(
      window.sessionStorage.getItem('hansel.verificationEmail'),
    ).toBeNull();
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
