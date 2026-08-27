import { describe, expect, it, vi } from 'vitest';
import {
  createOnboardingAccount,
  getHealth,
  resendOnboardingVerification,
  verifyOnboardingEmail,
  submitPersonalProfile,
} from './api.js';

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
