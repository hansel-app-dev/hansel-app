import { describe, expect, it } from 'vitest';
import {
  createOnboardingAccountRequestSchema,
  createOnboardingAccountResponseSchema,
  healthResponseSchema,
} from './index.js';

describe('healthResponseSchema [REQ-002]', () => {
  it('accepts the specified health response', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({
      status: 'ok',
    });
  });

  it('rejects values outside the contract', () => {
    expect(() => healthResponseSchema.parse({ status: 'down' })).toThrow();
  });
});

describe('createOnboardingAccount contract [REQ-005, REQ-023, REQ-049]', () => {
  it('accepts an email account with explicit versioned consent', () => {
    expect(
      createOnboardingAccountRequestSchema.parse({
        email: 'owner@example.com',
        password: 'Correct horse battery staple!7',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      }),
    ).toEqual({
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
      acceptsTerms: true,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
    expect(
      createOnboardingAccountResponseSchema.parse({
        nextStep: 'verify-email',
      }),
    ).toEqual({ nextStep: 'verify-email' });
  });

  it.each([
    { field: 'email', value: 'not-an-email' },
    { field: 'password', value: 'short password' },
    { field: 'password', value: 'correct horse battery staple!7' },
    { field: 'password', value: 'CORRECT HORSE BATTERY STAPLE!7' },
    { field: 'password', value: 'Correct horse battery staple!' },
    { field: 'password', value: 'Correct horse battery staple 7' },
    { field: 'password', value: '😀'.repeat(129) },
    { field: 'acceptsTerms', value: false },
    { field: 'termsVersion', value: '' },
    { field: 'privacyVersion', value: '' },
  ])('rejects invalid $field', ({ field, value }) => {
    const input: Record<string, unknown> = {
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
      acceptsTerms: true,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      [field]: value,
    };

    expect(() => createOnboardingAccountRequestSchema.parse(input)).toThrow();
  });
});
