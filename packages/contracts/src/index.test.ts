import { describe, expect, it } from 'vitest';
import {
  countryOptions,
  departmentOptions,
  jobTitleOptions,
  personalProfileRequestSchema,
  personalProfilePageResponseSchema,
  personalProfileResponseSchema,
  planSelectionPageResponseSchema,
  planSelectionRequestSchema,
  planSelectionResponseSchema,
  createOnboardingAccountRequestSchema,
  createOnboardingAccountResponseSchema,
  healthResponseSchema,
  industryOptions,
  organizationProfilePageResponseSchema,
  organizationProfileRequestSchema,
  organizationProfileResponseSchema,
  organizationSizeOptions,
  placeServiceOptions,
  resendOnboardingVerificationRequestSchema,
  resendOnboardingVerificationResponseSchema,
  verifyOnboardingEmailRequestSchema,
  verifyOnboardingEmailResponseSchema,
} from './index.js';

describe('organization profile contract [onboarding-organization-profile REQ-002..REQ-006, REQ-011, REQ-016]', () => {
  it('publishes complete stable catalogs and validates dependent choices', () => {
    expect(countryOptions).toHaveLength(249);
    expect(countryOptions).toContainEqual({ id: 'AU', label: 'Australia' });
    expect(organizationSizeOptions.map(({ id }) => id)).toEqual([
      'employees_1_10',
      'employees_11_50',
      'employees_51_100',
      'employees_over_100',
    ]);
    expect(industryOptions).toHaveLength(10);
    expect(placeServiceOptions.healthcare.map(({ id }) => id)).toEqual([
      'hospitals',
      'clinics',
      'aged_care_facilities',
    ]);
    expect(
      organizationProfileRequestSchema.parse({
        organizationName: ' Hanse\u0301l ',
        country: 'AU',
        industry: 'healthcare',
        placeService: 'clinics',
        organizationSize: 'employees_11_50',
        submissionKey: 'x'.repeat(43),
      }),
    ).toMatchObject({ organizationName: 'Hansél', country: 'AU' });
    expect(() =>
      organizationProfileRequestSchema.parse({
        organizationName: 'Hansel',
        country: 'AU',
        industry: 'education',
        placeService: 'clinics',
        organizationSize: 'employees_11_50',
        submissionKey: 'x'.repeat(43),
      }),
    ).toThrow();
  });

  it('validates the page and discovery response', () => {
    const page = {
      submissionKey: 'x'.repeat(43),
      countries: countryOptions,
      industries: industryOptions,
      placesByIndustry: placeServiceOptions,
      sizes: organizationSizeOptions,
    };
    expect(organizationProfilePageResponseSchema.parse(page)).toEqual(page);
    expect(
      organizationProfileResponseSchema.parse({ nextStep: 'discovery' }),
    ).toEqual({ nextStep: 'discovery' });
  });
});

describe('plan selection contract [onboarding-plan-selection REQ-002, REQ-006, REQ-007, REQ-008]', () => {
  it('accepts only stable selections and server-authored outcomes', () => {
    expect(
      planSelectionRequestSchema.parse({ priceId: 'plus_annual' }),
    ).toEqual({ priceId: 'plus_annual' });
    expect(
      planSelectionResponseSchema.parse({
        nextStep: 'organization-profile',
      }),
    ).toEqual({ nextStep: 'organization-profile' });
    expect(planSelectionResponseSchema.parse({ nextStep: 'payment' })).toEqual({
      nextStep: 'payment',
    });
    expect(
      planSelectionResponseSchema.parse({
        nextStep: 'contact-sales',
        destination: 'https://sales.example.com/hansel',
      }),
    ).toEqual({
      nextStep: 'contact-sales',
      destination: 'https://sales.example.com/hansel',
    });
    expect(() =>
      planSelectionResponseSchema.parse({
        nextStep: 'contact-sales',
        destination: 'http://sales.example.com/hansel',
      }),
    ).toThrow();
    expect(() =>
      planSelectionRequestSchema.parse({
        priceId: 'plus_annual',
        amount: 1,
      }),
    ).toThrow();
  });

  it('validates the complete server-authored plan page', () => {
    const plans = [
      ['free', 'free', null],
      ['plus_monthly', 'plus', 'monthly'],
      ['plus_annual', 'plus', 'annual'],
      ['pro_monthly', 'pro', 'monthly'],
      ['pro_annual', 'pro', 'annual'],
      ['enterprise', 'enterprise', null],
    ].map(([priceId, planId, billingInterval]) => ({
      priceId,
      planId,
      displayName: String(planId),
      description: 'Dummy description',
      features: ['Dummy one', 'Dummy two', 'Dummy three'],
      billingInterval,
      currency: 'USD',
      amountMinor: priceId === 'enterprise' ? null : 0,
      monthlyEquivalentMinor: priceId === 'enterprise' ? null : 0,
      additionalSiteAmountMinor: null,
      paymentRequired: String(planId) === 'plus' || String(planId) === 'pro',
      maximumSites: priceId === 'free' ? 1 : null,
      contactSales: priceId === 'enterprise',
    }));
    expect(
      planSelectionPageResponseSchema.parse({
        firstName: 'Nabin',
        selectedInterval: 'annual',
        selectedPriceId: null,
        plans,
      }),
    ).toMatchObject({ firstName: 'Nabin', plans });
  });
});

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
    expect(
      personalProfilePageResponseSchema.parse({
        profile: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      }),
    ).toEqual({
      profile: {
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      },
    });
    expect(personalProfilePageResponseSchema.parse({ profile: null })).toEqual({
      profile: null,
    });
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
