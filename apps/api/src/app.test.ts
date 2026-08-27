import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { VerificationFailedError } from './onboarding/verify-email.js';
import { PersonalProfileTransitionError } from './onboarding/personal-profile.js';

const app = createApp({ allowedOrigin: 'https://app.example.com' });

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

  it('submits a validated profile using only the secure continuation cookie', async () => {
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

  it.each([
    ['missing cookie', 'https://app.example.com', undefined],
    ['wrong origin', 'https://evil.example.com', 'hansel_onboarding=opaque'],
    [
      'malformed cookie',
      'https://app.example.com',
      'hansel_onboarding=%E0%A4%A',
    ],
  ])('rejects profile submission with %s', async (_name, origin, cookie) => {
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
    await profileRequest
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(401, { error: 'onboarding_transition_failed' });
    expect(submitPersonalProfile).not.toHaveBeenCalled();
  });

  it('returns a generic error for invalid data or a rejected transition', async () => {
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
    await validRequest()
      .send({
        firstName: 'Nabin',
        lastName: 'Singh',
        jobTitle: 'manager',
        department: 'marketing_communications',
      })
      .expect(409, { error: 'onboarding_transition_failed' });
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
    await nativeForm()
      .send({ firstName: '', jobTitleOther: '', departmentOther: '' })
      .expect('Content-Type', /html/)
      .expect(400, /Review the form/);
    expect(submitPersonalProfile).toHaveBeenCalledWith(
      'opaque',
      'csrf-proof',
      expect.objectContaining({ firstName: 'Nabin' }),
    );

    submitPersonalProfile.mockRejectedValueOnce(
      new PersonalProfileTransitionError(),
    );
    const recovery = await nativeForm()
      .send({
        firstName: `A&<>"'`,
        lastName: 'Singh',
        jobTitle: 'other',
        jobTitleOther: 'Founder',
        department: 'other',
        departmentOther: 'Strategy',
      })
      .expect(409);
    expect(recovery.text).toContain('value="A&amp;&lt;&gt;&quot;&#39;"');
    expect(recovery.text).toContain('value="other" selected');
    expect(recovery.text).toContain(
      'name="jobTitleOther" maxlength="100" required value="Founder"',
    );
    expect(recovery.text).toContain(
      'name="departmentOther" maxlength="100" required value="Strategy"',
    );
  });
});
