import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { VerificationFailedError } from './onboarding/verify-email.js';
import { PersonalProfileTransitionError } from './onboarding/personal-profile.js';
import { PlanSelectionTransitionError } from './onboarding/plan-selection.js';
import { loadPlanCatalog } from './onboarding/plan-catalog.js';
import {
  OrganizationProfileConflictError,
  OrganizationProfileTransitionError,
} from './onboarding/organization-profile.js';
import {
  DiscoveryConflictError,
  DiscoveryTransitionError,
} from './onboarding/discovery.js';
import {
  countryOptions,
  discoveryManagementOptions,
  industryOptions,
  organizationSizeOptions,
  placeServiceOptions,
} from '@hansel/contracts';

const planPage = {
  firstName: 'Nabin',
  selectedInterval: 'annual' as const,
  selectedPriceId: null,
  plans: loadPlanCatalog('test').entries.map(
    ({
      active: _active,
      selfService: _selfService,
      displayOrder: _order,
      stripePriceLookupKey: _key,
      ...plan
    }) => plan,
  ),
};

const app = createApp({ allowedOrigin: 'https://app.example.com' });

describe('dashboard routes [dashboard-home REQ-006, REQ-007, REQ-010..REQ-013]', () => {
  it('logs out from a trusted origin and clears both application cookies [dashboard-logout REQ-004..REQ-007]', async () => {
    const dashboard = {
      load: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', dashboardEnabled: true },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .post('/api/dashboard/logout')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', 'hansel_access=access; hansel_refresh=refresh')
      .expect(204);

    expect(dashboard.logout).toHaveBeenCalledWith({
      accessCredential: 'access',
      refreshCredential: 'refresh',
    });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^hansel_access=;.*Path=\/;.*HttpOnly;.*Secure;.*SameSite=Lax$/,
        ),
        expect.stringMatching(
          /^hansel_refresh=;.*Path=\/api\/dashboard;.*HttpOnly;.*Secure;.*SameSite=Lax$/,
        ),
      ]),
    );
  });

  it('rejects untrusted logout before session access and honors the dashboard flag [dashboard-logout REQ-006]', async () => {
    const dashboard = { load: vi.fn(), logout: vi.fn() };
    const enabled = createApp(
      { allowedOrigin: 'https://app.example.com', dashboardEnabled: true },
      undefined,
      undefined,
      dashboard,
    );
    for (const origin of [undefined, 'null', 'https://attacker.example']) {
      let call = request(enabled).post('/api/dashboard/logout');
      if (origin) call = call.set('Origin', origin);
      const response = await call.expect(403, { error: 'forbidden' });
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(dashboard.logout).not.toHaveBeenCalled();

    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com', dashboardEnabled: false },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .post('/api/dashboard/logout')
      .set('Origin', 'https://app.example.com')
      .expect(404, { error: 'not_found' });
    expect(dashboard.logout).not.toHaveBeenCalled();
  });

  it('keeps cookies when logout persistence is unavailable [dashboard-logout REQ-008]', async () => {
    const dashboard = {
      load: vi.fn(),
      logout: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'http://localhost:5173' },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .post('/api/dashboard/logout')
      .set('Origin', 'http://localhost:5173')
      .expect(503, { error: 'logout_unavailable' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('returns only the private authenticated viewer DTO', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      }),
      logout: vi.fn(),
      recordEvent: vi.fn(),
    };
    const response = await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          dashboardEnabled: true,
        },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .set('Cookie', 'hansel_access=access; hansel_refresh=refresh')
      .expect(200, {
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
      });

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('Cookie');
    expect(dashboard.load).toHaveBeenCalledWith({
      accessCredential: 'access',
      refreshCredential: 'refresh',
    });
  });

  it('sets rotated credentials while keeping them out of the response', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue({
        viewer: {
          displayName: 'Nabin Singh',
          initials: 'NS',
          roleLabel: 'Owner',
        },
        applicationSession: {
          accessCredential: 'new-access',
          refreshCredential: 'new-refresh',
        },
      }),
      logout: vi.fn(),
    };
    const response = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .set('Cookie', 'hansel_refresh=refresh')
      .expect(200);

    expect(response.body).toEqual({
      viewer: {
        displayName: 'Nabin Singh',
        initials: 'NS',
        roleLabel: 'Owner',
      },
    });
    expect(String(response.headers['set-cookie'])).toContain(
      'hansel_access=new-access',
    );
    expect(String(response.headers['set-cookie'])).toContain(
      'hansel_refresh=new-refresh',
    );
  });

  it('fails closed, clears credentials, and honors the rollout flag', async () => {
    const dashboard = {
      load: vi.fn().mockResolvedValue(null),
      logout: vi.fn(),
      recordEvent: vi.fn(),
    };
    const enabled = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      undefined,
      dashboard,
    );
    const rejected = await request(enabled)
      .get('/api/dashboard')
      .expect(401, { error: 'authentication_required' });
    expect(dashboard.load).toHaveBeenCalledWith({
      accessCredential: null,
      refreshCredential: null,
    });
    expect(dashboard.recordEvent).toHaveBeenCalledWith(
      'dashboard_authentication_rejected',
    );
    expect(String(rejected.headers['set-cookie'])).toContain('hansel_access=;');

    await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          dashboardEnabled: false,
        },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .expect(404, { error: 'not_found' });
  });

  it('records and delegates unexpected dashboard failures', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const dashboard = {
      load: vi.fn().mockRejectedValue(new Error('database unavailable')),
      logout: vi.fn(),
      recordEvent: vi.fn(),
    };
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        undefined,
        dashboard,
      ),
    )
      .get('/api/dashboard')
      .expect(500);
    expect(dashboard.recordEvent).toHaveBeenCalledWith(
      'dashboard_unexpected_failure',
    );
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});

describe('discovery routes [onboarding-discovery REQ-001, REQ-005..REQ-013, REQ-018]', () => {
  const page = {
    submissionKey: 'x'.repeat(43),
    methods: [...discoveryManagementOptions],
  };
  const input = {
    action: 'submit',
    currentManagement: 'pdf',
    challenges: 'Version control',
    submissionKey: page.submissionKey,
  };
  const module = (overrides: Record<string, unknown> = {}) => ({
    createAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
    loadDiscovery: vi.fn().mockResolvedValue(page),
    completeDiscovery: vi.fn().mockResolvedValue({
      nextStep: 'dashboard',
      destination: '/dashboard',
      applicationSession: {
        accessCredential: 'application-access',
        refreshCredential: 'application-refresh',
      },
    }),
    recordDiscoveryEvent: vi.fn(),
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}, enabled = true) =>
    createApp(
      {
        allowedOrigin: 'https://app.example.com',
        discoveryEnabled: enabled,
      },
      undefined,
      module(overrides),
    );
  const cookies = 'hansel_onboarding=credential; hansel_onboarding_csrf=proof';

  it('loads private JSON and exact progressive Figma wording', async () => {
    const json = await request(create())
      .get('/api/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(json.body).toEqual(page);
    expect(json.headers['cache-control']).toBe('private, no-store');
    const html = await request(create())
      .get('/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.text).toContain('Could you tell us more?');
    expect(html.text).toContain('How do you manage your signage currently?');
    expect(html.text).toContain('Biggest challenges your team faces');
    expect(html.text).toContain('Skip for now');
    expect(html.text).toContain('href="/onboarding/organization-profile"');
  });

  it('submits JSON and submit/skip native forms to the server dashboard', async () => {
    const feature = module();
    const json = await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        feature,
      ),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(200, { nextStep: 'dashboard', destination: '/dashboard' });
    expect(String(json.headers['set-cookie'])).toContain('hansel_onboarding=;');
    expect(String(json.headers['set-cookie'])).toContain(
      'hansel_access=application-access',
    );
    expect(String(json.headers['set-cookie'])).toContain(
      'hansel_refresh=application-refresh',
    );
    expect(feature.completeDiscovery).toHaveBeenCalledWith(
      'credential',
      'proof',
      input,
    );

    await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send(input)
      .expect(303)
      .expect('Location', '/dashboard');
    const skipFeature = module();
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        skipFeature,
      ),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, action: 'skip' })
      .expect(303)
      .expect('Location', '/dashboard');
    expect(skipFeature.completeDiscovery).toHaveBeenCalledWith(
      'credential',
      'proof',
      { action: 'skip', submissionKey: page.submissionKey },
    );
  });

  it('rejects disabled, missing, invalid, forged, conflict, and stale requests', async () => {
    await request(create({}, false))
      .get('/api/onboarding/discovery')
      .expect(404);
    await request(create({}, false)).get('/onboarding/discovery').expect(404);
    await request(create({}, false))
      .post('/api/onboarding/discovery')
      .send(input)
      .expect(404);
    await request(create()).get('/api/onboarding/discovery').expect(401);
    await request(create())
      .get('/onboarding/discovery')
      .expect(303)
      .expect('Location', '/onboarding');
    await request(create())
      .post('/api/onboarding/discovery')
      .send({})
      .expect(400);
    await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookies)
      .send(input)
      .expect(401);
    await request(
      create({
        completeDiscovery: vi
          .fn()
          .mockRejectedValue(new DiscoveryConflictError()),
      }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(409, { error: 'discovery_conflict' });
    await request(
      create({
        completeDiscovery: vi
          .fn()
          .mockRejectedValue(new DiscoveryTransitionError()),
      }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(409, { error: 'onboarding_transition_failed' });
  });

  it('redirects unavailable pages and renders progressive validation recovery', async () => {
    const unavailable = create({
      loadDiscovery: vi.fn().mockRejectedValue(new DiscoveryTransitionError()),
    });
    await request(unavailable)
      .get('/api/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(401);
    await request(unavailable)
      .get('/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(303)
      .expect('Location', '/onboarding');
    const recovery = await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: '' })
      .expect(400);
    expect(recovery.text).toContain('could not save your answers');
    expect(recovery.text).toContain('Version control');
    const otherRecovery = await request(create())
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: 'other' })
      .expect(400);
    expect(otherRecovery.text).toContain(
      'name="currentManagementOther" maxlength="100" required',
    );
  });

  it('uses safe progressive fallback and records validation and unexpected failures', async () => {
    const feature = module();
    await request(
      createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        feature,
      ),
    )
      .post('/api/onboarding/discovery')
      .send({})
      .expect(400);
    expect(feature.recordDiscoveryEvent).toHaveBeenCalledWith(
      'discovery_validation_rejected',
    );

    const fallback = await request(
      create({
        loadDiscovery: vi
          .fn()
          .mockRejectedValue(new DiscoveryTransitionError()),
      }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: '' })
      .expect(400);
    expect(fallback.text).toBe('We could not save your answers.');

    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error('database unavailable');
    await request(create({ loadDiscovery: vi.fn().mockRejectedValue(failure) }))
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, currentManagement: '' })
      .expect(500);
    await request(create({ loadDiscovery: vi.fn().mockRejectedValue(failure) }))
      .get('/api/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(create({ loadDiscovery: vi.fn().mockRejectedValue(failure) }))
      .get('/onboarding/discovery')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(
      create({ completeDiscovery: vi.fn().mockRejectedValue(failure) }),
    )
      .post('/api/onboarding/discovery')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(4);
    errorLog.mockRestore();
  });
});

describe('API [REQ-002, REQ-007]', () => {
  it('returns the specified health response', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a stable not-found response', async () => {
    await request(app).get('/missing').expect(404, { error: 'not_found' });
  });

  it('serves the progressive personal-profile form without JavaScript [REQ-054, REQ-086]', async () => {
    const response = await request(app)
      .get('/onboarding/about-you')
      .expect('Content-Type', /html/)
      .expect(200);
    expect(response.text).toContain('Tell us about you');
    expect(response.text).toContain('name="jobTitleOther"');
    expect(response.text).toContain('href="/assets/about-you-progressive.css"');
  });

  it('handles unexpected errors without leaking details', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      (router) => {
        router.get('/failure', () => {
          throw new Error('secret');
        });
      },
    );
    const response = await request(failingApp).get('/failure').expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });
});

describe('organization-profile routes [onboarding-organization-profile REQ-001, REQ-006, REQ-007, REQ-011, REQ-012, REQ-018]', () => {
  const page = {
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
  };
  const input = {
    organizationName: 'Hansel',
    country: 'AU',
    industry: 'healthcare',
    placeService: 'clinics',
    organizationSize: 'employees_11_50',
    submissionKey: page.submissionKey,
  };
  const module = (overrides: Record<string, unknown> = {}) => ({
    createAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
    load: vi.fn().mockResolvedValue(planPage),
    select: vi.fn(),
    loadOrganizationProfile: vi.fn().mockResolvedValue(page),
    submitOrganizationProfile: vi.fn().mockResolvedValue({
      nextStep: 'discovery',
      onboardingCredential: 'next',
      csrfProof: 'next-proof',
    }),
    recordOrganizationProfileEvent: vi.fn(),
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}, enabled = true) =>
    createApp(
      {
        allowedOrigin: 'https://app.example.com',
        organizationProfileEnabled: enabled,
      },
      undefined,
      module(overrides),
    );

  it('loads JSON and progressive HTML privately', async () => {
    const json = await request(create())
      .get('/api/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(json.body).toEqual(page);
    expect(json.headers['cache-control']).toBe('private, no-store');
    const html = await request(create())
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.text).toContain('Now your organization');
    expect(html.text).toContain('Industry or sector');
    expect(html.text).not.toContain('>Back<');
  });

  it('prefills the saved organization profile on an authorized Back visit', async () => {
    const savedPage = {
      ...page,
      profile: {
        organizationName: 'Hansel saved',
        country: 'AU',
        industry: 'healthcare',
        placeService: 'clinics',
        organizationSize: 'employees_11_50',
      },
    };
    const html = await request(
      create({ loadOrganizationProfile: vi.fn().mockResolvedValue(savedPage) }),
    )
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.text).toContain('value="Hansel saved"');
    expect(html.text).toContain('<option value="AU" selected>');
    expect(html.text).toContain('<option value="healthcare" selected>');
    expect(html.text).toContain(
      '<option value="clinics" data-industry="healthcare" selected>',
    );
    expect(html.text).toContain('<option value="employees_11_50" selected>');
  });

  it('submits JSON and native forms with rotated cookies', async () => {
    const cookies =
      'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
    const json = await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(200, { nextStep: 'discovery' });
    expect(String(json.headers['set-cookie'])).toContain(
      'hansel_onboarding=next',
    );
    await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send(input)
      .expect(303)
      .expect('Location', '/onboarding/discovery');
  });

  it('rejects disabled, missing, invalid, conflict, and stale requests safely', async () => {
    await request(create({}, false))
      .get('/api/onboarding/organization-profile')
      .expect(404);
    await request(create({}, false))
      .get('/onboarding/organization-profile')
      .expect(404);
    await request(create({}, false))
      .post('/api/onboarding/organization-profile')
      .send(input)
      .expect(404);
    await request(create())
      .get('/api/onboarding/organization-profile')
      .expect(401);
    await request(create()).get('/onboarding/organization-profile').expect(401);
    await request(create())
      .post('/api/onboarding/organization-profile')
      .send({})
      .expect(400);
    await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://evil.example')
      .send(input)
      .expect(401);
    await request(
      create({
        submitOrganizationProfile: vi
          .fn()
          .mockRejectedValue(new OrganizationProfileConflictError()),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .send(input)
      .expect(409, { error: 'organization_profile_conflict' });
    await request(
      create({
        submitOrganizationProfile: vi
          .fn()
          .mockRejectedValue(new OrganizationProfileTransitionError()),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .send(input)
      .expect(409, { error: 'onboarding_transition_failed' });
  });

  it('maps unavailable reads and progressive validation recovery', async () => {
    const unavailable = create({
      loadOrganizationProfile: vi
        .fn()
        .mockRejectedValue(new OrganizationProfileTransitionError()),
    });
    await request(unavailable)
      .get('/api/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409);
    await request(unavailable)
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409);
    const recovery = await request(create())
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ ...input, organizationName: '' })
      .expect(400);
    expect(recovery.text).toContain('could not save your organization');
  });

  it('records validation rejection without profile data', async () => {
    const feature = module();
    await request(
      createApp(
        {
          allowedOrigin: 'https://app.example.com',
          organizationProfileEnabled: true,
        },
        undefined,
        feature,
      ),
    )
      .post('/api/onboarding/organization-profile')
      .send({})
      .expect(400);
    expect(feature.recordOrganizationProfileEvent).toHaveBeenCalledWith(
      'organization_profile_validation_rejected',
    );
  });

  it('uses safe progressive fallbacks and preserves unexpected failures', async () => {
    const cookies =
      'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
    const unavailable = await request(
      create({
        loadOrganizationProfile: vi
          .fn()
          .mockRejectedValue(new OrganizationProfileTransitionError()),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, organizationName: '' })
      .expect(400);
    expect(unavailable.text).toBe('We could not save your organization.');

    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const failure = new Error('database unavailable');
    await request(
      create({ loadOrganizationProfile: vi.fn().mockRejectedValue(failure) }),
    )
      .get('/api/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(
      create({ loadOrganizationProfile: vi.fn().mockRejectedValue(failure) }),
    )
      .get('/onboarding/organization-profile')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(
      create({
        loadOrganizationProfile: vi.fn().mockRejectedValue(failure),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ ...input, organizationName: '' })
      .expect(500);
    await request(
      create({
        submitOrganizationProfile: vi.fn().mockRejectedValue(failure),
      }),
    )
      .post('/api/onboarding/organization-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set('Cookie', cookies)
      .send(input)
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(4);
    errorLog.mockRestore();
  });
});

describe('onboarding account route [REQ-005, REQ-023, REQ-049]', () => {
  const verification = {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
  };
  it('accepts a valid account request through the onboarding interface', async () => {
    const createAccount = vi
      .fn()
      .mockResolvedValue({ nextStep: 'verify-email' as const });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      { createAccount, ...verification },
    );

    await request(onboardingApp)
      .post('/api/onboarding/accounts')
      .send({
        email: 'OWNER@Example.com',
        password: 'Correct horse battery staple!7',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      })
      .expect(202, { nextStep: 'verify-email' });

    expect(createAccount).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'Correct horse battery staple!7',
      acceptsTerms: true,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
  });

  it('rejects invalid account input without invoking onboarding', async () => {
    const createAccount = vi.fn();
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      { createAccount, ...verification },
    );

    await request(onboardingApp)
      .post('/api/onboarding/accounts')
      .send({
        email: 'owner@example.com',
        password: 'too short',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      })
      .expect(400, { error: 'invalid_request' });

    expect(createAccount).not.toHaveBeenCalled();
  });

  it('verifies a valid code and accepts generic resend requests', async () => {
    const onboarding = {
      createAccount: vi.fn(),
      verifyEmail: vi.fn().mockResolvedValue({
        nextStep: 'personal-profile',
        onboardingCredential: 'opaque-credential',
        csrfProof: 'csrf-proof',
      }),
      resendVerification: vi.fn().mockResolvedValue({ status: 'accepted' }),
      submitPersonalProfile: vi.fn(),
    };
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      onboarding,
    );
    const verificationResponse = await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'OWNER@example.com', code: '123456' })
      .expect(200, { nextStep: 'personal-profile' });
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain(
      'hansel_onboarding=opaque-credential',
    );
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain(
      'HttpOnly',
    );
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain(
      'SameSite=Lax',
    );
    expect(verificationResponse.headers['set-cookie']?.[0]).toContain('Secure');
    expect(verificationResponse.headers['set-cookie']?.[1]).toContain(
      'hansel_onboarding_csrf=csrf-proof',
    );
    expect(verificationResponse.headers['set-cookie']?.[1]).toContain(
      'SameSite=Strict',
    );
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/resend')
      .send({ email: 'OWNER@example.com' })
      .expect(202, { status: 'accepted' });
  });

  it('rejects malformed verification and resend requests', async () => {
    const onboarding = {
      createAccount: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      submitPersonalProfile: vi.fn(),
    };
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      onboarding,
    );
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'bad', code: '12' })
      .expect(400, { error: 'invalid_request' });
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/resend')
      .send({ email: 'bad' })
      .expect(400, { error: 'invalid_request' });
  });

  it('returns the generic verification failure', async () => {
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn().mockRejectedValue(new VerificationFailedError()),
        resendVerification: vi.fn(),
        submitPersonalProfile: vi.fn(),
      },
    );
    await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'owner@example.com', code: '123456' })
      .expect(400, { error: 'verification_failed' });
  });

  it('passes unexpected verification failures to the global handler', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn().mockRejectedValue(new Error('secret')),
        resendVerification: vi.fn(),
        submitPersonalProfile: vi.fn(),
      },
    );
    const response = await request(onboardingApp)
      .post('/api/onboarding/email-verification/verify')
      .send({ email: 'owner@example.com', code: '123456' })
      .expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it('submits a validated profile using only the secure continuation cookie [REQ-054, REQ-086]', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockResolvedValue({ nextStep: 'plan-selection' });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );
    await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'csrf-proof')
      .set(
        'Cookie',
        'other=x; hansel_onboarding=opaque%2Dcredential; hansel_onboarding_csrf=csrf-proof',
      )
      .send({
        firstName: ' Nabin ',
        lastName: ' Singh ',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(200, { nextStep: 'plan-selection' });
    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque-credential',
      'csrf-proof',
      {
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      },
    );
  });

  it('accepts a same-origin progressive profile submission with an opaque Origin [REQ-054, REQ-086]', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockResolvedValue({ nextStep: 'plan-selection' });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );

    await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .type('form')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Host', 'app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
      )
      .send({
        firstName: 'Updated',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(303)
      .expect('Location', '/onboarding/plan-selection');

    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque',
      'csrf-proof',
      expect.objectContaining({ firstName: 'Updated' }),
    );
  });

  it('loads the accepted profile using only the secure continuation cookie [REQ-011, REQ-014, REQ-086]', async () => {
    const profile = {
      firstName: 'Nabin',
      lastName: 'Singh',
      jobTitle: 'manager' as const,
      department: 'marketing_communications' as const,
    };
    const loadPersonalProfile = vi.fn().mockResolvedValue({ profile });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        loadPersonalProfile,
        submitPersonalProfile: vi.fn(),
      },
    );

    const response = await request(onboardingApp)
      .get('/api/onboarding/personal-profile')
      .set('Cookie', 'other=x; hansel_onboarding=opaque%2Dcredential')
      .expect('Cache-Control', 'private, no-store')
      .expect(200, { profile });

    expect(response.body).toEqual({ profile });
    expect(loadPersonalProfile).toHaveBeenCalledWith('opaque-credential');
  });

  it('prefills the progressive profile form from accepted server state [REQ-011, REQ-054]', async () => {
    const loadPersonalProfile = vi
      .fn()
      .mockResolvedValueOnce({
        profile: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      })
      .mockResolvedValueOnce({ profile: null });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        loadPersonalProfile,
        submitPersonalProfile: vi.fn(),
      },
    );

    const response = await request(onboardingApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(200);

    expect(response.text).toContain('value="Nabin"');
    expect(response.text).toContain('value="manager" selected');
    await request(onboardingApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(200, /name="firstName"[^>]+value=""/);
  });

  it('rejects unavailable profile reads without exposing continuation details [REQ-086]', async () => {
    const module = (loadPersonalProfile: ReturnType<typeof vi.fn>) => ({
      createAccount: vi.fn(),
      verifyEmail: vi.fn(),
      resendVerification: vi.fn(),
      loadPersonalProfile,
      submitPersonalProfile: vi.fn(),
    });
    const missingCredential = vi.fn();
    const missingCredentialApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(missingCredential),
    );
    const expiredApi = await request(missingCredentialApp)
      .get('/api/onboarding/personal-profile')
      .expect(401, { error: 'onboarding_session_expired' });
    expect(expiredApi.headers['set-cookie']).toHaveLength(2);
    const expiredPage = await request(missingCredentialApp)
      .get('/onboarding/about-you')
      .expect('Location', '/onboarding')
      .expect(303);
    const expiredCookies = expiredPage.headers['set-cookie'] ?? [];
    expect(expiredCookies).toHaveLength(2);
    expect(expiredCookies[0]).toMatch(/^hansel_onboarding=;/);
    expect(expiredCookies[1]).toMatch(/^hansel_onboarding_csrf=;/);
    expect(missingCredential).not.toHaveBeenCalled();

    const staleApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(vi.fn().mockRejectedValue(new PersonalProfileTransitionError())),
    );
    const staleApi = await request(staleApp)
      .get('/api/onboarding/personal-profile')
      .set('Cookie', 'hansel_onboarding=stale')
      .expect(401, { error: 'onboarding_session_expired' });
    expect(staleApi.headers['set-cookie']).toHaveLength(2);
    const stalePage = await request(staleApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=stale')
      .expect('Location', '/onboarding')
      .expect(303);
    expect(stalePage.headers['set-cookie']).toHaveLength(2);

    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const unexpectedApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(vi.fn().mockRejectedValue(new Error('secret'))),
    );
    const response = await request(unexpectedApp)
      .get('/api/onboarding/personal-profile')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await request(unexpectedApp)
      .get('/onboarding/about-you')
      .set('Cookie', 'hansel_onboarding=opaque')
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });

  it.each([
    [
      'missing cookie',
      'https://app.example.com',
      undefined,
      'onboarding_session_expired',
    ],
    [
      'wrong origin',
      'https://evil.example.com',
      'hansel_onboarding=opaque',
      'onboarding_transition_failed',
    ],
    [
      'mismatched CSRF proof',
      'https://app.example.com',
      'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
      'onboarding_transition_failed',
    ],
    [
      'malformed cookie',
      'https://app.example.com',
      'hansel_onboarding=%E0%A4%A',
      'onboarding_session_expired',
    ],
  ])(
    'rejects profile submission with %s',
    async (_name, origin, cookie, error) => {
      const submitPersonalProfile = vi.fn();
      const onboardingApp = createApp(
        { allowedOrigin: 'https://app.example.com' },
        undefined,
        {
          createAccount: vi.fn(),
          verifyEmail: vi.fn(),
          resendVerification: vi.fn(),
          submitPersonalProfile,
        },
      );
      const profileRequest = request(onboardingApp)
        .post('/api/onboarding/personal-profile')
        .set('Origin', origin);
      if (cookie) profileRequest.set('Cookie', cookie);
      const response = await profileRequest
        .send({
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        })
        .expect(401, { error });
      if (error === 'onboarding_session_expired')
        expect(response.headers['set-cookie']).toHaveLength(2);
      expect(submitPersonalProfile).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid data and logs out a rejected transition', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockRejectedValue(new PersonalProfileTransitionError());
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );
    const validRequest = () =>
      request(onboardingApp)
        .post('/api/onboarding/personal-profile')
        .set('Origin', 'https://app.example.com')
        .set('x-hansel-csrf', 'csrf-proof')
        .set(
          'Cookie',
          'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
        );
    await validRequest()
      .send({ firstName: '' })
      .expect(400, { error: 'invalid_request' });
    expect(submitPersonalProfile).not.toHaveBeenCalled();
    const expiredResponse = await validRequest()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(401, { error: 'onboarding_session_expired' });
    expect(expiredResponse.headers['set-cookie']).toHaveLength(2);
  });

  it('passes unexpected profile failures to the global handler', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile: vi.fn().mockRejectedValue(new Error('secret')),
      },
    );
    const response = await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'csrf-proof')
      .set(
        'Cookie',
        'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
      )
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(500);
    expect(response.body).toEqual({
      error: 'internal_error',
      correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(errorLog).toHaveBeenCalledOnce();
    errorLog.mockRestore();
  });

  it('supports native HTML form submission and recovery without JavaScript [REQ-054, REQ-086]', async () => {
    const submitPersonalProfile = vi
      .fn()
      .mockResolvedValue({ nextStep: 'plan-selection' });
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );
    const nativeForm = () =>
      request(onboardingApp)
        .post('/api/onboarding/personal-profile')
        .set('Origin', 'https://app.example.com')
        .set(
          'Cookie',
          'hansel_onboarding=opaque; hansel_onboarding_csrf=csrf-proof',
        )
        .type('form');
    await nativeForm()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect('Location', '/onboarding/plan-selection')
      .expect(303);
    const recovery = await nativeForm()
      .send({
        firstName: `A&<>"'`,
        lastName: '',
        jobTitle: 'other',
        jobTitleOther: 'Founder',
        department: 'other',
        departmentOther: 'Strategy',
      })
      .expect('Content-Type', /html/)
      .expect(400, /Review the form/);
    expect(recovery.text).toContain('value="A&amp;&lt;&gt;&quot;&#39;"');
    expect(recovery.text).toContain('value="other" selected');
    expect(recovery.text).toContain(
      'name="jobTitleOther" maxlength="100" required value="Founder"',
    );
    expect(recovery.text).toContain(
      'name="departmentOther" maxlength="100" required value="Strategy"',
    );
    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque',
      'csrf-proof',
      expect.objectContaining({ firstName: 'Nabin' }),
    );

    submitPersonalProfile.mockRejectedValueOnce(
      new PersonalProfileTransitionError(),
    );
    const expiredResponse = await nativeForm()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect('Location', '/onboarding')
      .expect(303);
    expect(expiredResponse.headers['set-cookie']).toHaveLength(2);
  });

  it('logs out an expired native profile submission and returns to onboarding [REQ-086]', async () => {
    const submitPersonalProfile = vi.fn();
    const onboardingApp = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      {
        createAccount: vi.fn(),
        verifyEmail: vi.fn(),
        resendVerification: vi.fn(),
        submitPersonalProfile,
      },
    );

    const response = await request(onboardingApp)
      .post('/api/onboarding/personal-profile')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect('Location', '/onboarding')
      .expect(303);

    expect(response.headers['set-cookie']).toHaveLength(2);
    expect(submitPersonalProfile).not.toHaveBeenCalled();
  });
});

describe('plan-selection routes [onboarding-plan-selection REQ-006, REQ-007, REQ-008, REQ-011, REQ-012, REQ-013]', () => {
  const module = (overrides: Record<string, unknown> = {}) => ({
    createAccount: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    submitPersonalProfile: vi.fn(),
    load: vi.fn().mockResolvedValue(planPage),
    select: vi.fn().mockResolvedValue({
      nextStep: 'payment',
      onboardingCredential: 'next-credential',
      csrfProof: 'next-proof',
    }),
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}) =>
    createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      module(overrides),
    );

  it('keeps every plan-selection route behind the rollout flag [onboarding-plan-selection REQ-018]', async () => {
    const app = createApp(
      { allowedOrigin: 'https://app.example.com', planSelectionEnabled: false },
      undefined,
      module(),
    );
    await request(app)
      .get('/api/onboarding/plan-selection')
      .expect(404, { error: 'not_found' });
    await request(app)
      .get('/onboarding/plan-selection')
      .expect(404, /Not found/);
    await request(app)
      .post('/api/onboarding/plan-selection')
      .send({ priceId: 'free' })
      .expect(404, { error: 'not_found' });
  });

  it('loads private JSON and progressive HTML with annual and monthly views', async () => {
    const onboarding = module();
    const app = createApp(
      { allowedOrigin: 'https://app.example.com' },
      undefined,
      onboarding,
    );
    const json = await request(app)
      .get('/api/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(json.headers['cache-control']).toBe('private, no-store');
    expect(json.body).toEqual(planPage);
    const html = await request(app)
      .get('/onboarding/plan-selection?interval=monthly')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200);
    expect(html.headers['cache-control']).toBe('private, no-store');
    expect(html.text).toContain('Welcome Nabin, choose your plan');
    expect(html.text).toContain('value="plus_monthly"');
    expect(html.text).not.toContain('value="plus_annual"');
    expect(html.text).toContain('Or try it for free');
    await request(app)
      .get('/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(200, /value="plus_annual"/);
  });

  it('rejects missing or invalid read continuations generically', async () => {
    await request(create())
      .get('/api/onboarding/plan-selection')
      .expect(401, { error: 'onboarding_transition_failed' });
    await request(create())
      .get('/onboarding/plan-selection')
      .expect(401, /session unavailable/i);
    const rejected = create({
      load: vi.fn().mockRejectedValue(new PlanSelectionTransitionError()),
    });
    await request(rejected)
      .get('/api/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409, { error: 'onboarding_transition_failed' });
    await request(rejected)
      .get('/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(409, /session unavailable/i);
  });

  it('passes unexpected plan read failures to the global handler', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const app = create({
      load: vi.fn().mockRejectedValue(new Error('secret')),
    });
    await request(app)
      .get('/api/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    await request(app)
      .get('/onboarding/plan-selection')
      .set('Cookie', 'hansel_onboarding=credential')
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });

  it.each([
    ['plus_annual', { nextStep: 'payment' }, '/onboarding/payment'],
    [
      'free',
      { nextStep: 'organization-profile' },
      '/onboarding/organization-profile',
    ],
    [
      'enterprise',
      {
        nextStep: 'contact-sales',
        destination: 'https://sales.example.com/hansel',
      },
      'https://sales.example.com/hansel',
    ],
  ] as const)(
    'submits %s for JSON and native form clients',
    async (priceId, result, destination) => {
      const select = vi.fn().mockResolvedValue({
        ...result,
        onboardingCredential: 'next-credential',
        csrfProof: 'next-proof',
      });
      const app = create({ select });
      const cookies =
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
      const response = await request(app)
        .post('/api/onboarding/plan-selection')
        .set('Origin', 'https://app.example.com')
        .set('x-hansel-csrf', 'proof')
        .set('Cookie', cookies)
        .send({ priceId })
        .expect(200, result);
      expect(String(response.headers['set-cookie'])).toContain(
        'hansel_onboarding=next-credential',
      );
      await request(app)
        .post('/api/onboarding/plan-selection')
        .set('Origin', 'https://app.example.com')
        .set('Cookie', cookies)
        .type('form')
        .send({ priceId })
        .expect(303)
        .expect('Location', destination);
      expect(select).toHaveBeenCalledWith('credential', 'proof', { priceId });
    },
  );

  it('rejects malformed, unauthenticated, and rejected transitions while preserving the HTML form', async () => {
    const select = vi
      .fn()
      .mockRejectedValue(new PlanSelectionTransitionError());
    const app = create({ select });
    await request(app)
      .post('/api/onboarding/plan-selection')
      .send({ priceId: 'unknown' })
      .expect(400, { error: 'invalid_request' });
    await request(app)
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://evil.example.com')
      .send({ priceId: 'free' })
      .expect(401, { error: 'onboarding_transition_failed' });
    const recovery = await request(app)
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'plus_annual' })
      .expect(409);
    expect(recovery.text).toContain('We could not save your plan');
    expect(recovery.text).toContain('value="plus_annual"');
    expect(recovery.text).toContain(
      '<article class="plan" aria-current="true"><h2>Plus</h2>',
    );
  });

  it('accepts an opaque browser origin only for a same-origin native form', async () => {
    const cookies =
      'hansel_onboarding=credential; hansel_onboarding_csrf=proof';
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Host', 'app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(303);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Host', 'app.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(401);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'null')
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Host', 'evil.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(401);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://evil.example.com')
      .set('Cookie', cookies)
      .type('form')
      .send({ priceId: 'free' })
      .expect(401);
  });

  it('recovers native-form failures when state cannot be reloaded and propagates unexpected selections', async () => {
    const errorLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const unavailable = create({
      load: vi.fn().mockRejectedValue(new PlanSelectionTransitionError()),
      select: vi.fn().mockRejectedValue(new PlanSelectionTransitionError()),
    });
    await request(unavailable)
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'free' })
      .expect(409, /could not save your plan/i);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .type('form')
      .send({ priceId: 'unknown' })
      .expect(400, /could not save your plan/i);
    await request(create())
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'unknown' })
      .expect(400, /Welcome Nabin, choose your plan/);
    await request(
      create({ load: vi.fn().mockRejectedValue(new Error('load secret')) }),
    )
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .type('form')
      .send({ priceId: 'unknown' })
      .expect(500);
    await request(
      create({ select: vi.fn().mockRejectedValue(new Error('secret')) }),
    )
      .post('/api/onboarding/plan-selection')
      .set('Origin', 'https://app.example.com')
      .set('x-hansel-csrf', 'proof')
      .set(
        'Cookie',
        'hansel_onboarding=credential; hansel_onboarding_csrf=proof',
      )
      .send({ priceId: 'free' })
      .expect(500);
    expect(errorLog).toHaveBeenCalledTimes(2);
    errorLog.mockRestore();
  });
});
