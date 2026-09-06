import { describe, expect, it } from 'vitest';
import {
  countryOptions,
  departmentOptions,
  discoveryManagementOptions,
  discoveryPageResponseSchema,
  discoveryRequestSchema,
  discoveryResponseSchema,
  dashboardResponseSchema,
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
  loginRequestSchema,
  loginResponseSchema,
  passwordRecoveryRequestSchema,
  passwordRecoveryRequestResponseSchema,
  passwordResetRequestSchema,
  passwordResetResponseSchema,
  createSiteRequestSchema,
  legacyCreateSiteRequestSchema,
  createSiteResponseSchema,
  sitesPageResponseSchema,
  siteActivityPageResponseSchema,
  createSiteCommentRequestSchema,
} from './index.js';

describe('Site Activity contract [site-activity-feed-comments REQ-003, REQ-007..REQ-009]', () => {
  const actor = { displayName: 'Nabin Singh', initials: 'NS' };
  const base = {
    id: '00000000-0000-4000-8000-000000000050',
    actor,
    createdAt: '2026-09-06T00:00:00.000Z',
  };

  it('accepts strict action and comment items plus an opaque cursor', () => {
    expect(
      siteActivityPageResponseSchema.parse({
        items: [
          { ...base, kind: 'SIGN_CREATED', subjectLabel: 'RS.101' },
          { ...base, kind: 'SITE_COMMENT_ADDED', commentText: 'Looks good.' },
        ],
        nextCursor: 'opaque-cursor',
      }),
    ).toBeTruthy();
    expect(createSiteCommentRequestSchema.parse({ text: '  Hello  ' })).toEqual(
      { text: 'Hello' },
    );
  });

  it('rejects invalid kind shapes, unknown fields, and comment bounds', () => {
    expect(() =>
      siteActivityPageResponseSchema.parse({
        items: [{ ...base, kind: 'SITE_COMMENT_ADDED', subjectLabel: 'Site' }],
        nextCursor: null,
      }),
    ).toThrow();
    expect(() =>
      createSiteCommentRequestSchema.parse({ text: 'x', extra: true }),
    ).toThrow();
    expect(() =>
      createSiteCommentRequestSchema.parse({ text: '😀'.repeat(2_001) }),
    ).toThrow();
  });
});

describe('site creation contract [sites-add-new REQ-003, REQ-006..REQ-013]', () => {
  it('normalizes a strict Organization-scoped request and closed destination [sites-access-scope REQ-015]', () => {
    expect(
      createSiteRequestSchema.parse({
        name: '  Café West  ',
        accessScope: 'ORGANIZATION',
        organizationAccess: 'VIEW_COMMENT',
        idempotencyKey: 'a'.repeat(32),
      }),
    ).toEqual({
      name: 'Café West',
      accessScope: 'ORGANIZATION',
      organizationAccess: 'VIEW_COMMENT',
      idempotencyKey: 'a'.repeat(32),
    });

    expect(
      createSiteResponseSchema.parse({
        siteId: '7fced42f-e2e4-4c31-89db-f282bdaeea44',
        destination: '/sites/7fced42f-e2e4-4c31-89db-f282bdaeea44/activity',
      }),
    ).toEqual({
      siteId: '7fced42f-e2e4-4c31-89db-f282bdaeea44',
      destination: '/sites/7fced42f-e2e4-4c31-89db-f282bdaeea44/activity',
    });
  });

  it('accepts a Private request without Organization capability or assignments [sites-access-scope REQ-010, REQ-015]', () => {
    expect(
      createSiteRequestSchema.parse({
        name: 'Private site',
        accessScope: 'PRIVATE',
        idempotencyKey: 'b'.repeat(32),
      }),
    ).toEqual({
      name: 'Private site',
      accessScope: 'PRIVATE',
      idempotencyKey: 'b'.repeat(32),
    });
  });

  it('normalizes a People You Invite request with at least one assignment [sites-access-scope REQ-008, REQ-015]', () => {
    expect(
      createSiteRequestSchema.parse({
        name: 'Invite-only site',
        accessScope: 'PEOPLE_INVITED',
        assignments: [
          { email: ' ADMIN@EXAMPLE.COM ', role: 'ADMINISTRATOR' },
          { email: 'viewer@example.com', role: 'VIEWER' },
        ],
        idempotencyKey: 'c'.repeat(32),
      }),
    ).toEqual({
      name: 'Invite-only site',
      accessScope: 'PEOPLE_INVITED',
      assignments: [
        { email: 'admin@example.com', role: 'ADMINISTRATOR' },
        { email: 'viewer@example.com', role: 'VIEWER' },
      ],
      idempotencyKey: 'c'.repeat(32),
    });
  });

  it('accepts only the prior strict Organization shape on the bounded compatibility path [sites-access-scope REQ-021]', () => {
    expect(
      legacyCreateSiteRequestSchema.parse({
        name: 'Legacy site',
        organizationAccess: 'EDIT_MANAGE',
        assignments: [],
        idempotencyKey: 'd'.repeat(32),
      }),
    ).toEqual({
      name: 'Legacy site',
      organizationAccess: 'EDIT_MANAGE',
      assignments: [],
      idempotencyKey: 'd'.repeat(32),
    });
    expect(() =>
      legacyCreateSiteRequestSchema.parse({
        name: 'Not legacy',
        accessScope: 'PRIVATE',
        organizationAccess: 'VIEW_COMMENT',
        assignments: [],
        idempotencyKey: 'e'.repeat(32),
      }),
    ).toThrow();
  });

  it('publishes only bounded tenant creation context and enriched site summaries [sites-populated-state REQ-003, REQ-011, REQ-012, REQ-024]', () => {
    expect(
      sitesPageResponseSchema.parse({
        organizationName: 'Hansel',
        canCreateSite: true,
        canInviteMembers: true,
        creator: {
          email: 'owner@example.com',
          displayName: 'Owner',
          initials: 'O',
        },
        siteLimitReached: false,
        maximumSites: null,
        members: [
          {
            email: 'owner@example.com',
            displayName: 'Owner Example',
            initials: 'OE',
          },
        ],
        sites: [
          {
            id: '7fced42f-e2e4-4c31-89db-f282bdaeea44',
            name: 'Café West',
            createdAt: '2026-09-01T10:00:00.000Z',
            updatedAt: '2026-09-02T12:00:00.000Z',
            memberCount: 1,
            memberPreview: [{ displayName: 'Owner Example', initials: 'OE' }],
          },
        ],
      }),
    ).toMatchObject({ organizationName: 'Hansel', canCreateSite: true });
  });

  it.each([
    {
      createdAt: 'not-an-instant',
      updatedAt: '2026-09-02T12:00:00.000Z',
      memberCount: 0,
      memberPreview: [],
    },
    {
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
      memberCount: 0,
      memberPreview: [
        {
          displayName: 'Private Member',
          initials: 'PM',
          email: 'private@example.com',
        },
      ],
    },
    {
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T12:00:00.000Z',
      memberCount: 2,
      memberPreview: [
        { displayName: 'One', initials: 'O' },
        { displayName: 'Two', initials: 'T' },
        { displayName: 'Three', initials: 'TH' },
      ],
    },
  ])(
    'rejects unsafe or inconsistent populated-site metadata %# [sites-populated-state REQ-003, REQ-012, REQ-018]',
    (summary) => {
      expect(() =>
        sitesPageResponseSchema.parse({
          organizationName: 'Hansel',
          canCreateSite: true,
          canInviteMembers: true,
          creator: {
            email: 'owner@example.com',
            displayName: 'Owner',
            initials: 'O',
          },
          siteLimitReached: false,
          maximumSites: null,
          members: [],
          sites: [
            {
              id: '7fced42f-e2e4-4c31-89db-f282bdaeea44',
              name: 'Café West',
              ...summary,
            },
          ],
        }),
      ).toThrow();
    },
  );

  it.each([
    [
      'empty name',
      {
        name: '',
        accessScope: 'ORGANIZATION',
        organizationAccess: 'VIEW_COMMENT',
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'long name',
      {
        name: '😀'.repeat(101),
        accessScope: 'PRIVATE',
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'bad access',
      {
        name: 'Main site',
        accessScope: 'ORGANIZATION',
        organizationAccess: 'PUBLIC',
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'bad email',
      {
        name: 'Main site',
        accessScope: 'PEOPLE_INVITED',
        assignments: [{ email: 'not-email', role: 'VIEWER' }],
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'bad role',
      {
        name: 'Main site',
        accessScope: 'PEOPLE_INVITED',
        assignments: [{ email: 'user@example.com', role: 'OWNER' }],
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'empty invite list',
      {
        name: 'Main site',
        accessScope: 'PEOPLE_INVITED',
        assignments: [],
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'assignments on Organization',
      {
        name: 'Main site',
        accessScope: 'ORGANIZATION',
        organizationAccess: 'VIEW_COMMENT',
        assignments: [{ email: 'user@example.com', role: 'VIEWER' }],
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'Organization capability on Private',
      {
        name: 'Main site',
        accessScope: 'PRIVATE',
        organizationAccess: 'VIEW_COMMENT',
        idempotencyKey: 'a'.repeat(32),
      },
    ],
    [
      'short key',
      {
        name: 'Main site',
        accessScope: 'PRIVATE',
        idempotencyKey: 'short',
      },
    ],
  ])('rejects %s [sites-access-scope REQ-015]', (_name, input) => {
    expect(() => createSiteRequestSchema.parse(input)).toThrow();
  });
});

describe('password recovery request contract [password-recovery REQ-003, REQ-004]', () => {
  it('normalizes only an email and exposes one generic accepted response', () => {
    expect(
      passwordRecoveryRequestSchema.parse({ email: '  OWNER@Example.com ' }),
    ).toEqual({ email: 'owner@example.com' });
    expect(
      passwordRecoveryRequestResponseSchema.parse({ status: 'accepted' }),
    ).toEqual({ status: 'accepted' });
    expect(() =>
      passwordRecoveryRequestSchema.parse({
        email: 'owner@example.com',
        userId: 'caller-controlled',
      }),
    ).toThrow();
  });
});

describe('password reset contract [password-recovery REQ-009, REQ-010, REQ-016]', () => {
  it('accepts one normalized reset and only the closed login destination', () => {
    expect(
      passwordResetRequestSchema.parse({
        email: ' OWNER@Example.com ',
        code: '123456',
        password: 'Correct horse battery staple!7',
      }),
    ).toEqual({
      email: 'owner@example.com',
      code: '123456',
      password: 'Correct horse battery staple!7',
    });
    expect(
      passwordResetResponseSchema.parse({ destination: '/login' }),
    ).toEqual({ destination: '/login' });
    expect(() =>
      passwordResetResponseSchema.parse({ destination: '/dashboard' }),
    ).toThrow();
  });

  it.each([
    { code: '12345', password: 'Correct horse battery staple!7' },
    { code: '12345a', password: 'Correct horse battery staple!7' },
    { code: '123456', password: 'short!A1' },
    { code: '123456', password: 'correct horse battery staple!7' },
    { code: '123456', password: 'CORRECT HORSE BATTERY STAPLE!7' },
    { code: '123456', password: 'Correct horse battery staple!' },
    { code: '123456', password: 'Correct horse battery staple 7' },
  ])('rejects an invalid reset input', ({ code, password }) => {
    expect(() =>
      passwordResetRequestSchema.parse({
        email: 'owner@example.com',
        code,
        password,
      }),
    ).toThrow();
  });
});

describe('login contract [user-login REQ-003, REQ-004, REQ-020]', () => {
  it('normalizes credentials and accepts only server-owned destinations', () => {
    expect(
      loginRequestSchema.parse({
        email: '  OWNER@Example.com ',
        password: 'Correct horse battery staple!7',
      }),
    ).toEqual({
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
    });
    expect(loginResponseSchema.parse({ destination: '/dashboard' })).toEqual({
      destination: '/dashboard',
    });
    expect(() =>
      loginResponseSchema.parse({ destination: 'https://attacker.example' }),
    ).toThrow();
  });
});

describe('dashboard contract [dashboard-home REQ-005, REQ-007]', () => {
  const response = {
    viewer: {
      displayName: 'Nabin Singh',
      initials: 'NS',
      roleLabel: 'Owner',
    },
  };

  it('accepts only the private viewer display values', () => {
    expect(dashboardResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      dashboardResponseSchema.parse({
        ...response,
        tenantId: 'caller-controlled',
      }),
    ).toThrow();
  });
});

describe('discovery contract [onboarding-discovery REQ-002..REQ-010, REQ-017]', () => {
  const submissionKey = 'x'.repeat(43);

  it('publishes the approved methods and normalizes submitted answers', () => {
    expect(discoveryManagementOptions).toEqual([
      { id: 'pdf', label: 'PDF' },
      { id: 'spreadsheet', label: 'Spreadsheet' },
      { id: 'other', label: 'Other' },
    ]);
    expect(
      discoveryRequestSchema.parse({
        action: 'submit',
        currentManagement: 'other',
        currentManagementOther: '  Signag\u0065\u0301 platform  ',
        challenges: '   ',
        submissionKey,
      }),
    ).toEqual({
      action: 'submit',
      currentManagement: 'other',
      currentManagementOther: 'Signagé platform',
      submissionKey,
    });
    expect(
      discoveryRequestSchema.parse({
        action: 'submit',
        currentManagement: 'pdf',
        challenges: '  Version control  ',
        submissionKey,
      }),
    ).toEqual({
      action: 'submit',
      currentManagement: 'pdf',
      challenges: 'Version control',
      submissionKey,
    });
  });

  it('accepts a strict skip and server-owned dashboard response', () => {
    expect(
      discoveryRequestSchema.parse({ action: 'skip', submissionKey }),
    ).toEqual({ action: 'skip', submissionKey });
    expect(
      discoveryPageResponseSchema.parse({
        submissionKey,
        methods: discoveryManagementOptions,
      }),
    ).toEqual({ submissionKey, methods: discoveryManagementOptions });
    expect(
      discoveryResponseSchema.parse({
        nextStep: 'dashboard',
        destination: '/dashboard',
      }),
    ).toEqual({ nextStep: 'dashboard', destination: '/dashboard' });
  });

  it.each([
    [
      'missing Other explanation',
      { action: 'submit', currentManagement: 'other', submissionKey },
    ],
    [
      'unexpected Other explanation',
      {
        action: 'submit',
        currentManagement: 'pdf',
        currentManagementOther: 'Tool',
        submissionKey,
      },
    ],
    [
      'overlong Other explanation',
      {
        action: 'submit',
        currentManagement: 'other',
        currentManagementOther: '😀'.repeat(101),
        submissionKey,
      },
    ],
    [
      'overlong challenges',
      {
        action: 'submit',
        currentManagement: 'pdf',
        challenges: '😀'.repeat(1001),
        submissionKey,
      },
    ],
    [
      'answers on skip',
      {
        action: 'skip',
        currentManagement: 'pdf',
        submissionKey,
      },
    ],
  ])('rejects %s', (_name, input) => {
    expect(() => discoveryRequestSchema.parse(input)).toThrow();
  });
});

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
      organizationProfilePageResponseSchema.parse({
        ...page,
        profile: {
          organizationName: 'Hansel',
          country: 'AU',
          industry: 'healthcare',
          placeService: 'clinics',
          organizationSize: 'employees_11_50',
        },
      }).profile,
    ).toEqual({
      organizationName: 'Hansel',
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_11_50',
    });
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
    expect(() =>
      verifyOnboardingEmailResponseSchema.parse({
        nextStep: 'plan-selection',
      }),
    ).toThrow();
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
    expect(
      createOnboardingAccountResponseSchema.parse({ nextStep: 'login' }),
    ).toEqual({ nextStep: 'login' });
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
