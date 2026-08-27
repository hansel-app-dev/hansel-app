import { describe, expect, it, vi } from 'vitest';
import { createOnboardingAccount, getHealth } from './api.js';

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
