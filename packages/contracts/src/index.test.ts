import { describe, expect, it } from 'vitest';
import {
  departmentOptions,
  jobTitleOptions,
  personalProfileRequestSchema,
  personalProfileResponseSchema,
  createOnboardingAccountRequestSchema,
  createOnboardingAccountResponseSchema,
  healthResponseSchema,
  resendOnboardingVerificationRequestSchema,
  resendOnboardingVerificationResponseSchema,
  verifyOnboardingEmailRequestSchema,
  verifyOnboardingEmailResponseSchema,
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

describe('email verification contract [REQ-006, REQ-007, REQ-084]', () => {
  it('accepts a normalized email and exactly six digits', () => {
    expect(
      verifyOnboardingEmailRequestSchema.parse({
        email: 'OWNER@Example.com',
        code: '012345',
      }),
    ).toEqual({ email: 'owner@example.com', code: '012345' });
    expect(
      verifyOnboardingEmailResponseSchema.parse({
        nextStep: 'personal-profile',
      }),
    ).toEqual({ nextStep: 'personal-profile' });
  });

  it.each(['12345', '1234567', '12345a'])('rejects invalid code %s', (code) => {
    expect(() =>
      verifyOnboardingEmailRequestSchema.parse({
        email: 'owner@example.com',
        code,
      }),
    ).toThrow();
  });

  it('defines the generic resend contract', () => {
    expect(
      resendOnboardingVerificationRequestSchema.parse({
        email: ' OWNER@Example.com ',
      }),
    ).toEqual({ email: 'owner@example.com' });
    expect(
      resendOnboardingVerificationResponseSchema.parse({ status: 'accepted' }),
    ).toEqual({ status: 'accepted' });
  });
});

describe('personal profile contract [REQ-037, REQ-040, REQ-086]', () => {
  it('publishes the approved catalogs and normalizes valid input', () => {
    expect(jobTitleOptions.map(({ id }) => id)).toEqual([
      'manager',
      'facility_manager',
      'project_manager',
      'in_house_designer',
      'signage_wayfinding_designer',
      'other',
    ]);
    expect(departmentOptions.map(({ id }) => id)).toEqual([
      'marketing_communications',
      'development_advancement',
      'facilities_management_campus_maintenance',
      'other',
    ]);
    expect(
      personalProfileRequestSchema.parse({
        firstName: ' Jose\u0301 ',
        lastName: ' Singh ',
        jobTitle: 'other',
        jobTitleOther: ' Founder ',
        department: 'marketing_communications',
      }),
    ).toEqual({
      firstName: 'José',
      lastName: 'Singh',
      jobTitle: 'other',
      jobTitleOther: 'Founder',
      department: 'marketing_communications',
    });
    expect(
      personalProfileResponseSchema.parse({ nextStep: 'plan-selection' }),
    ).toEqual({ nextStep: 'plan-selection' });
  });

  it('counts personal-profile limits by Unicode character [REQ-037, REQ-086]', () => {
    const base = {
      lastName: 'Singh',
      jobTitle: 'manager',
      department: 'marketing_communications',
    };
    expect(
      personalProfileRequestSchema.safeParse({
        ...base,
        firstName: '😀'.repeat(100),
      }).success,
    ).toBe(true);
    expect(
      personalProfileRequestSchema.safeParse({
        ...base,
        firstName: '😀'.repeat(101),
      }).success,
    ).toBe(false);
  });

  it.each([
    ['empty name', { firstName: '' }],
    ['unknown job title', { jobTitle: 'chief_executive' }],
    ['missing job-title other', { jobTitle: 'other' }],
    [
      'unexpected job-title other',
      { jobTitle: 'manager', jobTitleOther: 'Founder' },
    ],
    ['missing department other', { department: 'other' }],
    [
      'unexpected department other',
      { department: 'marketing_communications', departmentOther: 'Sales' },
    ],
  ])('rejects %s', (_name, override) => {
    expect(() =>
      personalProfileRequestSchema.parse({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
        ...override,
      }),
    ).toThrow();
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
