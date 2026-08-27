import { describe, expect, it, vi } from 'vitest';
import {
  createOnboardingAccount,
  getHealth,
  resendOnboardingVerification,
  loadPlanSelection,
  selectOnboardingPlan,
  verifyOnboardingEmail,
  submitPersonalProfile,
} from './api.js';

describe('plan selection API [onboarding-plan-selection REQ-006, REQ-007]', () => {
  const plan = (
    priceId:
      | 'free'
      | 'plus_monthly'
      | 'plus_annual'
      | 'pro_monthly'
      | 'pro_annual'
      | 'enterprise',
  ) => ({
    priceId,
    planId:
      priceId === 'free'
        ? ('free' as const)
        : priceId.startsWith('plus')
          ? ('plus' as const)
          : priceId.startsWith('pro')
            ? ('pro' as const)
            : ('enterprise' as const),
    displayName: 'Plan',
    description: 'Description',
    features: ['Feature one', 'Feature two', 'Feature three'],
    billingInterval: priceId.endsWith('monthly')
      ? ('monthly' as const)
      : priceId.endsWith('annual')
        ? ('annual' as const)
        : null,
    currency: 'USD' as const,
    amountMinor: priceId === 'enterprise' ? null : 0,
    monthlyEquivalentMinor: priceId === 'enterprise' ? null : 0,
    additionalSiteAmountMinor: null,
    paymentRequired: priceId !== 'free' && priceId !== 'enterprise',
    maximumSites: priceId === 'free' ? 1 : null,
    contactSales: priceId === 'enterprise',
  });
  const page = {
    firstName: 'Nabin',
    selectedInterval: 'annual' as const,
    selectedPriceId: null,
    plans: (
      [
        'free',
        'plus_monthly',
        'plus_annual',
        'pro_monthly',
        'pro_annual',
        'enterprise',
      ] as const
    ).map(plan),
  };

  it('loads private plan state and submits a CSRF-protected selection', async () => {
    document.cookie = 'hansel_onboarding_csrf=proof%20value';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextStep: 'payment' }), { status: 200 }),
      );
    await expect(
      loadPlanSelection('https://api.example', fetcher),
    ).resolves.toEqual(page);
    await expect(
      selectOnboardingPlan('plus_annual', 'https://api.example', fetcher),
    ).resolves.toEqual({ nextStep: 'payment' });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://api.example/api/onboarding/plan-selection',
      { credentials: 'include' },
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'https://api.example/api/onboarding/plan-selection',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'x-hansel-csrf': 'proof value' }),
        body: JSON.stringify({ priceId: 'plus_annual' }),
      }),
    );
  });

  it('maps load, submit, and missing-CSRF failures to stable errors', async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(loadPlanSelection('', failed)).rejects.toThrow(
      'plan_selection_load_failed',
    );
    document.cookie = 'hansel_onboarding_csrf=proof';
    await expect(selectOnboardingPlan('free', '', failed)).rejects.toThrow(
      'plan_selection_failed',
    );
    document.cookie = 'hansel_onboarding_csrf=; Max-Age=0';
    const unused = vi.fn<typeof fetch>();
    await expect(selectOnboardingPlan('free', '', unused)).rejects.toThrow(
      'csrf_proof_missing',
    );
    expect(unused).not.toHaveBeenCalled();
  });
});

describe('getHealth [REQ-002]', () => {
  it('parses a successful response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
      );
    await expect(getHealth('https://api.example', fetcher)).resolves.toEqual({
      status: 'ok',
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/health');
  });

  it('rejects an unsuccessful response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(getHealth('', fetcher)).rejects.toThrow(
      'Health request failed with 503',
    );
  });
});

describe('personal profile API [REQ-086]', () => {
  const input = {
    firstName: 'Nabin',
    lastName: 'Singh',
    jobTitle: 'manager' as const,
    department: 'marketing_communications' as const,
  };
  it('posts the profile with the continuation cookie', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ nextStep: 'plan-selection' }), {
        status: 200,
      }),
    );
    await expect(
      submitPersonalProfile(input, 'https://api.example', fetcher),
    ).resolves.toEqual({ nextStep: 'plan-selection' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-hansel-csrf': 'csrf-proof',
        },
        body: JSON.stringify(input),
      },
    );
  });
  it('maps unsuccessful responses to a stable error', async () => {
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 409 }));
    await expect(submitPersonalProfile(input, '', fetcher)).rejects.toThrow(
      'personal_profile_failed',
    );
  });
  it('does not send a profile without CSRF proof', async () => {
    document.cookie = 'hansel_onboarding_csrf=; Max-Age=0';
    const fetcher = vi.fn<typeof fetch>();
    await expect(submitPersonalProfile(input, '', fetcher)).rejects.toThrow(
      'csrf_proof_missing',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('verification API [REQ-006, REQ-007]', () => {
  it('posts verify and resend contracts', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ nextStep: 'personal-profile' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      );
    await expect(
      verifyOnboardingEmail(
        { email: 'owner@example.com', code: '123456' },
        '',
        fetcher,
      ),
    ).resolves.toEqual({ nextStep: 'personal-profile' });
    await expect(
      resendOnboardingVerification({ email: 'owner@example.com' }, '', fetcher),
    ).resolves.toEqual({ status: 'accepted' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('maps failed verify and resend transports to stable errors', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 400 }));
    await expect(
      verifyOnboardingEmail(
        { email: 'owner@example.com', code: '123456' },
        '',
        fetcher,
      ),
    ).rejects.toThrow('verification_failed');
    await expect(
      resendOnboardingVerification({ email: 'owner@example.com' }, '', fetcher),
    ).rejects.toThrow('resend_failed');
  });
});

describe('createOnboardingAccount [REQ-005, REQ-049]', () => {
  it('posts and parses the shared onboarding contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ nextStep: 'verify-email' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const input = {
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
      acceptsTerms: true as const,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    };

    await expect(
      createOnboardingAccount(input, 'https://api.example', fetcher),
    ).resolves.toEqual({ nextStep: 'verify-email' });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/accounts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
  });

  it('rejects an unsuccessful account request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 400 }));

    await expect(
      createOnboardingAccount(
        {
          email: 'owner@example.com',
          password: 'Correct horse battery staple!7',
          acceptsTerms: true,
          termsVersion: '2026-08-27',
          privacyVersion: '2026-08-27',
        },
        '',
        fetcher,
      ),
    ).rejects.toThrow('Account request failed with 400');
  });
});
